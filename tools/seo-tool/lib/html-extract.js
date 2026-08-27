// Fact extraction from an HTML string. Deliberately NOT a full HTML parser
// or DOM — this is a bounded set of regex-based extractors for the specific
// SEO-relevant tags this skill cares about (title, meta, link, headings,
// anchors, images, JSON-LD script blocks).
//
// This trades general correctness on arbitrary/malformed markup for zero
// dependencies. It handles realistic, reasonably-well-formed HTML (any
// attribute order, single/double-quoted or unquoted attribute values,
// mixed case tags) but is not a substitute for a browser or a real parser.
// See docs/tooling.md "Known limitations" before treating an absence of a
// tag as proof the tag truly isn't there on a page with unusual markup.
//
// This module only reads strings and returns data — it never writes
// anything back into the HTML it's given.

import { toAbsoluteUrl, isSameOrigin } from './url-utils.js';

const ENTITY_MAP = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
};

export function decodeEntities(str) {
  if (!str) return str;
  return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, ent) => {
    if (ent[0] === '#') {
      const isHex = ent[1] === 'x' || ent[1] === 'X';
      const code = parseInt(ent.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      if (Number.isNaN(code)) return match;
      try {
        return String.fromCodePoint(code);
      } catch {
        return match;
      }
    }
    const lower = ent.toLowerCase();
    return Object.prototype.hasOwnProperty.call(ENTITY_MAP, lower) ? ENTITY_MAP[lower] : match;
  });
}

export function stripTags(html) {
  return html.replace(/<[^>]*>/g, ' ');
}

export function collapseWhitespace(str) {
  return str.replace(/\s+/g, ' ').trim();
}

function cleanText(rawInnerHtml) {
  return collapseWhitespace(decodeEntities(stripTags(rawInnerHtml)));
}

/** Parse an HTML tag's attribute string into a lowercase-keyed map. */
export function parseAttributes(attrString) {
  const attrs = {};
  if (!attrString) return attrs;
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let m;
  while ((m = re.exec(attrString))) {
    const name = m[1].toLowerCase();
    const value = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
    attrs[name] = decodeEntities(value);
  }
  return attrs;
}

/** Find every occurrence of a void/self-describing tag (meta, link, img, base). */
export function findVoidTags(html, tagName) {
  const re = new RegExp(`<${tagName}\\b([^>]*)>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    out.push(parseAttributes(m[1]));
  }
  return out;
}

/** Find every occurrence of a tag with content (a, title, h1, script, html). */
export function findTagsWithContent(html, tagName) {
  const re = new RegExp(`<${tagName}\\b([^>]*)>([\\s\\S]*?)<\\/${tagName}\\s*>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(html))) {
    out.push({ attrs: parseAttributes(m[1]), innerHtml: m[2] });
  }
  return out;
}

export function extractTitle(html) {
  const matches = findTagsWithContent(html, 'title');
  if (matches.length === 0) return null;
  return cleanText(matches[0].innerHtml) || null;
}

export function extractMetaTags(html) {
  return findVoidTags(html, 'meta');
}

function findMeta(metaTags, key, value) {
  return metaTags.find((m) => (m[key] || '').toLowerCase() === value.toLowerCase());
}

export function extractMetaDescription(metaTags) {
  const tag = findMeta(metaTags, 'name', 'description');
  return tag && tag.content !== undefined ? tag.content : null;
}

