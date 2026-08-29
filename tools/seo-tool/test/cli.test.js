import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';

import { parseArgs, num } from '../cli.js';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const CLI_PATH = join(__dirname, '..', 'cli.js');

/**
 * Run the real CLI as a real subprocess — this is deliberately an
 * integration test of the actual shipped behavior (dispatch, exit codes,
 * output formatting), not a call into an in-process function, so nothing
 * here can pass while the real `node cli.js ...` invocation is broken.
 * Normalizes both success and failure into one shape for easy assertions.
 *
 * `nodeArgs` lets a caller pass extra flags to the `node` invocation itself
 * (before cli.js) — used solely by the "localhost" test below to load the
 * DNS-forcing preload module via `--import`. Every other call site leaves
 * it at the default empty array and is unaffected.
 */
async function runCli(args, options = {}, nodeArgs = []) {
  try {
    const { stdout, stderr } = await execFileAsync('node', [...nodeArgs, CLI_PATH, ...args], { timeout: 15000, ...options });
    return { stdout, stderr, code: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', code: typeof err.code === 'number' ? err.code : 1 };
  }
}

// ---------- fixture server (self-contained, no external websites) ----------

const SITEMAP_XML = `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>SITEMAP_ORIGIN/</loc></url>
  <url><loc>SITEMAP_ORIGIN/orphan</loc></url>
</urlset>`;

const ROBOTS_TXT = `User-agent: *\nDisallow: /blocked\nSitemap: SITEMAP_ORIGIN/sitemap.xml\n`;

function startFixtureServer() {
  const server = createServer((req, res) => {
    const origin = `http://127.0.0.1:${server.address() ? server.address().port : ''}`;
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>CLI Fixture Home</title></head><body><a href="/about">About</a></body></html>');
      return;
    }
    if (req.url === '/about') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>About</title></head><body>About page.</body></html>');
      return;
    }
    if (req.url === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(ROBOTS_TXT.replaceAll('SITEMAP_ORIGIN', origin));
      return;
    }
    if (req.url === '/sitemap.xml') {
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(SITEMAP_XML.replaceAll('SITEMAP_ORIGIN', origin));
      return;
    }
    if (req.url === '/sitemap-index.xml') {
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(
        `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><sitemap><loc>${origin}/sitemap.xml</loc></sitemap></sitemapindex>`
      );
      return;
    }
    if (req.url === '/multi-canonical') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        '<html><head><title>Multi Canonical</title><link rel="canonical" href="/canonical-target"><link rel="canonical" href="https://elsewhere.example.com/other"></head><body>x</body></html>'
      );
      return;
    }
    if (req.url === '/international') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        '<html><head><title>International Page</title>' +
          '<link rel="alternate" hreflang="en-US" href="/international">' +
          '<link rel="alternate" hreflang="fr-FR" href="/fr/international">' +
          '<link rel="alternate" hreflang="en_GB" href="/gb/international">' +
          '</head><body>x</body></html>'
      );
      return;
    }
    if (req.url === '/robots-conflict') {
      res.writeHead(200, { 'Content-Type': 'text/html', 'X-Robots-Tag': 'noindex' });
      res.end('<html><head><title>Conflicting Robots Signals</title><meta name="robots" content="index, follow"></head><body>x</body></html>');
      return;
    }
    if (req.url === '/incomplete-jsonld') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        '<html><head><title>Incomplete Schema</title>' +
          '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme"}</script>' +
          '<script type="application/ld+json">{"name":"Missing context and type"}</script>' +
          '</head><body>x</body></html>'
      );
      return;
    }
    if (req.url === '/with-charset-and-favicon') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        '<html><head><meta charset="utf-8"><link rel="icon" href="/favicon.png"><title>Has Charset And Favicon</title></head><body>x</body></html>'
      );
      return;
    }
    if (req.url === '/og-url-mismatch') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        `<html><head><title>OG Mismatch</title><link rel="canonical" href="${origin}/og-url-mismatch"><meta property="og:url" content="${origin}/old-og-url"></head><body>x</body></html>`
      );
      return;
    }
    if (req.url === '/images-no-dimensions') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        '<html><head><title>Images Without Dimensions</title></head><body>' +
          '<img src="/a.jpg" width="600" height="400">' +
          '<img src="/b.jpg">' +
          '</body></html>'
      );
      return;
    }
    if (req.url === '/paginated-page-2') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        '<html><head><title>Paginated Page 2</title>' +
          '<link rel="canonical" href="/paginated-page-1">' +
          '<link rel="next" href="/paginated-page-3">' +
          '<link rel="prev" href="/paginated-page-1">' +
          '</head><body>x</body></html>'
      );
      return;
    }
    // A small, self-contained subtree (not linked from / or /about) so this
    // fixture can be crawled on its own without disturbing other tests'
    // "Pages fetched: N" assertions against the main / -> /about tree.
    if (req.url === '/dup-start') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>Duplicate Start</title></head><body><a href="/dup-a">A</a><a href="/dup-b">B</a></body></html>');
      return;
    }
    if (req.url === '/dup-a' || req.url === '/dup-b') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>Same Title</title><meta name="description" content="Same description."></head><body>x</body></html>');
      return;
    }
    // Another small, self-contained subtree (not linked from / or /about)
    // for the internal-links-through-redirects tests below.
    if (req.url === '/redirect-link-start') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>Redirect Link Start</title></head><body><a href="/old-page">Old</a></body></html>');
      return;
    }
    if (req.url === '/old-page') {
      res.writeHead(302, { Location: '/new-page' });
      res.end();
      return;
    }
    if (req.url === '/new-page') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>New Page</title></head><body>x</body></html>');
      return;
    }
    // Another small, self-contained subtree (not linked from / or /about)
    // for the hreflang-reciprocity tests below: /hreflang-en declares a
    // link to /hreflang-fr, but /hreflang-fr never declares one back.
    if (req.url === '/hreflang-start') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>Hreflang Start</title></head><body><a href="/hreflang-en">EN</a><a href="/hreflang-fr">FR</a></body></html>');
      return;
    }
    if (req.url === '/hreflang-en') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(
        '<html><head><title>English</title>' +
          '<link rel="alternate" hreflang="en-US" href="/hreflang-en">' +
          '<link rel="alternate" hreflang="fr-FR" href="/hreflang-fr">' +
          '</head><body>x</body></html>'
      );
      return;
    }
    if (req.url === '/hreflang-fr') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>French</title><link rel="alternate" hreflang="fr-FR" href="/hreflang-fr"></head><body>x</body></html>');
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

