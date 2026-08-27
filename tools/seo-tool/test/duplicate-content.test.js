import test from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicateTitles, findDuplicateMetaDescriptions, buildDuplicateContentReport } from '../lib/duplicate-content.js';

function page(url, overrides = {}) {
  return {
    requestedUrl: url,
    finalUrl: url,
    status: 200,
    isExternal: false,
    title: null,
    metaDescription: null,
    ...overrides,
  };
}

test('findDuplicateTitles groups pages sharing the exact same title', () => {
  const pages = [
    page('https://example.com/a', { title: 'Widgets' }),
    page('https://example.com/b', { title: 'Widgets' }),
    page('https://example.com/c', { title: 'Gadgets' }),
  ];
  const duplicates = findDuplicateTitles(pages);
  assert.equal(duplicates.length, 1);
  assert.equal(duplicates[0].value, 'Widgets');
  assert.deepEqual(duplicates[0].urls, ['https://example.com/a', 'https://example.com/b']);
});

test('findDuplicateTitles returns nothing when every title is unique', () => {
  const pages = [page('https://example.com/a', { title: 'One' }), page('https://example.com/b', { title: 'Two' })];
  assert.deepEqual(findDuplicateTitles(pages), []);
});

test('findDuplicateTitles excludes pages with a missing title entirely (a different, already-flagged problem)', () => {
  const pages = [page('https://example.com/a', { title: null }), page('https://example.com/b', { title: null })];
  assert.deepEqual(findDuplicateTitles(pages), [], 'two missing titles are not "the same title" — extractTitle already flags missing separately');
});

test('findDuplicateTitles treats an empty-string title the same as a missing one (excluded, not a duplicate of other empties)', () => {
  const pages = [page('https://example.com/a', { title: '' }), page('https://example.com/b', { title: '' }), page('https://example.com/c', { title: '   ' })];
  assert.deepEqual(findDuplicateTitles(pages), [], 'an empty or whitespace-only title is not real content to compare — same treatment as null');
});

test('findDuplicateMetaDescriptions treats an empty-string description the same as a missing one', () => {
  const pages = [page('https://example.com/a', { metaDescription: '' }), page('https://example.com/b', { metaDescription: '' })];
  assert.deepEqual(findDuplicateMetaDescriptions(pages), []);
});

test('findDuplicateTitles excludes external, robots-skipped, and errored pages', () => {
  const pages = [
    page('https://example.com/a', { title: 'Widgets' }),
    page('https://other.com/x', { title: 'Widgets', isExternal: true }),
    page('https://example.com/blocked', { title: 'Widgets', skipped: true }),
    page('https://example.com/broken', { title: 'Widgets', error: { type: 'timeout' } }),
  ];
  assert.deepEqual(findDuplicateTitles(pages), [], 'only the one real, fetched page has this title — nothing to compare it against');
});

test('findDuplicateTitles excludes explicitly non-indexable pages (noindex, or a non-200 response with a real body)', () => {
  // checklists/on-page-checklist.md's requirement is specifically about
  // *indexable* pages — two 404s sharing a generic error-page title (or a
  // noindex page sharing a title with something else) is expected and
  // harmless, not a real duplicate-content finding.
  const pages = [
    page('https://example.com/a', { title: 'Page Not Found', indexable: true }),
    page('https://example.com/missing-1', { title: 'Page Not Found', status: 404, indexable: false }),
    page('https://example.com/missing-2', { title: 'Page Not Found', status: 404, indexable: false }),
  ];
  assert.deepEqual(findDuplicateTitles(pages), [], 'only one real indexable page carries this title — the two non-indexable 404s must not count');
});

test('findDuplicateTitles still flags a real duplicate among indexable pages even when a non-indexable page shares the same title', () => {
  const pages = [
    page('https://example.com/a', { title: 'Widgets', indexable: true }),
    page('https://example.com/b', { title: 'Widgets', indexable: true }),
    page('https://example.com/noindexed', { title: 'Widgets', indexable: false }),
  ];
  const duplicates = findDuplicateTitles(pages);
  assert.equal(duplicates.length, 1);
  assert.deepEqual(duplicates[0].urls, ['https://example.com/a', 'https://example.com/b'], 'the noindexed page must not be counted, even though it shares the title');
});

test('findDuplicateTitles does not exclude a page merely for lacking an indexable field (only indexable:false is excluded)', () => {
  // A page object with no `indexable` property at all (rather than an
  // explicit false) should still be considered — this only matters for
  // synthetic/partial page objects; real crawl results always compute it.
  const pages = [page('https://example.com/a', { title: 'Widgets' }), page('https://example.com/b', { title: 'Widgets' })];
  assert.equal(findDuplicateTitles(pages).length, 1);
});

test('findDuplicateTitles normalizes surrounding/collapsed whitespace but stays case-sensitive', () => {
  const pages = [page('https://example.com/a', { title: 'Widgets  For  Sale' }), page('https://example.com/b', { title: ' Widgets For Sale ' })];
  const duplicates = findDuplicateTitles(pages);
  assert.equal(duplicates.length, 1, 'whitespace differences alone should not hide a real duplicate');

  const caseSensitive = [page('https://example.com/a', { title: 'Widgets' }), page('https://example.com/b', { title: 'widgets' })];
  assert.deepEqual(findDuplicateTitles(caseSensitive), [], 'different casing is treated as a genuinely different title, not a duplicate');
});

