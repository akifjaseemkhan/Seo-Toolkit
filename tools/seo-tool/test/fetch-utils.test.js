import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import dns from 'node:dns';
import {
  fetchOnce,
  fetchFollowingRedirects,
  readBodyCapped,
  DEFAULT_USER_AGENT,
} from '../lib/fetch-utils.js';

// A small, purpose-built fixture server exercising the specific HTTP
// behaviors fetch-utils.js needs to handle correctly: plain 200s, redirect
// chains, redirect loops, a slow/never-responding route (for timeout), and
// a route with no Location header on a 3xx. No real network access, no
// external websites — everything is loopback.
function startFixtureServer() {
  const server = createServer((req, res) => {
    if (req.url === '/ok') {
      res.writeHead(200, { 'Content-Type': 'text/html', 'X-Custom': 'yes' });
      res.end('<html><body>ok</body></html>');
      return;
    }
    if (req.url === '/redirect-once') {
      res.writeHead(302, { Location: '/ok' });
      res.end();
      return;
    }
    if (req.url === '/redirect-chain-1') {
      res.writeHead(301, { Location: '/redirect-chain-2' });
      res.end();
      return;
    }
    if (req.url === '/redirect-chain-2') {
      res.writeHead(301, { Location: '/ok' });
      res.end();
      return;
    }
    if (req.url === '/loop-a') {
      res.writeHead(302, { Location: '/loop-b' });
      res.end();
      return;
    }
    if (req.url === '/loop-b') {
      res.writeHead(302, { Location: '/loop-a' });
      res.end();
      return;
    }
    if (req.url === '/redirect-no-location') {
      res.writeHead(302, {});
      res.end();
      return;
    }
    if (req.url === '/never-responds') {
      // deliberately hang — used to test the timeout path
      return;
    }
    if (req.url === '/big-body') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('x'.repeat(1000));
      return;
    }
    if (req.url === '/error-500') {
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('server error');
      return;
    }
    if (req.url === '/echo-ua') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(req.headers['user-agent'] || '');
      return;
    }
    if (req.url === '/redirect-to-private') {
      // Points OFF this loopback fixture server entirely, at a literal
      // RFC1918 address — used to prove a redirect hop gets validated even
      // though the fixture server itself (the request that produced this
      // redirect) is a perfectly allowed loopback target.
      res.writeHead(302, { Location: 'http://192.168.1.1/admin' });
      res.end();
      return;
    }
    if (req.url === '/redirect-to-metadata') {
      res.writeHead(302, { Location: 'http://169.254.169.254/latest/meta-data/' });
      res.end();
      return;
    }
    if (req.url === '/multi-hop-then-private') {
      // Hop 1: loopback -> loopback (allowed). The *next* hop from
      // /redirect-to-private is what actually goes private.
      res.writeHead(302, { Location: '/redirect-to-private' });
      res.end();
      return;
    }
    if (req.url === '/redirect-to-private-ipv6') {
      // Same idea as /redirect-to-private but for the IPv6 unique-local
      // range (fc00::/7), so IPv6 redirect targets get the same proof as
      // IPv4 ones: blocked before the request is ever made.
      res.writeHead(302, { Location: 'http://[fc00::1]/internal' });
      res.end();
      return;
    }
    res.writeHead(404);
    res.end('not found');
  });
  return new Promise((resolveServer) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolveServer({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

/**
 * Forces Node's `dns.lookup('localhost', ...)` to resolve to the IPv4
 * loopback address only, for the duration of `fn`. See the fuller
 * explanation in test/support/force-localhost-ipv4.mjs (used by the CLI
 * integration test, which needs the same override inside a real
 * subprocess) — this in-process version exists so the fetch-utils-level
 * tests can exercise the same real production fetchOnce/
 * fetchFollowingRedirects code and the real, proven-in-CI 127.0.0.1-only
 * fixture server, while still genuinely requesting the literal "localhost"
 * hostname, deterministically, on every platform and Node version. It
 * matches Node's documented `dns.lookup` signature exactly, including the
 * `{ all: true }` array-callback form that `net`'s own internals use.
 */
async function withLocalhostForcedToIPv4(fn) {
  const original = dns.lookup;
  dns.lookup = (hostname, options, callback) => {
    if (typeof options === 'function') {
      callback = options;
      options = {};
    }
    if (hostname !== 'localhost') {
      return original(hostname, options, callback);
    }
    if (options && options.all) {
      return process.nextTick(callback, null, [{ address: '127.0.0.1', family: 4 }]);
    }
    return process.nextTick(callback, null, '127.0.0.1', 4);
  };
  try {
    return await fn();
  } finally {
    dns.lookup = original;
  }
}

test('fetchOnce performs a successful GET and does not follow redirects itself', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await fetchOnce(baseUrl + '/ok');
    assert.equal(result.ok, true);
    assert.equal(result.status, 200);

    const redirectResult = await fetchOnce(baseUrl + '/redirect-once');
    assert.equal(redirectResult.ok, true);
    assert.equal(redirectResult.status, 302, 'fetchOnce must return the raw redirect status, not follow it');
  } finally {
    server.close();
  }
});

test('fetchOnce sends the documented User-Agent by default', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await fetchOnce(baseUrl + '/echo-ua');
    const body = await result.response.text();
    assert.equal(body, DEFAULT_USER_AGENT);
  } finally {
    server.close();
  }
});

