import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractTitle,
  extractMetaTags,
  extractMetaDescription,
  extractRobotsMeta,
  extractCanonical,
  extractHreflang,
  extractPagination,
  computePaginationCanonicalConflict,
  computeOgUrlCanonicalMismatch,
  extractViewport,
  extractCharset,
  extractLangAttribute,
  extractFavicon,
  extractHeadings,
  extractOpenGraph,
  extractTwitterCard,
  extractJsonLd,
  findMissingRequiredJsonLdProperties,
  extractLinks,
  extractImages,
  computeIndexabilitySignal,
  computeRobotsDirectivesConflict,
  extractSeoFacts,
  decodeEntities,
} from '../lib/html-extract.js';

test('extractTitle handles simple, entity-encoded, and nested-tag titles', () => {
  assert.equal(extractTitle('<title>Hello World</title>'), 'Hello World');
  assert.equal(extractTitle('<title>Widgets &amp; Gadgets</title>'), 'Widgets & Gadgets');
  assert.equal(extractTitle('<TITLE>  Spaced   Out  </TITLE>'), 'Spaced Out');
  assert.equal(extractTitle('<html><head></head></html>'), null);
});

test('extractMetaDescription finds description regardless of attribute order/case', () => {
  const html1 = '<meta name="description" content="A great page">';
  const html2 = '<meta content="Another page" name="Description">';
  assert.equal(extractMetaDescription(extractMetaTags(html1)), 'A great page');
  assert.equal(extractMetaDescription(extractMetaTags(html2)), 'Another page');
});

test('extractMetaDescription returns null when absent', () => {
  assert.equal(extractMetaDescription(extractMetaTags('<meta charset="utf-8">')), null);
});

test('extractRobotsMeta splits and lowercases directives', () => {
  const meta = extractMetaTags('<meta name="robots" content="NOINDEX, nofollow">');
  assert.deepEqual(extractRobotsMeta(meta), ['noindex', 'nofollow']);
});

test('extractRobotsMeta returns empty array when absent', () => {
  assert.deepEqual(extractRobotsMeta(extractMetaTags('<meta charset="utf-8">')), []);
});

test('extractCanonical finds link rel=canonical with any attribute order or quote style', () => {
  const base = 'https://example.com/';
  assert.equal(extractCanonical('<link rel="canonical" href="https://example.com/page">', base).canonical, 'https://example.com/page');
  assert.equal(extractCanonical("<link href='https://example.com/x' rel='canonical'>", base).canonical, 'https://example.com/x');
  assert.equal(extractCanonical('<link rel="stylesheet" href="/style.css">', base).canonical, null);
});

test('extractCanonical resolves an absolute canonical href unchanged', () => {
  const result = extractCanonical('<link rel="canonical" href="https://example.com/canonical-page">', 'https://example.com/some/other/page');
  assert.equal(result.canonical, 'https://example.com/canonical-page');
  assert.equal(result.canonicalCount, 1);
  assert.equal(result.multipleCanonicals, false);
  assert.deepEqual(result.canonicalRawHrefs, ['https://example.com/canonical-page']);
});

test('extractCanonical resolves a path-relative canonical href against the page URL', () => {
  const result = extractCanonical('<link rel="canonical" href="widgets">', 'https://example.com/shop/index.html');
  assert.equal(result.canonical, 'https://example.com/shop/widgets');
  assert.deepEqual(result.canonicalRawHrefs, ['widgets']);
});

test('extractCanonical resolves a root-relative canonical href against the page URL', () => {
  const result = extractCanonical('<link rel="canonical" href="/widgets">', 'https://example.com/shop/deeply/nested/page');
  assert.equal(result.canonical, 'https://example.com/widgets');
});

test('extractCanonical preserves a canonical href\'s own query string and fragment (does not strip them)', () => {
  const result = extractCanonical('<link rel="canonical" href="/page?utm_source=x#section">', 'https://example.com/');
  assert.equal(result.canonical, 'https://example.com/page?utm_source=x#section');
});

test('extractCanonical detects multiple canonical declarations, preserves the first, and reports all raw hrefs as evidence', () => {
  const html = `
    <link rel="canonical" href="/first">
    <link rel="canonical" href="/second">
    <link rel="canonical" href="https://elsewhere.example.com/third">
  `;
  const result = extractCanonical(html, 'https://example.com/');
  assert.equal(result.canonical, 'https://example.com/first', 'the first declaration in document order wins, per existing project convention');
  assert.equal(result.canonicalCount, 3);
  assert.equal(result.multipleCanonicals, true);
  assert.deepEqual(result.canonicalRawHrefs, ['/first', '/second', 'https://elsewhere.example.com/third']);
});

test('extractCanonical returns a non-multiple result when there is exactly one canonical', () => {
  const result = extractCanonical('<link rel="canonical" href="/only">', 'https://example.com/');
  assert.equal(result.canonicalCount, 1);
  assert.equal(result.multipleCanonicals, false);
});

test('extractCanonical handles a missing canonical tag entirely', () => {
  const result = extractCanonical('<html><head><title>No canonical here</title></head></html>', 'https://example.com/');
  assert.equal(result.canonical, null);
  assert.equal(result.canonicalCount, 0);
  assert.equal(result.multipleCanonicals, false);
  assert.deepEqual(result.canonicalRawHrefs, []);
});

test('extractCanonical treats a canonical link with no href attribute as malformed, not a crash', () => {
  const result = extractCanonical('<link rel="canonical">', 'https://example.com/');
  assert.equal(result.canonical, null);
  assert.equal(result.canonicalCount, 1, 'the tag itself still counts as a declaration, even without a usable href');
  assert.deepEqual(result.canonicalRawHrefs, [null]);
});

