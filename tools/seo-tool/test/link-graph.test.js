import test from 'node:test';
import assert from 'node:assert/strict';
import {
  findOrphanCandidates,
  findOrphansAgainstKnownUrls,
  findCrawlDepthOutliers,
  findBrokenInternalLinks,
  findInternalLinksThroughRedirects,
  findSitemapIndexabilityConflicts,
  buildLinkGraph,
} from '../lib/link-graph.js';

function page(url, overrides = {}) {
  return {
    requestedUrl: url,
    finalUrl: url,
    status: 200,
    depth: 0,
    isExternal: false,
    internalLinks: [],
    discoveredFrom: [],
    ...overrides,
  };
}

test('findOrphanCandidates finds pages with no discovered incoming links, excluding the start URL', () => {
  const pages = [
    page('https://example.com/', { discoveredFrom: [] }),
    page('https://example.com/linked', { discoveredFrom: ['https://example.com/'] }),
    page('https://example.com/orphan', { discoveredFrom: [] }),
  ];
  const orphans = findOrphanCandidates(pages, 'https://example.com/');
  assert.deepEqual(orphans, ['https://example.com/orphan']);
});

test('findOrphanCandidates excludes external and robots-skipped pages', () => {
  const pages = [
    page('https://example.com/', {}),
    page('https://other.com/x', { isExternal: true, discoveredFrom: [] }),
    page('https://example.com/blocked', { skipped: true, discoveredFrom: [] }),
  ];
  const orphans = findOrphanCandidates(pages, 'https://example.com/');
  assert.deepEqual(orphans, []);
});

test('findCrawlDepthOutliers returns pages beyond the threshold, deepest first', () => {
  const pages = [page('https://example.com/', { depth: 0 }), page('https://example.com/a', { depth: 2 }), page('https://example.com/b', { depth: 5 }), page('https://example.com/c', { depth: 4 })];
  const outliers = findCrawlDepthOutliers(pages, 3);
  assert.deepEqual(
    outliers.map((o) => o.url),
    ['https://example.com/b', 'https://example.com/c']
  );
});

test('findBrokenInternalLinks flags links to pages with 4xx/5xx status found in the crawl', () => {
  const pages = [
    page('https://example.com/', { internalLinks: [{ url: 'https://example.com/gone' }, { url: 'https://example.com/ok' }] }),
    page('https://example.com/gone', { status: 404 }),
    page('https://example.com/ok', { status: 200 }),
  ];
  const { broken, unverified } = findBrokenInternalLinks(pages);
  assert.equal(broken.length, 1);
  assert.equal(broken[0].to, 'https://example.com/gone');
  assert.equal(unverified.length, 0);
});

test('findBrokenInternalLinks treats links to un-crawled targets as unverified, not broken', () => {
  const pages = [page('https://example.com/', { internalLinks: [{ url: 'https://example.com/never-reached' }] })];
  const { broken, unverified } = findBrokenInternalLinks(pages);
  assert.equal(broken.length, 0);
  assert.equal(unverified.length, 1);
  assert.equal(unverified[0].to, 'https://example.com/never-reached');
});

test('findBrokenInternalLinks flags fetch errors as broken with a reason', () => {
  const pages = [
    page('https://example.com/', { internalLinks: [{ url: 'https://example.com/timeout' }] }),
    page('https://example.com/timeout', { status: null, error: { type: 'timeout', message: 'Request timed out' } }),
  ];
  const { broken } = findBrokenInternalLinks(pages);
  assert.equal(broken.length, 1);
  assert.match(broken[0].reason, /timed out/);
});

// ---------- findInternalLinksThroughRedirects ----------

test('findInternalLinksThroughRedirects flags a link whose target only resolved after a redirect', () => {
  const pages = [
    page('https://example.com/', { internalLinks: [{ url: 'https://example.com/old' }] }),
    page('https://example.com/old', {
      finalUrl: 'https://example.com/new',
      redirectChain: [{ url: 'https://example.com/old', status: 301, location: 'https://example.com/new' }],
    }),
  ];
  const results = findInternalLinksThroughRedirects(pages);
  assert.equal(results.length, 1);
  assert.equal(results[0].from, 'https://example.com/');
  assert.equal(results[0].to, 'https://example.com/old');
  assert.equal(results[0].finalUrl, 'https://example.com/new');
  assert.equal(results[0].redirectHops, 1);
});

