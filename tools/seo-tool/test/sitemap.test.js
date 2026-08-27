import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSitemap, validateSitemapEntries, resolveSitemapTree } from '../lib/sitemap.js';

// ---------- helpers for resolveSitemapTree tests (mock fetch, no real network) ----------

function urlsetXml(locs) {
  return `<?xml version="1.0"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locs
    .map((l) => `<url><loc>${l}</loc></url>`)
    .join('')}</urlset>`;
}

function indexXml(childLocs) {
  return `<?xml version="1.0"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${childLocs
    .map((l) => `<sitemap><loc>${l}</loc></sitemap>`)
    .join('')}</sitemapindex>`;
}

/** routes: map of URL -> XML body string, or { error: {type, message} }, or { status } for a non-200. */
function makeMockFetch(routes) {
  const calls = [];
  const fetchFn = async (url) => {
    calls.push(url);
    if (!(url in routes)) {
      return { status: 404, body: null, error: null };
    }
    const entry = routes[url];
    if (entry && typeof entry === 'object' && entry.error) {
      return { status: null, body: null, error: entry.error };
    }
    if (entry && typeof entry === 'object' && entry.status) {
      return { status: entry.status, body: entry.body || null, error: null };
    }
    return { status: 200, body: entry, error: null };
  };
  fetchFn.calls = calls;
  return fetchFn;
}