test('extractCanonical treats an empty-string canonical href as malformed, not a crash', () => {
  const result = extractCanonical('<link rel="canonical" href="">', 'https://example.com/');
  assert.equal(result.canonical, null);
  assert.equal(result.canonicalCount, 1);
  assert.deepEqual(result.canonicalRawHrefs, ['']);
});

test('extractCanonical treats a non-navigable canonical scheme (javascript:) as malformed, not a crash', () => {
  const result = extractCanonical('<link rel="canonical" href="javascript:void(0)">', 'https://example.com/');
  assert.equal(result.canonical, null);
  assert.equal(result.canonicalCount, 1);
  assert.deepEqual(result.canonicalRawHrefs, ['javascript:void(0)']);
});

test('extractCanonical never throws when pageUrl itself is missing/invalid, even for a relative href', () => {
  assert.doesNotThrow(() => extractCanonical('<link rel="canonical" href="/relative">', undefined));
  const result = extractCanonical('<link rel="canonical" href="/relative">', undefined);
  assert.equal(result.canonical, null, 'cannot resolve a relative href with no usable base — malformed, not a crash');
  assert.deepEqual(result.canonicalRawHrefs, ['/relative']);
});

test('extractCanonical is case-insensitive and whitespace-tolerant on rel="canonical" among other rel values', () => {
  const result = extractCanonical('<link rel="alternate canonical" href="/x">', 'https://example.com/');
  assert.equal(result.canonical, 'https://example.com/x');
});

// ---------- extractHreflang ----------

test('extractHreflang finds every rel=alternate hreflang declaration and resolves each href to absolute', () => {
  const html = `
    <link rel="alternate" hreflang="en-US" href="/en/page">
    <link rel="alternate" hreflang="fr-FR" href="https://example.com/fr/page">
  `;
  const result = extractHreflang(html, 'https://example.com/en/page');
  assert.equal(result.hreflangCount, 2);
  assert.deepEqual(result.hreflangTags, [
    { hreflang: 'en-US', href: 'https://example.com/en/page', rawHref: '/en/page' },
    { hreflang: 'fr-FR', href: 'https://example.com/fr/page', rawHref: 'https://example.com/fr/page' },
  ]);
});

test('extractHreflang resolves relative and root-relative hrefs the same way canonical does', () => {
  const relative = extractHreflang('<link rel="alternate" hreflang="fr" href="page">', 'https://example.com/shop/index.html');
  assert.equal(relative.hreflangTags[0].href, 'https://example.com/shop/page');

  const rootRelative = extractHreflang('<link rel="alternate" hreflang="fr" href="/page">', 'https://example.com/shop/deep/page');
  assert.equal(rootRelative.hreflangTags[0].href, 'https://example.com/page');
});

test('extractHreflang recognizes hreflang="x-default" as valid, not malformed', () => {
  const result = extractHreflang('<link rel="alternate" hreflang="x-default" href="/default">', 'https://example.com/');
  assert.equal(result.hasXDefault, true);
  assert.deepEqual(result.malformedHreflang, []);
});

test('extractHreflang reports hasXDefault:false when no x-default declaration exists', () => {
  const result = extractHreflang('<link rel="alternate" hreflang="en" href="/en">', 'https://example.com/');
  assert.equal(result.hasXDefault, false);
});

test('extractHreflang detects a page that references itself in its own hreflang set', () => {
  const html = `
    <link rel="alternate" hreflang="en-US" href="/page">
    <link rel="alternate" hreflang="fr-FR" href="/fr/page">
  `;
  const result = extractHreflang(html, 'https://example.com/page');
  assert.equal(result.selfReferencingHreflang, true, 'the en-US entry resolves to the page\'s own URL');
});

test('extractHreflang detects when a page does NOT reference itself (a real, common hreflang mistake)', () => {
  const html = '<link rel="alternate" hreflang="fr-FR" href="/fr/page">';
  const result = extractHreflang(html, 'https://example.com/page');
  assert.equal(result.selfReferencingHreflang, false);
});

test('extractHreflang flags hreflang values repeated with genuinely different targets, but not the same target', () => {
  const conflicting = extractHreflang(
    '<link rel="alternate" hreflang="fr" href="/fr-a"><link rel="alternate" hreflang="fr" href="/fr-b">',
    'https://example.com/'
  );
  assert.deepEqual(conflicting.duplicateHreflangValues, ['fr']);

  const harmlessRepeat = extractHreflang(
    '<link rel="alternate" hreflang="fr" href="/fr"><link rel="alternate" hreflang="fr" href="/fr">',
    'https://example.com/'
  );
  assert.deepEqual(harmlessRepeat.duplicateHreflangValues, [], 'the exact same value+target repeated is redundant, not a conflicting signal');
});

test('extractHreflang treats an empty hreflang value as malformed', () => {
  const result = extractHreflang('<link rel="alternate" hreflang="" href="/x">', 'https://example.com/');
  assert.equal(result.malformedHreflang.length, 1);
  assert.match(result.malformedHreflang[0].issue, /empty/);
});

test('extractHreflang flags an underscore separator as malformed (the exact mistake workflows/international-seo.md calls out)', () => {
  const result = extractHreflang('<link rel="alternate" hreflang="en_US" href="/x">', 'https://example.com/');
  assert.equal(result.malformedHreflang.length, 1);
  assert.match(result.malformedHreflang[0].issue, /underscore/);
  assert.match(result.malformedHreflang[0].issue, /en_US/);
});

