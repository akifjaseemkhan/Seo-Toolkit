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

const XDEFAULT = 'x-default';
// Deliberately permissive — this is a shape check ("does this look roughly
// like a BCP47 language[-region] tag"), not a real ISO-639/ISO-3166 code
// validator (that would need a large lookup table, at odds with this
// module's zero-dependency, regex-based design). It exists to catch the
// specific, common mistakes this project's own workflow docs already call
// out (workflows/international-seo.md) — not to certify a code is real.
const HREFLANG_SHAPE = /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/;

/**
 * Classify one hreflang value as malformed (or not). Returns a short,
 * human-readable issue string, or null if nothing looks wrong.
 */
function classifyHreflangValue(raw) {
  if (!raw) return 'empty hreflang value';
  if (raw.toLowerCase() === XDEFAULT) return null; // reserved special value, always valid
  if (raw.includes('_')) return `uses underscore instead of hyphen ("${raw}") — hreflang codes must use hyphens, e.g. "en-US" not "en_US"`;
  if (!HREFLANG_SHAPE.test(raw)) return `does not look like a valid BCP47 language[-region] tag ("${raw}")`;
  // The single most common real-world hreflang mistake this project's own
  // workflow docs explicitly call out: "UK" is not a valid ISO 3166-1
  // region code (the country code is "GB"), but people write it anyway.
  if (/^[a-zA-Z]{2,3}-uk$/i.test(raw)) {
    return `"${raw}" — "UK" is not a valid ISO 3166-1 region code; "GB" is normally what's intended (e.g. "en-GB", not "en-UK")`;
  }
  return null;
}

/**
 * Extract every <link rel="alternate" hreflang="..."> declaration on the
 * page — the technical signal international/multilingual sites use to tell
 * search engines which URL serves which language/region variant. See
 * workflows/international-seo.md for the full methodology this data feeds;
 * this function only gathers facts, it doesn't judge them.
 *
 * Returns:
 *   hreflangTags            - every declaration, in document order, as
 *                              { hreflang, href, rawHref }. `href` is
 *                              resolved to an absolute URL against
 *                              `pageUrl` (null if unresolvable); `rawHref`
 *                              is the href exactly as written in the
 *                              markup, for evidence when `href` is null.
 *   hreflangCount           - total number of qualifying tags found.
 *   hasXDefault             - true if an `hreflang="x-default"` declaration
 *                              is present (the reserved catch-all value).
 *   selfReferencingHreflang - true if any declaration's resolved href
 *                              matches this page's own URL (fragment
 *                              ignored, same convention as the
 *                              canonical/finalUrl comparison below). The
 *                              project's international-SEO workflow
 *                              requires a page to reference itself in its
 *                              own hreflang set — this is that check, as a
 *                              fact, not an enforcement.
 *   duplicateHreflangValues - hreflang values that appear on more than one
 *                              tag pointing to genuinely different resolved
 *                              targets — a real, conflicting-signal error,
 *                              not just a harmless repeated declaration
 *                              (the same value repeated with the *same*
 *                              target is not flagged here).
 *   malformedHreflang        - [{ hreflang, issue }] for values that look
 *                              wrong — see classifyHreflangValue above.
 *
 * Cross-page reciprocity ("does the variant this page points to actually
 * point back?") is intentionally out of scope here — it needs the whole
 * crawled set, the same way orphan-page detection needs the sitemap (see
 * `audit`'s cross-reference in lib/crawler.js), not just one page's HTML.
 */
