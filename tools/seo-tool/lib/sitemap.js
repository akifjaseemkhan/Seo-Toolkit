// sitemap.xml parsing and validation. Regex-based on purpose (sitemap XML
// has a very regular, well-documented shape), not a general XML parser —
// see the same tradeoff note in lib/html-extract.js. Read-only: never
// writes to a sitemap file.

import { fetchFollowingRedirects } from './fetch-utils.js';
import { normalizeForDedup } from './url-utils.js';

const PRIVATE_LOOKING_SEGMENTS = [
  '/admin',
  '/wp-admin',
  '/login',
  '/signin',
  '/sign-in',
  '/account',
  '/dashboard',
  '/cart',
  '/checkout',
  '/api/',
  '/_next/',
  '/internal',
  '/staging',
  '/test/',
  '/draft',
];

function extractTagValue(block, tag) {
  const m = block.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, 'i'));
  return m ? m[1].trim() : null;
}

function extractAllBlocks(xml, tag) {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}\\s*>`, 'gi');
  const out = [];
  let m;
  while ((m = re.exec(xml))) out.push(m[1]);
  return out;
}

/**
 * Parse a sitemap document, whichever of the two standard shapes it is.
 * Returns { type: 'urlset' | 'sitemapindex' | 'invalid', ... }.
 */
export function parseSitemap(xmlText) {
  const text = String(xmlText || '');
  const looksLikeXml = /^\s*(<\?xml|﻿<\?xml|<)/.test(text);
  if (!looksLikeXml) {
    return { type: 'invalid', error: 'Content does not look like XML (no leading < or <?xml declaration)' };
  }

  const isIndex = /<sitemapindex\b/i.test(text);
  const isUrlset = /<urlset\b/i.test(text);

  if (!isIndex && !isUrlset) {
    return { type: 'invalid', error: 'No <urlset> or <sitemapindex> root element found' };
  }

  if (isIndex) {
    const blocks = extractAllBlocks(text, 'sitemap');
    const sitemaps = blocks.map((b) => ({
      loc: extractTagValue(b, 'loc'),
      lastmod: extractTagValue(b, 'lastmod'),
    }));
    return { type: 'sitemapindex', sitemaps, entryCount: sitemaps.length };
  }

  const blocks = extractAllBlocks(text, 'url');
  const urls = blocks.map((b) => ({
    loc: extractTagValue(b, 'loc'),
    lastmod: extractTagValue(b, 'lastmod'),
    changefreq: extractTagValue(b, 'changefreq'),
    priority: extractTagValue(b, 'priority'),
  }));
  return { type: 'urlset', urls, entryCount: urls.length };
}

function looksPrivate(pathname) {
  const lower = pathname.toLowerCase();
  return PRIVATE_LOOKING_SEGMENTS.some((seg) => lower.includes(seg));
}

/**
 * Validate the entries of a parsed urlset: missing/malformed loc values,
 * duplicates (exact and trailing-slash-only variants), and paths that
 * heuristically look non-public. All findings are facts/heuristics for the
 * reasoning layer to weigh — this never claims certainty about intent.
 */
export function validateSitemapEntries(urls) {
  const issues = [];
  const seenExact = new Map();
  const seenNoTrailingSlash = new Map();

  urls.forEach((entry, i) => {
    const loc = entry.loc;
    if (!loc) {
      issues.push({ type: 'missing_loc', index: i, message: 'Entry has no <loc>' });
      return;
    }
    let parsed;
    try {
      parsed = new URL(loc);
    } catch {
      issues.push({ type: 'malformed_url', index: i, loc, message: 'loc is not a valid absolute URL' });
      return;
    }
    if (!/^https?:$/.test(parsed.protocol)) {
      issues.push({ type: 'non_http_url', index: i, loc, message: `Unexpected scheme: ${parsed.protocol}` });
    }

    if (seenExact.has(loc)) {
      issues.push({ type: 'duplicate_exact', index: i, loc, firstSeenIndex: seenExact.get(loc) });
    } else {
      seenExact.set(loc, i);
    }

    const noSlashKey = `${parsed.origin}${parsed.pathname.replace(/\/$/, '')}${parsed.search}`;
    if (seenNoTrailingSlash.has(noSlashKey) && seenNoTrailingSlash.get(noSlashKey) !== loc) {
      issues.push({
        type: 'duplicate_trailing_slash_variant',
        index: i,
        loc,
        variantOf: seenNoTrailingSlash.get(noSlashKey),
      });
    } else {
      seenNoTrailingSlash.set(noSlashKey, loc);
    }

    if (looksPrivate(parsed.pathname)) {
      issues.push({
        type: 'looks_non_public',
        index: i,
        loc,
        message: 'Path heuristically resembles an admin/account/private route — verify this is meant to be public and indexable.',
      });
    }
  });

  return issues;
}

function tryOrigin(url) {
  try {
    const origin = new URL(url).origin;
    // A single-letter "scheme" (e.g. a Windows drive letter like "D:\...")
    // parses without throwing but yields WHATWG's degenerate origin string
    // "null" — treat that the same as "no real origin" so it doesn't get
    // locked in as a bogus reference origin for same-origin comparisons.
    return origin === 'null' ? null : origin;
  } catch {
    return null;
  }
}

const DEFAULT_MAX_SITEMAPS = 50;
const DEFAULT_MAX_SITEMAP_DEPTH = 5;

/**
 * Resolve a sitemap that may itself be a <sitemapindex> into the full,
 * aggregated set of real page URLs, by recursively fetching and parsing
 * child sitemaps. This exists so a sitemapindex can never silently produce
 * an empty/misleading result the way a single, non-recursive parse would.
 *
 * Bounded and defensive by design:
 * - `maxSitemaps` caps the total number of sitemap files fetched across the
 *   whole tree (default 50) — recursion stops, not hangs, once hit.
 * - `maxDepth` caps how many levels of nested sitemapindex are followed
 *   (default 5) — real sites are almost always 1 level deep; this is
 *   headroom, not an expectation of deep nesting.
 * - Every child sitemap URL is deduplicated (via normalizeForDedup) before
 *   being queued, so a sitemap referenced twice (or a cycle back to an
 *   already-seen sitemap) is only ever fetched once and never causes
 *   infinite recursion.
 * - Same-origin by default: a child <loc> pointing to a different origin
 *   than the sitemap tree's own reference origin is skipped and reported
 *   in `skipped`, never silently followed. When the root document was read
 *   from a local file (no origin of its own), the first child's origin is
 *   used as the reference origin, and every subsequent child is checked
 *   against that.
 * - A fetch failure or malformed child sitemap is recorded on that node
 *   and does not abort the rest of the tree walk.
 *
 * @param {string} startUrl - the root sitemap's URL (or, for a local-file
 *   root, any identifier — only used for origin inference when no seedText
 *   is given a real URL to anchor to).
 * @param {object} [options]
 * @param {function} [options.fetchFn] - defaults to fetchFollowingRedirects;
 *   injectable for testing without real network access.
 * @param {number} [options.timeoutMs]
 * @param {number} [options.maxSitemaps]
 * @param {number} [options.maxDepth]
 * @param {boolean} [options.sameOriginOnly] - default true.
 * @param {string} [options.seedText] - if provided, used as the root
 *   document's content instead of fetching startUrl (for a local-file root).
 * @returns {Promise<{urls:Array, entryCount:number, issues:Array, sitemapsProcessed:Array, skipped:Array, truncated:boolean}>}
 *   `entryCount` is always a real-page-URL count (the aggregated tree total).
 *   Each `sitemapsProcessed` entry carries a type-specific count instead of a
 *   generic `entryCount`, since a urlset's page count and a sitemapindex's
 *   child-reference count are different units — see `urlCount`/`childCount`.
 */
export async function resolveSitemapTree(startUrl, options = {}) {
  const {
    fetchFn = fetchFollowingRedirects,
    timeoutMs = 10000,
    maxSitemaps = DEFAULT_MAX_SITEMAPS,
    maxDepth = DEFAULT_MAX_SITEMAP_DEPTH,
    sameOriginOnly = true,
    seedText = null,
  } = options;

  const visited = new Set();
  const sitemapsProcessed = [];
  const skipped = [];
  const allUrls = [];
  let referenceOrigin = tryOrigin(startUrl);
  let truncatedByMaxSitemaps = false;
  let truncatedByMaxDepth = false;

  async function processNode(sitemapUrl, depth, presetText) {
    let key;
    try {
      key = normalizeForDedup(sitemapUrl);
    } catch {
      skipped.push({ url: sitemapUrl, reason: 'malformed sitemap URL' });
      return;
    }

    if (visited.has(key)) {
      skipped.push({ url: sitemapUrl, reason: 'duplicate — already processed (or a recursion cycle)' });
      return;
    }

    if (depth > maxDepth) {
      truncatedByMaxDepth = true;
      skipped.push({ url: sitemapUrl, reason: `exceeded maxDepth (${maxDepth})` });
      return;
    }

    if (depth > 0 && sameOriginOnly) {
      const nodeOrigin = tryOrigin(sitemapUrl);
      if (referenceOrigin === null) {
        referenceOrigin = nodeOrigin; // local-file root: lock reference origin from the first real child seen
      } else if (nodeOrigin !== referenceOrigin) {
        skipped.push({ url: sitemapUrl, reason: 'cross-origin child sitemap skipped (same-origin restriction)' });
        return;
      }
    }

    if (visited.size >= maxSitemaps) {
      truncatedByMaxSitemaps = true;
      skipped.push({ url: sitemapUrl, reason: `exceeded maxSitemaps (${maxSitemaps})` });
      return;
    }

    visited.add(key);

    let body;
    if (presetText !== undefined && presetText !== null) {
      body = presetText;
    } else {
      const fetchResult = await fetchFn(sitemapUrl, { timeoutMs });
      if (fetchResult.error || !fetchResult.status || fetchResult.status >= 400) {
        sitemapsProcessed.push({
          url: sitemapUrl,
          depth,
          type: 'error',
          error: fetchResult.error ? fetchResult.error.message : `status ${fetchResult.status}`,
        });
        return;
      }
      body = fetchResult.body;
    }

    const parsed = parseSitemap(body);

    if (parsed.type === 'invalid') {
      sitemapsProcessed.push({ url: sitemapUrl, depth, type: 'invalid', error: parsed.error });
      return;
    }

    if (parsed.type === 'urlset') {
      // urlCount: real page URLs found in this specific file — not to be
      // confused with a sitemapindex node's childCount below, which counts
      // child sitemap references instead. Kept as separate, clearly-named
      // fields rather than one `entryCount` meaning two different units.
      sitemapsProcessed.push({ url: sitemapUrl, depth, type: 'urlset', urlCount: parsed.urls.length, error: null });
      allUrls.push(...parsed.urls);
      return;
    }

    // sitemapindex — childCount is the number of <sitemap> references in
    // this index file, not a page-URL count (see the urlset branch above).
    sitemapsProcessed.push({ url: sitemapUrl, depth, type: 'sitemapindex', childCount: parsed.sitemaps.length, error: null });
    for (const child of parsed.sitemaps) {
      if (!child.loc) {
        skipped.push({ url: '(missing loc)', reason: 'sitemapindex entry missing <loc>' });
        continue;
      }
      await processNode(child.loc, depth + 1);
    }
  }

  await processNode(startUrl, 0, seedText);

  const issues = validateSitemapEntries(allUrls);

  return {
    urls: allUrls,
    entryCount: allUrls.length,
    issues,
    sitemapsProcessed,
    skipped,
    truncated: truncatedByMaxSitemaps || truncatedByMaxDepth,
  };
}
