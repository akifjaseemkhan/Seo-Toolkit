// Derives orphan/depth/broken-link facts from a completed crawl's page
// list. Pure post-processing — makes no further network requests.

import { normalizeForDedup } from './url-utils.js';

/** normalizeForDedup throws on an unparseable URL — this never does. */
function safeNormalize(urlString) {
  try {
    return normalizeForDedup(urlString);
  } catch {
    return null;
  }
}

export const INCOMPLETE_CRAWL_NOTE =
  'These findings are bounded by what this crawl actually discovered and fetched (see truncatedByMaxPages and maxPages) and, for orphan detection and sitemap/indexability cross-referencing, by whether an independent URL list (e.g. the sitemap) was supplied. A page flagged as a "potential orphan" is scoped to what this crawl actually reached, not mathematically proven across the whole site; a sitemap URL outside that reached scope is neither confirmed conflicting nor confirmed clean for sitemapIndexabilityConflicts — it is simply not reported either way, not silently assumed fine.';

/**
 * IMPORTANT: a pure single-seed breadth-first crawl can, by construction,
 * never discover a genuinely unlinked page — every page it fetches was
 * necessarily reached via some internal link, so it will always have at
 * least one discoveredFrom entry. This function will correctly return an
 * empty list for a crawl-only page set; that is not a bug, it is an honest
 * limitation of BFS-from-one-seed. Real orphan detection needs an
 * independent source of "URLs that should exist" — see
 * findOrphansAgainstKnownUrls below, which is what buildLinkGraph uses when
 * a knownUrls list (typically the sitemap) is supplied.
 */
export function findOrphanCandidates(pages, startUrl) {
  const startKey = safeNormalize(startUrl);
  return pages
    .filter((p) => !p.skipped && !p.isExternal)
    .filter((p) => safeNormalize(p.requestedUrl) !== startKey)
    .filter((p) => !p.discoveredFrom || p.discoveredFrom.length === 0)
    .map((p) => p.finalUrl || p.requestedUrl);
}

/**
 * The practically useful orphan check: URLs from an independent list (e.g.
 * sitemap entries) that never appeared as an internal-link target anywhere
 * in the crawl. This is what actually finds "the sitemap says this page
 * exists, but nothing on the site links to it."
 */
export function findOrphansAgainstKnownUrls(pages, knownUrls, startUrl) {
  const discoveredTargets = new Set();
  for (const p of pages) {
    if (!p.internalLinks) continue;
    for (const link of p.internalLinks) {
      const key = safeNormalize(link.url);
      if (key) discoveredTargets.add(key);
    }
  }
  const startKey = safeNormalize(startUrl);
  const out = [];
  for (const url of knownUrls) {
    const key = safeNormalize(url);
    if (!key) continue; // malformed sitemap entry — already reported by validateSitemapEntries
    if (key === startKey) continue;
    if (!discoveredTargets.has(key)) out.push(url);
  }
  return out;
}

/**
 * Sitemap entries that were also reached and fetched within this crawl but
 * turned out to be non-indexable (noindex, non-200 status) or blocked by
 * robots.txt — a page listed in the sitemap should be indexable, so listing
 * a noindex/blocked/non-200 URL sends a contradictory signal. See
 * checklists/technical-checklist.md ("noindex and sitemap inclusion never
 * contradict each other") and checklists/indexing-checklist.md ("Never
 * leave a sitemap entry for a noindex'd, blocked, or non-200 URL").
 *
 * Bounded exactly the way findOrphansAgainstKnownUrls is: only a sitemap
 * URL that was ALSO reached and fetched within this crawl can be checked
 * here — its indexability signal only exists once fetched. A sitemap URL
 * outside the crawl's discovered/fetched scope is neither confirmed
 * conflicting nor confirmed clean, so it is not reported either way.
 */
export function findSitemapIndexabilityConflicts(pages, knownUrls) {
  const byKey = new Map();
  for (const p of pages) {
    const requestedKey = safeNormalize(p.requestedUrl);
    if (requestedKey && !byKey.has(requestedKey)) byKey.set(requestedKey, p);
    const finalKey = safeNormalize(p.finalUrl);
    if (finalKey && !byKey.has(finalKey)) byKey.set(finalKey, p);
  }

  const conflicts = [];
  const seenUrlKeys = new Set();
  for (const url of knownUrls) {
    const key = safeNormalize(url);
    if (!key || seenUrlKeys.has(key)) continue;
    seenUrlKeys.add(key);

    const page = byKey.get(key);
    if (!page) continue; // outside this crawl's discovered/fetched scope — not confirmable either way

    if (page.skipped) {
      if (page.skipReason === 'blocked by robots.txt') {
        conflicts.push({ url, reason: 'blocked by robots.txt' });
      }
      continue; // any other skip reason isn't a confirmed conflict
    }
    if (page.error) continue; // fetch failed — indexability can't be confirmed either way

    if (typeof page.status === 'number' && page.status !== 200) {
      conflicts.push({ url, reason: `non-200 status (${page.status})` });
      continue;
    }
    if (page.indexable === false) {
      const reason = page.indexabilityReasons && page.indexabilityReasons.length ? page.indexabilityReasons.join('; ') : 'marked non-indexable';
      conflicts.push({ url, reason });
    }
  }
  return conflicts;
}