test('extractHreflang flags the "UK instead of GB" mistake (also explicitly called out in workflows/international-seo.md)', () => {
  const result = extractHreflang('<link rel="alternate" hreflang="en-uk" href="/x">', 'https://example.com/');
  assert.equal(result.malformedHreflang.length, 1);
  assert.match(result.malformedHreflang[0].issue, /GB/);
});

test('extractHreflang does not flag well-formed codes as malformed', () => {
  const html = `
    <link rel="alternate" hreflang="en" href="/en">
    <link rel="alternate" hreflang="en-US" href="/en-us">
    <link rel="alternate" hreflang="zh-Hans-CN" href="/zh">
  `;
  const result = extractHreflang(html, 'https://example.com/');
  assert.deepEqual(result.malformedHreflang, []);
});

test('extractHreflang ignores rel="alternate" links that have no hreflang attribute (e.g. an RSS feed link)', () => {
  const result = extractHreflang('<link rel="alternate" type="application/rss+xml" href="/feed.xml">', 'https://example.com/');
  assert.equal(result.hreflangCount, 0);
});

test('extractHreflang ignores rel="canonical" and other non-alternate link tags', () => {
  const result = extractHreflang('<link rel="canonical" href="/x"><link rel="stylesheet" href="/style.css">', 'https://example.com/');
  assert.equal(result.hreflangCount, 0);
});

test('extractHreflang handles a page with no hreflang tags at all', () => {
  const result = extractHreflang('<html><head><title>No hreflang</title></head></html>', 'https://example.com/');
  assert.equal(result.hreflangCount, 0);
  assert.equal(result.hasXDefault, false);
  assert.equal(result.selfReferencingHreflang, false);
  assert.deepEqual(result.hreflangTags, []);
  assert.deepEqual(result.duplicateHreflangValues, []);
  assert.deepEqual(result.malformedHreflang, []);
});

test('extractHreflang never throws when pageUrl is missing, even for a relative href', () => {
  assert.doesNotThrow(() => extractHreflang('<link rel="alternate" hreflang="en" href="/x">', undefined));
  const result = extractHreflang('<link rel="alternate" hreflang="en" href="/x">', undefined);
  assert.equal(result.hreflangTags[0].href, null);
  assert.equal(result.hreflangTags[0].rawHref, '/x');
  assert.equal(result.selfReferencingHreflang, false);
});

test('extractHreflang is case-insensitive on rel="alternate" and tolerant of other rel tokens alongside it', () => {
  const result = extractHreflang('<link rel="ALTERNATE" hreflang="en" href="/en">', 'https://example.com/');
  assert.equal(result.hreflangCount, 1);
});

// ---------- extractPagination / computePaginationCanonicalConflict ----------

test('extractPagination finds and resolves both rel=next and rel=prev', () => {
  const html = '<link rel="next" href="/page/3"><link rel="prev" href="/page/1">';
  const result = extractPagination(html, 'https://example.com/page/2');
  assert.equal(result.paginationNext, 'https://example.com/page/3');
  assert.equal(result.paginationPrev, 'https://example.com/page/1');
  assert.equal(result.isPaginated, true);
});

test('extractPagination handles a page with only rel=next (the first page of a series)', () => {
  const result = extractPagination('<link rel="next" href="/page/2">', 'https://example.com/page/1');
  assert.equal(result.paginationNext, 'https://example.com/page/2');
  assert.equal(result.paginationPrev, null);
  assert.equal(result.isPaginated, true);
});

test('extractPagination handles a page with only rel=prev (the last page of a series)', () => {
  const result = extractPagination('<link rel="prev" href="/page/4">', 'https://example.com/page/5');
  assert.equal(result.paginationNext, null);
  assert.equal(result.paginationPrev, 'https://example.com/page/4');
  assert.equal(result.isPaginated, true);
});

test('extractPagination reports isPaginated:false when neither tag is present', () => {
  const result = extractPagination('<link rel="canonical" href="/x">', 'https://example.com/');
  assert.equal(result.paginationNext, null);
  assert.equal(result.paginationPrev, null);
  assert.equal(result.isPaginated, false);
});

test('extractPagination resolves relative and root-relative hrefs the same way canonical/hreflang do', () => {
  const relative = extractPagination('<link rel="next" href="page-3">', 'https://example.com/shop/page-2');
  assert.equal(relative.paginationNext, 'https://example.com/shop/page-3');

  const rootRelative = extractPagination('<link rel="next" href="/page-3">', 'https://example.com/shop/deep/page-2');
  assert.equal(rootRelative.paginationNext, 'https://example.com/page-3');
});

test('extractPagination still reports isPaginated:true when the tag is present but its href is empty/unresolvable (the tag itself marks this as a paginated page)', () => {
  const result = extractPagination('<link rel="next" href="">', 'https://example.com/');
  assert.equal(result.paginationNext, null);
  assert.equal(result.isPaginated, true);
});

test('extractPagination never throws when pageUrl is missing, even for a relative href', () => {
  assert.doesNotThrow(() => extractPagination('<link rel="next" href="/page/2">', undefined));
  const result = extractPagination('<link rel="next" href="/page/2">', undefined);
  assert.equal(result.paginationNext, null, 'cannot resolve a relative href with no usable base — not paginated data lost, just unresolvable');
  assert.equal(result.isPaginated, true);
});

test('extractPagination is case-insensitive on rel="next"/rel="prev" among other rel tokens', () => {
  const result = extractPagination('<link rel="NEXT" href="/page/2">', 'https://example.com/');
  assert.equal(result.paginationNext, 'https://example.com/page/2');
});