// Preload module (loaded into the CLI *subprocess* via `node --import`)
// that forces the literal "localhost" hostname to resolve to the IPv4
// loopback address only — see test/support/force-localhost-ipv4.mjs for the
// full explanation. This is what lets the "localhost" CLI test below reuse
// the plain, proven-in-CI startFixtureServer() (127.0.0.1-only) instead of
// needing a real IPv6 listener, since which address family the OS/Node
// would otherwise resolve "localhost" to (and whether it falls back to the
// other one, and how fast) is not something this test can control or
// portably rely on inside a real child process.
const FORCE_LOCALHOST_IPV4_PRELOAD = pathToFileURL(join(__dirname, 'support', 'force-localhost-ipv4.mjs')).href;

// ---------- parseArgs / num (pure, direct unit tests) ----------

test('parseArgs separates positional arguments from --flags', () => {
  const { positional, flags } = parseArgs(['crawl', 'https://example.com', '--max-pages=5', '--include-external']);
  assert.deepEqual(positional, ['crawl', 'https://example.com']);
  assert.deepEqual(flags, { 'max-pages': '5', 'include-external': true });
});

test('parseArgs treats a bare --flag (no =value) as boolean true', () => {
  const { flags } = parseArgs(['--json']);
  assert.equal(flags.json, true);
});

test('parseArgs preserves a --flag=path value as a string, including one containing slashes', () => {
  const { flags } = parseArgs(['--json=out/report.json']);
  assert.equal(flags.json, 'out/report.json');
});

test('parseArgs handles an empty argv', () => {
  const { positional, flags } = parseArgs([]);
  assert.deepEqual(positional, []);
  assert.deepEqual(flags, {});
});

test('num parses a numeric flag and falls back to the default when absent or non-numeric', () => {
  assert.equal(num({ 'max-pages': '25' }, 'max-pages', 50), 25);
  assert.equal(num({}, 'max-pages', 50), 50);
  assert.equal(num({ 'max-pages': 'not-a-number' }, 'max-pages', 50), 50);
});

// ---------- CLI dispatch / usage errors (no network needed) ----------

test('CLI with no arguments prints help and exits 0', async () => {
  const { stdout, code } = await runCli([]);
  assert.equal(code, 0);
  assert.match(stdout, /seo-tool — small, read-only local SEO inspection CLI/);
  assert.match(stdout, /Usage:/);
});

test('CLI --help / help / -h all print the same help text', async () => {
  for (const arg of ['--help', 'help', '-h']) {
    const { stdout, code } = await runCli([arg]);
    assert.equal(code, 0, `expected exit 0 for "${arg}"`);
    assert.match(stdout, /Usage:/);
  }
});

test('CLI rejects an unknown command with a clear message and exit code 1', async () => {
  const { stdout, stderr, code } = await runCli(['frobnicate']);
  assert.equal(code, 1);
  assert.match(stderr, /Unknown command: frobnicate/);
  assert.match(stdout, /Usage:/, 'help should still be shown as guidance');
});

test('CLI requires a URL for crawl and exits 1 with a usage message when missing', async () => {
  const { stderr, code } = await runCli(['crawl']);
  assert.equal(code, 1);
  assert.match(stderr, /Usage: seo-tool crawl <url>/);
});

test('CLI requires a URL for page and exits 1 with a usage message when missing', async () => {
  const { stderr, code } = await runCli(['page']);
  assert.equal(code, 1);
  assert.match(stderr, /Usage: seo-tool page <url>/);
});

test('CLI requires a target for sitemap and exits 1 with a usage message when missing', async () => {
  const { stderr, code } = await runCli(['sitemap']);
  assert.equal(code, 1);
  assert.match(stderr, /Usage: seo-tool sitemap <urlOrPath>/);
});

test('CLI requires a target for robots and exits 1 with a usage message when missing', async () => {
  const { stderr, code } = await runCli(['robots']);
  assert.equal(code, 1);
  assert.match(stderr, /Usage: seo-tool robots <urlOrPath>/);
});

test('CLI requires a URL for audit and exits 1 with a usage message when missing', async () => {
  const { stderr, code } = await runCli(['audit']);
  assert.equal(code, 1);
  assert.match(stderr, /Usage: seo-tool audit <url>/);
});

