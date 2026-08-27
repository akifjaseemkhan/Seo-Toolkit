import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
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