test('computePaginationCanonicalConflict flags a paginated page whose canonical points to a different URL (the "canonicalize everything to page 1" mistake)', () => {
  const conflict = computePaginationCanonicalConflict({
    isPaginated: true,
    canonical: 'https://example.com/page/1',
    pageUrl: 'https://example.com/page/2',
  });
  assert.equal(conflict, true);
});

test('computePaginationCanonicalConflict does not flag a paginated page with a correct, self-referencing canonical', () => {
  const conflict = computePaginationCanonicalConflict({
    isPaginated: true,
    canonical: 'https://example.com/page/2',
    pageUrl: 'https://example.com/page/2',
  });
  assert.equal(conflict, false);
});

test('computePaginationCanonicalConflict does not flag a non-paginated page, even with a canonical pointing elsewhere', () => {
  const conflict = computePaginationCanonicalConflict({
    isPaginated: false,
    canonical: 'https://example.com/other',
    pageUrl: 'https://example.com/page/2',
  });
  assert.equal(conflict, false);
});

test('computePaginationCanonicalConflict does not flag a paginated page with no canonical at all', () => {
  const conflict = computePaginationCanonicalConflict({ isPaginated: true, canonical: null, pageUrl: 'https://example.com/page/2' });
  assert.equal(conflict, false);
});

test('computePaginationCanonicalConflict ignores a fragment-only difference (same page, different fragment)', () => {
  const conflict = computePaginationCanonicalConflict({
    isPaginated: true,
    canonical: 'https://example.com/page/2#section',
    pageUrl: 'https://example.com/page/2',
  });
  assert.equal(conflict, false);
});

test('computePaginationCanonicalConflict never throws on a malformed canonical or pageUrl', () => {
  assert.doesNotThrow(() => computePaginationCanonicalConflict({ isPaginated: true, canonical: 'not a url', pageUrl: undefined }));
  assert.equal(computePaginationCanonicalConflict({ isPaginated: true, canonical: 'not a url', pageUrl: undefined }), false);
});

test('computeOgUrlCanonicalMismatch flags a genuine disagreement between og:url and canonical', () => {
  const result = computeOgUrlCanonicalMismatch({
    ogUrl: 'https://example.com/old-url',
    canonical: 'https://example.com/new-url',
    pageUrl: 'https://example.com/new-url',
  });
  assert.equal(result, true);
});

test('computeOgUrlCanonicalMismatch does not flag agreement, or when either value is absent', () => {
  assert.equal(
    computeOgUrlCanonicalMismatch({ ogUrl: 'https://example.com/page', canonical: 'https://example.com/page', pageUrl: 'https://example.com/page' }),
    false
  );
  assert.equal(computeOgUrlCanonicalMismatch({ ogUrl: null, canonical: 'https://example.com/page', pageUrl: 'https://example.com/page' }), false, 'no og:url declared — nothing to compare');
  assert.equal(computeOgUrlCanonicalMismatch({ ogUrl: 'https://example.com/page', canonical: null, pageUrl: 'https://example.com/page' }), false, 'no canonical — a separately-reported problem, not an og:url mismatch');
});

test('computeOgUrlCanonicalMismatch resolves a relative og:url against pageUrl before comparing', () => {
  const result = computeOgUrlCanonicalMismatch({ ogUrl: '/widgets', canonical: 'https://example.com/widgets', pageUrl: 'https://example.com/widgets' });
  assert.equal(result, false, 'a relative og:url resolving to the same absolute URL as canonical is not a mismatch');
});

test('computeOgUrlCanonicalMismatch ignores a fragment-only difference', () => {
  const result = computeOgUrlCanonicalMismatch({
    ogUrl: 'https://example.com/page#section',
    canonical: 'https://example.com/page',
    pageUrl: 'https://example.com/page',
  });
  assert.equal(result, false);
});

test('computeOgUrlCanonicalMismatch never throws on a malformed og:url', () => {
  assert.doesNotThrow(() => computeOgUrlCanonicalMismatch({ ogUrl: 'not a url at all', canonical: 'https://example.com/page', pageUrl: 'https://example.com/page' }));
});

test('extractViewport reads meta viewport content', () => {
  const meta = extractMetaTags('<meta name="viewport" content="width=device-width, initial-scale=1">');
  assert.equal(extractViewport(meta), 'width=device-width, initial-scale=1');
});

test('extractLangAttribute reads html lang', () => {
  assert.equal(extractLangAttribute('<html lang="en-US"><head></head></html>'), 'en-US');
  assert.equal(extractLangAttribute('<html><head></head></html>'), null);
});

test('extractCharset reads the modern HTML5 <meta charset> form', () => {
  const meta = extractMetaTags('<meta charset="utf-8">');
  assert.equal(extractCharset(meta), 'utf-8');
});

test('extractCharset falls back to the legacy http-equiv Content-Type form', () => {
  const meta = extractMetaTags('<meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1">');
  assert.equal(extractCharset(meta), 'iso-8859-1');
});

test('extractCharset returns null when neither form is present', () => {
  assert.equal(extractCharset(extractMetaTags('<meta name="viewport" content="width=device-width">')), null);
});

test('extractFavicon finds an icon-family link and resolves its href', () => {
  const result = extractFavicon('<link rel="icon" href="/favicon.png">', 'https://example.com/page');
  assert.equal(result.hasFavicon, true);
  assert.equal(result.faviconHref, 'https://example.com/favicon.png');
});