test('CLI project runs without a path argument (defaults to cwd) and exits 0', async () => {
  const { stdout, code } = await runCli(['project'], { cwd: __dirname });
  assert.equal(code, 0);
  assert.match(stdout, /Project:/);
});

// ---------- normal successful execution + output modes (against the local fixture) ----------

test('CLI page: normal successful execution produces the expected human-readable output', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/`]);
    assert.equal(code, 0);
    assert.match(stdout, /Status: 200/);
    assert.match(stdout, /Title: CLI Fixture Home/);
  } finally {
    server.close();
  }
});

test('CLI page --json prints a single valid JSON report to stdout', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/`, '--json']);
    assert.equal(code, 0);
    const report = JSON.parse(stdout);
    assert.equal(report.meta.command, 'page');
    assert.equal(report.pages[0].status, 200);
    assert.equal(report.pages[0].title, 'CLI Fixture Home');
  } finally {
    server.close();
  }
});

test('CLI page --json surfaces the resolved canonical plus multiple-canonical evidence end-to-end', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/multi-canonical`, '--json']);
    assert.equal(code, 0);
    const page = JSON.parse(stdout).pages[0];
    assert.equal(page.canonical, `${baseUrl}/canonical-target`, 'the first canonical must be resolved to an absolute URL against the page URL');
    assert.equal(page.canonicalCount, 2);
    assert.equal(page.multipleCanonicals, true);
    assert.deepEqual(page.canonicalRawHrefs, ['/canonical-target', 'https://elsewhere.example.com/other']);
  } finally {
    server.close();
  }
});

test('CLI page human-readable output flags multiple declared canonicals instead of silently showing only the first', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/multi-canonical`]);
    assert.equal(code, 0);
    assert.ok(
      stdout.includes(`Canonical: ${baseUrl}/canonical-target (2 canonical tags declared`),
      `expected the Canonical line to flag multiple declarations, got:\n${stdout}`
    );
  } finally {
    server.close();
  }
});

test('CLI page --json surfaces resolved hreflang tags plus self-reference/malformed evidence end-to-end', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/international`, '--json']);
    assert.equal(code, 0);
    const page = JSON.parse(stdout).pages[0];
    assert.equal(page.hreflangCount, 3);
    assert.equal(page.selfReferencingHreflang, true, 'the en-US entry resolves to this page\'s own URL');
    assert.equal(page.hasXDefault, false);
    assert.deepEqual(page.duplicateHreflangValues, []);
    assert.equal(page.malformedHreflang.length, 1);
    assert.equal(page.malformedHreflang[0].hreflang, 'en_GB');
    assert.deepEqual(page.hreflangTags.map((t) => t.hreflang), ['en-US', 'fr-FR', 'en_GB']);
    assert.equal(page.hreflangTags[1].href, `${baseUrl}/fr/international`);
  } finally {
    server.close();
  }
});

test('CLI page human-readable output shows a Hreflang line with self-reference and malformed-count evidence', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/international`]);
    assert.equal(code, 0);
    assert.ok(
      stdout.includes('Hreflang: 3 tag(s), self-referencing: true (1 malformed)'),
      `expected a Hreflang summary line, got:\n${stdout}`
    );
  } finally {
    server.close();
  }
});

test('CLI page human-readable output omits the Hreflang line entirely when a page declares none', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/`]);
    assert.equal(code, 0);
    assert.ok(!stdout.includes('Hreflang:'), 'the home fixture page declares no hreflang tags, so the line should not appear at all');
  } finally {
    server.close();
  }
});

test('CLI page --json surfaces resolved pagination plus the canonical-conflict flag end-to-end', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/paginated-page-2`, '--json']);
    assert.equal(code, 0);
    const page = JSON.parse(stdout).pages[0];
    assert.equal(page.isPaginated, true);
    assert.equal(page.paginationNext, `${baseUrl}/paginated-page-3`);
    assert.equal(page.paginationPrev, `${baseUrl}/paginated-page-1`);
    assert.equal(page.paginationCanonicalConflict, true, 'the canonical points to page 1 instead of self-referencing this page');
  } finally {
    server.close();
  }
});

test('CLI page human-readable output shows a Pagination line flagging the canonical conflict', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/paginated-page-2`]);
    assert.equal(code, 0);
    assert.ok(
      stdout.includes(`Pagination: prev=${baseUrl}/paginated-page-1  next=${baseUrl}/paginated-page-3  (canonical points away from this page`),
      `expected a Pagination line flagging the conflict, got:\n${stdout}`
    );
  } finally {
    server.close();
  }
});

test('CLI page human-readable output omits the Pagination line entirely when a page is not paginated', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/`]);
    assert.equal(code, 0);
    assert.ok(!stdout.includes('Pagination:'), 'the home fixture page has no rel=next/rel=prev, so the line should not appear at all');
  } finally {
    server.close();
  }
});

