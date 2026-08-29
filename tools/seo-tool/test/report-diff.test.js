import test from 'node:test';
import assert from 'node:assert/strict';
import { diffReports, isSeoToolReport } from '../lib/report-diff.js';

function page(url, overrides = {}) {
  return {
    requestedUrl: url,
    finalUrl: url,
    status: 200,
    indexable: true,
    title: 'Title',
    metaDescription: 'Description',
    canonical: url,
    ...overrides,
  };
}

function report(overrides = {}) {
  return {
    meta: { tool: 'seo-tool', version: '1.0.0', command: 'crawl' },
    pages: [],
    linkGraph: { orphanCandidates: [], brokenInternalLinks: [], internalLinksThroughRedirects: [], sitemapIndexabilityConflicts: [] },
    duplicateContent: { duplicateTitles: [], duplicateMetaDescriptions: [] },
    hreflangReciprocity: { nonReciprocalHreflang: [] },
    ...overrides,
  };
}

// ---------- isSeoToolReport ----------

test('isSeoToolReport accepts a real report shape', () => {
  assert.equal(isSeoToolReport(report()), true);
});

test('isSeoToolReport rejects unrelated JSON, null, and non-objects', () => {
  assert.equal(isSeoToolReport({}), false);
  assert.equal(isSeoToolReport({ meta: {} }), false);
  assert.equal(isSeoToolReport({ meta: { tool: 'something-else' } }), false);
  assert.equal(isSeoToolReport(null), false);
  assert.equal(isSeoToolReport(undefined), false);
  assert.equal(isSeoToolReport('a string'), false);
  assert.equal(isSeoToolReport(42), false);
});

// ---------- diffReports: pages ----------

test('diffReports finds no differences when comparing a report to an identical copy of itself', () => {
  const r = report({ pages: [page('https://example.com/a'), page('https://example.com/b')] });
  const result = diffReports(r, JSON.parse(JSON.stringify(r)));
  assert.deepEqual(result.pages.added, []);
  assert.deepEqual(result.pages.removed, []);
  assert.deepEqual(result.pages.changed, []);
  assert.equal(result.pages.unchangedCount, 2);
  assert.deepEqual(result.regressions, []);
  assert.deepEqual(result.improvements, []);
});

test('diffReports detects a page present in the after-report but not the before-report as added', () => {
  const before = report({ pages: [page('https://example.com/a')] });
  const after = report({ pages: [page('https://example.com/a'), page('https://example.com/new')] });
  const result = diffReports(before, after);
  assert.deepEqual(result.pages.added, ['https://example.com/new']);
  assert.deepEqual(result.pages.removed, []);
});

test('diffReports detects a page present in the before-report but not the after-report as removed', () => {
  const before = report({ pages: [page('https://example.com/a'), page('https://example.com/gone')] });
  const after = report({ pages: [page('https://example.com/a')] });
  const result = diffReports(before, after);
  assert.deepEqual(result.pages.removed, ['https://example.com/gone']);
  assert.deepEqual(result.pages.added, []);
});

test('diffReports matches pages by normalized URL, not array order or position', () => {
  const before = report({ pages: [page('https://EXAMPLE.com/a'), page('https://example.com/b')] });
  const after = report({ pages: [page('https://example.com/b'), page('https://example.com/a')] });
  const result = diffReports(before, after);
  assert.deepEqual(result.pages.added, []);
  assert.deepEqual(result.pages.removed, []);
  assert.equal(result.pages.unchangedCount, 2, 'reordering and host-case differences alone must not look like changes');
});

test('diffReports reports the specific tracked fields that changed for a page present in both', () => {
  const before = report({ pages: [page('https://example.com/a', { status: 200, title: 'Old Title' })] });
  const after = report({ pages: [page('https://example.com/a', { status: 200, title: 'New Title' })] });
  const result = diffReports(before, after);
  assert.equal(result.pages.changed.length, 1);
  assert.equal(result.pages.changed[0].url, 'https://example.com/a');
  assert.deepEqual(result.pages.changed[0].changes, [{ field: 'title', before: 'Old Title', after: 'New Title' }]);
});

