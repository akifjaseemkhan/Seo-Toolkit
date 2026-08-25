import test from 'node:test';
import assert from 'node:assert/strict';
import { parseSitemap, validateSitemapEntries } from '../lib/sitemap.js';

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