test('CLI page --json flags a real disagreement between meta robots and the X-Robots-Tag header end-to-end', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/robots-conflict`, '--json']);
    assert.equal(code, 0);
    const page = JSON.parse(stdout).pages[0];
    assert.deepEqual(page.robotsMetaDirectives, ['index', 'follow']);
    assert.deepEqual(page.xRobotsTagDirectives, ['noindex']);
    assert.equal(page.robotsDirectivesConflict, true);
    assert.match(page.robotsDirectivesConflictReasons[0], /meta robots says "index" but X-Robots-Tag says "noindex"/);
  } finally {
    server.close();
  }
});

test('CLI page human-readable output shows the X-Robots-Tag line with a CONFLICT marker when meta and header disagree', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/robots-conflict`]);
    assert.equal(code, 0);
    assert.ok(
      stdout.includes('X-Robots-Tag: noindex  CONFLICT: meta robots says "index" but X-Robots-Tag says "noindex"'),
      `expected an X-Robots-Tag line flagging the conflict, got:\n${stdout}`
    );
  } finally {
    server.close();
  }
});

test('CLI page human-readable output shows the X-Robots-Tag line without a CONFLICT marker when there is no disagreement', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/`]);
    assert.equal(code, 0);
    assert.ok(stdout.includes('X-Robots-Tag: (none)'), `expected a plain X-Robots-Tag line, got:\n${stdout}`);
    assert.ok(!stdout.includes('CONFLICT'), 'the home fixture page has no X-Robots-Tag header at all, so there is nothing to disagree with');
  } finally {
    server.close();
  }
});

test('CLI page --json flags JSON-LD blocks missing @context/@type end-to-end', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/incomplete-jsonld`, '--json']);
    assert.equal(code, 0);
    const page = JSON.parse(stdout).pages[0];
    assert.equal(page.jsonLd.length, 2);
    assert.deepEqual(page.jsonLd[0].missingRequiredProperties, [], 'the first block declares both @context and @type');
    assert.deepEqual(page.jsonLd[1].missingRequiredProperties.sort(), ['@context', '@type'], 'the second block declares neither');
  } finally {
    server.close();
  }
});

test('CLI page human-readable output shows a missing @context/@type count on the JSON-LD line when applicable', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/incomplete-jsonld`]);
    assert.equal(code, 0);
    assert.ok(stdout.includes('JSON-LD blocks: 2 (1 missing @context/@type)'), `expected the JSON-LD line to flag the incomplete block, got:\n${stdout}`);
  } finally {
    server.close();
  }
});

test('CLI page human-readable output shows no missing-property note when every JSON-LD block is complete', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/`]);
    assert.equal(code, 0);
    assert.ok(stdout.includes('JSON-LD blocks: 0'), `expected a plain JSON-LD line for a page with no blocks at all, got:\n${stdout}`);
    assert.ok(!stdout.includes('missing @context/@type'), 'the home fixture page has no JSON-LD at all, so there is nothing to flag');
  } finally {
    server.close();
  }
});

test('CLI page --json flags images missing explicit width/height end-to-end', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/images-no-dimensions`, '--json']);
    assert.equal(code, 0);
    const page = JSON.parse(stdout).pages[0];
    assert.equal(page.images.length, 2);
    assert.equal(page.images[0].hasExplicitDimensions, true);
    assert.equal(page.images[1].hasExplicitDimensions, false);
    assert.equal(page.imagesMissingDimensions, 1);
  } finally {
    server.close();
  }
});

test('CLI page human-readable output shows the images-missing-dimensions count alongside images-missing-alt', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/images-no-dimensions`]);
    assert.equal(code, 0);
    assert.ok(stdout.includes('Images missing dimensions: 1'), `expected the images-missing-dimensions line, got:\n${stdout}`);
  } finally {
    server.close();
  }
});