test('diffReports reports multiple simultaneous field changes on the same page', () => {
  const before = report({ pages: [page('https://example.com/a', { status: 200, title: 'Old', h1Count: 1 })] });
  const after = report({ pages: [page('https://example.com/a', { status: 404, title: 'New', h1Count: 0 })] });
  const result = diffReports(before, after);
  const fields = result.pages.changed[0].changes.map((c) => c.field).sort();
  assert.deepEqual(fields, ['h1Count', 'status', 'title']);
});

test('diffReports tracks a newly-appeared robotsDirectivesConflict as a real change', () => {
  const before = report({ pages: [page('https://example.com/a', { robotsDirectivesConflict: false })] });
  const after = report({ pages: [page('https://example.com/a', { robotsDirectivesConflict: true })] });
  const result = diffReports(before, after);
  assert.equal(result.pages.changed.length, 1);
  assert.deepEqual(result.pages.changed[0].changes, [{ field: 'robotsDirectivesConflict', before: false, after: true }]);
});

test('diffReports tracks a newly-appeared ogUrlCanonicalMismatch as a real change', () => {
  const before = report({ pages: [page('https://example.com/a', { ogUrlCanonicalMismatch: false })] });
  const after = report({ pages: [page('https://example.com/a', { ogUrlCanonicalMismatch: true })] });
  const result = diffReports(before, after);
  assert.equal(result.pages.changed.length, 1);
  assert.deepEqual(result.pages.changed[0].changes, [{ field: 'ogUrlCanonicalMismatch', before: false, after: true }]);
});

test('diffReports treats robotsMetaDirectives/xRobotsTagDirectives arrays as equal regardless of order', () => {
  const before = report({ pages: [page('https://example.com/a', { robotsMetaDirectives: ['noindex', 'nofollow'] })] });
  const after = report({ pages: [page('https://example.com/a', { robotsMetaDirectives: ['nofollow', 'noindex'] })] });
  const result = diffReports(before, after);
  assert.deepEqual(result.pages.changed, [], 'array order alone must not be reported as a change');
});

test('diffReports treats a canonical value that is the same URL but differs in irrelevant metadata (host case, default port) as unchanged', () => {
  const before = report({ pages: [page('https://example.com/a', { canonical: 'https://EXAMPLE.com:443/a' })] });
  const after = report({ pages: [page('https://example.com/a', { canonical: 'https://example.com/a' })] });
  const result = diffReports(before, after);
  assert.deepEqual(result.pages.changed, [], 'host case and an explicit default port are not a real canonical change');
});

test('diffReports still flags a genuinely different canonical target as a real change', () => {
  const before = report({ pages: [page('https://example.com/a', { canonical: 'https://example.com/a' })] });
  const after = report({ pages: [page('https://example.com/a', { canonical: 'https://example.com/somewhere-else' })] });
  const result = diffReports(before, after);
  assert.equal(result.pages.changed.length, 1);
  assert.deepEqual(result.pages.changed[0].changes, [{ field: 'canonical', before: 'https://example.com/a', after: 'https://example.com/somewhere-else' }]);
});

test('diffReports does NOT track fields outside the deliberately bounded set (e.g. internalLinks array churn is not noise)', () => {
  const before = report({ pages: [page('https://example.com/a', { internalLinks: [{ url: 'https://example.com/x' }] })] });
  const after = report({ pages: [page('https://example.com/a', { internalLinks: [{ url: 'https://example.com/x' }, { url: 'https://example.com/y' }] })] });
  const result = diffReports(before, after);
  assert.deepEqual(result.pages.changed, [], 'internalLinks is intentionally not a tracked field');
});

// ---------- diffReports: regressions / improvements ----------