export function extractHreflang(html, pageUrl) {
  const links = findVoidTags(html, 'link');
  const hreflangLinks = links.filter((l) => {
    const relTokens = (l.rel || '').toLowerCase().split(/\s+/);
    return relTokens.includes('alternate') && l.hreflang !== undefined;
  });

  const hreflangTags = hreflangLinks.map((l) => {
    const rawHref = l.href !== undefined ? l.href : null;
    return {
      hreflang: l.hreflang,
      href: rawHref ? toAbsoluteUrl(rawHref, pageUrl) : null,
      rawHref,
    };
  });

  const malformedHreflang = [];
  for (const tag of hreflangTags) {
    const issue = classifyHreflangValue(tag.hreflang);
    if (issue) malformedHreflang.push({ hreflang: tag.hreflang, issue });
  }

  const hasXDefault = hreflangTags.some((t) => (t.hreflang || '').toLowerCase() === XDEFAULT);

  const targetsByValue = new Map();
  for (const tag of hreflangTags) {
    const key = (tag.hreflang || '').toLowerCase();
    if (!key) continue;
    if (!targetsByValue.has(key)) targetsByValue.set(key, new Set());
    targetsByValue.get(key).add(tag.href || tag.rawHref || '');
  }
  const duplicateHreflangValues = [...targetsByValue.entries()].filter(([, targets]) => targets.size > 1).map(([value]) => value);

  let selfReferencingHreflang = false;
  if (pageUrl) {
    const pageKey = String(pageUrl).replace(/#.*$/, '');
    selfReferencingHreflang = hreflangTags.some((t) => t.href && t.href.replace(/#.*$/, '') === pageKey);
  }

  return {
    hreflangTags,
    hreflangCount: hreflangTags.length,
    hasXDefault,
    selfReferencingHreflang,
    duplicateHreflangValues,
    malformedHreflang,
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

/**
 * checklists/schema-checklist.md requires "Required properties for the
 * chosen type present (`@context`, `@type`, and type-specific required
 * fields)". This checks only the universal, spec-level structural minimum
 * every JSON-LD/schema.org block needs -- `@context` and `@type` -- not the
 * type-specific required-field lists (Article needs a real datePublished,
 * Product needs offers, Review needs real review data, etc.). Validating
 * those would mean building and maintaining a database of schema.org's
 * hundreds of types and their individual requirements -- an unnecessarily
 * broad schema.org validator this tool deliberately does not attempt.
 * That judgment stays with rules/schema-rules.md's "Choosing the right
 * type" section and no-fabrication.md, applied by a human/agent, not this
 * fact-gathering layer.
 *
 * Handles the common `{ "@context": ..., "@type": ... }` shape and the
 * `@graph` container pattern (a root object bundling several typed nodes
 * under one shared `@context` -- `@type` isn't expected on the container
 * itself, only its member nodes). A top-level JSON-LD array (multiple
 * independent node objects in one script, no `@graph` wrapper) is a real
 * but much rarer pattern; each item is checked the same way and any
 * missing property from any item is reported once. Nodes nested inside a
 * `@graph` are NOT individually re-checked -- recursing into every nested
 * node is exactly the kind of broader validation this function stays out
 * of; the presence of `@graph` itself is treated as satisfying the
 * container's own `@type` requirement.
 */
export function findMissingRequiredJsonLdProperties(parsed) {
  if (parsed === null || typeof parsed !== 'object') return [];
  const nodes = Array.isArray(parsed) ? parsed : [parsed];
  const missing = new Set();
  for (const node of nodes) {
    if (!node || typeof node !== 'object') continue;
    if (!node['@context']) missing.add('@context');
    const isGraphContainer = Array.isArray(node['@graph']);
    if (!isGraphContainer && !node['@type']) missing.add('@type');
  }
  return [...missing];
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
    // Only evaluated once the JSON itself parses -- a parseError already
    // flags a broken block, so there's nothing further to check on it.
    const missingRequiredProperties = parseError ? null : findMissingRequiredJsonLdProperties(parsed);
    blocks.push({ raw, parsed, parseError, missingRequiredProperties });
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

// A CSS-property-name substring check on the inline `style` attribute only
// -- not a CSS parser. `checklists/performance-checklist.md` and
// `workflows/performance.md` name `aspect-ratio` specifically as an
// alternative to width/height for preventing layout shift, but a real
// aspect-ratio could equally come from an external stylesheet or CSS class
// this tool never sees; this only catches the inline-style case, which is
// still a real, common way it's applied directly on the tag.
const STYLE_ASPECT_RATIO = /aspect-ratio\s*:/i;

export function extractImages(html, baseUrl) {
  const imgTags = findVoidTags(html, 'img');
  return imgTags.map((attrs) => {
    const src = attrs.src ? toAbsoluteUrl(attrs.src, baseUrl) : null;
    const width = attrs.width || null;
    const height = attrs.height || null;
    const hasAspectRatioStyle = STYLE_ASPECT_RATIO.test(attrs.style || '');
    return {
      src,
      alt: attrs.alt !== undefined ? attrs.alt : null,
      hasAlt: attrs.alt !== undefined,
      isEmptyAlt: attrs.alt === '',
      width,
      height,
      // checklists/performance-checklist.md: "width/height (or aspect-ratio)
      // attributes present to prevent layout shift" -- true when both width
      // and height are present, OR an inline aspect-ratio style is (see the
      // limitation noted above).
      hasExplicitDimensions: Boolean((width && height) || hasAspectRatioStyle),
      // Raw fact only, per workflows/performance.md's explicit fix-layer
      // guidance ("width/height, loading=\"lazy\" ... before code
      // restructuring") -- whether a *specific* image should or shouldn't
      // be lazy-loaded depends on its position on the page (above vs.
      // below the fold), which this static-HTML tool has no way to
      // determine. That judgment stays with the reasoning layer.
      loading: attrs.loading || null,
    };
  });
}

/**
 * Extract HTML5 pagination hints: <link rel="next" href="..."> and
 * <link rel="prev" href="...">. Both resolved to absolute URLs against
 * pageUrl, the same way extractCanonical/extractHreflang already are.
 *
 * Returns:
 *   paginationNext - resolved absolute URL of rel="next", or null if
 *                     absent, empty, or unresolvable.
 *   paginationPrev - resolved absolute URL of rel="prev", or null.
 *   isPaginated    - true if either tag is present on the page, even if its
 *                     href happened to be empty/unresolvable — the tag's
 *                     mere presence is what marks this page as part of a
 *                     paginated series.
 */
export function extractPagination(html, pageUrl) {
  const links = findVoidTags(html, 'link');
  const nextTag = links.find((l) => (l.rel || '').toLowerCase().split(/\s+/).includes('next'));
  const prevTag = links.find((l) => (l.rel || '').toLowerCase().split(/\s+/).includes('prev'));
  const resolve = (tag) => {
    if (!tag || tag.href === undefined || !tag.href) return null;
    return toAbsoluteUrl(tag.href, pageUrl);
  };
  return {
    paginationNext: resolve(nextTag),
    paginationPrev: resolve(prevTag),
    isPaginated: Boolean(nextTag || prevTag),
  };
}

/**
 * True when a paginated page's canonical points to a DIFFERENT URL than
 * itself — the specific, well-documented anti-pattern
 * rules/canonical-rules.md calls out: "canonicalizing all pages to page 1
 * is usually wrong and hides paginated content from indexing." Standard
 * practice is a self-referencing canonical on every page of a paginated
 * series, not just the first.
 */
export function computePaginationCanonicalConflict({ isPaginated, canonical, pageUrl }) {
  if (!isPaginated || !canonical || !pageUrl) return false;
  try {
    const canonicalKey = new URL(canonical, pageUrl).toString().replace(/#.*$/, '');
    const pageKey = String(pageUrl).replace(/#.*$/, '');
    return canonicalKey !== pageKey;
  } catch {
    return false;
  }
}

/**
 * checklists/metadata-checklist.md requires "og:url — matches canonical".
 * `og:url` and `<link rel="canonical">` are two independent signals for
 * "the one true URL of this page" -- a mismatch between them is a real,
 * common setup mistake (a stale og:url left over from a URL-structure
 * change, or a canonical rewrite that never touched the OG tags).
 *
 * `ogUrl` is resolved to an absolute URL against `pageUrl` the same way
 * every other href in this file is (og:url is supposed to already be
 * absolute per the Open Graph spec, but this stays robust to a relative
 * value rather than assuming). Only evaluated when BOTH `og:url` and
 * `canonical` are actually present -- a missing canonical is already its
 * own, separately-reported problem, not an og:url-specific one.
 */
export function computeOgUrlCanonicalMismatch({ ogUrl, canonical, pageUrl }) {
  if (!ogUrl || !canonical) return false;
  const ogUrlAbsolute = toAbsoluteUrl(ogUrl, pageUrl);
  if (!ogUrlAbsolute) return false;
  try {
    const ogKey = ogUrlAbsolute.replace(/#.*$/, '');
    const canonicalKey = canonical.replace(/#.*$/, '');
    return ogKey !== canonicalKey;
  } catch {
    return false;
  }
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

// The two directive families search engines treat as opposite pairs.
// "all"/"none" are the documented shorthand for both pairs at once (Google:
// "all" == the default, "none" == "noindex, nofollow"), so they're expanded
// before comparing rather than treated as a third, unrelated value.
const ROBOTS_DIRECTIVE_FAMILIES = [
  { positive: 'index', negative: 'noindex' },
  { positive: 'follow', negative: 'nofollow' },
];

function expandRobotsShorthand(directives) {
  const set = new Set(directives);
  if (set.has('all')) {
    set.add('index');
    set.add('follow');
  }
  if (set.has('none')) {
    set.add('noindex');
    set.add('nofollow');
  }
  return set;
}

/**
 * checklists/metadata-checklist.md requires "no conflicting robots
 * directives between meta tag and HTTP header" -- a real, checkable fact
 * distinct from indexability itself (a `noindex` from either source already
 * makes a page non-indexable regardless of what the other source says, so a
 * conflict here doesn't change the `indexable` signal -- it flags that the
 * two sources actively disagree, which is a real setup mistake even when
 * the practical effect happens to be "safe" this time).
 *
 * Only flags a genuine disagreement: BOTH sources present, and asserting
 * opposite values for the same family (index vs. noindex, or follow vs.
 * nofollow). A directive present in only one source is not a conflict --
 * that's just one signal with nothing to disagree with.
 */
export function computeRobotsDirectivesConflict(robotsMetaDirectives = [], xRobotsTagDirectives = []) {
  if (robotsMetaDirectives.length === 0 || xRobotsTagDirectives.length === 0) {
    return { conflict: false, reasons: [] };
  }
  const metaSet = expandRobotsShorthand(robotsMetaDirectives);
  const headerSet = expandRobotsShorthand(xRobotsTagDirectives);
  const reasons = [];
  for (const { positive, negative } of ROBOTS_DIRECTIVE_FAMILIES) {
    const metaValue = metaSet.has(positive) ? positive : metaSet.has(negative) ? negative : null;
    const headerValue = headerSet.has(positive) ? positive : headerSet.has(negative) ? negative : null;
    if (metaValue && headerValue && metaValue !== headerValue) {
      reasons.push(`meta robots says "${metaValue}" but X-Robots-Tag says "${headerValue}"`);
    }
  }
  return { conflict: reasons.length > 0, reasons };
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
  const { hreflangTags, hreflangCount, hasXDefault, selfReferencingHreflang, duplicateHreflangValues, malformedHreflang } = extractHreflang(
    html,
    pageUrl
  );
  const { paginationNext, paginationPrev, isPaginated } = extractPagination(html, pageUrl);
  const paginationCanonicalConflict = computePaginationCanonicalConflict({ isPaginated, canonical, pageUrl });
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
  const robotsDirectivesConflictResult = computeRobotsDirectivesConflict(robotsMetaDirectives, xRobotsTagDirectives);
  const openGraph = extractOpenGraph(metaTags);
  const ogUrlCanonicalMismatch = computeOgUrlCanonicalMismatch({ ogUrl: openGraph.url, canonical, pageUrl });

  return {
    title: extractTitle(html),
    metaDescription: extractMetaDescription(metaTags),
    canonical,
    canonicalRawHrefs,
    canonicalCount,
    multipleCanonicals,
    hreflangTags,
    hreflangCount,
    hasXDefault,
    selfReferencingHreflang,
    duplicateHreflangValues,
    malformedHreflang,
    paginationNext,
    paginationPrev,
    isPaginated,
    paginationCanonicalConflict,
    viewport: extractViewport(metaTags),
    lang: extractLangAttribute(html),
    robotsMetaDirectives,
    xRobotsTagDirectives,
    robotsDirectivesConflict: robotsDirectivesConflictResult.conflict,
    robotsDirectivesConflictReasons: robotsDirectivesConflictResult.reasons,
    indexable: indexability.indexable,
    indexabilityReasons: indexability.reasons,
    ...headings,
    openGraph,
    ogUrlCanonicalMismatch,
    twitter: extractTwitterCard(metaTags),
    jsonLd: extractJsonLd(html),
    internalLinks: links.internalLinks,
    externalLinks: links.externalLinks,
    invalidHrefs: links.invalidHrefs,
    images,
    imagesMissingAlt: images.filter((i) => !i.hasAlt).length,
    imagesMissingDimensions: images.filter((i) => !i.hasExplicitDimensions).length,
  };
}