test('findInternalLinksThroughRedirects does not flag a link pointing directly at its target (no redirect)', () => {
  const pages = [
    page('https://example.com/', { internalLinks: [{ url: 'https://example.com/direct' }] }),
    page('https://example.com/direct', { redirectChain: [] }),
  ];
  assert.deepEqual(findInternalLinksThroughRedirects(pages), []);
});

test('findInternalLinksThroughRedirects reports the correct hop count for a multi-hop redirect chain', () => {
  const pages = [
    page('https://example.com/', { internalLinks: [{ url: 'https://example.com/a' }] }),
    page('https://example.com/a', {
      finalUrl: 'https://example.com/c',
      redirectChain: [
        { url: 'https://example.com/a', status: 301, location: 'https://example.com/b' },
        { url: 'https://example.com/b', status: 301, location: 'https://example.com/c' },
      ],
    }),
  ];
  const results = findInternalLinksThroughRedirects(pages);
  assert.equal(results.length, 1);
  assert.equal(results[0].redirectHops, 2);
  assert.equal(results[0].finalUrl, 'https://example.com/c');
});

test('findInternalLinksThroughRedirects does not flag a link to a target that errored (a different, already-reported concern)', () => {
  const pages = [
    page('https://example.com/', { internalLinks: [{ url: 'https://example.com/timeout' }] }),
    page('https://example.com/timeout', { status: null, error: { type: 'timeout' }, redirectChain: [{ url: 'https://example.com/timeout', status: 301, location: 'https://example.com/x' }] }),
  ];
  assert.deepEqual(findInternalLinksThroughRedirects(pages), [], 'an errored target is broken/unverified territory, not this check\'s concern');
});

test('findInternalLinksThroughRedirects does not flag a link to a target that returned a 4xx/5xx status (broken, not redirected)', () => {
  const pages = [
    page('https://example.com/', { internalLinks: [{ url: 'https://example.com/missing' }] }),
    page('https://example.com/missing', { status: 404, redirectChain: [] }),
  ];
  assert.deepEqual(findInternalLinksThroughRedirects(pages), []);
});

test('findInternalLinksThroughRedirects does not flag a link to a target outside the crawl (unverified, not this check\'s concern)', () => {
  const pages = [page('https://example.com/', { internalLinks: [{ url: 'https://example.com/never-reached' }] })];
  assert.deepEqual(findInternalLinksThroughRedirects(pages), []);
});

test('findInternalLinksThroughRedirects excludes external and robots-skipped source pages', () => {
  const pages = [
    page('https://other.com/', { isExternal: true, internalLinks: [{ url: 'https://example.com/old' }] }),
    page('https://example.com/blocked', { skipped: true, internalLinks: [{ url: 'https://example.com/old' }] }),
    page('https://example.com/old', { finalUrl: 'https://example.com/new', redirectChain: [{ url: 'https://example.com/old', status: 301, location: 'https://example.com/new' }] }),
  ];
  assert.deepEqual(findInternalLinksThroughRedirects(pages), [], 'neither source page (external, robots-skipped) should be walked for links');
});

test('findInternalLinksThroughRedirects does not double-report the same from->to pair linked twice', () => {
  const pages = [
    page('https://example.com/', {
      internalLinks: [{ url: 'https://example.com/old' }, { url: 'https://example.com/old' }],
    }),
    page('https://example.com/old', { finalUrl: 'https://example.com/new', redirectChain: [{ url: 'https://example.com/old', status: 301, location: 'https://example.com/new' }] }),
  ];
  assert.equal(findInternalLinksThroughRedirects(pages).length, 1);
});

