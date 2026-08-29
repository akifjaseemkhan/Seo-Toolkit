// Compares two previously-generated seo-tool JSON reports (the output of
// any command's --json=path) to surface what changed between them -- the
// "before/after reference point" workflows/monitoring.md ("establish a
// full baseline snapshot first") and workflows/post-implementation.md
// ("log the change for future comparison") both call for. Pure comparison
// over two already-parsed report objects -- no file I/O, no network
// requests, same architectural role as lib/link-graph.js and
// lib/duplicate-content.js.

import { normalizeForDedup } from './url-utils.js';

/** normalizeForDedup throws on an unparseable URL — this never does. */
function safeNormalize(urlString) {
  try {
    return normalizeForDedup(urlString);
  } catch {
    return null;
  }
}

/** True if `obj` looks like a report this tool itself produced. */
export function isSeoToolReport(obj) {
  return Boolean(obj && typeof obj === 'object' && obj.meta && obj.meta.tool === 'seo-tool');
}

function pageUrlOf(page) {
  return page.finalUrl || page.requestedUrl;
}

/**
 * The specific, bounded set of per-page fields this diff tracks —
 * deliberately not exhaustive. internalLinks/externalLinks/images/jsonLd
 * are excluded: they're arrays whose ordinary churn (a new blog post added
 * a new internal link, a JSON-LD block's raw text reformatted) would be
 * noise, not the SEO-meaningful regression signal workflows/monitoring.md
 * actually asks to catch (indexing status, broken links, noindex/robots
 * drift). See the "report-diff note" in docs/tooling.md.
 */
const TRACKED_PAGE_FIELDS = [
  'status',
  'indexable',
  'canonical',
  'multipleCanonicals',
  'title',
  'metaDescription',
  'robotsMetaDirectives',
  'xRobotsTagDirectives',
  'robotsDirectivesConflict',
  'h1Count',
  'isPaginated',
  'paginationCanonicalConflict',
  'ogUrlCanonicalMismatch',
];

function valuesEqual(a, b) {
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort();
    const sortedB = [...b].sort();
    return sortedA.every((v, i) => v === sortedB[i]);
  }
  return a === b;
}

// Fields whose value is itself a URL — compared via the same
// normalizeForDedup equivalence the rest of this tool already uses
// everywhere else (orphan matching, broken-link matching, etc.), not raw
// string equality. Without this, a URL that's identical in every way that
// matters (host case, a default port written out) but differs as a literal
// string would show up as a false-positive "change".
const URL_VALUED_FIELDS = new Set(['canonical']);

function fieldValuesEqual(field, a, b) {
  if (URL_VALUED_FIELDS.has(field) && typeof a === 'string' && typeof b === 'string') {
    const normA = safeNormalize(a);
    const normB = safeNormalize(b);
    if (normA && normB) return normA === normB;
  }
  return valuesEqual(a, b);
}

/**
 * Diff two `pages` arrays, matched by normalized URL (never by array
 * position/order — a reordered array of otherwise-identical pages must
 * never show up as changes). Returns per-page added/removed/changed
 * (with the exact tracked fields that differ) plus the specific
 * `indexable` transitions this tool is confident enough to call a
 * regression or improvement — every other tracked-field difference is
 * reported as a "change," not editorialized as good or bad.
 */
function diffPages(pagesBefore = [], pagesAfter = []) {
  const beforeByKey = new Map();
  for (const p of pagesBefore) {
    const key = safeNormalize(pageUrlOf(p));
    if (key) beforeByKey.set(key, p);
  }
  const afterByKey = new Map();
  for (const p of pagesAfter) {
    const key = safeNormalize(pageUrlOf(p));
    if (key) afterByKey.set(key, p);
  }

  const added = [];
  const removed = [];
  const changed = [];
  const regressions = [];
  const improvements = [];
  let unchangedCount = 0;

  for (const [key, afterPage] of afterByKey) {
    if (!beforeByKey.has(key)) added.push(pageUrlOf(afterPage));
  }
  for (const [key, beforePage] of beforeByKey) {
    if (!afterByKey.has(key)) removed.push(pageUrlOf(beforePage));
  }
  for (const [key, beforePage] of beforeByKey) {
    const afterPage = afterByKey.get(key);
    if (!afterPage) continue;
    const url = pageUrlOf(afterPage);

    const fieldChanges = [];
    for (const field of TRACKED_PAGE_FIELDS) {
      const beforeValue = beforePage[field];
      const afterValue = afterPage[field];
      if (!fieldValuesEqual(field, beforeValue, afterValue)) {
        fieldChanges.push({ field, before: beforeValue, after: afterValue });
      }
    }
    if (fieldChanges.length > 0) {
      changed.push({ url, changes: fieldChanges });
    } else {
      unchangedCount++;
    }

    if (beforePage.indexable === true && afterPage.indexable === false) {
      regressions.push({ url, field: 'indexable', before: true, after: false });
    } else if (beforePage.indexable === false && afterPage.indexable === true) {
      improvements.push({ url, field: 'indexable', before: false, after: true });
    }
  }

  return { added, removed, changed, unchangedCount, regressions, improvements };
}

