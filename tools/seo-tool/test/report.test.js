import test from 'node:test';
import assert from 'node:assert/strict';
import { assembleReport, TOOL_VERSION } from '../lib/report.js';

const STARTED_AT = '2026-01-01T00:00:00.000Z';

test('assembleReport produces the documented top-level meta envelope', () => {
  const report = assembleReport({ command: 'page', target: 'https://example.com/', options: { timeoutMs: 10000 }, startedAt: STARTED_AT });
  assert.equal(report.meta.tool, 'seo-tool');
  assert.equal(report.meta.version, TOOL_VERSION);
  assert.equal(report.meta.command, 'page');
  assert.equal(report.meta.target, 'https://example.com/');
  assert.equal(report.meta.startedAt, STARTED_AT);
  assert.ok(report.meta.finishedAt, 'finishedAt should default to something when not supplied');
  assert.deepEqual(report.meta.options, { timeoutMs: 10000 });
});

test('assembleReport respects an explicit finishedAt instead of always defaulting', () => {
  const report = assembleReport({ command: 'page', target: 'x', options: {}, startedAt: STARTED_AT, finishedAt: '2026-01-01T00:00:05.000Z' });
  assert.equal(report.meta.finishedAt, '2026-01-01T00:00:05.000Z');
});

test('assembleReport surfaces page-level data from crawlResult.pages verbatim', () => {
  const page = { requestedUrl: 'https://example.com/', finalUrl: 'https://example.com/', status: 200, title: 'Home' };
  const crawlResult = { startUrl: 'https://example.com/', pages: [page], errors: [], warnings: [], truncatedByMaxPages: false, robots: { checked: true, robotsUrl: 'https://example.com/robots.txt' } };
  const report = assembleReport({ command: 'page', target: 'https://example.com/', options: {}, startedAt: STARTED_AT, crawlResult });
  assert.equal(report.pages.length, 1);
  assert.deepEqual(report.pages[0], page);
});

test('assembleReport computes crawlSummary (site-level data) from crawlResult', () => {
  const crawlResult = {
    startUrl: 'https://example.com/',
    pages: [{ requestedUrl: 'https://example.com/' }, { requestedUrl: 'https://example.com/about' }],
    errors: [],
    warnings: [],
    truncatedByMaxPages: true,
    robots: { checked: true, robotsUrl: 'https://example.com/robots.txt' },
  };
  const report = assembleReport({ command: 'crawl', target: 'https://example.com/', options: {}, startedAt: STARTED_AT, crawlResult });
  assert.deepEqual(report.crawlSummary, {
    startUrl: 'https://example.com/',
    pagesFetched: 2,
    truncatedByMaxPages: true,
    robots: { checked: true, robotsUrl: 'https://example.com/robots.txt' },
  });
});

test('assembleReport pulls errors and warnings up from crawlResult into the top-level arrays (findings/errors)', () => {
  const crawlResult = {
    startUrl: 'https://example.com/',
    pages: [],
    errors: [{ url: 'https://example.com/broken', message: 'timeout' }],
    warnings: ['robots.txt not available'],
    truncatedByMaxPages: false,
    robots: null,
  };
  const report = assembleReport({ command: 'crawl', target: 'https://example.com/', options: {}, startedAt: STARTED_AT, crawlResult });
  assert.deepEqual(report.errors, [{ url: 'https://example.com/broken', message: 'timeout' }]);
  assert.deepEqual(report.warnings, ['robots.txt not available']);
});

test('assembleReport passes sitemap, robots, linkGraph, duplicateContent, and project sections through unchanged when supplied', () => {
  const sitemapResult = { source: 'https://example.com/sitemap.xml', type: 'urlset', urls: [], entryCount: 0, issues: [] };
  const robotsResult = { source: 'https://example.com/robots.txt', found: true, groups: [], sitemaps: [] };
  const linkGraph = { orphanCandidates: [], crawlDepthOutliers: [], brokenInternalLinks: [], unverifiedInternalLinks: [], note: 'x' };
  const duplicateContent = { duplicateTitles: [], duplicateMetaDescriptions: [] };
  const projectFacts = { rootDir: '/tmp/project', packageJson: null };

  const report = assembleReport({
    command: 'audit',
    target: 'https://example.com/',
    options: {},
    startedAt: STARTED_AT,
    crawlResult: { startUrl: 'https://example.com/', pages: [], errors: [], warnings: [], truncatedByMaxPages: false, robots: null },
    sitemapResult,
    robotsResult,
    linkGraph,
    duplicateContent,
    projectFacts,
  });

  assert.equal(report.sitemap, sitemapResult);
  assert.equal(report.robots, robotsResult);
  assert.equal(report.linkGraph, linkGraph);
  assert.equal(report.duplicateContent, duplicateContent);
  assert.equal(report.project, projectFacts);
});

