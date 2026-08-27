// A small, conservative, same-origin-by-default breadth-first crawler.
// Read-only: it only ever GETs pages and never writes anything to the
// target. Designed to be predictable and bounded, not fast — see the
// options below for every safety knob.

import { setTimeout as sleep } from 'node:timers/promises';
import { fetchFollowingRedirects } from './fetch-utils.js';
import { extractSeoFacts } from './html-extract.js';
import { normalizeForDedup, isSameOrigin, isHttpUrl } from './url-utils.js';
import { parseRobotsTxt, isPathAllowed, getRulesForAgent } from './robots.js';

const MAX_QUEUE_SIZE = 2000; // hard safety valve independent of maxPages

export async function fetchRobotsForOrigin(originUrl, fetchOpts = {}) {
  let robotsUrl;
  try {
    robotsUrl = new URL('/robots.txt', originUrl).toString();
  } catch {
    return { found: false, parsed: parseRobotsTxt(''), robotsUrl: null, fetchError: 'invalid origin URL' };
  }
  const result = await fetchFollowingRedirects(robotsUrl, { ...fetchOpts, maxRedirects: 5 });
  if (result.error || !result.status || result.status >= 400) {
    return {
      found: false,
      parsed: parseRobotsTxt(''),
      robotsUrl,
      fetchError: result.error ? result.error.message : `status ${result.status}`,
    };
  }
  return { found: true, parsed: parseRobotsTxt(result.body), robotsUrl };
}

/**
 * Crawl starting from startUrl. Returns { startUrl, pages, robots, errors,
 * warnings, truncatedByMaxPages, options }. Never throws for per-page
 * failures — those are recorded on the page entry or in `errors`.
 */