test('parseSitemap parses a standard urlset', () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://example.com/</loc><lastmod>2026-01-01</lastmod></url>
  <url><loc>https://example.com/about</loc></url>
</urlset>`;
  const parsed = parseSitemap(xml);
  assert.equal(parsed.type, 'urlset');
  assert.equal(parsed.entryCount, 2);
  assert.equal(parsed.urls[0].loc, 'https://example.com/');
  assert.equal(parsed.urls[0].lastmod, '2026-01-01');
  assert.equal(parsed.urls[1].lastmod, null);
});

test('parseSitemap parses a sitemap index', () => {
  const xml = `<?xml version="1.0"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://example.com/sitemap-1.xml</loc><lastmod>2026-01-01</lastmod></sitemap>
  <sitemap><loc>https://example.com/sitemap-2.xml</loc></sitemap>
</sitemapindex>`;
  const parsed = parseSitemap(xml);
  assert.equal(parsed.type, 'sitemapindex');
  assert.equal(parsed.entryCount, 2);
  assert.equal(parsed.sitemaps[0].loc, 'https://example.com/sitemap-1.xml');
});

test('parseSitemap flags content with no recognizable root as invalid', () => {
  const parsed = parseSitemap('<html><body>not a sitemap</body></html>');
  assert.equal(parsed.type, 'invalid');
});

test('parseSitemap flags non-XML content as invalid without throwing', () => {
  const parsed = parseSitemap('this is not xml at all');
  assert.equal(parsed.type, 'invalid');
});

test('parseSitemap handles empty/missing content gracefully', () => {
  assert.equal(parseSitemap('').type, 'invalid');
  assert.equal(parseSitemap(undefined).type, 'invalid');
});

test('validateSitemapEntries flags a missing loc', () => {
  const issues = validateSitemapEntries([{ loc: null }]);
  assert.equal(issues.some((i) => i.type === 'missing_loc'), true);
});

test('validateSitemapEntries flags a malformed URL', () => {
  const issues = validateSitemapEntries([{ loc: 'not a url' }]);
  assert.equal(issues.some((i) => i.type === 'malformed_url'), true);
});

test('validateSitemapEntries flags exact duplicates', () => {
  const issues = validateSitemapEntries([{ loc: 'https://example.com/a' }, { loc: 'https://example.com/a' }]);
  assert.equal(issues.filter((i) => i.type === 'duplicate_exact').length, 1);
});

test('validateSitemapEntries flags trailing-slash-only duplicate variants', () => {
  const issues = validateSitemapEntries([{ loc: 'https://example.com/a' }, { loc: 'https://example.com/a/' }]);
  assert.equal(issues.some((i) => i.type === 'duplicate_trailing_slash_variant'), true);
});

test('validateSitemapEntries flags paths that look private/non-public', () => {
  const issues = validateSitemapEntries([{ loc: 'https://example.com/wp-admin/edit.php' }]);
  assert.equal(issues.some((i) => i.type === 'looks_non_public'), true);
});

test('validateSitemapEntries produces no issues for a clean sitemap', () => {
  const issues = validateSitemapEntries([{ loc: 'https://example.com/' }, { loc: 'https://example.com/about' }]);
  assert.equal(issues.length, 0);
});

// ---------- resolveSitemapTree ----------

test('resolveSitemapTree handles a normal (non-index) urlset with no recursion needed', async () => {
  const fetchFn = makeMockFetch({
    'https://example.com/sitemap.xml': urlsetXml(['https://example.com/', 'https://example.com/about']),
  });
  const tree = await resolveSitemapTree('https://example.com/sitemap.xml', { fetchFn });
  assert.equal(tree.entryCount, 2);
  assert.deepEqual(tree.urls.map((u) => u.loc), ['https://example.com/', 'https://example.com/about']);
  assert.equal(tree.sitemapsProcessed.length, 1);
  assert.equal(tree.sitemapsProcessed[0].type, 'urlset');
  assert.equal(tree.skipped.length, 0);
  assert.equal(tree.truncated, false);
});

test('resolveSitemapTree recurses into a sitemapindex and aggregates all child URLs', async () => {
  const fetchFn = makeMockFetch({
    'https://example.com/sitemap-index.xml': indexXml(['https://example.com/sitemap-a.xml', 'https://example.com/sitemap-b.xml']),
    'https://example.com/sitemap-a.xml': urlsetXml(['https://example.com/a1', 'https://example.com/a2']),
    'https://example.com/sitemap-b.xml': urlsetXml(['https://example.com/b1']),
  });
  const tree = await resolveSitemapTree('https://example.com/sitemap-index.xml', { fetchFn });
  assert.equal(tree.entryCount, 3);
  assert.deepEqual(
    tree.urls.map((u) => u.loc).sort(),
    ['https://example.com/a1', 'https://example.com/a2', 'https://example.com/b1']
  );
  assert.equal(tree.sitemapsProcessed.length, 3); // index + 2 children
  assert.equal(tree.sitemapsProcessed.find((s) => s.url.endsWith('index.xml')).type, 'sitemapindex');
  assert.equal(tree.skipped.length, 0);
  assert.equal(tree.truncated, false);
});

test('resolveSitemapTree follows a nested sitemapindex (index of indexes)', async () => {
  const fetchFn = makeMockFetch({
    'https://example.com/root-index.xml': indexXml(['https://example.com/mid-index.xml']),
    'https://example.com/mid-index.xml': indexXml(['https://example.com/leaf.xml']),
    'https://example.com/leaf.xml': urlsetXml(['https://example.com/deep-page']),
  });
  const tree = await resolveSitemapTree('https://example.com/root-index.xml', { fetchFn });
  assert.equal(tree.entryCount, 1);
  assert.equal(tree.urls[0].loc, 'https://example.com/deep-page');
  const depths = tree.sitemapsProcessed.map((s) => s.depth);
  assert.deepEqual(depths, [0, 1, 2]);
  assert.equal(tree.truncated, false);
});

test('resolveSitemapTree fetches a duplicate child sitemap only once', async () => {
  const fetchFn = makeMockFetch({
    'https://example.com/index.xml': indexXml(['https://example.com/shared.xml', 'https://example.com/shared.xml']),
    'https://example.com/shared.xml': urlsetXml(['https://example.com/only-page']),
  });
  const tree = await resolveSitemapTree('https://example.com/index.xml', { fetchFn });
  assert.equal(tree.entryCount, 1, 'the shared child\'s URLs must not be double-counted');
  assert.equal(fetchFn.calls.filter((u) => u === 'https://example.com/shared.xml').length, 1, 'the shared child must only be fetched once');
  assert.equal(tree.skipped.some((s) => s.url === 'https://example.com/shared.xml' && /duplicate/.test(s.reason)), true);
});

test('resolveSitemapTree records a malformed child sitemap without aborting the rest of the tree', async () => {
  const fetchFn = makeMockFetch({
    'https://example.com/index.xml': indexXml(['https://example.com/bad.xml', 'https://example.com/good.xml']),
    'https://example.com/bad.xml': 'this is not xml at all',
    'https://example.com/good.xml': urlsetXml(['https://example.com/ok-page']),
  });
  const tree = await resolveSitemapTree('https://example.com/index.xml', { fetchFn });
  assert.equal(tree.entryCount, 1);
  assert.equal(tree.urls[0].loc, 'https://example.com/ok-page');
  const badNode = tree.sitemapsProcessed.find((s) => s.url === 'https://example.com/bad.xml');
  assert.equal(badNode.type, 'invalid');
  assert.ok(badNode.error);
});

test('resolveSitemapTree treats a self-referencing sitemapindex as a protected cycle, not an infinite loop', async () => {
  const fetchFn = makeMockFetch({
    'https://example.com/index.xml': indexXml(['https://example.com/index.xml']),
  });
  const tree = await resolveSitemapTree('https://example.com/index.xml', { fetchFn });
  assert.equal(tree.sitemapsProcessed.length, 1, 'only the first visit should be processed');
  assert.equal(tree.skipped.some((s) => s.url === 'https://example.com/index.xml' && /duplicate|cycle/.test(s.reason)), true);
  assert.equal(fetchFn.calls.filter((u) => u === 'https://example.com/index.xml').length, 1);
});

test('resolveSitemapTree handles a longer A -> B -> A cycle without infinite recursion', async () => {
  const fetchFn = makeMockFetch({
    'https://example.com/a.xml': indexXml(['https://example.com/b.xml']),
    'https://example.com/b.xml': indexXml(['https://example.com/a.xml']),
  });
  const tree = await resolveSitemapTree('https://example.com/a.xml', { fetchFn });
  assert.equal(tree.sitemapsProcessed.length, 2); // a, then b — the second reference back to a is skipped
  assert.equal(tree.skipped.some((s) => s.url === 'https://example.com/a.xml'), true);
});

test('resolveSitemapTree handles a mix of valid, malformed, and fetch-failing children and never crashes', async () => {
  const fetchFn = makeMockFetch({
    'https://example.com/index.xml': indexXml([
      'https://example.com/ok.xml',
      'https://example.com/broken.xml',
      'https://example.com/missing.xml',
    ]),
    'https://example.com/ok.xml': urlsetXml(['https://example.com/ok-page-1', 'https://example.com/ok-page-2']),
    'https://example.com/broken.xml': '<not-a-sitemap/>',
    // 'https://example.com/missing.xml' intentionally not in routes -> 404
  });
  const tree = await resolveSitemapTree('https://example.com/index.xml', { fetchFn });
  assert.equal(tree.entryCount, 2);
  assert.equal(tree.sitemapsProcessed.length, 4); // index + ok + broken + missing
  const missingNode = tree.sitemapsProcessed.find((s) => s.url === 'https://example.com/missing.xml');
  assert.equal(missingNode.type, 'error');
  assert.match(missingNode.error, /404/);
});

test('resolveSitemapTree respects maxSitemaps and reports truncation', async () => {
  const children = Array.from({ length: 5 }, (_, i) => `https://example.com/child-${i}.xml`);
  const routes = { 'https://example.com/index.xml': indexXml(children) };
  for (const c of children) routes[c] = urlsetXml([`https://example.com/page-from-${c.slice(-6, -4)}`]);
  const fetchFn = makeMockFetch(routes);

  const tree = await resolveSitemapTree('https://example.com/index.xml', { fetchFn, maxSitemaps: 3 });
  assert.equal(tree.truncated, true);
  assert.ok(tree.sitemapsProcessed.length <= 3);
  assert.ok(tree.skipped.some((s) => /exceeded maxSitemaps/.test(s.reason)));
});

