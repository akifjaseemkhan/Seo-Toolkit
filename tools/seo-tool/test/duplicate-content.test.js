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

test('findDuplicateTitles excludes external, robots-skipped, and errored pages', () => {
  const pages = [
    page('https://example.com/a', { title: 'Widgets' }),
    page('https://other.com/x', { title: 'Widgets', isExternal: true }),
    page('https://example.com/blocked', { title: 'Widgets', skipped: true }),
    page('https://example.com/broken', { title: 'Widgets', error: { type: 'timeout' } }),
  ];
  assert.deepEqual(findDuplicateTitles(pages), [], 'only the one real, fetched page has this title — nothing to compare it against');
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

test('buildDuplicateContentReport never throws on an empty pages array', () => {
  assert.doesNotThrow(() => buildDuplicateContentReport([]));
  assert.deepEqual(buildDuplicateContentReport([]), { duplicateTitles: [], duplicateMetaDescriptions: [] });
});

test('buildDuplicateContentReport never throws when a page has an unparseable URL', () => {
  const pages = [page('not a url at all', { title: 'Widgets' }), page('https://example.com/b', { title: 'Widgets' })];
  assert.doesNotThrow(() => buildDuplicateContentReport(pages));
});