test('diffReports classifies indexable true->false as a regression', () => {
  const before = report({ pages: [page('https://example.com/a', { indexable: true })] });
  const after = report({ pages: [page('https://example.com/a', { indexable: false })] });
  const result = diffReports(before, after);
  assert.equal(result.regressions.length, 1);
  assert.deepEqual(result.regressions[0], { url: 'https://example.com/a', field: 'indexable', before: true, after: false });
  assert.deepEqual(result.improvements, []);
});

test('diffReports classifies indexable false->true as an improvement', () => {
  const before = report({ pages: [page('https://example.com/a', { indexable: false })] });
  const after = report({ pages: [page('https://example.com/a', { indexable: true })] });
  const result = diffReports(before, after);
  assert.equal(result.improvements.length, 1);
  assert.deepEqual(result.improvements[0], { url: 'https://example.com/a', field: 'indexable', before: false, after: true });
  assert.deepEqual(result.regressions, []);
});

test('diffReports does not report a regression/improvement when indexable stays the same', () => {
  const before = report({ pages: [page('https://example.com/a', { indexable: true, title: 'A' })] });
  const after = report({ pages: [page('https://example.com/a', { indexable: true, title: 'B' })] });
  const result = diffReports(before, after);
  assert.deepEqual(result.regressions, []);
  assert.deepEqual(result.improvements, []);
  assert.equal(result.pages.changed.length, 1, 'the title change is still reported as a plain change, just not judged');
});

// ---------- diffReports: linkGraph ----------

test('diffReports flags newly-appeared broken internal links, orphans, redirect-hop links, and sitemap conflicts', () => {
  const before = report();
  const after = report({
    linkGraph: {
      orphanCandidates: ['https://example.com/orphan'],
      brokenInternalLinks: [{ from: 'https://example.com/a', to: 'https://example.com/broken', status: 404 }],
      internalLinksThroughRedirects: [{ from: 'https://example.com/a', to: 'https://example.com/old', finalUrl: 'https://example.com/new', redirectHops: 1 }],
      sitemapIndexabilityConflicts: [{ url: 'https://example.com/noindexed', reason: 'noindex' }],
    },
  });
  const result = diffReports(before, after);
  assert.equal(result.linkGraph.orphanCandidates.added.length, 1);
  assert.equal(result.linkGraph.brokenInternalLinks.added.length, 1);
  assert.equal(result.linkGraph.internalLinksThroughRedirects.added.length, 1);
  assert.equal(result.linkGraph.sitemapIndexabilityConflicts.added.length, 1);
});

test('diffReports flags resolved (removed) linkGraph findings the same way as newly-appeared ones', () => {
  const before = report({ linkGraph: { orphanCandidates: [], brokenInternalLinks: [{ from: 'https://example.com/a', to: 'https://example.com/broken', status: 404 }], internalLinksThroughRedirects: [], sitemapIndexabilityConflicts: [] } });
  const after = report();
  const result = diffReports(before, after);
  assert.equal(result.linkGraph.brokenInternalLinks.removed.length, 1);
  assert.equal(result.linkGraph.brokenInternalLinks.added.length, 0);
});

test('diffReports leaves linkGraph null when either report lacks it (e.g. a sitemap-only report)', () => {
  const withLinkGraph = report();
  const withoutLinkGraph = { meta: { tool: 'seo-tool', command: 'sitemap' }, sitemap: { entryCount: 0 } };
  const result = diffReports(withLinkGraph, withoutLinkGraph);
  assert.equal(result.linkGraph, null);
});

// ---------- diffReports: duplicateContent ----------

test('diffReports flags newly-appeared and resolved duplicate-content groups by value', () => {
  const before = report({ duplicateContent: { duplicateTitles: [{ value: 'Same Title', urls: ['https://example.com/a', 'https://example.com/b'] }], duplicateMetaDescriptions: [] } });
  const after = report({ duplicateContent: { duplicateTitles: [], duplicateMetaDescriptions: [{ value: 'Same Desc', urls: ['https://example.com/c', 'https://example.com/d'] }] } });
  const result = diffReports(before, after);
  assert.equal(result.duplicateContent.duplicateTitles.removed.length, 1);
  assert.equal(result.duplicateContent.duplicateTitles.added.length, 0);
  assert.equal(result.duplicateContent.duplicateMetaDescriptions.added.length, 1);
});