test('findInternalLinksThroughRedirects flags multiple distinct redirect-hop links across different pages', () => {
  const pages = [
    page('https://example.com/', { internalLinks: [{ url: 'https://example.com/old-a' }] }),
    page('https://example.com/about', { internalLinks: [{ url: 'https://example.com/old-b' }] }),
    page('https://example.com/old-a', { finalUrl: 'https://example.com/new-a', redirectChain: [{ url: 'https://example.com/old-a', status: 301, location: 'https://example.com/new-a' }] }),
    page('https://example.com/old-b', { finalUrl: 'https://example.com/new-b', redirectChain: [{ url: 'https://example.com/old-b', status: 301, location: 'https://example.com/new-b' }] }),
  ];
  assert.equal(findInternalLinksThroughRedirects(pages).length, 2);
});

test('buildLinkGraph includes the incomplete-crawl caveat note', () => {
  const graph = buildLinkGraph([page('https://example.com/')], 'https://example.com/');
  assert.match(graph.note, /not mathematically proven/);
});

test('a single-seed crawl alone finds no orphans by construction (every fetched page has a referrer)', () => {
  // This documents the real limitation, not a bug: BFS from one seed can
  // never discover a page nothing links to, because it can only reach
  // pages via a link in the first place.
  const pages = [page('https://example.com/', { internalLinks: [{ url: 'https://example.com/a' }] }), page('https://example.com/a', { discoveredFrom: ['https://example.com/'] })];
  const graph = buildLinkGraph(pages, 'https://example.com/');
  assert.deepEqual(graph.orphanCandidates, []);
  assert.equal(graph.orphanDetectionUsedKnownUrls, false);
});

test('findOrphansAgainstKnownUrls finds sitemap URLs the crawl never linked to', () => {
  const pages = [page('https://example.com/', { internalLinks: [{ url: 'https://example.com/a' }] })];
  const knownUrls = ['https://example.com/a', 'https://example.com/unlinked-page', 'https://example.com/'];
  const orphans = findOrphansAgainstKnownUrls(pages, knownUrls, 'https://example.com/');
  assert.deepEqual(orphans, ['https://example.com/unlinked-page']);
});

test('buildLinkGraph never throws when startUrl is not a valid URL (e.g. an empty crawl result)', () => {
  assert.doesNotThrow(() => buildLinkGraph([], 'not-a-valid-url'));
  const graph = buildLinkGraph([], 'not-a-valid-url', { knownUrls: ['https://example.com/a'] });
  assert.deepEqual(graph.orphanCandidates, ['https://example.com/a']);
});

test('buildLinkGraph surfaces sitemap-based orphans when knownUrls is supplied', () => {
  const pages = [page('https://example.com/', { internalLinks: [{ url: 'https://example.com/a' }] })];
  const graph = buildLinkGraph(pages, 'https://example.com/', { knownUrls: ['https://example.com/a', 'https://example.com/never-linked'] });
  assert.deepEqual(graph.orphanCandidates, ['https://example.com/never-linked']);
  assert.equal(graph.orphanDetectionUsedKnownUrls, true);
});

// ---------- findSitemapIndexabilityConflicts ----------

test('findSitemapIndexabilityConflicts flags a sitemap URL that turned out noindex', () => {
  const pages = [page('https://example.com/noindexed', { indexable: false, indexabilityReasons: ['noindex directive present (meta robots or X-Robots-Tag)'] })];
  const conflicts = findSitemapIndexabilityConflicts(pages, ['https://example.com/noindexed']);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].url, 'https://example.com/noindexed');
  assert.match(conflicts[0].reason, /noindex/);
});

test('findSitemapIndexabilityConflicts flags a sitemap URL that returned a non-200 status', () => {
  const pages = [page('https://example.com/missing', { status: 404, indexable: false, indexabilityReasons: ['non-200 status (404)'] })];
  const conflicts = findSitemapIndexabilityConflicts(pages, ['https://example.com/missing']);
  assert.equal(conflicts.length, 1);
  assert.match(conflicts[0].reason, /non-200 status \(404\)/);
});

test('findSitemapIndexabilityConflicts flags a sitemap URL blocked by robots.txt', () => {
  const pages = [page('https://example.com/blocked', { skipped: true, skipReason: 'blocked by robots.txt', status: undefined })];
  const conflicts = findSitemapIndexabilityConflicts(pages, ['https://example.com/blocked']);
  assert.equal(conflicts.length, 1);
  assert.equal(conflicts[0].reason, 'blocked by robots.txt');
});