export async function crawl(startUrl, options = {}) {
  const {
    maxPages = 50,
    delayMs = 250,
    concurrency = 2,
    timeoutMs = 10000,
    includeExternal = false,
    respectRobots = true,
    userAgent,
    robotsUserAgent = '*',
    allowPrivateNetwork = false,
  } = options;

  const resolvedOptions = { maxPages, delayMs, concurrency, timeoutMs, includeExternal, respectRobots, allowPrivateNetwork };
  const errors = [];
  const warnings = [];

  if (!isHttpUrl(startUrl)) {
    return { startUrl, pages: [], robots: null, errors: [{ url: startUrl, message: 'Start URL is not a valid http(s) URL' }], warnings, truncatedByMaxPages: false, options: resolvedOptions };
  }

  let robotsInfo = { found: false, parsed: { groups: [], sitemaps: [], unknownDirectives: [] }, robotsUrl: null };
  if (respectRobots) {
    robotsInfo = await fetchRobotsForOrigin(startUrl, { timeoutMs, userAgent, allowPrivateNetwork });
    if (!robotsInfo.found && robotsInfo.fetchError) {
      warnings.push(`robots.txt not available (${robotsInfo.fetchError}) — crawling without robots restrictions.`);
    }
  }
  const robotsRules = respectRobots ? getRulesForAgent(robotsInfo.parsed, robotsUserAgent) : [];

  const visited = new Map(); // dedupKey -> page result
  const queued = new Set();
  const discoveredFrom = new Map(); // dedupKey of requested URL -> Set of referrer final URLs
  let queue = [{ url: startUrl, depth: 0 }];
  queued.add(normalizeForDedup(startUrl));
  let fetchedCount = 0;

  while (queue.length > 0 && fetchedCount < maxPages) {
    const batchSize = Math.min(concurrency, maxPages - fetchedCount, queue.length);
    const toProcess = queue.splice(0, batchSize);

    const results = await Promise.all(
      toProcess.map(async (item) => {
        const key = normalizeForDedup(item.url);
        if (visited.has(key)) return null;

        const isExternalUrl = !isSameOrigin(item.url, startUrl);
        if (isExternalUrl && !includeExternal) return null;

        if (respectRobots && !isExternalUrl) {
          let pathAndQuery = '/';
          try {
            const u = new URL(item.url);
            pathAndQuery = u.pathname + u.search;
          } catch {
            /* fall through with default */
          }
          const { allowed, matchedRule } = isPathAllowed(robotsRules, pathAndQuery);
          if (!allowed) {
            return {
              requestedUrl: item.url,
              finalUrl: item.url,
              depth: item.depth,
              isExternal: false,
              skipped: true,
              skipReason: 'blocked by robots.txt',
              blockedByRule: matchedRule,
            };
          }
        }

        const fetchResult = await fetchFollowingRedirects(item.url, {
          timeoutMs,
          userAgent,
          readBody: !isExternalUrl, // don't bother downloading external page bodies
          allowPrivateNetwork,
        });

        if (fetchResult.error) {
          errors.push({ url: item.url, message: fetchResult.error.message || fetchResult.error.type });
          return {
            requestedUrl: item.url,
            finalUrl: fetchResult.finalUrl,
            depth: item.depth,
            status: fetchResult.status,
            redirectChain: fetchResult.redirectChain,
            isExternal: isExternalUrl,
            error: fetchResult.error,
          };
        }

        if (!isExternalUrl && !isSameOrigin(fetchResult.finalUrl, startUrl)) {
          warnings.push(`${item.url} redirects to a different origin (${fetchResult.finalUrl}) — not following further, crawl stays restricted to the original requested origin.`);
        }

        const contentType = fetchResult.contentType || '';
        const isHtml = /text\/html|application\/xhtml\+xml/i.test(contentType);
        let facts = null;
        if (!isExternalUrl && isHtml && fetchResult.body) {
          try {
            facts = extractSeoFacts(fetchResult.body, fetchResult.finalUrl, {
              statusCode: fetchResult.status,
              xRobotsTagHeader: fetchResult.headers ? fetchResult.headers.get('x-robots-tag') : null,
            });
          } catch (err) {
            errors.push({ url: item.url, message: `HTML extraction failed: ${err.message}` });
          }
        }

        return {
          requestedUrl: item.url,
          finalUrl: fetchResult.finalUrl,
          depth: item.depth,
          status: fetchResult.status,
          redirectChain: fetchResult.redirectChain,
          contentType,
          isHtml,
          isExternal: isExternalUrl,
          bodyTruncated: fetchResult.bodyTruncated || false,
          error: null,
          ...(facts || {}),
        };
      })
    );

    for (let i = 0; i < toProcess.length; i++) {
      const item = toProcess[i];
      const key = normalizeForDedup(item.url);
      const result = results[i];
      if (!result || visited.has(key)) continue;
      visited.set(key, result);
      fetchedCount++;

      if (!result.isExternal && result.internalLinks && queued.size < MAX_QUEUE_SIZE) {
        for (const link of result.internalLinks) {
          const linkKey = normalizeForDedup(link.url);
          if (!discoveredFrom.has(linkKey)) discoveredFrom.set(linkKey, new Set());
          discoveredFrom.get(linkKey).add(result.finalUrl || result.requestedUrl);
          if (!queued.has(linkKey) && queued.size < MAX_QUEUE_SIZE) {
            queued.add(linkKey);
            queue.push({ url: link.url, depth: item.depth + 1 });
          }
        }
      }
      if (includeExternal && !result.isExternal && result.externalLinks && queued.size < MAX_QUEUE_SIZE) {
        for (const link of result.externalLinks) {
          const linkKey = normalizeForDedup(link.url);
          if (!queued.has(linkKey) && queued.size < MAX_QUEUE_SIZE) {
            queued.add(linkKey);
            queue.push({ url: link.url, depth: item.depth + 1 });
          }
        }
      }
    }

    if (queue.length > 0 && fetchedCount < maxPages && delayMs > 0) {
      await sleep(delayMs);
    }
  }

  const pages = Array.from(visited.values()).map((p) => ({
    ...p,
    discoveredFrom: Array.from(discoveredFrom.get(normalizeForDedup(p.requestedUrl)) || []),
  }));

  return {
    startUrl,
    pages,
    robots: respectRobots ? { checked: robotsInfo.found, robotsUrl: robotsInfo.robotsUrl } : null,
    errors,
    warnings,
    truncatedByMaxPages: queue.length > 0,
    options: resolvedOptions,
  };
}
