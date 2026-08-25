// sitemap.xml parsing and validation. Regex-based on purpose (sitemap XML
// has a very regular, well-documented shape), not a general XML parser —
// see the same tradeoff note in lib/html-extract.js. Read-only: never
// writes to a sitemap file.

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