/** Diff two plain URL-string arrays, matched by normalized URL. */
function diffUrlList(before = [], after = []) {
  const beforeKeys = new Map();
  for (const url of before) {
    const key = safeNormalize(url);
    if (key) beforeKeys.set(key, url);
  }
  const afterKeys = new Map();
  for (const url of after) {
    const key = safeNormalize(url);
    if (key) afterKeys.set(key, url);
  }
  const added = [...afterKeys.entries()].filter(([k]) => !beforeKeys.has(k)).map(([, url]) => url);
  const removed = [...beforeKeys.entries()].filter(([k]) => !afterKeys.has(k)).map(([, url]) => url);
  return { added, removed };
}

/** Diff two arrays of finding objects, matched by a caller-supplied key. */
function diffFindingList(before = [], after = [], keyFn) {
  const beforeKeys = new Set(before.map(keyFn));
  const afterKeys = new Set(after.map(keyFn));
  const added = after.filter((item) => !beforeKeys.has(keyFn(item)));
  const removed = before.filter((item) => !afterKeys.has(keyFn(item)));
  return { added, removed };
}

/**
 * Compare two full seo-tool report objects. Each section is only computed
 * when BOTH reports have it — comparing a `sitemap`-only report against a
 * `crawl` report, for instance, still works, it just reports `null` for
 * the sections that aren't present on both sides rather than crashing or
 * inventing data. `regressions`/`improvements` are currently sourced only
 * from `pages`' `indexable` transitions — the one signal explicit enough
 * (per workflows/monitoring.md: "catches accidental noindex/robots
 * regressions") to classify with confidence; every other difference is
 * reported as a fact under the relevant section, not judged.
 *
 * Sitemap/robots-section diffing is a deliberate, documented boundary —
 * not implemented here (see the "report-diff note" in docs/tooling.md).
 */
export function diffReports(reportBefore, reportAfter) {
  const result = {
    pages: null,
    linkGraph: null,
    duplicateContent: null,
    hreflangReciprocity: null,
    regressions: [],
    improvements: [],
  };

  if (reportBefore.pages && reportAfter.pages) {
    const pageDiff = diffPages(reportBefore.pages, reportAfter.pages);
    result.pages = {
      added: pageDiff.added,
      removed: pageDiff.removed,
      changed: pageDiff.changed,
      unchangedCount: pageDiff.unchangedCount,
    };
    result.regressions.push(...pageDiff.regressions);
    result.improvements.push(...pageDiff.improvements);
  }

  if (reportBefore.linkGraph && reportAfter.linkGraph) {
    result.linkGraph = {
      orphanCandidates: diffUrlList(reportBefore.linkGraph.orphanCandidates, reportAfter.linkGraph.orphanCandidates),
      brokenInternalLinks: diffFindingList(reportBefore.linkGraph.brokenInternalLinks, reportAfter.linkGraph.brokenInternalLinks, (x) => `${x.from}=>${x.to}`),
      internalLinksThroughRedirects: diffFindingList(
        reportBefore.linkGraph.internalLinksThroughRedirects,
        reportAfter.linkGraph.internalLinksThroughRedirects,
        (x) => `${x.from}=>${x.to}`
      ),
      sitemapIndexabilityConflicts: diffFindingList(
        reportBefore.linkGraph.sitemapIndexabilityConflicts,
        reportAfter.linkGraph.sitemapIndexabilityConflicts,
        (x) => x.url
      ),
    };
  }

  if (reportBefore.duplicateContent && reportAfter.duplicateContent) {
    result.duplicateContent = {
      duplicateTitles: diffFindingList(reportBefore.duplicateContent.duplicateTitles, reportAfter.duplicateContent.duplicateTitles, (x) => x.value),
      duplicateMetaDescriptions: diffFindingList(
        reportBefore.duplicateContent.duplicateMetaDescriptions,
        reportAfter.duplicateContent.duplicateMetaDescriptions,
        (x) => x.value
      ),
    };
  }

  if (reportBefore.hreflangReciprocity && reportAfter.hreflangReciprocity) {
    result.hreflangReciprocity = {
      nonReciprocalHreflang: diffFindingList(
        reportBefore.hreflangReciprocity.nonReciprocalHreflang,
        reportAfter.hreflangReciprocity.nonReciprocalHreflang,
        (x) => `${x.from}=>${x.to}:${(x.hreflang || '').toLowerCase()}`
      ),
    };
  }

  result.summary = {
    pagesAdded: result.pages ? result.pages.added.length : 0,
    pagesRemoved: result.pages ? result.pages.removed.length : 0,
    pagesChanged: result.pages ? result.pages.changed.length : 0,
    regressions: result.regressions.length,
    improvements: result.improvements.length,
  };

  return result;
}