test('fetchOnce classifies a timeout as { type: "timeout" }', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await fetchOnce(baseUrl + '/never-responds', { timeoutMs: 200 });
    assert.equal(result.ok, false);
    assert.equal(result.error.type, 'timeout');
  } finally {
    server.close();
  }
});

test('fetchOnce classifies a connection failure as a network error', async () => {
  // Grab an ephemeral loopback port, close the server immediately, then
  // connect to that now-closed port — a reliable, network-free way to
  // trigger a genuine ECONNREFUSED (low, "well-known" ports like 1 are
  // blocked by fetch()'s own restricted-port list with a different,
  // non-network "bad port" error, so they don't exercise this path).
  const probe = createServer();
  const closedPort = await new Promise((resolveServer) => {
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolveServer(port));
    });
  });

  const result = await fetchOnce(`http://127.0.0.1:${closedPort}/`, { timeoutMs: 3000 });
  assert.equal(result.ok, false);
  assert.equal(result.error.type, 'network');
  assert.equal(result.error.code, 'ECONNREFUSED');
});

test('fetchOnce classifies a malformed URL without throwing', async () => {
  const result = await fetchOnce('not a url at all');
  assert.equal(result.ok, false);
  assert.ok(result.error.type);
});

test('readBodyCapped reads a normal body fully and reports truncated:false', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await fetchOnce(baseUrl + '/ok');
    const { text, truncated } = await readBodyCapped(result.response);
    assert.match(text, /ok/);
    assert.equal(truncated, false);
  } finally {
    server.close();
  }
});

test('readBodyCapped truncates a response larger than maxBytes', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await fetchOnce(baseUrl + '/big-body');
    const { text, truncated } = await readBodyCapped(result.response, 100);
    assert.equal(truncated, true);
    assert.equal(text.length, 100);
  } finally {
    server.close();
  }
});

test('fetchFollowingRedirects follows a single redirect to the terminal response', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await fetchFollowingRedirects(baseUrl + '/redirect-once');
    assert.equal(result.status, 200);
    assert.equal(result.finalUrl, baseUrl + '/ok');
    assert.equal(result.redirectChain.length, 1);
    assert.equal(result.redirectChain[0].status, 302);
    assert.equal(result.error, null);
    assert.match(result.body, /ok/);
  } finally {
    server.close();
  }
});

test('fetchFollowingRedirects records the full multi-hop redirect chain', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await fetchFollowingRedirects(baseUrl + '/redirect-chain-1');
    assert.equal(result.status, 200);
    assert.equal(result.finalUrl, baseUrl + '/ok');
    assert.equal(result.redirectChain.length, 2);
    assert.equal(result.redirectChain[0].url, baseUrl + '/redirect-chain-1');
    assert.equal(result.redirectChain[1].url, baseUrl + '/redirect-chain-2');
  } finally {
    server.close();
  }
});