test('assembleReport leaves crawl-derived sections undefined for a non-crawl command (e.g. sitemap-only)', () => {
  const report = assembleReport({
    command: 'sitemap',
    target: 'https://example.com/sitemap.xml',
    options: {},
    startedAt: STARTED_AT,
    sitemapResult: { source: 'https://example.com/sitemap.xml', type: 'urlset', urls: [], entryCount: 0, issues: [] },
  });
  assert.equal(report.pages, undefined);
  assert.equal(report.crawlSummary, undefined);
  assert.equal(report.robots, undefined);
  assert.equal(report.linkGraph, undefined);
  assert.equal(report.duplicateContent, undefined);
  assert.equal(report.project, undefined);
  assert.ok(report.sitemap);
});

test('assembleReport handles a fully empty/partial call (no result objects at all) without throwing', () => {
  const report = assembleReport({ command: 'project', target: '/tmp/x', options: {}, startedAt: STARTED_AT });
  assert.deepEqual(report.errors, []);
  assert.deepEqual(report.warnings, []);
  assert.equal(report.pages, undefined);
  assert.equal(report.sitemap, undefined);
  assert.equal(report.robots, undefined);
  assert.equal(report.linkGraph, undefined);
  assert.equal(report.duplicateContent, undefined);
  assert.equal(report.project, undefined);
});

test('assembleReport treats a crawlResult with zero pages as valid, not an error state', () => {
  const crawlResult = { startUrl: 'https://example.com/', pages: [], errors: [], warnings: [], truncatedByMaxPages: false, robots: null };
  const report = assembleReport({ command: 'crawl', target: 'https://example.com/', options: {}, startedAt: STARTED_AT, crawlResult });
  assert.deepEqual(report.pages, []);
  assert.equal(report.crawlSummary.pagesFetched, 0);
});

test('assembleReport output survives JSON.stringify/parse with every populated field intact', () => {
  // Note: keys assembleReport sets to `undefined` (e.g. `sitemap` on a
  // crawl-only report) are legitimately dropped by JSON.stringify — that's
  // correct, expected JSON behavior, not data loss, so this only asserts
  // on fields that actually carry data.
  const crawlResult = {
    startUrl: 'https://example.com/',
    pages: [{ requestedUrl: 'https://example.com/', status: 200, jsonLd: [{ raw: '{}', parsed: {}, parseError: null }] }],
    errors: [],
    warnings: [],
    truncatedByMaxPages: false,
    robots: { checked: true, robotsUrl: 'https://example.com/robots.txt' },
  };
  const report = assembleReport({ command: 'crawl', target: 'https://example.com/', options: { maxPages: 5 }, startedAt: STARTED_AT, crawlResult });
  const roundTripped = JSON.parse(JSON.stringify(report));
  assert.deepEqual(roundTripped.meta, report.meta);
  assert.deepEqual(roundTripped.pages, report.pages);
  assert.deepEqual(roundTripped.crawlSummary, report.crawlSummary);
  assert.deepEqual(roundTripped.errors, report.errors);
  assert.deepEqual(roundTripped.warnings, report.warnings);
  assert.equal('sitemap' in roundTripped, false, 'unpopulated sections should not survive serialization as explicit keys');
});

test('assembleReport JSON output never contains a literal "undefined" section for a command that has no data for it', () => {
  // JSON.stringify drops keys whose value is `undefined` entirely — this
  // confirms assembleReport's `|| undefined` pattern actually produces a
  // clean object (no stray keys) once serialized, matching the documented
  // schema's "only the populated sections differ by command" promise.
  const report = assembleReport({ command: 'robots', target: 'https://example.com/robots.txt', options: {}, startedAt: STARTED_AT, robotsResult: { source: 'x', found: true, groups: [], sitemaps: [] } });
  const serialized = JSON.parse(JSON.stringify(report));
  assert.equal('pages' in serialized, false);
  assert.equal('crawlSummary' in serialized, false);
  assert.equal('sitemap' in serialized, false);
  assert.equal('linkGraph' in serialized, false);
  assert.equal('duplicateContent' in serialized, false);
  assert.equal('project' in serialized, false);
  assert.ok('robots' in serialized);
});
