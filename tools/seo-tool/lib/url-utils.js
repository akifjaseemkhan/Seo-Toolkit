// URL resolution, normalization, and comparison helpers.
// Deliberately conservative: normalization only folds things that are truly
// equivalent (scheme/host case, default ports, fragments). Trailing slashes
// and query strings are left alone because they can be meaningful to SEO
// (see rules/canonical-rules.md) — this tool must not erase a real signal
// by over-normalizing it away.

const DEFAULT_PORTS = { 'http:': '80', 'https:': '443' };

/**
 * Resolve a possibly-relative href against a base URL.
 * Returns null (never throws) if the result isn't a usable absolute URL.
 */
export function toAbsoluteUrl(href, baseUrl) {
  if (!href || typeof href !== 'string') return null;
  const trimmed = href.trim();
  if (!trimmed) return null;
  // Skip non-navigable pseudo-links early.
  if (/^(javascript|mailto|tel|data):/i.test(trimmed)) return null;
  try {
    const resolved = new URL(trimmed, baseUrl);
    return resolved.toString();
  } catch {
    return null;
  }
}

/** True if the URL uses http/https (the only schemes this tool ever fetches). */
export function isHttpUrl(urlString) {
  try {
    const u = new URL(urlString);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * A stable key for "is this the same resource" deduplication during a crawl.
 * Folds scheme/host case and default ports, strips the fragment. Does NOT
 * touch path trailing slashes or query strings — those are left exactly as
 * observed since collapsing them could hide a real duplicate-content issue
 * instead of revealing one.
 */
export function normalizeForDedup(urlString) {
  const u = new URL(urlString);
  const protocol = u.protocol.toLowerCase();
  const hostname = u.hostname.toLowerCase();
  const port = u.port && u.port !== DEFAULT_PORTS[protocol] ? `:${u.port}` : '';
  return `${protocol}//${hostname}${port}${u.pathname}${u.search}`;
}

/** Same origin = same scheme + hostname + effective port. */
export function isSameOrigin(urlA, urlB) {
  try {
    const a = new URL(urlA);
    const b = new URL(urlB);
    const portA = a.port || DEFAULT_PORTS[a.protocol] || '';
    const portB = b.port || DEFAULT_PORTS[b.protocol] || '';
    return a.protocol === b.protocol && a.hostname.toLowerCase() === b.hostname.toLowerCase() && portA === portB;
  } catch {
    return false;
  }
}

/**
 * Given a list of URL strings, return which normalized keys occur more than
 * once, mapped to every original URL string that produced that key.
 */
export function findDuplicates(urlStrings) {
  const byKey = new Map();
  for (const raw of urlStrings) {
    let key;
    try {
      key = normalizeForDedup(raw);
    } catch {
      continue; // invalid URLs are reported separately by callers, not here
    }
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(raw);
  }
  const duplicates = {};
  for (const [key, list] of byKey) {
    if (list.length > 1) duplicates[key] = list;
  }
  return duplicates;
}
