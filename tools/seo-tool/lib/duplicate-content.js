// Cross-page duplicate title / meta-description detection. Pure
// post-processing over a completed crawl's page list — no further network
// requests, same architectural role as lib/link-graph.js (which does the
// equivalent cross-page derivation for the link graph).
//
// checklists/on-page-checklist.md requires "every indexable page has a
// unique <title>" and "every indexable page has a unique meta description"
// — before this module, checking that required a human to manually compare
// every crawled page's title/description by eye. This makes it a real,
// checkable fact instead.

import { normalizeForDedup } from './url-utils.js';

/** normalizeForDedup throws on an unparseable URL — this never does. */
function safeNormalize(urlString) {
  try {
    return normalizeForDedup(urlString);
  } catch {
    return null;
  }
}

/**
 * Group pages by an exact-match value for one field (after trimming and
 * collapsing internal whitespace — real templating differences like a
 * trailing space or double space shouldn't hide an otherwise-identical
 * duplicate, but this is deliberately NOT a fuzzy/near-duplicate matcher).
 * Comparison is case-sensitive: "Widgets" and "widgets" are usually a
 * genuinely different (if similar) title, not a templating artifact — this
 * only flags true duplicates, not similarity.
 *
 * A page with a missing/empty value for the field is excluded entirely —
 * that's a different, already-reported problem (see extractTitle /
 * extractMetaDescription, whose `null` already flags "missing"), not a
 * duplicate. External, robots-skipped, errored, and explicitly
 * non-indexable pages (noindex, a non-200 response that still returned a
 * real body — e.g. a shared custom error page) are excluded too, since
 * checklists/on-page-checklist.md's requirement is specifically about
 * *indexable* pages: two 404s sharing a generic "Page Not Found" title is
 * expected and harmless, not a real duplicate-content problem, and
 * including it would just be noise alongside genuine findings.
 *
 * Returns groups with more than one distinct page, most-duplicated first.
 */
function findDuplicateField(pages, fieldName) {
  const groups = new Map(); // normalized comparison value -> { value, urls, seenKeys }

  for (const page of pages) {
    if (page.skipped || page.isExternal || page.error || page.indexable === false) continue;
    const raw = page[fieldName];
    if (!raw || typeof raw !== 'string') continue;
    const normalized = raw.trim().replace(/\s+/g, ' ');
    if (!normalized) continue;

    const url = page.finalUrl || page.requestedUrl;
    const key = safeNormalize(url);
    if (!key) continue;

    if (!groups.has(normalized)) groups.set(normalized, { value: normalized, urls: [], seenKeys: new Set() });
    const group = groups.get(normalized);
    if (group.seenKeys.has(key)) continue; // don't double-count the same page
    group.seenKeys.add(key);
    group.urls.push(url);
  }

  const duplicates = [];
  for (const { value, urls } of groups.values()) {
    if (urls.length > 1) duplicates.push({ value, urls });
  }
  duplicates.sort((a, b) => b.urls.length - a.urls.length);
  return duplicates;
}

/** Titles shared, verbatim, by more than one crawled page. */
export function findDuplicateTitles(pages) {
  return findDuplicateField(pages, 'title');
}

/** Meta descriptions shared, verbatim, by more than one crawled page. */
export function findDuplicateMetaDescriptions(pages) {
  return findDuplicateField(pages, 'metaDescription');
}

/**
 * Assemble the full duplicate-content facts object for the report. Same
 * "pure derivation from a completed pages array" shape as buildLinkGraph.
 */
export function buildDuplicateContentReport(pages) {
  return {
    duplicateTitles: findDuplicateTitles(pages),
    duplicateMetaDescriptions: findDuplicateMetaDescriptions(pages),
  };
}