// ---------- diffReports: hreflangReciprocity ----------

test('diffReports flags newly-appeared and resolved non-reciprocal hreflang links', () => {
  const before = report({ hreflangReciprocity: { nonReciprocalHreflang: [{ from: 'https://example.com/en', to: 'https://example.com/fr', hreflang: 'fr-FR' }] } });
  const after = report({ hreflangReciprocity: { nonReciprocalHreflang: [{ from: 'https://example.com/de', to: 'https://example.com/es', hreflang: 'es-ES' }] } });
  const result = diffReports(before, after);
  assert.equal(result.hreflangReciprocity.nonReciprocalHreflang.removed.length, 1);
  assert.equal(result.hreflangReciprocity.nonReciprocalHreflang.added.length, 1);
});

test('diffReports leaves hreflangReciprocity null when either report lacks it (e.g. a sitemap-only report)', () => {
  const withIt = report();
  const withoutIt = { meta: { tool: 'seo-tool', command: 'sitemap' }, sitemap: { entryCount: 0 } };
  const result = diffReports(withIt, withoutIt);
  assert.equal(result.hreflangReciprocity, null);
});

// ---------- diffReports: summary + edge cases ----------

test('diffReports computes a summary that matches the detailed sections', () => {
  const before = report({ pages: [page('https://example.com/a', { indexable: true })] });
  const after = report({ pages: [page('https://example.com/a', { indexable: false }), page('https://example.com/new')] });
  const result = diffReports(before, after);
  assert.deepEqual(result.summary, {
    pagesAdded: 1,
    pagesRemoved: 0,
    pagesChanged: 1,
    regressions: 1,
    improvements: 0,
  });
});

test('diffReports handles two reports with completely disjoint URL sets without throwing', () => {
  const before = report({ pages: [page('https://example.com/a')] });
  const after = report({ pages: [page('https://other-site.com/x')] });
  assert.doesNotThrow(() => diffReports(before, after));
  const result = diffReports(before, after);
  assert.equal(result.pages.added.length, 1);
  assert.equal(result.pages.removed.length, 1);
  assert.equal(result.pages.changed.length, 0);
});

test('diffReports never throws when pages arrays contain an unparseable URL', () => {
  const before = report({ pages: [page('not a url at all')] });
  const after = report({ pages: [page('not a url at all')] });
  assert.doesNotThrow(() => diffReports(before, after));
});

test('diffReports handles two reports with no comparable sections at all (returns all-null, no crash)', () => {
  const minimalA = { meta: { tool: 'seo-tool', command: 'robots' } };
  const minimalB = { meta: { tool: 'seo-tool', command: 'robots' } };
  const result = diffReports(minimalA, minimalB);
  assert.equal(result.pages, null);
  assert.equal(result.linkGraph, null);
  assert.equal(result.duplicateContent, null);
  assert.equal(result.hreflangReciprocity, null);
  assert.deepEqual(result.regressions, []);
  assert.deepEqual(result.improvements, []);
  assert.deepEqual(result.summary, { pagesAdded: 0, pagesRemoved: 0, pagesChanged: 0, regressions: 0, improvements: 0 });
});

test('diffReports still diffs pages even when comparing a single-page `page` report against a `crawl` report', () => {
  const pageReport = report({ pages: [page('https://example.com/a', { indexable: false })], linkGraph: undefined, duplicateContent: undefined });
  const crawlReport = report({ pages: [page('https://example.com/a', { indexable: true }), page('https://example.com/b')] });
  const result = diffReports(pageReport, crawlReport);
  assert.equal(result.pages.added.length, 1);
  assert.equal(result.regressions.length, 0);
  assert.equal(result.improvements.length, 1, 'the shared page went indexable:false -> true');
  assert.equal(result.linkGraph, null, 'the page-only report has no linkGraph to compare');
});