test('fetchFollowingRedirects detects a redirect loop instead of hanging', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await fetchFollowingRedirects(baseUrl + '/loop-a');
    assert.equal(result.status, null);
    assert.equal(result.error.type, 'redirect_loop');
  } finally {
    server.close();
  }
});

test('fetchFollowingRedirects reports a 3xx with no Location header as an error, not a silent stop', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await fetchFollowingRedirects(baseUrl + '/redirect-no-location');
    assert.equal(result.error.type, 'redirect_no_location');
  } finally {
    server.close();
  }
});

test('fetchFollowingRedirects surfaces a 500 as a normal terminal response, not an error', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await fetchFollowingRedirects(baseUrl + '/error-500');
    assert.equal(result.status, 500);
    assert.equal(result.error, null);
    assert.match(result.body, /server error/);
  } finally {
    server.close();
  }
});

test('fetchFollowingRedirects propagates a timeout as an error result, never throws', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await fetchFollowingRedirects(baseUrl + '/never-responds', { timeoutMs: 200 });
    assert.equal(result.error.type, 'timeout');
    assert.equal(result.status, null);
  } finally {
    server.close();
  }
});

test('fetchFollowingRedirects with readBody:false skips reading the body (HEAD-style status check)', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await fetchFollowingRedirects(baseUrl + '/ok', { readBody: false });
    assert.equal(result.status, 200);
    assert.equal(result.body, null);
  } finally {
    server.close();
  }
});

test('fetchFollowingRedirects never throws for a malformed URL', async () => {
  const result = await fetchFollowingRedirects('definitely not a url');
  assert.ok(result.error);
  assert.equal(result.status, null);
});

// ---------- SSRF / private-network protection ----------

test('fetchOnce refuses a private-network URL directly, before any request would be attempted', async () => {
  const started = Date.now();
  const result = await fetchOnce('http://169.254.169.254/latest/meta-data/', { timeoutMs: 5000 });
  const elapsed = Date.now() - started;
  assert.equal(result.ok, false);
  assert.equal(result.error.type, 'blocked_private_network');
  assert.match(result.error.message, /169\.254\.169\.254/);
  // A real attempt to an unreachable address would take until the timeout
  // (5000ms here) to fail; resolving near-instantly is itself evidence the
  // request was never made, not just that it failed fast.
  assert.ok(elapsed < 1000, `expected a near-instant rejection, took ${elapsed}ms`);
});

test('fetchOnce allows an ordinary public/loopback target through unaffected', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await fetchOnce(baseUrl + '/ok');
    assert.equal(result.ok, true);
    assert.equal(result.status, 200);
  } finally {
    server.close();
  }
});

test('fetchFollowingRedirects blocks a redirect to a private IPv4 target before fetching it, even though the initial request was an allowed loopback URL', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await fetchFollowingRedirects(baseUrl + '/redirect-to-private', { timeoutMs: 5000 });
    assert.equal(result.error.type, 'blocked_private_network');
    // The chain must show exactly the one (allowed) hop that was actually
    // fetched -- the dangerous second request must never have happened, so
    // there is nothing beyond it to record.
    assert.equal(result.redirectChain.length, 1);
    assert.equal(result.redirectChain[0].location, 'http://192.168.1.1/admin');
  } finally {
    server.close();
  }
});

test('fetchFollowingRedirects blocks a redirect to the cloud metadata address', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await fetchFollowingRedirects(baseUrl + '/redirect-to-metadata', { timeoutMs: 5000 });
    assert.equal(result.error.type, 'blocked_private_network');
    assert.match(result.error.message, /169\.254\.169\.254/);
  } finally {
    server.close();
  }
});

