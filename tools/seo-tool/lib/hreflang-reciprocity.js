// Cross-page hreflang reciprocity detection. Pure post-processing over a
// completed crawl's page list — no further network requests, same
// architectural role as lib/duplicate-content.js (which does the equivalent
// cross-page derivation for duplicate titles/descriptions) and
// lib/link-graph.js (whose byKey lookup pattern this reuses).
//
// checklists/international-seo-checklist.md requires "Every language/region
// variant has a complete, reciprocal hreflang set (every page links to
// every variant, including itself)". lib/html-extract.js's extractHreflang
// explicitly defers this check ("intentionally out of scope here — it needs
// the whole crawled set") because a single page's HTML can never tell you
// whether the pages it points to point back — that needs the whole crawled
// set, the same way real orphan-page detection needs an independent URL
// list. This module is that cross-reference.

import { normalizeForDedup } from './url-utils.js';

/** normalizeForDedup throws on an unparseable URL — this never does. */
function safeNormalize(urlString) {
  try {
    return normalizeForDedup(urlString);
  } catch {
    return null;
  }
}

export const HREFLANG_RECIPROCITY_NOTE =
  'This is bounded by what this crawl actually discovered and fetched: an hreflang target outside the crawl\'s reached scope (external, beyond maxPages, or robots-blocked) cannot be confirmed reciprocal or non-reciprocal, so it is not reported either way — only a target this crawl actually verified and found not pointing back is flagged.';

/**
 * For every declared hreflang link whose target was ALSO reached and
 * fetched within this crawl, confirm the target page has an hreflang entry
 * pointing back to the origin page. A target outside the crawl's reached
 * scope can't be confirmed either way, so it is not reported — the same
 * "honest bound" convention findOrphansAgainstKnownUrls and
 * findSitemapIndexabilityConflicts already use in lib/link-graph.js.
 *
 * A self-referencing entry (a page's hreflang set including itself, already
 * tracked per-page as `selfReferencingHreflang`) is not a reciprocity
 * concern and is skipped here.
 */
export function findNonReciprocalHreflang(pages) {
  const byKey = new Map();
  for (const p of pages) {
    const requestedKey = safeNormalize(p.requestedUrl);
    if (requestedKey && !byKey.has(requestedKey)) byKey.set(requestedKey, p);
    const finalKey = safeNormalize(p.finalUrl);
    if (finalKey && !byKey.has(finalKey)) byKey.set(finalKey, p);
  }

  const results = [];
  const seenPairs = new Set();

  for (const page of pages) {
    if (page.skipped || page.isExternal || !page.hreflangTags || page.hreflangTags.length === 0) continue;
    const fromUrl = page.finalUrl || page.requestedUrl;
    const fromKey = safeNormalize(fromUrl);
    if (!fromKey) continue;

    for (const tag of page.hreflangTags) {
      if (!tag.href) continue; // unresolved href — already reported by malformedHreflang/rawHref evidence, nothing to cross-reference
      const targetKey = safeNormalize(tag.href);
      if (!targetKey || targetKey === fromKey) continue; // self-reference — not a reciprocity concern

      const pairKey = `${fromKey}=>${targetKey}:${(tag.hreflang || '').toLowerCase()}`;
      if (seenPairs.has(pairKey)) continue; // don't double-report the same declaration
      seenPairs.add(pairKey);

      const targetPage = byKey.get(targetKey);
      if (!targetPage) continue; // outside this crawl's reached scope — not confirmable either way
      if (targetPage.skipped || targetPage.error) continue; // couldn't actually inspect its hreflang set

      const targetHreflangTags = targetPage.hreflangTags || [];
      const pointsBack = targetHreflangTags.some((t) => t.href && safeNormalize(t.href) === fromKey);
      if (!pointsBack) {
        results.push({ from: fromUrl, to: tag.href, hreflang: tag.hreflang });
      }
    }
  }

  return results;
}

/**
 * Assemble the full hreflang-reciprocity facts object for the report. Same
 * "pure derivation from a completed pages array" shape as
 * buildDuplicateContentReport/buildLinkGraph.
 */
export function buildHreflangReciprocityReport(pages) {
  return {
    nonReciprocalHreflang: findNonReciprocalHreflang(pages),
    note: HREFLANG_RECIPROCITY_NOTE,
  };
}
