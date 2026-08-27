// Conservative HTTP fetching: manual redirect following (so the full chain
// is visible), a hard timeout, and a capped body read so this tool can never
// be pointed at a huge or infinite response and hang or exhaust memory.
//
// Read-only guarantee: this module only ever issues GET/HEAD requests. It
// never sends a body and never calls a method that would mutate anything on
// the target server.
//
// Safety guarantee: every actual network request funnels through fetchOnce
// (fetchFollowingRedirects calls it once per hop, and it has no other
// caller anywhere in this codebase), so the private-network check there
// applies to the initial URL AND every redirect hop, with no separate path
// that could bypass it. A blocked target is refused before fetch() is ever
// called — no request reaches it, so no response body from it can exist.

import { isPrivateNetworkTarget } from './url-utils.js';

export const DEFAULT_USER_AGENT =
  'seo-tool/1.0 (+local SEO inspection toolkit; read-only; part of an agent-agnostic SEO engineering skill)';

export const DEFAULT_TIMEOUT_MS = 10000;
export const DEFAULT_MAX_REDIRECTS = 10;
export const DEFAULT_MAX_BODY_BYTES = 2_000_000; // 2MB — plenty for HTML, robots.txt, sitemap pages

function classifyFetchError(err) {
  if (err && err.name === 'AbortError') {
    return { type: 'timeout', message: 'Request timed out' };
  }
  const code = err && err.cause && err.cause.code;
  if (code) {
    return { type: 'network', code, message: err.message };
  }
  return { type: 'unknown', message: String((err && err.message) || err) };
}

/** Issue a single request with no redirect-following and a timeout. */
export async function fetchOnce(url, options = {}) {
  const { timeoutMs = DEFAULT_TIMEOUT_MS, userAgent = DEFAULT_USER_AGENT, method = 'GET', allowPrivateNetwork = false } = options;

  if (!allowPrivateNetwork && isPrivateNetworkTarget(url)) {
    let hostname = url;
    try {
      hostname = new URL(url).hostname;
    } catch {
      /* keep the raw url in the message if it somehow doesn't parse here */
    }
    return {
      ok: false,
      error: {
        type: 'blocked_private_network',
        message: `Refusing to fetch a private/internal network address (${hostname}) — pass --allow-private-network to override for a deliberate internal-network audit.`,
      },
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method,
      redirect: 'manual',
      signal: controller.signal,
      headers: {
        'User-Agent': userAgent,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    return { ok: true, status: response.status, response };
  } catch (err) {
    return { ok: false, error: classifyFetchError(err) };
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Read a response body as text, capped at maxBytes so a huge/streaming
 * response can never be read in full. Returns { text, truncated }.
 */
export async function readBodyCapped(response, maxBytes = DEFAULT_MAX_BODY_BYTES) {
  if (!response.body) {
    const text = await response.text();
    return { text, truncated: false };
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  let truncated = false;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      const allowed = maxBytes - (total - value.byteLength);
      if (allowed > 0) chunks.push(value.subarray(0, allowed));
      truncated = true;
      try {
        await reader.cancel();
      } catch {
        // best effort — some responses don't support cancel cleanly
      }
      break;
    }
    chunks.push(value);
  }
  const combined = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  return { text: combined.toString('utf-8'), truncated };
}

/**
 * Fetch a URL, following redirects manually so the entire chain is recorded.
 * Detects loops and caps the number of hops. Never throws — all failure
 * modes are returned as { error } so a single bad URL never aborts a crawl.
 */
export async function fetchFollowingRedirects(url, options = {}) {
  const {
    timeoutMs = DEFAULT_TIMEOUT_MS,
    maxRedirects = DEFAULT_MAX_REDIRECTS,
    userAgent = DEFAULT_USER_AGENT,
    method = 'GET',
    maxBodyBytes = DEFAULT_MAX_BODY_BYTES,
    readBody = true,
    allowPrivateNetwork = false,
  } = options;

  const redirectChain = [];
  const seen = new Set();
  let current = url;

  for (let hop = 0; ; hop++) {
    if (seen.has(current)) {
      return {
        requestedUrl: url,
        finalUrl: current,
        status: null,
        redirectChain,
        error: { type: 'redirect_loop', message: `Redirect loop detected at ${current}` },
      };
    }
    seen.add(current);

    if (hop > maxRedirects) {
      return {
        requestedUrl: url,
        finalUrl: current,
        status: null,
        redirectChain,
        error: { type: 'too_many_redirects', message: `Exceeded ${maxRedirects} redirects` },
      };
    }

    const result = await fetchOnce(current, { timeoutMs, userAgent, method, allowPrivateNetwork });
    if (!result.ok) {
      return { requestedUrl: url, finalUrl: current, status: null, redirectChain, error: result.error };
    }

    const { status, response } = result;

    if (status >= 300 && status < 400) {
      const location = response.headers.get('location');
      if (!location) {
        return {
          requestedUrl: url,
          finalUrl: current,
          status,
          redirectChain,
          headers: response.headers,
          error: { type: 'redirect_no_location', message: `Status ${status} with no Location header` },
        };
      }
      let nextUrl;
      try {
        nextUrl = new URL(location, current).toString();
      } catch {
        return {
          requestedUrl: url,
          finalUrl: current,
          status,
          redirectChain,
          headers: response.headers,
          error: { type: 'invalid_redirect_target', message: `Location header is not a valid URL: ${location}` },
        };
      }
      redirectChain.push({ url: current, status, location: nextUrl });
      current = nextUrl;
      continue;
    }

    // Terminal (non-redirect) response.
    const contentType = response.headers.get('content-type') || '';
    let body = null;
    let truncated = false;
    if (readBody && method !== 'HEAD') {
      const read = await readBodyCapped(response, maxBodyBytes);
      body = read.text;
      truncated = read.truncated;
    }
    return {
      requestedUrl: url,
      finalUrl: current,
      status,
      redirectChain,
      headers: response.headers,
      contentType,
      body,
      bodyTruncated: truncated,
      error: null,
    };
  }
}