test('CLI page --json flags a real og:url/canonical mismatch end-to-end', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/og-url-mismatch`, '--json']);
    assert.equal(code, 0);
    const page = JSON.parse(stdout).pages[0];
    assert.equal(page.canonical, `${baseUrl}/og-url-mismatch`);
    assert.equal(page.openGraph.url, `${baseUrl}/old-og-url`);
    assert.equal(page.ogUrlCanonicalMismatch, true);
  } finally {
    server.close();
  }
});

test('CLI page human-readable output shows a MISMATCH line when og:url disagrees with canonical', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const mismatch = await runCli(['page', `${baseUrl}/og-url-mismatch`]);
    assert.equal(mismatch.code, 0);
    assert.ok(mismatch.stdout.includes('MISMATCH: og:url'), `expected a MISMATCH line, got:\n${mismatch.stdout}`);

    const noMismatch = await runCli(['page', `${baseUrl}/`]);
    assert.equal(noMismatch.code, 0);
    assert.ok(!noMismatch.stdout.includes('MISMATCH'), 'the home fixture page declares no og:url at all, so there is nothing to compare');
  } finally {
    server.close();
  }
});

test('CLI page --json surfaces charset and favicon presence end-to-end', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const withBoth = await runCli(['page', `${baseUrl}/with-charset-and-favicon`, '--json']);
    assert.equal(withBoth.code, 0);
    const pageWithBoth = JSON.parse(withBoth.stdout).pages[0];
    assert.equal(pageWithBoth.charset, 'utf-8');
    assert.equal(pageWithBoth.hasFavicon, true);
    assert.equal(pageWithBoth.faviconHref, `${baseUrl}/favicon.png`);

    const withoutEither = await runCli(['page', `${baseUrl}/`, '--json']);
    assert.equal(withoutEither.code, 0);
    const pageWithoutEither = JSON.parse(withoutEither.stdout).pages[0];
    assert.equal(pageWithoutEither.charset, null);
    assert.equal(pageWithoutEither.hasFavicon, false);
  } finally {
    server.close();
  }
});

test('CLI page human-readable output shows the Charset/Favicon line', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const withBoth = await runCli(['page', `${baseUrl}/with-charset-and-favicon`]);
    assert.equal(withBoth.code, 0);
    assert.ok(withBoth.stdout.includes('Charset: utf-8  Favicon: declared'), `expected the Charset/Favicon line, got:\n${withBoth.stdout}`);

    const withoutEither = await runCli(['page', `${baseUrl}/`]);
    assert.equal(withoutEither.code, 0);
    assert.ok(withoutEither.stdout.includes('Charset: (missing)  Favicon: (not declared)'), `expected the missing-case line, got:\n${withoutEither.stdout}`);
  } finally {
    server.close();
  }
});

test('CLI page --json=path writes the report to that file and confirms it on stdout', async () => {
  const { server, baseUrl } = await startFixtureServer();
  const tmpDir = mkdtempSync(join(tmpdir(), 'seo-tool-cli-test-'));
  const outPath = join(tmpDir, 'report.json');
  try {
    const { stdout, code } = await runCli(['page', `${baseUrl}/`, `--json=${outPath}`]);
    assert.equal(code, 0);
    assert.match(stdout, /Wrote JSON report to/);
    assert.equal(existsSync(outPath), true);
    const written = JSON.parse(readFileSync(outPath, 'utf-8'));
    assert.equal(written.pages[0].title, 'CLI Fixture Home');
  } finally {
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CLI page against an unreachable URL reports the error and exits 1 (a real failure, not a crash)', async () => {
  // A closed loopback port — deterministic connection failure, no external network.
  const probe = createServer();
  const closedPort = await new Promise((resolveServer) => {
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address();
      probe.close(() => resolveServer(port));
    });
  });
  const { stdout, code } = await runCli(['page', `http://127.0.0.1:${closedPort}/`]);
  assert.equal(code, 1);
  assert.match(stdout, /ERROR:/);
});

test('CLI page rejects a syntactically invalid URL gracefully (no stack trace, no hang)', async () => {
  const { code, stdout, stderr } = await runCli(['page', 'not-a-real-url']);
  assert.equal(code, 1);
  assert.equal(/at\s+\S+\s+\(/.test(stderr), false, 'should not print a raw stack trace');
  assert.match(stdout, /ERROR:/);
});

test('CLI crawl: normal successful execution against the fixture site', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['crawl', `${baseUrl}/`, '--max-pages=5', '--delay=0']);
    assert.equal(code, 0);
    assert.match(stdout, /Pages fetched: 2/);
  } finally {
    server.close();
  }
});

test('CLI crawl --json surfaces duplicateTitles/duplicateMetaDescriptions end-to-end for real crawled pages', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['crawl', `${baseUrl}/dup-start`, '--max-pages=5', '--delay=0', '--json']);
    assert.equal(code, 0);
    const report = JSON.parse(stdout);
    assert.equal(report.duplicateContent.duplicateTitles.length, 1);
    assert.equal(report.duplicateContent.duplicateTitles[0].value, 'Same Title');
    assert.deepEqual(report.duplicateContent.duplicateTitles[0].urls.sort(), [`${baseUrl}/dup-a`, `${baseUrl}/dup-b`]);
    assert.equal(report.duplicateContent.duplicateMetaDescriptions.length, 1);
    assert.equal(report.duplicateContent.duplicateMetaDescriptions[0].value, 'Same description.');
  } finally {
    server.close();
  }
});

test('CLI crawl human-readable output shows duplicate title/description counts when present, nothing when absent', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const withDupes = await runCli(['crawl', `${baseUrl}/dup-start`, '--max-pages=5', '--delay=0']);
    assert.equal(withDupes.code, 0);
    assert.match(withDupes.stdout, /Duplicate titles: 1 group\(s\)\s+Duplicate meta descriptions: 1 group\(s\)/);

    const withoutDupes = await runCli(['crawl', `${baseUrl}/`, '--max-pages=5', '--delay=0']);
    assert.equal(withoutDupes.code, 0);
    assert.ok(!withoutDupes.stdout.includes('Duplicate titles'), 'the / -> /about tree has no duplicate titles/descriptions, so the line should not appear');
  } finally {
    server.close();
  }
});

test('CLI crawl --json flags an internal link that only resolves after a redirect', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['crawl', `${baseUrl}/redirect-link-start`, '--max-pages=5', '--delay=0', '--json']);
    assert.equal(code, 0);
    const report = JSON.parse(stdout);
    assert.equal(report.linkGraph.internalLinksThroughRedirects.length, 1);
    const finding = report.linkGraph.internalLinksThroughRedirects[0];
    assert.equal(finding.from, `${baseUrl}/redirect-link-start`);
    assert.equal(finding.to, `${baseUrl}/old-page`);
    assert.equal(finding.finalUrl, `${baseUrl}/new-page`);
    assert.equal(finding.redirectHops, 1);
  } finally {
    server.close();
  }
});

