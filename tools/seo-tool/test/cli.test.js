import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, rmSync, readFileSync, existsSync } from 'node:fs';
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
