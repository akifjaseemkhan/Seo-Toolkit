import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractTitle,
  extractMetaTags,
  extractMetaDescription,
  extractRobotsMeta,
  extractCanonical,
  extractViewport,
  extractLangAttribute,
  extractHeadings,
  extractOpenGraph,
  extractTwitterCard,
  extractJsonLd,
  extractLinks,
  extractImages,
  computeIndexabilitySignal,
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
  assert.equal(extractCanonical('<link rel="canonical" href="https://example.com/page">'), 'https://example.com/page');
  assert.equal(extractCanonical("<link href='https://example.com/x' rel='canonical'>"), 'https://example.com/x');
  assert.equal(extractCanonical('<link rel="stylesheet" href="/style.css">'), null);
});

test('extractViewport reads meta viewport content', () => {
  const meta = extractMetaTags('<meta name="viewport" content="width=device-width, initial-scale=1">');
  assert.equal(extractViewport(meta), 'width=device-width, initial-scale=1');
});

test('extractLangAttribute reads html lang', () => {
  assert.equal(extractLangAttribute('<html lang="en-US"><head></head></html>'), 'en-US');
  assert.equal(extractLangAttribute('<html><head></head></html>'), null);
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
  assert.equal(blocks[1].parsed, null);
  assert.ok(blocks[1].parseError);
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
  assert.equal(facts.h1Count, 1);
  assert.equal(facts.indexable, true);
  assert.equal(facts.jsonLd.length, 1);
  assert.equal(facts.internalLinks.length, 1);
  assert.equal(facts.externalLinks.length, 1);
  assert.equal(facts.imagesMissingAlt, 0);
});