test('CLI crawl human-readable output shows the internal-links-through-redirects count', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const withRedirectLink = await runCli(['crawl', `${baseUrl}/redirect-link-start`, '--max-pages=5', '--delay=0']);
    assert.equal(withRedirectLink.code, 0);
    assert.match(withRedirectLink.stdout, /Internal links through a redirect: 1/);

    const withoutRedirectLink = await runCli(['crawl', `${baseUrl}/`, '--max-pages=5', '--delay=0']);
    assert.equal(withoutRedirectLink.code, 0);
    assert.match(withoutRedirectLink.stdout, /Internal links through a redirect: 0/);
  } finally {
    server.close();
  }
});

test('CLI crawl --json flags a non-reciprocal hreflang link between two real crawled pages', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['crawl', `${baseUrl}/hreflang-start`, '--max-pages=5', '--delay=0', '--json']);
    assert.equal(code, 0);
    const report = JSON.parse(stdout);
    assert.equal(report.hreflangReciprocity.nonReciprocalHreflang.length, 1);
    const finding = report.hreflangReciprocity.nonReciprocalHreflang[0];
    assert.equal(finding.from, `${baseUrl}/hreflang-en`);
    assert.equal(finding.to, `${baseUrl}/hreflang-fr`);
    assert.equal(finding.hreflang, 'fr-FR');
  } finally {
    server.close();
  }
});

test('CLI crawl human-readable output shows the non-reciprocal-hreflang count only when there is something to report', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const withNonReciprocal = await runCli(['crawl', `${baseUrl}/hreflang-start`, '--max-pages=5', '--delay=0']);
    assert.equal(withNonReciprocal.code, 0);
    assert.match(withNonReciprocal.stdout, /Non-reciprocal hreflang links: 1/);

    const withoutAnyHreflang = await runCli(['crawl', `${baseUrl}/`, '--max-pages=5', '--delay=0']);
    assert.equal(withoutAnyHreflang.code, 0);
    assert.ok(!withoutAnyHreflang.stdout.includes('Non-reciprocal hreflang links'), 'the plain fixture tree declares no hreflang at all, so the line should not appear');
  } finally {
    server.close();
  }
});

test('CLI robots: dispatches correctly and reports the parsed groups', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['robots', `${baseUrl}/robots.txt`]);
    assert.equal(code, 0);
    assert.match(stdout, /Groups: 1/);
  } finally {
    server.close();
  }
});

test('CLI sitemap: normal urlset dispatch, human output and --json agree on entry count', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const human = await runCli(['sitemap', `${baseUrl}/sitemap.xml`]);
    assert.equal(human.code, 0);
    assert.match(human.stdout, /Entries \(aggregated across all sitemap files found\): 2/);

    const jsonRun = await runCli(['sitemap', `${baseUrl}/sitemap.xml`, '--json']);
    const report = JSON.parse(jsonRun.stdout);
    assert.equal(report.sitemap.type, 'urlset');
    assert.equal(report.sitemap.entryCount, 2);
  } finally {
    server.close();
  }
});

test('CLI sitemap: a sitemapindex is recursed into by default and reports the aggregated entries', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['sitemap', `${baseUrl}/sitemap-index.xml`, '--json']);
    assert.equal(code, 0);
    const report = JSON.parse(stdout);
    assert.equal(report.sitemap.type, 'sitemapindex');
    assert.equal(report.sitemap.entryCount, 2, 'child urlset entries must be aggregated, not left empty');
    assert.equal(report.sitemap.sitemapsProcessed.length, 2);
  } finally {
    server.close();
  }
});

test('CLI audit: normal successful execution combines crawl, sitemap, and robots, and correctly finds the orphan page via sitemap-index-aware cross-referencing', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['audit', `${baseUrl}/`, '--max-pages=5', '--delay=0', '--json']);
    assert.equal(code, 0);
    const report = JSON.parse(stdout);
    assert.equal(report.crawlSummary.pagesFetched, 2);
    assert.equal(report.sitemap.type, 'urlset');
    assert.ok(report.robots.found);
    // /orphan is listed in the sitemap but never linked from the crawled pages.
    assert.ok(report.linkGraph.orphanCandidates.includes(`${baseUrl}/orphan`));
    // Home and About have distinct titles/descriptions, so audit's
    // duplicate-content section should be present but empty here — this
    // confirms it's actually wired into `audit`, not just `crawl`.
    assert.deepEqual(report.duplicateContent, { duplicateTitles: [], duplicateMetaDescriptions: [] });
    // Both crawled, sitemap-listed pages are indexable, so this must be
    // present but empty — confirms the field exists without a false positive.
    assert.deepEqual(report.linkGraph.sitemapIndexabilityConflicts, []);
    // Neither / nor /about links through a redirect, so this must be
    // present but empty — confirms it's wired into `audit` too, not just `crawl`.
    assert.deepEqual(report.linkGraph.internalLinksThroughRedirects, []);
  } finally {
    server.close();
  }
});