/** Pages whose BFS crawl depth exceeds the given threshold. */
export function findCrawlDepthOutliers(pages, threshold = 3) {
  return pages
    .filter((p) => !p.skipped && !p.isExternal && typeof p.depth === 'number' && p.depth > threshold)
    .map((p) => ({ url: p.finalUrl || p.requestedUrl, depth: p.depth }))
    .sort((a, b) => b.depth - a.depth);
}

/**
 * Internal links whose target resolved to an error status (4xx/5xx) or a
 * fetch error within this crawl. Links to URLs the crawl never reached
 * (beyond maxPages) are reported separately as "unverified", not "broken" —
 * this tool never claims a link is broken without having actually checked it.
 */
export function findBrokenInternalLinks(pages) {
  const byKey = new Map();
  for (const p of pages) {
    const key = safeNormalize(p.requestedUrl);
    if (key) byKey.set(key, p);
  }

  const broken = [];
  const unverified = [];
  const seenPairs = new Set();

  for (const page of pages) {
    if (page.skipped || page.isExternal || !page.internalLinks) continue;
    const fromKey = safeNormalize(page.requestedUrl);
    for (const link of page.internalLinks) {
      const targetKey = safeNormalize(link.url);
      if (!targetKey) continue;
      const pairKey = `${fromKey}=>${targetKey}`;
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const target = byKey.get(targetKey);
      if (!target) {
        unverified.push({ from: page.finalUrl || page.requestedUrl, to: link.url });
        continue;
      }
      if (target.error) {
        broken.push({ from: page.finalUrl || page.requestedUrl, to: link.url, reason: target.error.message || target.error.type });
      } else if (typeof target.status === 'number' && target.status >= 400) {
        broken.push({ from: page.finalUrl || page.requestedUrl, to: link.url, status: target.status });
      }
    }
  }

  return { broken, unverified };
}

/**
 * Internal links whose target resolved successfully but only after being
 * redirected — the reader (and a search engine) still gets there, but every
 * such link wastes a redirect hop instead of pointing directly at the real
 * destination. See checklists/internal-linking-checklist.md ("linking to
 * ... redirect chains"), workflows/internal-linking.md ("links pointing to
 * 404s or unnecessary redirect hops" — "fix the link's destination... don't
 * rely on a redirect alone"), and workflows/technical-seo.md ("collapse to
 * single-hop... never introduce a new redirect hop to fix an old one").
 *
 * Only counts a target this crawl actually verified (present in `pages`,
 * fetched without error) that has a non-empty `redirectChain` — a link to
 * an un-crawled or broken target is a different, already-reported concern
 * (see findBrokenInternalLinks above).
 */
export function findInternalLinksThroughRedirects(pages) {
  const byKey = new Map();
  for (const p of pages) {
    const key = safeNormalize(p.requestedUrl);
    if (key) byKey.set(key, p);
  }

  const results = [];
  const seenPairs = new Set();

  for (const page of pages) {
    if (page.skipped || page.isExternal || !page.internalLinks) continue;
    const fromKey = safeNormalize(page.requestedUrl);
    for (const link of page.internalLinks) {
      const targetKey = safeNormalize(link.url);
      if (!targetKey) continue;
      const pairKey = `${fromKey}=>${targetKey}`;
      if (seenPairs.has(pairKey)) continue;
      seenPairs.add(pairKey);

      const target = byKey.get(targetKey);
      if (!target || target.error) continue; // broken/unverified — a different, already-reported concern
      if (target.redirectChain && target.redirectChain.length > 0) {
        results.push({
          from: page.finalUrl || page.requestedUrl,
          to: link.url,
          finalUrl: target.finalUrl,
          redirectHops: target.redirectChain.length,
        });
      }
    }
  }

  return results;
}

/**
 * Assemble the full link-graph facts object for the report. Pass
 * `knownUrls` (typically the sitemap's URL list) to get meaningful orphan
 * detection — without it, orphanCandidates will usually be empty for a
 * single-seed crawl (see findOrphanCandidates' doc comment above).
 */
export function buildLinkGraph(pages, startUrl, { depthThreshold = 3, knownUrls = [] } = {}) {
  const { broken, unverified } = findBrokenInternalLinks(pages);
  const crawlOnlyOrphans = findOrphanCandidates(pages, startUrl);
  const knownUrlOrphans = knownUrls.length ? findOrphansAgainstKnownUrls(pages, knownUrls, startUrl) : [];
  const orphanCandidates = Array.from(new Set([...crawlOnlyOrphans, ...knownUrlOrphans]));
  const sitemapIndexabilityConflicts = knownUrls.length ? findSitemapIndexabilityConflicts(pages, knownUrls) : [];
  const internalLinksThroughRedirects = findInternalLinksThroughRedirects(pages);
  return {
    orphanCandidates,
    orphanDetectionUsedKnownUrls: knownUrls.length > 0,
    crawlDepthOutliers: findCrawlDepthOutliers(pages, depthThreshold),
    brokenInternalLinks: broken,
    unverifiedInternalLinks: unverified,
    internalLinksThroughRedirects,
    sitemapIndexabilityConflicts,
    note: INCOMPLETE_CRAWL_NOTE,
  };
}