test('findSitemapIndexabilityConflicts does not flag a genuinely indexable sitemap URL', () => {
  const pages = [page('https://example.com/fine', { indexable: true })];
  assert.deepEqual(findSitemapIndexabilityConflicts(pages, ['https://example.com/fine']), []);
});

test('findSitemapIndexabilityConflicts does not report a sitemap URL that was never reached/fetched by this crawl (neither confirmed conflicting nor clean)', () => {
  const pages = [page('https://example.com/fine', { indexable: true })];
  const conflicts = findSitemapIndexabilityConflicts(pages, ['https://example.com/fine', 'https://example.com/never-crawled']);
  assert.deepEqual(conflicts, [], 'the never-crawled URL has no indexability signal to report either way');
});

test('findSitemapIndexabilityConflicts does not flag a page skipped for a reason other than robots.txt', () => {
  const pages = [page('https://example.com/x', { skipped: true, skipReason: 'some other reason', status: undefined })];
  assert.deepEqual(findSitemapIndexabilityConflicts(pages, ['https://example.com/x']), []);
});

test('findSitemapIndexabilityConflicts does not flag a page that failed to fetch (indexability unconfirmable, not a confirmed conflict)', () => {
  const pages = [page('https://example.com/x', { error: { type: 'timeout' }, status: null, indexable: undefined })];
  assert.deepEqual(findSitemapIndexabilityConflicts(pages, ['https://example.com/x']), []);
});

test('findSitemapIndexabilityConflicts matches a sitemap URL against either the requested or the final (post-redirect) crawled URL', () => {
  const pages = [page('https://example.com/old', { finalUrl: 'https://example.com/new', indexable: false, indexabilityReasons: ['noindex directive present'] })];
  const byRequested = findSitemapIndexabilityConflicts(pages, ['https://example.com/old']);
  assert.equal(byRequested.length, 1);
  const byFinal = findSitemapIndexabilityConflicts(pages, ['https://example.com/new']);
  assert.equal(byFinal.length, 1);
});

test('findSitemapIndexabilityConflicts never throws on an unparseable sitemap URL or an empty pages array', () => {
  assert.doesNotThrow(() => findSitemapIndexabilityConflicts([], ['not a url at all']));
  assert.deepEqual(findSitemapIndexabilityConflicts([], ['not a url at all']), []);
});

test('findSitemapIndexabilityConflicts does not double-report the same sitemap URL listed twice', () => {
  const pages = [page('https://example.com/noindexed', { indexable: false, indexabilityReasons: ['noindex'] })];
  const conflicts = findSitemapIndexabilityConflicts(pages, ['https://example.com/noindexed', 'https://example.com/noindexed']);
  assert.equal(conflicts.length, 1);
});

test('buildLinkGraph surfaces sitemapIndexabilityConflicts only when knownUrls is supplied', () => {
  const pages = [page('https://example.com/noindexed', { indexable: false, indexabilityReasons: ['noindex'] })];
  const withoutKnownUrls = buildLinkGraph(pages, 'https://example.com/');
  assert.deepEqual(withoutKnownUrls.sitemapIndexabilityConflicts, [], 'without an independent URL list, there is nothing to cross-reference against');

  const withKnownUrls = buildLinkGraph(pages, 'https://example.com/', { knownUrls: ['https://example.com/noindexed'] });
  assert.equal(withKnownUrls.sitemapIndexabilityConflicts.length, 1);
  assert.equal(withKnownUrls.sitemapIndexabilityConflicts[0].url, 'https://example.com/noindexed');
});

test('buildLinkGraph surfaces internalLinksThroughRedirects unconditionally (no knownUrls needed, unlike sitemap-based checks)', () => {
  const pages = [
    page('https://example.com/', { internalLinks: [{ url: 'https://example.com/old' }] }),
    page('https://example.com/old', { finalUrl: 'https://example.com/new', redirectChain: [{ url: 'https://example.com/old', status: 301, location: 'https://example.com/new' }] }),
  ];
  const graph = buildLinkGraph(pages, 'https://example.com/');
  assert.equal(graph.internalLinksThroughRedirects.length, 1);
  assert.equal(graph.internalLinksThroughRedirects[0].finalUrl, 'https://example.com/new');
});