test('extractFavicon recognizes shortcut icon and apple-touch-icon rel variants', () => {
  assert.equal(extractFavicon('<link rel="shortcut icon" href="/favicon.ico">', 'https://example.com/').hasFavicon, true);
  assert.equal(extractFavicon('<link rel="apple-touch-icon" href="/apple-icon.png">', 'https://example.com/').hasFavicon, true);
});

test('extractFavicon reports hasFavicon:false when no icon link is declared', () => {
  const result = extractFavicon('<link rel="canonical" href="/page">', 'https://example.com/page');
  assert.equal(result.hasFavicon, false);
  assert.equal(result.faviconHref, null);
});

test('extractFavicon treats a present tag with an empty href as not having a usable favicon', () => {
  const result = extractFavicon('<link rel="icon" href="">', 'https://example.com/page');
  assert.equal(result.hasFavicon, false);
});

test('extractHeadings counts and captures H1/H2 text', () => {
  const html = '<h1>Main Title</h1><p>x</p><h2>Section A</h2><h2>Section B</h2>';
  const h = extractHeadings(html);
  assert.equal(h.h1Count, 1);
  assert.deepEqual(h.h1Texts, ['Main Title']);
  assert.equal(h.h2Count, 2);
  assert.deepEqual(h.h2Texts, ['Section A', 'Section B']);
});

test('extractHeadings handles zero and multiple H1s', () => {
  assert.equal(extractHeadings('<p>no headings</p>').h1Count, 0);
  assert.equal(extractHeadings('<h1>One</h1><h1>Two</h1>').h1Count, 2);
});

test('extractOpenGraph and extractTwitterCard collect the relevant meta fields', () => {
  const html = `
    <meta property="og:title" content="OG Title">
    <meta property="og:description" content="OG Desc">
    <meta property="og:image" content="https://example.com/img.png">
    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="TW Title">
  `;
  const meta = extractMetaTags(html);
  const og = extractOpenGraph(meta);
  assert.equal(og.title, 'OG Title');
  assert.equal(og.description, 'OG Desc');
  assert.equal(og.image, 'https://example.com/img.png');
  const tw = extractTwitterCard(meta);
  assert.equal(tw.card, 'summary_large_image');
  assert.equal(tw.title, 'TW Title');
});

test('extractJsonLd parses valid blocks and captures parse errors without throwing', () => {
  const html = `
    <script type="application/ld+json">{"@context":"https://schema.org","@type":"Organization","name":"Acme"}</script>
    <script type="application/ld+json">{ not valid json }</script>
    <script type="text/javascript">var x = 1;</script>
  `;
  const blocks = extractJsonLd(html);
  assert.equal(blocks.length, 2);
  assert.equal(blocks[0].parsed['@type'], 'Organization');
  assert.equal(blocks[0].parseError, null);
  assert.deepEqual(blocks[0].missingRequiredProperties, []);
  assert.equal(blocks[1].parsed, null);
  assert.ok(blocks[1].parseError);
  assert.equal(blocks[1].missingRequiredProperties, null, 'a block that failed to parse has nothing further to check');
});

test('findMissingRequiredJsonLdProperties flags a missing @context, a missing @type, or both', () => {
  assert.deepEqual(findMissingRequiredJsonLdProperties({ '@context': 'https://schema.org', '@type': 'Article' }), []);
  assert.deepEqual(findMissingRequiredJsonLdProperties({ '@type': 'Article' }), ['@context']);
  assert.deepEqual(findMissingRequiredJsonLdProperties({ '@context': 'https://schema.org' }), ['@type']);
  assert.deepEqual(findMissingRequiredJsonLdProperties({}).sort(), ['@context', '@type']);
});

test('findMissingRequiredJsonLdProperties treats a @graph container as not needing its own @type', () => {
  const block = { '@context': 'https://schema.org', '@graph': [{ '@type': 'Product', name: 'Widget' }, { '@type': 'BreadcrumbList' }] };
  assert.deepEqual(findMissingRequiredJsonLdProperties(block), []);
});

test('findMissingRequiredJsonLdProperties still requires @context on a @graph container', () => {
  const block = { '@graph': [{ '@type': 'Product' }] };
  assert.deepEqual(findMissingRequiredJsonLdProperties(block), ['@context']);
});

test('findMissingRequiredJsonLdProperties checks each item of a top-level array independently, deduping the result', () => {
  const withOneBad = [
    { '@context': 'https://schema.org', '@type': 'Product' },
    { '@type': 'Review' }, // missing @context
  ];
  assert.deepEqual(findMissingRequiredJsonLdProperties(withOneBad), ['@context']);

  const bothFine = [
    { '@context': 'https://schema.org', '@type': 'Product' },
    { '@context': 'https://schema.org', '@type': 'Review' },
  ];
  assert.deepEqual(findMissingRequiredJsonLdProperties(bothFine), []);
});

test('findMissingRequiredJsonLdProperties never throws on null, a non-object, or an empty array', () => {
  assert.deepEqual(findMissingRequiredJsonLdProperties(null), []);
  assert.deepEqual(findMissingRequiredJsonLdProperties('a string'), []);
  assert.deepEqual(findMissingRequiredJsonLdProperties(42), []);
  assert.deepEqual(findMissingRequiredJsonLdProperties([]), []);
});

