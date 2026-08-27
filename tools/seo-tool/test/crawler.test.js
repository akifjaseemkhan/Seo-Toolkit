import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { crawl } from '../lib/crawler.js';
import { buildLinkGraph } from '../lib/link-graph.js';

// A tiny fixture site served over loopback HTTP — no external network
// access, no dependency needed. Covers: internal links, a redirect hop,
// a 404, an external link (not followed by default), and a robots.txt
// disallow rule.
const ROUTES = {
  '/': `<html><head><title>Home</title></head><body>
    <a href="/a">A</a>
    <a href="/b">B (redirects)</a>
    <a href="/missing">Missing</a>
    <a href="/blocked">Blocked</a>
    <a href="https://external.invalid/page">External</a>
  </body></html>`,
  '/a': `<html><head><title>Page A</title></head><body><a href="/c">C</a><a href="/">Home</a></body></html>`,
  '/c': `<html><head><title>Page C</title></head><body>Leaf page.</body></html>`,
  '/b-new': `<html><head><title>Page B New</title><link rel="canonical" href="/b-new"><link rel="alternate" hreflang="en" href="/b-new"></head><body>Landed after redirect.</body></html>`,
  '/blocked': `<html><head><title>Should not be fetched</title></head><body></body></html>`,
  '/robots.txt': `User-agent: *\nDisallow: /blocked\n`,
};

function startFixtureServer() {
  const server = createServer((req, res) => {
    if (req.url === '/b') {
      res.writeHead(302, { Location: '/b-new' });
      res.end();
      return;
    }
    if (req.url === '/missing') {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<html><body>Not found</body></html>');
      return;
    }
    const body = ROUTES[req.url];
    if (body) {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(body);
    } else {
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<html><body>Not found</body></html>');
    }
  });
  return new Promise((resolveServer) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address();
      resolveServer({ server, baseUrl: `http://127.0.0.1:${port}` });
    });
  });
}

test('crawl() discovers pages, follows redirects, records 404s, respects robots.txt, and does not follow external links by default', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await crawl(baseUrl + '/', { maxPages: 20, delayMs: 0, concurrency: 2, timeoutMs: 5000 });

    assert.equal(result.errors.length, 0, `unexpected errors: ${JSON.stringify(result.errors)}`);

    const byPath = (p) => new URL(p, baseUrl).toString();
    const findPage = (url) => result.pages.find((pg) => pg.requestedUrl === url);

    const home = findPage(byPath('/'));
    assert.ok(home, 'home page should be in results');
    assert.equal(home.title, 'Home');
    assert.equal(home.status, 200);

    const a = findPage(byPath('/a'));
    assert.ok(a, 'page /a should be discovered and fetched');
    assert.equal(a.title, 'Page A');
    assert.deepEqual(a.discoveredFrom, [byPath('/')]);

    const c = findPage(byPath('/c'));
    assert.ok(c, 'page /c should be discovered via /a');
    assert.equal(c.title, 'Page C');

    const b = findPage(byPath('/b'));
    assert.ok(b, 'redirecting page /b should be recorded');
    assert.equal(b.status, 200); // final status after following the redirect
    assert.equal(b.finalUrl, byPath('/b-new'));
    assert.equal(b.redirectChain.length, 1);
    assert.equal(b.redirectChain[0].status, 302);
    // The landing page's canonical is root-relative ("/b-new") — it must
    // resolve against the page's real, post-redirect final URL, not the
    // originally-requested /b.
    assert.equal(b.canonical, byPath('/b-new'), 'a relative canonical on a redirected page must resolve against the final URL, not the requested one');
    // Same principle for hreflang: it must resolve — and self-reference —
    // against the real final URL, not the originally-requested one.
    assert.equal(b.hreflangCount, 1);
    assert.equal(b.hreflangTags[0].href, byPath('/b-new'));
    assert.equal(b.selfReferencingHreflang, true, 'the hreflang entry resolves to the page\'s own post-redirect URL');

    const missing = findPage(byPath('/missing'));
    assert.ok(missing, '404 page should be recorded, not dropped');
    assert.equal(missing.status, 404);

    const blocked = findPage(byPath('/blocked'));
    assert.ok(blocked, 'robots-blocked page should be recorded as skipped, not silently omitted');
    assert.equal(blocked.skipped, true);
    assert.equal(blocked.skipReason, 'blocked by robots.txt');

    const external = result.pages.find((pg) => pg.requestedUrl === 'https://external.invalid/page');
    assert.equal(external, undefined, 'external link should not be crawled by default');

    // No duplicate fetches: /  is linked from nowhere else, /a linked once from home,
    // and /a's own link back to "/" must not cause a second fetch of home.
    const homeFetches = result.pages.filter((pg) => pg.requestedUrl === byPath('/'));
    assert.equal(homeFetches.length, 1);
  } finally {
    server.close();
  }
});

test('crawl() respects maxPages and reports truncation', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await crawl(baseUrl + '/', { maxPages: 1, delayMs: 0, concurrency: 1, timeoutMs: 5000 });
    assert.equal(result.pages.length, 1);
    assert.equal(result.truncatedByMaxPages, true);
  } finally {
    server.close();
  }
});

test('crawl() with includeExternal records a status check for external links without expanding them', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    // external.invalid will fail DNS/connection — that's fine, it should be
    // recorded as an error, not thrown, and never crash the crawl.
    const result = await crawl(baseUrl + '/', { maxPages: 20, delayMs: 0, concurrency: 2, timeoutMs: 3000, includeExternal: true });
    const external = result.pages.find((pg) => pg.requestedUrl === 'https://external.invalid/page');
    assert.ok(external, 'external link should be attempted when includeExternal is set');
    assert.equal(external.internalLinks, undefined, 'external pages are never expanded for their own links');
  } finally {
    server.close();
  }
});

test('crawl() + buildLinkGraph together flag the 404 as a broken internal link', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const result = await crawl(baseUrl + '/', { maxPages: 20, delayMs: 0, concurrency: 2, timeoutMs: 5000 });
    const graph = buildLinkGraph(result.pages, baseUrl + '/');
    const brokenTargets = graph.brokenInternalLinks.map((b) => b.to);
    assert.ok(brokenTargets.includes(new URL('/missing', baseUrl).toString()));
  } finally {
    server.close();
  }
});