test('findDuplicateTitles sorts groups by most-duplicated first', () => {
  const pages = [
    page('https://example.com/a', { title: 'A' }),
    page('https://example.com/b', { title: 'A' }),
    page('https://example.com/c', { title: 'B' }),
    page('https://example.com/d', { title: 'B' }),
    page('https://example.com/e', { title: 'B' }),
  ];
  const duplicates = findDuplicateTitles(pages);
  assert.equal(duplicates[0].value, 'B');
  assert.equal(duplicates[0].urls.length, 3);
  assert.equal(duplicates[1].value, 'A');
  assert.equal(duplicates[1].urls.length, 2);
});

test('findDuplicateTitles does not double-count the same page appearing twice in the pages array', () => {
  const p = page('https://example.com/a', { title: 'Widgets' });
  const pages = [p, p, page('https://example.com/b', { title: 'Widgets' })];
  const duplicates = findDuplicateTitles(pages);
  assert.equal(duplicates[0].urls.length, 2, 'the repeated page entry must not inflate the duplicate count');
});

test('findDuplicateMetaDescriptions mirrors findDuplicateTitles for the metaDescription field', () => {
  const pages = [
    page('https://example.com/a', { metaDescription: 'Buy widgets online.' }),
    page('https://example.com/b', { metaDescription: 'Buy widgets online.' }),
    page('https://example.com/c', { metaDescription: 'Something else entirely.' }),
  ];
  const duplicates = findDuplicateMetaDescriptions(pages);
  assert.equal(duplicates.length, 1);
  assert.deepEqual(duplicates[0].urls, ['https://example.com/a', 'https://example.com/b']);
});

test('buildDuplicateContentReport assembles both title and description results together', () => {
  const pages = [
    page('https://example.com/a', { title: 'Same', metaDescription: 'Same desc' }),
    page('https://example.com/b', { title: 'Same', metaDescription: 'Same desc' }),
  ];
  const report = buildDuplicateContentReport(pages);
  assert.equal(report.duplicateTitles.length, 1);
  assert.equal(report.duplicateMetaDescriptions.length, 1);
});

test('buildDuplicateContentReport computes title and description duplicates fully independently of each other', () => {
  // Duplicate titles with genuinely distinct descriptions must not surface
  // any duplicate-description finding, and vice versa -- the two checks
  // must not leak into each other.
  const duplicateTitlesOnly = buildDuplicateContentReport([
    page('https://example.com/a', { title: 'Same Title', metaDescription: 'Description A' }),
    page('https://example.com/b', { title: 'Same Title', metaDescription: 'Description B' }),
  ]);
  assert.equal(duplicateTitlesOnly.duplicateTitles.length, 1);
  assert.deepEqual(duplicateTitlesOnly.duplicateMetaDescriptions, [], 'the descriptions are genuinely different — nothing to flag here');

  const duplicateDescriptionsOnly = buildDuplicateContentReport([
    page('https://example.com/a', { title: 'Title A', metaDescription: 'Same description.' }),
    page('https://example.com/b', { title: 'Title B', metaDescription: 'Same description.' }),
  ]);
  assert.deepEqual(duplicateDescriptionsOnly.duplicateTitles, [], 'the titles are genuinely different — nothing to flag here');
  assert.equal(duplicateDescriptionsOnly.duplicateMetaDescriptions.length, 1);
});

test('buildDuplicateContentReport correctly handles pages with mixed distinct and shared metadata across a larger set', () => {
  const pages = [
    page('https://example.com/1', { title: 'Widgets', metaDescription: 'Buy widgets.' }),
    page('https://example.com/2', { title: 'Widgets', metaDescription: 'Buy gadgets.' }), // shares title only
    page('https://example.com/3', { title: 'Gadgets', metaDescription: 'Buy widgets.' }), // shares description only
    page('https://example.com/4', { title: 'Doohickeys', metaDescription: 'Buy doohickeys.' }), // shares nothing
  ];
  const report = buildDuplicateContentReport(pages);
  assert.equal(report.duplicateTitles.length, 1);
  assert.deepEqual(report.duplicateTitles[0].urls, ['https://example.com/1', 'https://example.com/2']);
  assert.equal(report.duplicateMetaDescriptions.length, 1);
  assert.deepEqual(report.duplicateMetaDescriptions[0].urls, ['https://example.com/1', 'https://example.com/3']);
});

test('buildDuplicateContentReport never throws on an empty pages array', () => {
  assert.doesNotThrow(() => buildDuplicateContentReport([]));
  assert.deepEqual(buildDuplicateContentReport([]), { duplicateTitles: [], duplicateMetaDescriptions: [] });
});

test('buildDuplicateContentReport never throws when a page has an unparseable URL', () => {
  const pages = [page('not a url at all', { title: 'Widgets' }), page('https://example.com/b', { title: 'Widgets' })];
  assert.doesNotThrow(() => buildDuplicateContentReport(pages));
});