test('extractLinks classifies internal vs external and resolves relative hrefs', () => {
  const html = `
    <a href="/about">About</a>
    <a href="https://example.com/contact">Contact</a>
    <a href="https://other.com/x">External</a>
    <a href="#section">Anchor only</a>
    <a href="javascript:void(0)">JS link</a>
  `;
  const { internalLinks, externalLinks, invalidHrefs } = extractLinks(html, 'https://example.com/start');
  assert.equal(internalLinks.length, 2);
  assert.equal(internalLinks[0].url, 'https://example.com/about');
  assert.equal(externalLinks.length, 1);
  assert.equal(externalLinks[0].url, 'https://other.com/x');
  assert.equal(invalidHrefs.length, 0); // javascript: is filtered, not invalid; #section is skipped as a fragment-only link
});

test('extractLinks flags nofollow', () => {
  const html = '<a href="/x" rel="nofollow">no follow me</a>';
  const { internalLinks } = extractLinks(html, 'https://example.com/');
  assert.equal(internalLinks[0].nofollow, true);
});

test('extractImages reports alt presence distinctly from empty alt', () => {
  const html = `
    <img src="/a.jpg" alt="A description">
    <img src="/b.jpg" alt="">
    <img src="/c.jpg">
  `;
  const images = extractImages(html, 'https://example.com/');
  assert.equal(images[0].hasAlt, true);
  assert.equal(images[0].isEmptyAlt, false);
  assert.equal(images[1].hasAlt, true);
  assert.equal(images[1].isEmptyAlt, true);
  assert.equal(images[2].hasAlt, false);
});

test('extractImages reports explicit width/height dimensions distinctly from missing ones', () => {
  const html = `
    <img src="/a.jpg" width="600" height="400">
    <img src="/b.jpg" width="600">
    <img src="/c.jpg">
  `;
  const images = extractImages(html, 'https://example.com/');
  assert.equal(images[0].width, '600');
  assert.equal(images[0].height, '400');
  assert.equal(images[0].hasExplicitDimensions, true);
  assert.equal(images[1].hasExplicitDimensions, false, 'width alone, with no height, is not enough to prevent layout shift');
  assert.equal(images[1].width, '600');
  assert.equal(images[1].height, null);
  assert.equal(images[2].hasExplicitDimensions, false);
  assert.equal(images[2].width, null);
  assert.equal(images[2].height, null);
});

test('extractImages treats an inline aspect-ratio style as satisfying the dimensions check too', () => {
  const html = '<img src="/a.jpg" style="aspect-ratio: 16 / 9;">';
  const images = extractImages(html, 'https://example.com/');
  assert.equal(images[0].hasExplicitDimensions, true, 'checklists/performance-checklist.md documents aspect-ratio as an accepted alternative to width/height');
  assert.equal(images[0].width, null);
  assert.equal(images[0].height, null);
});

test('extractImages captures the raw loading attribute value as evidence, without judging above/below-the-fold correctness', () => {
  const html = `
    <img src="/a.jpg" loading="lazy">
    <img src="/b.jpg" loading="eager">
    <img src="/c.jpg">
  `;
  const images = extractImages(html, 'https://example.com/');
  assert.equal(images[0].loading, 'lazy');
  assert.equal(images[1].loading, 'eager');
  assert.equal(images[2].loading, null);
});

test('computeIndexabilitySignal flags noindex and non-200 status', () => {
  const r1 = computeIndexabilitySignal({ statusCode: 200, robotsMetaDirectives: [] });
  assert.equal(r1.indexable, true);

  const r2 = computeIndexabilitySignal({ statusCode: 200, robotsMetaDirectives: ['noindex'] });
  assert.equal(r2.indexable, false);
  assert.match(r2.reasons[0], /noindex/);

  const r3 = computeIndexabilitySignal({ statusCode: 404, robotsMetaDirectives: [] });
  assert.equal(r3.indexable, false);
});

test('computeIndexabilitySignal flags a canonical pointing elsewhere', () => {
  const r = computeIndexabilitySignal({
    statusCode: 200,
    robotsMetaDirectives: [],
    canonicalUrl: 'https://example.com/other',
    finalUrl: 'https://example.com/this',
  });
  assert.equal(r.reasons.some((m) => m.includes('canonical points to a different URL')), true);
});

test('computeRobotsDirectivesConflict flags a genuine index/noindex disagreement between meta and header', () => {
  const r = computeRobotsDirectivesConflict(['index', 'follow'], ['noindex']);
  assert.equal(r.conflict, true);
  assert.match(r.reasons[0], /meta robots says "index" but X-Robots-Tag says "noindex"/);
});

test('computeRobotsDirectivesConflict flags a genuine follow/nofollow disagreement between meta and header', () => {
  const r = computeRobotsDirectivesConflict(['nofollow'], ['follow']);
  assert.equal(r.conflict, true);
  assert.match(r.reasons[0], /meta robots says "nofollow" but X-Robots-Tag says "follow"/);
});

test('computeRobotsDirectivesConflict can report both families conflicting at once', () => {
  const r = computeRobotsDirectivesConflict(['index', 'follow'], ['noindex', 'nofollow']);
  assert.equal(r.conflict, true);
  assert.equal(r.reasons.length, 2);
});

test('computeRobotsDirectivesConflict expands "all"/"none" shorthand before comparing', () => {
  const r1 = computeRobotsDirectivesConflict(['all'], ['noindex']);
  assert.equal(r1.conflict, true, '"all" means index+follow, which disagrees with header noindex');

  const r2 = computeRobotsDirectivesConflict(['none'], ['index']);
  assert.equal(r2.conflict, true, '"none" means noindex+nofollow, which disagrees with header index');

  const r3 = computeRobotsDirectivesConflict(['all'], ['index', 'follow']);
  assert.equal(r3.conflict, false, '"all" and an explicit index,follow header agree');
});

