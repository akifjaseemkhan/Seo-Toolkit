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

// ---------- private/internal network detection (SSRF hardening) ----------
//
// Policy, stated explicitly: loopback (127.0.0.0/8, ::1) is always allowed,
// regardless of this check, because a loopback address can only ever reach
// back to the same machine running this tool — it is not a route to another
// host, so it carries none of the risk this check exists to prevent, and the
// documented local-development workflow (`http://localhost:PORT`,
// `http://127.0.0.1:PORT`) depends on it. Every other private/internal/
// link-local range (RFC1918, link-local/cloud-metadata 169.254.0.0/16, the
// IPv6 equivalents, and the unspecified addresses) is blocked by default.
//
// Scope, stated explicitly: this checks *literal* IP addresses only (IPv4
// dotted-quad or IPv6 bracketed literal) appearing directly as the URL's
// host. It does not perform DNS resolution — a hostname that *resolves* to
// a private address (e.g. an internal DNS entry, or a "DNS rebinding"
// domain crafted to do this) is not caught here. That would require
// resolving hostnames before every request (and re-resolving on every
// redirect hop, since resolution can change between checks), which is a
// meaningfully larger, riskier scope than this check — see docs/tooling.md.

const IPV4_LITERAL = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

function parseIPv4Literal(hostname) {
  const m = IPV4_LITERAL.exec(hostname);
  if (!m) return null;
  const octets = m.slice(1, 5).map(Number);
  if (octets.some((o) => o > 255)) return null;
  return octets;
}

function isPrivateIPv4Octets([a, b]) {
  if (a === 127) return false; // loopback — always allowed, see policy note above
  if (a === 10) return true; // 10.0.0.0/8
  if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
  if (a === 192 && b === 168) return true; // 192.168.0.0/16
  if (a === 169 && b === 254) return true; // 169.254.0.0/16 — link-local, includes cloud metadata (169.254.169.254)
  if (a === 0) return true; // 0.0.0.0/8 — "this network" / unspecified
  return false;
}

/**
 * Expand a bracket-stripped IPv6 address into exactly 8 lowercase hex-group
 * strings, resolving "::" zero-compression. Returns null if it doesn't look
 * like a valid IPv6 literal. Note: by the time a hostname reaches this
 * function it has already been parsed once by WHATWG URL, which normalizes
 * IPv4-mapped forms (e.g. "::ffff:169.254.169.254") into pure hex-group
 * notation ("::ffff:a9fe:a9fe") — so this never needs to handle an embedded
 * dotted-quad itself, only hex groups.
 */
function expandIPv6Groups(addr) {
  const zoneIdx = addr.indexOf('%');
  const clean = zoneIdx === -1 ? addr : addr.slice(0, zoneIdx);
  const parts = clean.split('::');
  if (parts.length > 2) return null;
  const parseGroups = (s) => (s === '' ? [] : s.split(':'));
  if (parts.length === 1) {
    const groups = parseGroups(parts[0]);
    return groups.length === 8 ? groups : null;
  }
  const head = parseGroups(parts[0]);
  const tail = parseGroups(parts[1]);
  const missing = 8 - head.length - tail.length;
  if (missing < 0) return null;
  return [...head, ...Array(missing).fill('0'), ...tail];
}

function isPrivateIPv6(addrNoBrackets) {
  const groups = expandIPv6Groups(addrNoBrackets);
  if (!groups) return false; // not a parseable IPv6 literal — nothing more to check here
  const hex = (g) => parseInt(g || '0', 16);

  const isLoopback = groups.slice(0, 7).every((g) => hex(g) === 0) && hex(groups[7]) === 1;
  if (isLoopback) return false; // ::1 — always allowed, see policy note above

  const isUnspecified = groups.every((g) => hex(g) === 0);
  if (isUnspecified) return true; // ::

  // IPv4-mapped ::ffff:0:0/96 — 5 leading zero groups, group 5 is "ffff",
  // groups 6-7 are the embedded IPv4 address as two 16-bit hex halves.
  const isIPv4Mapped = groups.slice(0, 5).every((g) => hex(g) === 0) && (groups[5] || '').toLowerCase() === 'ffff';
  if (isIPv4Mapped) {
    const hi = hex(groups[6]);
    const lo = hex(groups[7]);
    return isPrivateIPv4Octets([hi >> 8, hi & 0xff, lo >> 8, lo & 0xff]);
  }

  const first = hex(groups[0]);
  if (first >= 0xfe80 && first <= 0xfebf) return true; // fe80::/10 — link-local
  if (first >= 0xfc00 && first <= 0xfdff) return true; // fc00::/7 — unique-local (IPv6's RFC1918 equivalent)

  return false;
}

/**
 * True if `urlString`'s host is a private/internal/link-local address that
 * should be blocked by default (SSRF hardening). Loopback and `localhost`
 * are always allowed — see the policy note above. Never throws; an
 * unparseable URL is not this function's concern (other checks catch that).
 */
export function isPrivateNetworkTarget(urlString) {
  let hostname;
  try {
    hostname = new URL(urlString).hostname.toLowerCase();
  } catch {
    return false;
  }
  if (hostname === 'localhost') return false;
  if (hostname.startsWith('[') && hostname.endsWith(']')) {
    return isPrivateIPv6(hostname.slice(1, -1));
  }
  const v4 = parseIPv4Literal(hostname);
  if (v4) return isPrivateIPv4Octets(v4);
  return false; // an ordinary hostname — DNS resolution is out of scope, see policy note above
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
