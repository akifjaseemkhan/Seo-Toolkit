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
  'These findings are bounded by what this crawl actually discovered and fetched (see truncatedByMaxPages and maxPages) and, for orphan detection, by whether an independent URL list (e.g. the sitemap) was supplied. A page flagged here is a "potential orphan" within this crawl\'s scope — it is not mathematically proven to be an orphan across the whole site.';

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
  return {
    orphanCandidates,
    orphanDetectionUsedKnownUrls: knownUrls.length > 0,
    crawlDepthOutliers: findCrawlDepthOutliers(pages, depthThreshold),
    brokenInternalLinks: broken,
    unverifiedInternalLinks: unverified,
    note: INCOMPLETE_CRAWL_NOTE,
  };
}