test('computeRobotsDirectivesConflict does not flag agreement, or a directive present in only one source', () => {
  assert.equal(computeRobotsDirectivesConflict(['noindex'], ['noindex']).conflict, false, 'both sources agree');
  assert.equal(computeRobotsDirectivesConflict(['noindex'], []).conflict, false, 'only meta has a directive — nothing to disagree with');
  assert.equal(computeRobotsDirectivesConflict([], ['noindex']).conflict, false, 'only the header has a directive — nothing to disagree with');
  assert.equal(computeRobotsDirectivesConflict([], []).conflict, false, 'neither source has any directive');
  assert.equal(computeRobotsDirectivesConflict(['noarchive'], ['nosnippet']).conflict, false, 'directives with no opposite-pair family are never flagged as conflicting');
});

test('decodeEntities handles named and numeric entities', () => {
  assert.equal(decodeEntities('A &amp; B'), 'A & B');
  assert.equal(decodeEntities('&#39;quoted&#39;'), "'quoted'");
  assert.equal(decodeEntities('&#x27;hex&#x27;'), "'hex'");
});

test('extractSeoFacts assembles a complete facts object from a realistic page', () => {
  const html = `<!doctype html>
<html lang="en">
<head>
  <title>Widgets — Acme</title>
  <meta name="description" content="Buy the best widgets online.">
  <link rel="canonical" href="https://example.com/widgets">
  <meta name="robots" content="index, follow">
  <meta property="og:title" content="Widgets">
  <script type="application/ld+json">{"@type":"Product","name":"Widget"}</script>
</head>
<body>
  <h1>Our Widgets</h1>
  <p>Some copy with an <a href="/widgets/blue">internal link</a> and an <a href="https://partner.com">external link</a>.</p>
  <img src="/widget.jpg" alt="A blue widget">
</body>
</html>`;
  const facts = extractSeoFacts(html, 'https://example.com/widgets', { statusCode: 200 });
  assert.equal(facts.title, 'Widgets — Acme');
  assert.equal(facts.metaDescription, 'Buy the best widgets online.');
  assert.equal(facts.canonical, 'https://example.com/widgets');
  assert.equal(facts.canonicalCount, 1);
  assert.equal(facts.multipleCanonicals, false);
  assert.deepEqual(facts.canonicalRawHrefs, ['https://example.com/widgets']);
  assert.equal(facts.hreflangCount, 0, 'this fixture page declares no hreflang tags');
  assert.deepEqual(facts.hreflangTags, []);
  assert.equal(facts.hasXDefault, false);
  assert.equal(facts.selfReferencingHreflang, false);
  assert.equal(facts.h1Count, 1);
  assert.equal(facts.indexable, true);
  assert.equal(facts.jsonLd.length, 1);
  assert.equal(facts.internalLinks.length, 1);
  assert.equal(facts.externalLinks.length, 1);
  assert.equal(facts.imagesMissingAlt, 0);
  assert.equal(facts.imagesMissingDimensions, 1, 'the fixture image declares no width/height/aspect-ratio');
  assert.equal(facts.charset, null, 'this fixture declares no <meta charset>');
  assert.equal(facts.hasFavicon, false, 'this fixture declares no favicon link');
  assert.equal(facts.faviconHref, null);
});

test('extractSeoFacts resolves charset and favicon presence when declared', () => {
  const html = '<html><head><meta charset="utf-8"><link rel="icon" href="/favicon.png"></head></html>';
  const facts = extractSeoFacts(html, 'https://example.com/page', { statusCode: 200 });
  assert.equal(facts.charset, 'utf-8');
  assert.equal(facts.hasFavicon, true);
  assert.equal(facts.faviconHref, 'https://example.com/favicon.png');
});

test('extractSeoFacts resolves a relative canonical against the real page URL and surfaces multiple-canonical evidence', () => {
  const html = `<!doctype html>
<html><head>
  <title>Duplicated canonicals</title>
  <link rel="canonical" href="/canonical-target">
  <link rel="canonical" href="/another-declared-target">
</head><body></body></html>`;
  const facts = extractSeoFacts(html, 'https://example.com/some/deep/page', { statusCode: 200 });
  assert.equal(facts.canonical, 'https://example.com/canonical-target', 'relative href resolved against the real page URL, first declaration wins');
  assert.equal(facts.canonicalCount, 2);
  assert.equal(facts.multipleCanonicals, true);
  assert.deepEqual(facts.canonicalRawHrefs, ['/canonical-target', '/another-declared-target']);
});

test('extractSeoFacts reports a missing canonical as null with zero count, not a crash', () => {
  const facts = extractSeoFacts('<html><head><title>No canonical</title></head></html>', 'https://example.com/page', { statusCode: 200 });
  assert.equal(facts.canonical, null);
  assert.equal(facts.canonicalCount, 0);
  assert.equal(facts.multipleCanonicals, false);
  assert.deepEqual(facts.canonicalRawHrefs, []);
});

test('extractSeoFacts resolves hreflang declarations against the real page URL and surfaces self-reference/duplicate/malformed evidence', () => {
  const html = `<!doctype html>
<html><head>
  <title>International page</title>
  <link rel="alternate" hreflang="en-US" href="/en/page">
  <link rel="alternate" hreflang="fr-FR" href="/fr/page">
  <link rel="alternate" hreflang="x-default" href="/en/page">
  <link rel="alternate" hreflang="de_DE" href="/de/page">
</head><body></body></html>`;
  const facts = extractSeoFacts(html, 'https://example.com/en/page', { statusCode: 200 });
  assert.equal(facts.hreflangCount, 4);
  assert.equal(facts.hasXDefault, true);
  assert.equal(facts.selfReferencingHreflang, true, 'the en-US entry resolves to this page\'s own URL');
  assert.deepEqual(facts.duplicateHreflangValues, []);
  assert.equal(facts.malformedHreflang.length, 1);
  assert.equal(facts.malformedHreflang[0].hreflang, 'de_DE');
  assert.deepEqual(
    facts.hreflangTags.map((t) => t.href),
    ['https://example.com/en/page', 'https://example.com/fr/page', 'https://example.com/en/page', 'https://example.com/de/page']
  );
});