export function extractRobotsMeta(metaTags) {
  const tag = findMeta(metaTags, 'name', 'robots');
  if (!tag || tag.content === undefined || tag.content === '') return [];
  return tag.content
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function extractXRobotsTag(headerValue) {
  if (!headerValue) return [];
  return headerValue
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function extractViewport(metaTags) {
  const tag = findMeta(metaTags, 'name', 'viewport');
  return tag ? tag.content || null : null;
}

/**
 * Extract every <link rel="canonical"> declaration on the page. Real search
 * engines only honor one canonical signal per page — a page with more than
 * one declaration creates real ambiguity about which target actually wins,
 * so that's surfaced as evidence here rather than silently discarded.
 *
 * Returns:
 *   canonical          - the FIRST declaration's href (in document order),
 *                         resolved to an absolute URL against `pageUrl` —
 *                         null if there's no canonical link, the tag has no
 *                         (or an empty) href, or the href doesn't resolve to
 *                         a navigable URL (see toAbsoluteUrl). A relative,
 *                         root-relative, or already-absolute href are all
 *                         handled the same way; a query string or fragment
 *                         present in the href is preserved as declared, not
 *                         stripped.
 *   canonicalRawHrefs  - every declaration's href, in document order, EXACTLY
 *                         as written in the markup (unresolved) — evidence
 *                         for canonicalCount/multipleCanonicals below, and
 *                         for seeing what a malformed first href actually
 *                         said even though `canonical` came back null. A
 *                         tag with no href attribute at all is recorded as
 *                         `null` in this list (not `undefined`), so its
 *                         position/count is still visible.
 *   canonicalCount     - total number of <link rel="canonical"> tags found.
 *   multipleCanonicals - true when canonicalCount > 1.
 *
 * `pageUrl` should be the page's actual final URL (post-redirect) — see the
 * same convention already used by extractLinks/extractImages below.
 */
export function extractCanonical(html, pageUrl) {
  const links = findVoidTags(html, 'link');
  const canonicalLinks = links.filter((l) => (l.rel || '').toLowerCase().split(/\s+/).includes('canonical'));
  const canonicalRawHrefs = canonicalLinks.map((l) => (l.href !== undefined ? l.href : null));
  const firstRaw = canonicalRawHrefs.length > 0 ? canonicalRawHrefs[0] : null;
  const canonical = firstRaw ? toAbsoluteUrl(firstRaw, pageUrl) : null;
  return {
    canonical,
    canonicalRawHrefs,
    canonicalCount: canonicalLinks.length,
    multipleCanonicals: canonicalLinks.length > 1,
  };
}

export function extractLangAttribute(html) {
  const htmlTag = html.match(/<html\b([^>]*)>/i);
  if (!htmlTag) return null;
  const attrs = parseAttributes(htmlTag[1]);
  return attrs.lang || null;
}

export function extractHeadings(html) {
  const h1s = findTagsWithContent(html, 'h1').map((h) => cleanText(h.innerHtml));
  const h2s = findTagsWithContent(html, 'h2').map((h) => cleanText(h.innerHtml));
  return { h1Count: h1s.length, h1Texts: h1s, h2Count: h2s.length, h2Texts: h2s };
}

export function extractOpenGraph(metaTags) {
  const og = {};
  for (const tag of metaTags) {
    const prop = (tag.property || '').toLowerCase();
    if (prop.startsWith('og:') && tag.content !== undefined) {
      const key = prop.slice(3).replace(/[:.](.)/g, (_, c) => c.toUpperCase());
      og[key] = tag.content;
    }
  }
  return og;
}

export function extractTwitterCard(metaTags) {
  const tw = {};
  for (const tag of metaTags) {
    const name = (tag.name || tag.property || '').toLowerCase();
    if (name.startsWith('twitter:') && tag.content !== undefined) {
      const key = name.slice(8).replace(/[:.](.)/g, (_, c) => c.toUpperCase());
      tw[key] = tag.content;
    }
  }
  return tw;
}

export function extractJsonLd(html) {
  const re = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
  const blocks = [];
  let m;
  while ((m = re.exec(html))) {
    const attrs = parseAttributes(m[1]);
    const type = (attrs.type || '').toLowerCase();
    if (type !== 'application/ld+json') continue;
    const raw = m[2].trim();
    let parsed = null;
    let parseError = null;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      parseError = err.message;
    }
    blocks.push({ raw, parsed, parseError });
  }
  return blocks;
}

const EXCLUDED_HREF_SCHEMES = /^(javascript|mailto|tel|sms|data):/i;

export function extractLinks(html, baseUrl) {
  const anchors = findTagsWithContent(html, 'a');
  const internalLinks = [];
  const externalLinks = [];
  const invalidHrefs = [];
  for (const a of anchors) {
    const hrefRaw = a.attrs.href;
    if (hrefRaw === undefined) continue;
    const trimmed = hrefRaw.trim();
    if (!trimmed || trimmed.startsWith('#')) continue; // same-page anchor, not a link to a different resource
    if (EXCLUDED_HREF_SCHEMES.test(trimmed)) continue; // not a crawlable http(s) resource link
    const absolute = toAbsoluteUrl(hrefRaw, baseUrl);
    if (!absolute) {
      invalidHrefs.push(hrefRaw);
      continue;
    }
    const rel = (a.attrs.rel || '').toLowerCase();
    const entry = { url: absolute, text: cleanText(a.innerHtml), nofollow: rel.split(/\s+/).includes('nofollow') };
    if (isSameOrigin(absolute, baseUrl)) internalLinks.push(entry);
    else externalLinks.push(entry);
  }
  return { internalLinks, externalLinks, invalidHrefs };
}

export function extractImages(html, baseUrl) {
  const imgTags = findVoidTags(html, 'img');
  return imgTags.map((attrs) => {
    const src = attrs.src ? toAbsoluteUrl(attrs.src, baseUrl) : null;
    return {
      src,
      alt: attrs.alt !== undefined ? attrs.alt : null,
      hasAlt: attrs.alt !== undefined,
      isEmptyAlt: attrs.alt === '',
    };
  });
}

/**
 * Indexability is a *signal*, not a verdict — it only reflects what's
 * visible on this one response (status + meta/X-Robots-Tag directives +
 * whether canonical points elsewhere). It does NOT account for robots.txt
 * blocking (that's a separate, crawl-level check — see lib/robots.js) or
 * quality-based exclusion, which no local tool can determine. Feed this
 * into checklists/indexing-checklist.md's full diagnostic order rather than
 * treating it as a final answer.
 */
export function computeIndexabilitySignal({ statusCode, robotsMetaDirectives = [], xRobotsTagDirectives = [], canonicalUrl, finalUrl }) {
  const reasons = [];
  let indexable = true;

  if (statusCode !== undefined && statusCode !== null && statusCode !== 200) {
    indexable = false;
    reasons.push(`non-200 status (${statusCode})`);
  }
  const allDirectives = [...robotsMetaDirectives, ...xRobotsTagDirectives];
  if (allDirectives.includes('noindex')) {
    indexable = false;
    reasons.push('noindex directive present (meta robots or X-Robots-Tag)');
  }
  if (canonicalUrl && finalUrl) {
    try {
      const canonicalKey = new URL(canonicalUrl, finalUrl).toString().replace(/#.*$/, '');
      const finalKey = finalUrl.replace(/#.*$/, '');
      if (canonicalKey !== finalKey) {
        reasons.push('canonical points to a different URL than this page — indexing signal for THIS URL may defer to the canonical target');
      }
    } catch {
      reasons.push('canonical value is not a resolvable URL');
    }
  }
  return { indexable, reasons };
}

/**
 * Run every extractor over one HTML document and return a single facts
 * object. This is the primary entry point used by the crawler and the
 * `page` CLI command.
 */
export function extractSeoFacts(html, pageUrl, { statusCode = null, xRobotsTagHeader = null } = {}) {
  const metaTags = extractMetaTags(html);
  const robotsMetaDirectives = extractRobotsMeta(metaTags);
  const xRobotsTagDirectives = extractXRobotsTag(xRobotsTagHeader);
  const { canonical, canonicalRawHrefs, canonicalCount, multipleCanonicals } = extractCanonical(html, pageUrl);
  const headings = extractHeadings(html);
  const links = extractLinks(html, pageUrl);
  const images = extractImages(html, pageUrl);
  const indexability = computeIndexabilitySignal({
    statusCode,
    robotsMetaDirectives,
    xRobotsTagDirectives,
    canonicalUrl: canonical,
    finalUrl: pageUrl,
  });

  return {
    title: extractTitle(html),
    metaDescription: extractMetaDescription(metaTags),
    canonical,
    canonicalRawHrefs,
    canonicalCount,
    multipleCanonicals,
    viewport: extractViewport(metaTags),
    lang: extractLangAttribute(html),
    robotsMetaDirectives,
    xRobotsTagDirectives,
    indexable: indexability.indexable,
    indexabilityReasons: indexability.reasons,
    ...headings,
    openGraph: extractOpenGraph(metaTags),
    twitter: extractTwitterCard(metaTags),
    jsonLd: extractJsonLd(html),
    internalLinks: links.internalLinks,
    externalLinks: links.externalLinks,
    invalidHrefs: links.invalidHrefs,
    images,
    imagesMissingAlt: images.filter((i) => !i.hasAlt).length,
  };
}
