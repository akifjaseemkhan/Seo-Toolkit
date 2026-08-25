import test from 'node:test';
import assert from 'node:assert/strict';
import { findOrphanCandidates, findOrphansAgainstKnownUrls, findCrawlDepthOutliers, findBrokenInternalLinks, buildLinkGraph } from '../lib/link-graph.js';

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