test('extractSeoFacts resolves pagination against the real page URL and flags the canonical-to-page-1 anti-pattern', () => {
  const html = `<!doctype html>
<html><head>
  <title>Widgets — Page 2</title>
  <link rel="canonical" href="/widgets">
  <link rel="next" href="/widgets/page/3">
  <link rel="prev" href="/widgets/page/1">
</head><body></body></html>`;
  const facts = extractSeoFacts(html, 'https://example.com/widgets/page/2', { statusCode: 200 });
  assert.equal(facts.isPaginated, true);
  assert.equal(facts.paginationNext, 'https://example.com/widgets/page/3');
  assert.equal(facts.paginationPrev, 'https://example.com/widgets/page/1');
  assert.equal(
    facts.paginationCanonicalConflict,
    true,
    'the canonical points to /widgets (effectively page 1) instead of self-referencing this page — the documented anti-pattern'
  );
});

test('extractSeoFacts reports no pagination conflict for a correctly self-referencing paginated page', () => {
  const html = `<!doctype html>
<html><head>
  <title>Widgets — Page 2</title>
  <link rel="canonical" href="/widgets/page/2">
  <link rel="next" href="/widgets/page/3">
  <link rel="prev" href="/widgets/page/1">
</head><body></body></html>`;
  const facts = extractSeoFacts(html, 'https://example.com/widgets/page/2', { statusCode: 200 });
  assert.equal(facts.isPaginated, true);
  assert.equal(facts.paginationCanonicalConflict, false);
});

test('extractSeoFacts reports isPaginated:false and no conflict for an ordinary, non-paginated page', () => {
  const facts = extractSeoFacts('<html><head><title>Ordinary page</title></head></html>', 'https://example.com/about', { statusCode: 200 });
  assert.equal(facts.isPaginated, false);
  assert.equal(facts.paginationNext, null);
  assert.equal(facts.paginationPrev, null);
  assert.equal(facts.paginationCanonicalConflict, false);
});

test('extractSeoFacts flags a real disagreement between meta robots and X-Robots-Tag end-to-end', () => {
  const html = '<html><head><title>Conflicting signals</title><meta name="robots" content="index, follow"></head></html>';
  const facts = extractSeoFacts(html, 'https://example.com/page', { statusCode: 200, xRobotsTagHeader: 'noindex' });
  assert.deepEqual(facts.robotsMetaDirectives, ['index', 'follow']);
  assert.deepEqual(facts.xRobotsTagDirectives, ['noindex']);
  assert.equal(facts.robotsDirectivesConflict, true);
  assert.match(facts.robotsDirectivesConflictReasons[0], /meta robots says "index" but X-Robots-Tag says "noindex"/);
  // The conflict is surfaced as its own fact -- it doesn't change the
  // indexable signal itself, which already correctly reflects "noindex
  // present anywhere" regardless of the disagreement.
  assert.equal(facts.indexable, false);
});

test('extractSeoFacts reports no conflict when meta and X-Robots-Tag agree, or when only one is present', () => {
  const agreeing = extractSeoFacts('<html><head><meta name="robots" content="noindex"></head></html>', 'https://example.com/a', {
    statusCode: 200,
    xRobotsTagHeader: 'noindex',
  });
  assert.equal(agreeing.robotsDirectivesConflict, false);
  assert.deepEqual(agreeing.robotsDirectivesConflictReasons, []);

  const metaOnly = extractSeoFacts('<html><head><meta name="robots" content="noindex"></head></html>', 'https://example.com/b', { statusCode: 200 });
  assert.equal(metaOnly.robotsDirectivesConflict, false);

  const neither = extractSeoFacts('<html><head><title>Plain</title></head></html>', 'https://example.com/c', { statusCode: 200 });
  assert.equal(neither.robotsDirectivesConflict, false);
});

test('extractSeoFacts flags a real og:url/canonical mismatch end-to-end', () => {
  const html =
    '<html><head><link rel="canonical" href="https://example.com/new-url">' +
    '<meta property="og:url" content="https://example.com/old-url"></head></html>';
  const facts = extractSeoFacts(html, 'https://example.com/new-url', { statusCode: 200 });
  assert.equal(facts.openGraph.url, 'https://example.com/old-url');
  assert.equal(facts.ogUrlCanonicalMismatch, true);
});

test('extractSeoFacts reports no og:url/canonical mismatch when they agree, or when either is absent', () => {
  const agreeing = extractSeoFacts(
    '<html><head><link rel="canonical" href="https://example.com/page"><meta property="og:url" content="https://example.com/page"></head></html>',
    'https://example.com/page',
    { statusCode: 200 }
  );
  assert.equal(agreeing.ogUrlCanonicalMismatch, false);

  const noOgUrl = extractSeoFacts('<html><head><link rel="canonical" href="https://example.com/page"></head></html>', 'https://example.com/page', {
    statusCode: 200,
  });
  assert.equal(noOgUrl.ogUrlCanonicalMismatch, false);
});