// A separate, self-contained fixture server (own robots.txt/sitemap.xml,
// isolated from startFixtureServer's) specifically for the
// sitemap/indexability conflict tests below — `audit` always fetches
// /sitemap.xml at the origin root, and the shared fixture's sitemap.xml is
// already asserted on with an exact entryCount elsewhere, so this needs its
// own server rather than adding a third entry there.
function startSitemapConflictFixtureServer() {
  const server = createServer((req, res) => {
    const origin = `http://127.0.0.1:${server.address() ? server.address().port : ''}`;
    if (req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>Conflict Fixture Home</title></head><body><a href="/noindexed-but-listed">Noindexed</a></body></html>');
      return;
    }
    if (req.url === '/noindexed-but-listed') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end('<html><head><title>Noindexed But Listed</title><meta name="robots" content="noindex"></head><body>x</body></html>');
      return;
    }
    if (req.url === '/robots.txt') {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end('User-agent: *\n');
      return;
    }
    if (req.url === '/sitemap.xml') {
      res.writeHead(200, { 'Content-Type': 'application/xml' });
      res.end(
        `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${origin}/</loc></url><url><loc>${origin}/noindexed-but-listed</loc></url></urlset>`
      );
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

test('CLI audit --json flags a sitemap-listed URL that turned out noindex as a sitemapIndexabilityConflict', async () => {
  const { server, baseUrl } = await startSitemapConflictFixtureServer();
  try {
    const { stdout, code } = await runCli(['audit', `${baseUrl}/`, '--max-pages=5', '--delay=0', '--json']);
    assert.equal(code, 0);
    const report = JSON.parse(stdout);
    assert.equal(report.linkGraph.sitemapIndexabilityConflicts.length, 1);
    assert.equal(report.linkGraph.sitemapIndexabilityConflicts[0].url, `${baseUrl}/noindexed-but-listed`);
    assert.match(report.linkGraph.sitemapIndexabilityConflicts[0].reason, /noindex/);
  } finally {
    server.close();
  }
});

test('CLI audit human-readable output shows the sitemap/indexability conflict count', async () => {
  const { server, baseUrl } = await startSitemapConflictFixtureServer();
  try {
    const { stdout, code } = await runCli(['audit', `${baseUrl}/`, '--max-pages=5', '--delay=0']);
    assert.equal(code, 0);
    assert.match(stdout, /Sitemap\/indexability conflicts: 1/);
  } finally {
    server.close();
  }
});

test('CLI links: dispatches to the same crawl machinery with a link-graph-focused summary', async () => {
  const { server, baseUrl } = await startFixtureServer();
  try {
    const { stdout, code } = await runCli(['links', `${baseUrl}/`, '--max-pages=5', '--delay=0']);
    assert.equal(code, 0);
    assert.match(stdout, /Pages fetched: 2/);
  } finally {
    server.close();
  }
});

// ---------- diff (report comparison, real --json=path files as input) ----------

test('CLI diff --json compares two real report files and surfaces an indexable regression end-to-end', async () => {
  const { server, baseUrl } = await startFixtureServer();
  const tmpDir = mkdtempSync(join(tmpdir(), 'seo-tool-cli-test-'));
  const report1Path = join(tmpDir, 'report1.json');
  const report2Path = join(tmpDir, 'report2.json');
  try {
    const gen = await runCli(['page', `${baseUrl}/`, `--json=${report1Path}`]);
    assert.equal(gen.code, 0);

    // A real report file, as --json=path actually writes it, then a
    // simulated later snapshot of the same page having regressed to
    // non-indexable — exactly the "before/after reference point" scenario
    // workflows/post-implementation.md describes.
    const report1 = JSON.parse(readFileSync(report1Path, 'utf-8'));
    assert.equal(report1.pages[0].indexable, true, 'sanity check on the real generated report');
    const report2 = JSON.parse(JSON.stringify(report1));
    report2.pages[0].indexable = false;
    report2.pages[0].indexabilityReasons = ['noindex directive present (meta robots or X-Robots-Tag)'];
    writeFileSync(report2Path, JSON.stringify(report2));

    const { stdout, code } = await runCli(['diff', report1Path, report2Path, '--json']);
    assert.equal(code, 0);
    const diffReport = JSON.parse(stdout);
    assert.equal(diffReport.meta.command, 'diff');
    assert.equal(diffReport.diff.regressions.length, 1);
    assert.equal(diffReport.diff.regressions[0].url, `${baseUrl}/`);
    assert.equal(diffReport.diff.regressions[0].field, 'indexable');
    assert.equal(diffReport.diff.summary.regressions, 1);
    assert.equal(diffReport.diff.summary.improvements, 0);
  } finally {
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CLI diff human-readable output shows regressions/improvements counts and lists the specific regression', async () => {
  const { server, baseUrl } = await startFixtureServer();
  const tmpDir = mkdtempSync(join(tmpdir(), 'seo-tool-cli-test-'));
  const report1Path = join(tmpDir, 'report1.json');
  const report2Path = join(tmpDir, 'report2.json');
  try {
    const gen = await runCli(['page', `${baseUrl}/`, `--json=${report1Path}`]);
    assert.equal(gen.code, 0);
    const report1 = JSON.parse(readFileSync(report1Path, 'utf-8'));
    const report2 = JSON.parse(JSON.stringify(report1));
    report2.pages[0].indexable = false;
    writeFileSync(report2Path, JSON.stringify(report2));

    const { stdout, code } = await runCli(['diff', report1Path, report2Path]);
    assert.equal(code, 0);
    assert.match(stdout, /Regressions: 1\s+Improvements: 0/);
    assert.match(stdout, new RegExp(`${baseUrl}/: indexable true -> false`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  } finally {
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CLI diff reports zero regressions/improvements and all-unchanged when comparing a report file to itself', async () => {
  const { server, baseUrl } = await startFixtureServer();
  const tmpDir = mkdtempSync(join(tmpdir(), 'seo-tool-cli-test-'));
  const reportPath = join(tmpDir, 'report.json');
  try {
    const gen = await runCli(['page', `${baseUrl}/`, `--json=${reportPath}`]);
    assert.equal(gen.code, 0);

    const { stdout, code } = await runCli(['diff', reportPath, reportPath, '--json']);
    assert.equal(code, 0);
    const diffReport = JSON.parse(stdout);
    assert.deepEqual(diffReport.diff.regressions, []);
    assert.deepEqual(diffReport.diff.improvements, []);
    assert.equal(diffReport.diff.pages.unchangedCount, 1);
  } finally {
    server.close();
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CLI diff exits 1 with a clear error (no stack trace) when a report file does not exist', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'seo-tool-cli-test-'));
  const missingPath = join(tmpDir, 'does-not-exist.json');
  const realPath = join(tmpDir, 'real.json');
  try {
    writeFileSync(realPath, JSON.stringify({ meta: { tool: 'seo-tool', command: 'page' }, pages: [] }));
    const { stdout, stderr, code } = await runCli(['diff', missingPath, realPath]);
    assert.equal(code, 1);
    assert.match(stderr, /Could not read report file/);
    assert.equal(/at\s+\S+\s+\(/.test(stderr), false, 'should not print a raw stack trace');
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CLI diff exits 1 with a clear error when a report file is not valid JSON', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'seo-tool-cli-test-'));
  const invalidPath = join(tmpDir, 'invalid.json');
  const realPath = join(tmpDir, 'real.json');
  try {
    writeFileSync(invalidPath, 'not json at all');
    writeFileSync(realPath, JSON.stringify({ meta: { tool: 'seo-tool', command: 'page' }, pages: [] }));
    const { stderr, code } = await runCli(['diff', invalidPath, realPath]);
    assert.equal(code, 1);
    assert.match(stderr, /is not valid JSON/);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CLI diff exits 1 with a clear error when a file is valid JSON but not a seo-tool report', async () => {
  const tmpDir = mkdtempSync(join(tmpdir(), 'seo-tool-cli-test-'));
  const notAReportPath = join(tmpDir, 'notareport.json');
  const realPath = join(tmpDir, 'real.json');
  try {
    writeFileSync(notAReportPath, JSON.stringify({ foo: 'bar' }));
    writeFileSync(realPath, JSON.stringify({ meta: { tool: 'seo-tool', command: 'page' }, pages: [] }));
    const { stderr, code } = await runCli(['diff', notAReportPath, realPath]);
    assert.equal(code, 1);
    assert.match(stderr, /does not look like a seo-tool JSON report/);
  } finally {
    rmSync(tmpDir, { recursive: true, force: true });
  }
});

test('CLI diff requires both report file arguments and exits 1 with a usage message when either is missing', async () => {
  const { stderr, code } = await runCli(['diff', 'only-one-file.json']);
  assert.equal(code, 1);
  assert.match(stderr, /Usage: seo-tool diff <report1.json> <report2.json>/);
});

// ---------- --allow-private-network (SSRF hardening, end-to-end through the real CLI) ----------

test('CLI page against a private-network target is blocked by default, with a clear error and exit 1', async () => {
  const { stdout, code } = await runCli(['page', 'http://169.254.169.254/latest/meta-data/']);
  assert.equal(code, 1);
  assert.match(stdout, /ERROR:/);
  assert.match(stdout, /private|internal network/i);
});

test('CLI page --json against a private-network target reports the blocked_private_network error type in the JSON report, not a fetched body', async () => {
  const { stdout, code } = await runCli(['page', 'http://192.168.1.1/admin', '--json']);
  assert.equal(code, 1);
  const report = JSON.parse(stdout);
  assert.equal(report.pages[0].error.type, 'blocked_private_network');
  assert.equal(report.pages[0].status, null, 'a blocked request must never carry a real response status');
});

test('CLI page --allow-private-network explicitly lifts the block (the request is actually attempted, not synchronously refused)', async () => {
  const { stdout } = await runCli(['page', 'http://169.254.169.254/latest/meta-data/', '--allow-private-network', '--json']);
  const report = JSON.parse(stdout);
  // Whether this address is actually reachable is genuinely
  // environment-dependent, not just "unreachable everywhere": it's
  // unreachable on a typical dev machine, but 169.254.169.254 is the real,
  // live cloud-metadata endpoint on many CI providers — including GitHub
  // Actions, whose hosted runners are themselves Azure VMs serving their
  // own Instance Metadata Service at this exact address. So this must not
  // assert a specific exit code or a real network-layer failure — what it
  // proves, on any environment, is only that our own synchronous guard did
  // not refuse the request before a real attempt was made.
  assert.notEqual(report.pages[0].error && report.pages[0].error.type, 'blocked_private_network');
});

test('CLI still works normally against "localhost" (not just 127.0.0.1), confirming the default protection never regresses the documented local-dev-server use case', async () => {
  const { server, baseUrl } = await startFixtureServer();
  const localhostUrl = baseUrl.replace('127.0.0.1', 'localhost');
  try {
    const { stdout, code } = await runCli(['page', `${localhostUrl}/`], {}, ['--import', FORCE_LOCALHOST_IPV4_PRELOAD]);
    assert.equal(code, 0);
    assert.match(stdout, /Status: 200/);
    assert.match(stdout, /Title: CLI Fixture Home/);
  } finally {
    server.close();
  }
});