test('fetchFollowingRedirects blocks at whichever hop first becomes private, even several hops into a chain', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await fetchFollowingRedirects(baseUrl + '/multi-hop-then-private', { timeoutMs: 5000 });
    assert.equal(result.error.type, 'blocked_private_network');
    // Two allowed loopback hops happened before the block: the original
    // request, then /redirect-to-private -- both fine -- then the third
    // target (the literal private IP) is where it stops.
    assert.equal(result.redirectChain.length, 2);
    assert.equal(result.redirectChain[1].location, 'http://192.168.1.1/admin');
  } finally {
    server.close();
  }
});

test('allowPrivateNetwork:true deliberately lifts the block, as an explicit opt-in', async () => {
  const result = await fetchOnce('http://169.254.169.254/latest/meta-data/', { timeoutMs: 3000, allowPrivateNetwork: true });
  // Nothing real listens at this address in the test environment, so this
  // must still fail overall — the point is *how* it fails. Whether the
  // underlying network stack rejects it quickly (e.g. no route to host) or
  // slowly (timeout) is environment-dependent and not what's under test
  // here; what matters, deterministically, is that it is no longer rejected
  // by *our* guard before ever reaching the network.
  assert.equal(result.ok, false);
  assert.notEqual(result.error.type, 'blocked_private_network');
  assert.ok(['network', 'timeout', 'unknown'].includes(result.error.type), `expected a real network-layer failure type, got "${result.error.type}"`);
});

test('allowPrivateNetwork:true on fetchFollowingRedirects also applies per-hop, not just to the initial URL', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await fetchFollowingRedirects(baseUrl + '/redirect-to-private', { timeoutMs: 3000, allowPrivateNetwork: true });
    // Same reasoning as above: the redirect hop must actually be attempted
    // (proven by the error no longer being our synchronous guard), not by
    // how long the resulting real network failure happens to take.
    assert.notEqual(result.error && result.error.type, 'blocked_private_network');
    assert.equal(result.redirectChain.length, 1, 'the redirect to the private target must still be recorded as having been followed');
  } finally {
    server.close();
  }
});

test('fetchFollowingRedirects blocks a redirect to a private IPv6 target before fetching it', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await fetchFollowingRedirects(baseUrl + '/redirect-to-private-ipv6', { timeoutMs: 5000 });
    assert.equal(result.error.type, 'blocked_private_network');
    assert.equal(result.redirectChain.length, 1, 'the dangerous IPv6 hop must never have been fetched');
    assert.equal(result.redirectChain[0].location, 'http://[fc00::1]/internal');
  } finally {
    server.close();
  }
});

test('a request made against the literal "localhost" hostname (not just 127.0.0.1) succeeds unaffected', async () => {
  const { server, baseUrl } = await startFixtureServer();
  const localhostUrl = baseUrl.replace('127.0.0.1', 'localhost');
  try {
    await withLocalhostForcedToIPv4(async () => {
      const result = await fetchOnce(localhostUrl + '/ok');
      assert.equal(result.ok, true);
      assert.equal(result.status, 200);
    });
  } finally {
    server.close();
  }
});

test('a localhost -> localhost redirect (the relative Location preserves the "localhost" host) remains allowed', async () => {
  const { server, baseUrl } = await startFixtureServer();
  const localhostUrl = baseUrl.replace('127.0.0.1', 'localhost');
  try {
    await withLocalhostForcedToIPv4(async () => {
      const result = await fetchFollowingRedirects(localhostUrl + '/redirect-once');
      assert.equal(result.error, null);
      assert.equal(result.status, 200);
      assert.equal(result.finalUrl, localhostUrl + '/ok');
    });
  } finally {
    server.close();
  }
});

test('a localhost -> private-network redirect is still blocked (starting from an allowed host does not grant the next hop a pass)', async () => {
  const { server, baseUrl } = await startFixtureServer();
  const localhostUrl = baseUrl.replace('127.0.0.1', 'localhost');
  try {
    await withLocalhostForcedToIPv4(async () => {
      const result = await fetchFollowingRedirects(localhostUrl + '/redirect-to-private');
      assert.equal(result.error.type, 'blocked_private_network');
      assert.equal(result.redirectChain.length, 1, 'only the allowed localhost hop was fetched; the private hop was refused');
    });
  } finally {
    server.close();
  }
});