test('resolveSitemapTree respects maxDepth and reports truncation', async () => {
  const fetchFn = makeMockFetch({
    'https://example.com/l0.xml': indexXml(['https://example.com/l1.xml']),
    'https://example.com/l1.xml': indexXml(['https://example.com/l2.xml']),
    'https://example.com/l2.xml': indexXml(['https://example.com/l3.xml']),
    'https://example.com/l3.xml': urlsetXml(['https://example.com/too-deep']),
  });
  const tree = await resolveSitemapTree('https://example.com/l0.xml', { fetchFn, maxDepth: 1 });
  assert.equal(tree.truncated, true);
  assert.equal(tree.entryCount, 0, 'the urlset beyond maxDepth must never be reached');
  assert.ok(tree.skipped.some((s) => /exceeded maxDepth/.test(s.reason)));
});

test('resolveSitemapTree skips a cross-origin child sitemap rather than following it', async () => {
  const fetchFn = makeMockFetch({
    'https://example.com/index.xml': indexXml(['https://example.com/same-origin.xml', 'https://other.com/cross-origin.xml']),
    'https://example.com/same-origin.xml': urlsetXml(['https://example.com/safe-page']),
    'https://other.com/cross-origin.xml': urlsetXml(['https://other.com/should-not-appear']),
  });
  const tree = await resolveSitemapTree('https://example.com/index.xml', { fetchFn });
  assert.equal(tree.entryCount, 1);
  assert.equal(tree.urls[0].loc, 'https://example.com/safe-page');
  assert.equal(tree.skipped.some((s) => s.url === 'https://other.com/cross-origin.xml' && /cross-origin/.test(s.reason)), true);
  assert.equal(fetchFn.calls.includes('https://other.com/cross-origin.xml'), false, 'a skipped cross-origin sitemap must never even be fetched');
});

test('resolveSitemapTree supports a local-file root by locking the reference origin to the first real child', async () => {
  const fetchFn = makeMockFetch({
    'https://example.com/same.xml': urlsetXml(['https://example.com/local-root-page']),
    'https://other.com/cross.xml': urlsetXml(['https://other.com/should-be-skipped']),
  });
  // startUrl is a local filesystem path (not a parseable absolute URL), matching how the CLI
  // passes an on-disk sitemap file's resolved path when the root is read locally.
  const seedText = indexXml(['https://example.com/same.xml', 'https://other.com/cross.xml']);
  const tree = await resolveSitemapTree('D:\\local\\path\\sitemap-index.xml', { fetchFn, seedText });
  assert.equal(tree.entryCount, 1);
  assert.equal(tree.urls[0].loc, 'https://example.com/local-root-page');
  assert.equal(tree.skipped.some((s) => s.url === 'https://other.com/cross.xml'), true);
});
