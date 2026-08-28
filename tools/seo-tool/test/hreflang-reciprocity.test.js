import test from 'node:test';
import assert from 'node:assert/strict';
import { findNonReciprocalHreflang, buildHreflangReciprocityReport, HREFLANG_RECIPROCITY_NOTE } from '../lib/hreflang-reciprocity.js';

function page(url, overrides = {}) {
  return {
    requestedUrl: url,
    finalUrl: url,
    status: 200,
    isExternal: false,
    hreflangTags: [],
    ...overrides,
  };
}

function hreflang(value, href) {
  return { hreflang: value, href, rawHref: href };
}

test('findNonReciprocalHreflang finds nothing when every declared target points back', () => {
  const pages = [
    page('https://example.com/en', { hreflangTags: [hreflang('en-US', 'https://example.com/en'), hreflang('fr-FR', 'https://example.com/fr')] }),
    page('https://example.com/fr', { hreflangTags: [hreflang('en-US', 'https://example.com/en'), hreflang('fr-FR', 'https://example.com/fr')] }),
  ];
  assert.deepEqual(findNonReciprocalHreflang(pages), []);
});

test('findNonReciprocalHreflang flags a page whose declared target does not point back', () => {
  const pages = [
    page('https://example.com/en', { hreflangTags: [hreflang('fr-FR', 'https://example.com/fr')] }),
    page('https://example.com/fr', { hreflangTags: [] }), // does not declare a link back to /en
  ];
  const result = findNonReciprocalHreflang(pages);
  assert.equal(result.length, 1);
  assert.deepEqual(result[0], { from: 'https://example.com/en', to: 'https://example.com/fr', hreflang: 'fr-FR' });
});

test('findNonReciprocalHreflang does not flag a self-referencing declaration', () => {
  const pages = [page('https://example.com/en', { hreflangTags: [hreflang('en-US', 'https://example.com/en')] })];
  assert.deepEqual(findNonReciprocalHreflang(pages), [], 'a page referencing itself is not a reciprocity concern');
});

test('findNonReciprocalHreflang does not flag a target outside the crawl\'s reached scope', () => {
  const pages = [page('https://example.com/en', { hreflangTags: [hreflang('fr-FR', 'https://example.com/fr')] })];
  // /fr was never crawled at all -- can't be confirmed reciprocal or not.
  assert.deepEqual(findNonReciprocalHreflang(pages), []);
});

test('findNonReciprocalHreflang does not flag a target that was crawled but skipped or errored', () => {
  const skippedTarget = [
    page('https://example.com/en', { hreflangTags: [hreflang('fr-FR', 'https://example.com/fr')] }),
    page('https://example.com/fr', { skipped: true, hreflangTags: [] }),
  ];
  assert.deepEqual(findNonReciprocalHreflang(skippedTarget), [], 'a robots-blocked target could not actually be inspected for its hreflang set');

  const erroredTarget = [
    page('https://example.com/en', { hreflangTags: [hreflang('fr-FR', 'https://example.com/fr')] }),
    page('https://example.com/fr', { error: { type: 'timeout' }, hreflangTags: [] }),
  ];
  assert.deepEqual(findNonReciprocalHreflang(erroredTarget), [], 'a fetch-errored target could not actually be inspected either');
});

test('findNonReciprocalHreflang ignores an unresolved (null) hreflang href', () => {
  const pages = [page('https://example.com/en', { hreflangTags: [hreflang('fr-FR', null)] })];
  assert.doesNotThrow(() => findNonReciprocalHreflang(pages));
  assert.deepEqual(findNonReciprocalHreflang(pages), []);
});

test('findNonReciprocalHreflang matches targets by normalized URL, not literal string equality', () => {
  const pages = [
    page('https://EXAMPLE.com/en', { hreflangTags: [hreflang('fr-FR', 'https://example.com/fr')] }),
    page('https://example.com/fr', { hreflangTags: [hreflang('en-US', 'https://EXAMPLE.com/en')] }),
  ];
  assert.deepEqual(findNonReciprocalHreflang(pages), [], 'host-case differences alone must not produce a false non-reciprocal finding');
});

test('findNonReciprocalHreflang does not double-report the same declaration seen more than once', () => {
  const tag = hreflang('fr-FR', 'https://example.com/fr');
  const pages = [page('https://example.com/en', { hreflangTags: [tag, tag] }), page('https://example.com/fr', { hreflangTags: [] })];
  const result = findNonReciprocalHreflang(pages);
  assert.equal(result.length, 1);
});

test('findNonReciprocalHreflang excludes external and robots-skipped origin pages', () => {
  const pages = [
    page('https://other.com/en', { isExternal: true, hreflangTags: [hreflang('fr-FR', 'https://example.com/fr')] }),
    page('https://example.com/skipped', { skipped: true, hreflangTags: [hreflang('fr-FR', 'https://example.com/fr')] }),
    page('https://example.com/fr', { hreflangTags: [] }),
  ];
  assert.deepEqual(findNonReciprocalHreflang(pages), [], 'an external or robots-skipped page is not a real origin to check reciprocity from');
});

test('findNonReciprocalHreflang never throws on pages with no hreflangTags at all, or an unparseable URL', () => {
  assert.doesNotThrow(() => findNonReciprocalHreflang([{ requestedUrl: 'https://example.com/a' }]));
  assert.doesNotThrow(() => findNonReciprocalHreflang([page('not a url at all', { hreflangTags: [hreflang('fr-FR', 'https://example.com/fr')] })]));
});

test('buildHreflangReciprocityReport assembles findings plus the bounded-scope note', () => {
  const pages = [
    page('https://example.com/en', { hreflangTags: [hreflang('fr-FR', 'https://example.com/fr')] }),
    page('https://example.com/fr', { hreflangTags: [] }),
  ];
  const report = buildHreflangReciprocityReport(pages);
  assert.equal(report.nonReciprocalHreflang.length, 1);
  assert.equal(report.note, HREFLANG_RECIPROCITY_NOTE);
});

test('buildHreflangReciprocityReport never throws on an empty pages array', () => {
  assert.doesNotThrow(() => buildHreflangReciprocityReport([]));
  assert.deepEqual(buildHreflangReciprocityReport([]).nonReciprocalHreflang, []);
});
