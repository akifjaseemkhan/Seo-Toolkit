#!/usr/bin/env node
// seo-tool — a small, read-only local SEO inspection CLI.
//
// Safety guarantee: every command in this file only ever reads. It fetches
// URLs with GET/HEAD, reads local files, and prints/writes a report. It
// never edits source files, never writes robots.txt/sitemap.xml, never
// touches package.json, and never mutates Git state. See docs/tooling.md.

import { readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';

import { fetchFollowingRedirects, DEFAULT_TIMEOUT_MS } from './lib/fetch-utils.js';
import { extractSeoFacts } from './lib/html-extract.js';
import { crawl, fetchRobotsForOrigin } from './lib/crawler.js';
import { buildLinkGraph } from './lib/link-graph.js';
import { buildDuplicateContentReport } from './lib/duplicate-content.js';
import { buildHreflangReciprocityReport } from './lib/hreflang-reciprocity.js';
import { diffReports, isSeoToolReport } from './lib/report-diff.js';
import { parseRobotsTxt, checkImportantPathConflicts, ROBOTS_NOT_SECURITY_NOTE } from './lib/robots.js';
import { parseSitemap, resolveSitemapTree } from './lib/sitemap.js';
import { inspectProject } from './lib/project-inspect.js';
import { assembleReport } from './lib/report.js';

export function parseArgs(argv) {
  const positional = [];
  const flags = {};
  for (const arg of argv) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq === -1) flags[arg.slice(2)] = true;
      else flags[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

export function num(flags, key, def) {
  if (flags[key] === undefined) return def;
  const n = Number(flags[key]);
  return Number.isFinite(n) ? n : def;
}

async function emit(report, flags, printSummary) {
  if (flags.json !== undefined) {
    const jsonStr = JSON.stringify(report, null, 2);
    if (typeof flags.json === 'string') {
      await writeFile(flags.json, jsonStr, 'utf-8');
      console.log(`Wrote JSON report to ${flags.json}`);
    } else {
      console.log(jsonStr);
    }
  } else {
    printSummary();
  }
}

function readLocalOrFetch(target, timeoutMs, allowPrivateNetwork = false) {
  if (/^https?:\/\//i.test(target)) {
    return fetchFollowingRedirects(target, { timeoutMs, allowPrivateNetwork }).then((result) => ({
      text: result.error ? null : result.body,
      source: target,
      finalUrl: result.finalUrl,
      status: result.status,
      fetchError: result.error ? result.error.message : null,
    }));
  }
  try {
    const text = readFileSync(target, 'utf-8');
    return Promise.resolve({ text, source: resolve(target), finalUrl: null, status: null, fetchError: null });
  } catch (err) {
    return Promise.resolve({ text: null, source: resolve(target), finalUrl: null, status: null, fetchError: err.message });
  }
}

// ---------- summaries (human-readable, printed unless --json is passed) ----------

function printPageSummary(page) {
  console.log(`\nPage: ${page.finalUrl || page.requestedUrl}`);
  if (page.error) {
    console.log(`  ERROR: ${page.error.type} — ${page.error.message}`);
    return;
  }
  console.log(`  Status: ${page.status}${page.redirectChain && page.redirectChain.length ? ` (via ${page.redirectChain.length} redirect${page.redirectChain.length > 1 ? 's' : ''})` : ''}`);
  console.log(`  Title: ${page.title || '(missing)'}`);
  console.log(`  Meta description: ${page.metaDescription || '(missing)'}`);
  console.log(`  Canonical: ${page.canonical || '(missing)'}${page.multipleCanonicals ? ` (${page.canonicalCount} canonical tags declared — only the first is used; see canonicalRawHrefs in --json for all of them)` : ''}`);
  if (page.hreflangCount) {
    const hreflangIssues = [];
    if (page.duplicateHreflangValues && page.duplicateHreflangValues.length) hreflangIssues.push(`duplicate values: ${page.duplicateHreflangValues.join(', ')}`);
    if (page.malformedHreflang && page.malformedHreflang.length) hreflangIssues.push(`${page.malformedHreflang.length} malformed`);
    console.log(`  Hreflang: ${page.hreflangCount} tag(s), self-referencing: ${page.selfReferencingHreflang}${page.hasXDefault ? ', has x-default' : ''}${hreflangIssues.length ? ` (${hreflangIssues.join('; ')})` : ''}`);
  }
  if (page.isPaginated) {
    console.log(`  Pagination: prev=${page.paginationPrev || '(none)'}  next=${page.paginationNext || '(none)'}${page.paginationCanonicalConflict ? '  (canonical points away from this page — see rules/canonical-rules.md)' : ''}`);
  }
  console.log(`  H1 count: ${page.h1Count ?? '?'}  H2 count: ${page.h2Count ?? '?'}`);
  console.log(`  Robots meta: ${(page.robotsMetaDirectives || []).join(', ') || '(none)'}`);
  console.log(`  X-Robots-Tag: ${(page.xRobotsTagDirectives || []).join(', ') || '(none)'}${page.robotsDirectivesConflict ? `  CONFLICT: ${page.robotsDirectivesConflictReasons.join('; ')}` : ''}`);
  console.log(`  Indexable signal: ${page.indexable === undefined ? '?' : page.indexable}${page.indexabilityReasons && page.indexabilityReasons.length ? ` (${page.indexabilityReasons.join('; ')})` : ''}`);
  const jsonLdCount = page.jsonLd ? page.jsonLd.length : 0;
  const jsonLdMissingRequired = page.jsonLd ? page.jsonLd.filter((b) => b.missingRequiredProperties && b.missingRequiredProperties.length > 0).length : 0;
  console.log(`  JSON-LD blocks: ${jsonLdCount}${jsonLdMissingRequired ? ` (${jsonLdMissingRequired} missing @context/@type)` : ''}`);
  console.log(`  Internal links: ${page.internalLinks ? page.internalLinks.length : 0}  External links: ${page.externalLinks ? page.externalLinks.length : 0}`);
  console.log(`  Images missing alt: ${page.imagesMissingAlt ?? '?'}  Images missing dimensions: ${page.imagesMissingDimensions ?? '?'}`);
}

function printCrawlSummary(report) {
  const s = report.crawlSummary;
  console.log(`\nCrawl of ${s.startUrl}`);
  if (s.pagesFetched === 0 && report.errors.length) {
    console.log(`  Failed to fetch anything:`);
    for (const e of report.errors) console.log(`    - ${e.url}: ${e.message}`);
    return;
  }
  console.log(`  Pages fetched: ${s.pagesFetched}${s.truncatedByMaxPages ? ' (stopped at maxPages — queue still had more)' : ' (crawl exhausted all discovered same-origin links)'}`);
  const statusCounts = {};
  for (const p of report.pages) {
    const bucket = p.error ? 'error' : p.skipped ? 'skipped (robots)' : `${Math.floor((p.status || 0) / 100)}xx`;
    statusCounts[bucket] = (statusCounts[bucket] || 0) + 1;
  }
  console.log('  Status breakdown:', JSON.stringify(statusCounts));
  if (report.warnings.length) {
    console.log(`  Warnings:`);
    for (const w of report.warnings) console.log(`    - ${w}`);
  }
  if (report.linkGraph) {
    console.log(`  Potential orphan pages: ${report.linkGraph.orphanCandidates.length}`);
    console.log(`  Crawl-depth outliers: ${report.linkGraph.crawlDepthOutliers.length}`);
    console.log(`  Broken internal links found: ${report.linkGraph.brokenInternalLinks.length}`);
    console.log(`  Internal links through a redirect: ${report.linkGraph.internalLinksThroughRedirects.length}`);
    console.log(`  Sitemap/indexability conflicts: ${report.linkGraph.sitemapIndexabilityConflicts.length}`);
  }
  if (report.duplicateContent) {
    const dupTitles = report.duplicateContent.duplicateTitles.length;
    const dupDescriptions = report.duplicateContent.duplicateMetaDescriptions.length;
    if (dupTitles || dupDescriptions) {
      console.log(`  Duplicate titles: ${dupTitles} group(s)  Duplicate meta descriptions: ${dupDescriptions} group(s)`);
    }
  }
  if (report.hreflangReciprocity && report.hreflangReciprocity.nonReciprocalHreflang.length) {
    console.log(`  Non-reciprocal hreflang links: ${report.hreflangReciprocity.nonReciprocalHreflang.length}`);
  }
  console.log(`\nRun with --json for full machine-readable output.`);
}

function printSitemapSummary(sitemapResult) {
  console.log(`\nSitemap: ${sitemapResult.source}`);
  if (sitemapResult.fetchError) {
    console.log(`  Could not read sitemap: ${sitemapResult.fetchError}`);
    return;
  }
  console.log(`  Type: ${sitemapResult.type}`);
  if (sitemapResult.type === 'invalid') {
    // An invalid root has no children to recurse into, so this is always
    // exactly one processed node — nothing more to show than the error.
    console.log(`  Error: ${sitemapResult.error}`);
    return;
  }
  console.log(`  Entries (aggregated across all sitemap files found): ${sitemapResult.entryCount}`);
  if (sitemapResult.sitemapsProcessed && sitemapResult.sitemapsProcessed.length > 1) {
    const failed = sitemapResult.sitemapsProcessed.filter((s) => s.type === 'error' || s.type === 'invalid');
    console.log(`  Sitemap files processed: ${sitemapResult.sitemapsProcessed.length}${failed.length ? ` (${failed.length} failed/malformed — see --json)` : ''}`);
  }
  if (sitemapResult.skipped && sitemapResult.skipped.length) {
    console.log(`  Skipped: ${sitemapResult.skipped.length} (duplicate, cross-origin, or bound exceeded — see --json for detail)`);
  }
  if (sitemapResult.truncated) {
    console.log('  WARNING: sitemap tree traversal was truncated by --max-sitemaps/--max-sitemap-depth — results may be incomplete. Re-run with higher limits if this site has an unusually large sitemap index.');
  }
  if (sitemapResult.issues && sitemapResult.issues.length) {
    console.log(`  Issues found: ${sitemapResult.issues.length}`);
    for (const issue of sitemapResult.issues.slice(0, 10)) {
      console.log(`    - [${issue.type}] ${issue.loc || ''} ${issue.message || ''}`);
    }
    if (sitemapResult.issues.length > 10) console.log(`    ... and ${sitemapResult.issues.length - 10} more (see --json)`);
  } else {
    console.log('  No structural issues found in this pass.');
  }
  if (sitemapResult.statusChecks) {
    const broken = sitemapResult.statusChecks.filter((c) => c.error || (c.status && c.status >= 400));
    console.log(`  Status-checked ${sitemapResult.statusChecks.length} URLs — ${broken.length} problem(s) found.`);
  }
}

function printRobotsSummary(robotsResult) {
  console.log(`\nrobots.txt: ${robotsResult.source}`);
  if (robotsResult.fetchError) {
    console.log(`  Could not read robots.txt: ${robotsResult.fetchError}`);
    return;
  }
  console.log(`  Groups: ${robotsResult.groups.length}  Sitemap declarations: ${robotsResult.sitemaps.length}`);
  if (robotsResult.importantPathConflicts && robotsResult.importantPathConflicts.length) {
    console.log(`  Blocked important paths:`);
    for (const c of robotsResult.importantPathConflicts) console.log(`    - ${c.path} (blocked by "${c.blockedBy.type}: ${c.blockedBy.path}")`);
  }
  console.log(`  Note: ${ROBOTS_NOT_SECURITY_NOTE}`);
}

function printAuditSummary(report) {
  printCrawlSummary(report);
  if (report.sitemap) printSitemapSummary(report.sitemap);
  if (report.robots) printRobotsSummary(report.robots);
}

function printProjectSummary(facts) {
  console.log(`\nProject: ${facts.rootDir}`);
  console.log(`  package.json: ${facts.packageJson ? 'found' : 'not found'}`);
  if (facts.packageJson) {
    console.log(`    dependencies: ${facts.packageJson.dependencies.slice(0, 15).join(', ') || '(none)'}`);
    console.log(`    scripts: ${Object.keys(facts.packageJson.scripts).join(', ') || '(none)'}`);
  }
  console.log(`  package manager: ${facts.packageManager || 'not determined (no lockfile found)'}`);
  console.log(`  framework config files found: ${facts.frameworkConfigFiles.join(', ') || '(none)'}`);
  console.log(`  directory conventions: ${JSON.stringify(facts.directoryConventions)}`);
  console.log(`  SEO-related files found: ${facts.seoRelatedFilesFound.join(', ') || '(none)'}`);
  const signalKeys = Object.keys(facts.metadataImplementationSignals);
  console.log(`  metadata implementation signals: ${signalKeys.join(', ') || '(none found)'}`);
  console.log(`  (scanned ${facts.scan.filesWalked} files${facts.scan.truncated ? ', scan was truncated by size limits' : ''})`);
  console.log(`\nThese are raw facts only — see workflows/discovery.md for how to interpret them.`);
}

function printDiffSummary(report) {
  const d = report.diff;
  console.log(`\nReport diff: ${report.meta.target}`);
  if (!d.pages && !d.linkGraph && !d.duplicateContent && !d.hreflangReciprocity) {
    console.log('  Nothing comparable found between these two reports (no pages/linkGraph/duplicateContent/hreflangReciprocity section present in both).');
    return;
  }
  if (d.pages) {
    console.log(`  Pages: ${d.pages.added.length} added, ${d.pages.removed.length} removed, ${d.pages.changed.length} changed, ${d.pages.unchangedCount} unchanged`);
  }
  console.log(`  Regressions: ${d.regressions.length}  Improvements: ${d.improvements.length}`);
  if (d.regressions.length) {
    console.log('  Regressions:');
    for (const r of d.regressions.slice(0, 20)) {
      console.log(`    - ${r.url}: ${r.field} ${JSON.stringify(r.before)} -> ${JSON.stringify(r.after)}`);
    }
    if (d.regressions.length > 20) console.log(`    ... and ${d.regressions.length - 20} more (see --json for the full list)`);
  }
  if (d.linkGraph) {
    const lg = d.linkGraph;
    console.log(
      `  Link-graph: new broken links ${lg.brokenInternalLinks.added.length}, new orphans ${lg.orphanCandidates.added.length}, ` +
        `new redirect-hop links ${lg.internalLinksThroughRedirects.added.length}, new sitemap conflicts ${lg.sitemapIndexabilityConflicts.added.length}`
    );
  }
  if (d.duplicateContent) {
    const dc = d.duplicateContent;
    console.log(`  Duplicate content: new duplicate-title groups ${dc.duplicateTitles.added.length}, new duplicate-description groups ${dc.duplicateMetaDescriptions.added.length}`);
  }
  if (d.hreflangReciprocity) {
    console.log(`  Hreflang reciprocity: new non-reciprocal links ${d.hreflangReciprocity.nonReciprocalHreflang.added.length}`);
  }
  console.log(`\nRun with --json for full machine-readable output.`);
}

// ---------- commands ----------

async function cmdPage(url, flags) {
  const startedAt = new Date().toISOString();
  const timeoutMs = num(flags, 'timeout', DEFAULT_TIMEOUT_MS);
  const allowPrivateNetwork = !!flags['allow-private-network'];
  const result = await fetchFollowingRedirects(url, { timeoutMs, allowPrivateNetwork });
  let facts = null;
  if (!result.error && /text\/html|application\/xhtml\+xml/i.test(result.contentType || '') && result.body) {
    facts = extractSeoFacts(result.body, result.finalUrl, {
      statusCode: result.status,
      xRobotsTagHeader: result.headers ? result.headers.get('x-robots-tag') : null,
    });
  }
  const page = {
    requestedUrl: url,
    finalUrl: result.finalUrl,
    status: result.status,
    redirectChain: result.redirectChain,
    contentType: result.contentType,
    error: result.error,
    ...(facts || {}),
  };
  const report = assembleReport({
    command: 'page',
    target: url,
    options: { timeoutMs, allowPrivateNetwork },
    startedAt,
    crawlResult: { startUrl: url, pages: [page], errors: result.error ? [{ url, message: result.error.message }] : [], warnings: [], truncatedByMaxPages: false, robots: null },
  });
  await emit(report, flags, () => printPageSummary(page));
  if (result.error) process.exitCode = 1;
}

async function cmdCrawl(url, flags, commandName = 'crawl') {
  const startedAt = new Date().toISOString();
  const options = {
    maxPages: num(flags, 'max-pages', 50),
    delayMs: num(flags, 'delay', 250),
    concurrency: num(flags, 'concurrency', 2),
    timeoutMs: num(flags, 'timeout', 10000),
    includeExternal: !!flags['include-external'],
    respectRobots: !flags['no-robots'],
    allowPrivateNetwork: !!flags['allow-private-network'],
  };
  const crawlResult = await crawl(url, options);
  const linkGraph = buildLinkGraph(crawlResult.pages, url);
  const duplicateContent = buildDuplicateContentReport(crawlResult.pages);
  const hreflangReciprocity = buildHreflangReciprocityReport(crawlResult.pages);
  const report = assembleReport({ command: commandName, target: url, options, startedAt, crawlResult, linkGraph, duplicateContent, hreflangReciprocity });
  await emit(report, flags, () => printCrawlSummary(report));
  if (crawlResult.pages.length === 0 && crawlResult.errors.length > 0) process.exitCode = 1;
}

async function cmdSitemap(target, flags) {
  const startedAt = new Date().toISOString();
  const timeoutMs = num(flags, 'timeout', 10000);
  const maxSitemaps = num(flags, 'max-sitemaps', 50);
  // --no-recurse means "show me the root document only" — implemented as
  // maxDepth 0 through the same resolver, so a not-recursed sitemapindex
  // still honestly reports its children as skipped rather than just
  // vanishing, instead of maintaining a second, duplicate parse path.
  const maxDepth = flags['no-recurse'] ? 0 : num(flags, 'max-sitemap-depth', 5);
  const allowPrivateNetwork = !!flags['allow-private-network'];
  const { text, source, fetchError } = await readLocalOrFetch(target, timeoutMs, allowPrivateNetwork);

  const isUrl = /^https?:\/\//i.test(target);
  let sitemapResult;

  if (!text) {
    sitemapResult = {
      source,
      type: 'invalid',
      error: fetchError || 'no content available',
      urls: [],
      entryCount: 0,
      issues: [],
      sitemapsProcessed: [],
      skipped: [],
      truncated: false,
      fetchError,
    };
  } else {
    const tree = await resolveSitemapTree(isUrl ? target : source, {
      timeoutMs,
      maxSitemaps,
      maxDepth,
      seedText: text,
      allowPrivateNetwork,
    });
    const rootNode = tree.sitemapsProcessed[0];
    const rootType = rootNode ? rootNode.type : 'error';
    sitemapResult = {
      source,
      type: rootType === 'error' ? 'invalid' : rootType,
      error: rootType === 'error' || rootType === 'invalid' ? rootNode.error : undefined,
      urls: tree.urls,
      entryCount: tree.entryCount,
      issues: tree.issues,
      sitemapsProcessed: tree.sitemapsProcessed,
      skipped: tree.skipped,
      truncated: tree.truncated,
      fetchError: null,
    };
  }

  if (flags['check-status'] && sitemapResult.urls.length) {
    const maxChecks = num(flags, 'max-checks', 20);
    const delayMs = num(flags, 'delay', 250);
    sitemapResult.statusChecks = [];
    for (const entry of sitemapResult.urls.slice(0, maxChecks)) {
      if (!entry.loc) continue;
      const r = await fetchFollowingRedirects(entry.loc, { timeoutMs, readBody: false, allowPrivateNetwork });
      sitemapResult.statusChecks.push({ loc: entry.loc, status: r.status, finalUrl: r.finalUrl, redirected: (r.redirectChain || []).length > 0, error: r.error });
      if (delayMs > 0) await sleep(delayMs);
    }
  }

  const report = assembleReport({ command: 'sitemap', target, options: { maxSitemaps, maxDepth, allowPrivateNetwork }, startedAt, sitemapResult });
  await emit(report, flags, () => printSitemapSummary(sitemapResult));
}

async function cmdRobots(target, flags) {
  const startedAt = new Date().toISOString();
  const timeoutMs = num(flags, 'timeout', 10000);
  const allowPrivateNetwork = !!flags['allow-private-network'];
  const { text, source, fetchError } = await readLocalOrFetch(target, timeoutMs, allowPrivateNetwork);
  const parsed = parseRobotsTxt(text || '');
  const importantPaths = flags.important ? String(flags.important).split(',').map((s) => s.trim()).filter(Boolean) : [];
  const userAgent = typeof flags['user-agent'] === 'string' ? flags['user-agent'] : '*';
  const conflicts = importantPaths.length ? checkImportantPathConflicts(parsed, importantPaths, userAgent) : [];

  const robotsResult = { source, found: !fetchError, ...parsed, importantPathConflicts: conflicts, note: ROBOTS_NOT_SECURITY_NOTE, fetchError };
  const report = assembleReport({ command: 'robots', target, options: { allowPrivateNetwork }, startedAt, robotsResult });
  await emit(report, flags, () => printRobotsSummary(robotsResult));
}

async function cmdAudit(url, flags) {
  const startedAt = new Date().toISOString();
  const options = {
    maxPages: num(flags, 'max-pages', 50),
    delayMs: num(flags, 'delay', 250),
    concurrency: num(flags, 'concurrency', 2),
    timeoutMs: num(flags, 'timeout', 10000),
    includeExternal: !!flags['include-external'],
    respectRobots: !flags['no-robots'],
    allowPrivateNetwork: !!flags['allow-private-network'],
  };
  const crawlResult = await crawl(url, options);

  const origin = new URL(url).origin;
  const robotsInfo = await fetchRobotsForOrigin(origin, { timeoutMs: options.timeoutMs, allowPrivateNetwork: options.allowPrivateNetwork });
  const robotsResult = { source: robotsInfo.robotsUrl, found: robotsInfo.found, ...robotsInfo.parsed, note: ROBOTS_NOT_SECURITY_NOTE, fetchError: robotsInfo.fetchError || null };

  const sitemapUrl = new URL('/sitemap.xml', origin).toString();
  const maxSitemaps = num(flags, 'max-sitemaps', 50);
  const maxSitemapDepth = num(flags, 'max-sitemap-depth', 5);
  const tree = await resolveSitemapTree(sitemapUrl, { timeoutMs: options.timeoutMs, maxSitemaps, maxDepth: maxSitemapDepth, allowPrivateNetwork: options.allowPrivateNetwork });
  const rootNode = tree.sitemapsProcessed[0];
  let sitemapResult;
  if (!rootNode || rootNode.type === 'error') {
    sitemapResult = { source: sitemapUrl, type: 'not_found', fetchError: rootNode ? rootNode.error : 'sitemap.xml not reachable', urls: [], entryCount: 0, issues: [], sitemapsProcessed: tree.sitemapsProcessed, skipped: tree.skipped, truncated: tree.truncated };
  } else {
    sitemapResult = {
      source: sitemapUrl,
      type: rootNode.type, // 'urlset' | 'sitemapindex' | 'invalid'
      urls: tree.urls,
      entryCount: tree.entryCount,
      issues: tree.issues,
      sitemapsProcessed: tree.sitemapsProcessed,
      skipped: tree.skipped,
      truncated: tree.truncated,
    };
  }

  // Cross-referencing the sitemap's URL list against the crawl's discovered
  // links is what makes orphan detection actually meaningful — see
  // lib/link-graph.js's doc comments on why a crawl alone can't do this.
  // This now correctly includes sitemapindex trees (previously only a plain
  // urlset populated knownUrls — an indexed sitemap silently produced an
  // empty list and orphan detection degraded with no warning).
  const knownUrls = (sitemapResult.type === 'urlset' || sitemapResult.type === 'sitemapindex') ? sitemapResult.urls.map((u) => u.loc).filter(Boolean) : [];
  const linkGraph = buildLinkGraph(crawlResult.pages, url, { knownUrls });
  const duplicateContent = buildDuplicateContentReport(crawlResult.pages);
  const hreflangReciprocity = buildHreflangReciprocityReport(crawlResult.pages);

  const report = assembleReport({ command: 'audit', target: url, options, startedAt, crawlResult, linkGraph, duplicateContent, hreflangReciprocity, sitemapResult, robotsResult });
  await emit(report, flags, () => printAuditSummary(report));
  if (crawlResult.pages.length === 0 && crawlResult.errors.length > 0) process.exitCode = 1;
}

async function cmdProject(pathArg, flags) {
  const startedAt = new Date().toISOString();
  const rootDir = pathArg ? resolve(pathArg) : process.cwd();
  const projectFacts = inspectProject(rootDir);
  const report = assembleReport({ command: 'project', target: rootDir, options: {}, startedAt, projectFacts });
  await emit(report, flags, () => printProjectSummary(projectFacts));
}

/**
 * Read and validate a JSON report file for `diff` — never a network fetch,
 * always a local file this tool (or a compatible one) previously wrote via
 * --json=path. Throws a clear, specific Error (caught by main()'s existing
 * try/catch, exit 1) for every way this can go wrong: unreadable file,
 * invalid JSON, or valid JSON that just isn't a seo-tool report.
 */
function readReportFile(path) {
  let raw;
  try {
    raw = readFileSync(path, 'utf-8');
  } catch (err) {
    throw new Error(`Could not read report file "${path}": ${err.message}`);
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Report file "${path}" is not valid JSON: ${err.message}`);
  }
  if (!isSeoToolReport(parsed)) {
    throw new Error(`"${path}" does not look like a seo-tool JSON report (missing meta.tool: "seo-tool")`);
  }
  return parsed;
}

async function cmdDiff(report1Path, report2Path, flags) {
  const startedAt = new Date().toISOString();
  const reportBefore = readReportFile(report1Path);
  const reportAfter = readReportFile(report2Path);
  const diffResult = diffReports(reportBefore, reportAfter);
  const report = assembleReport({
    command: 'diff',
    target: `${report1Path} -> ${report2Path}`,
    options: { report1: report1Path, report2: report2Path },
    startedAt,
    diffResult,
  });
  await emit(report, flags, () => printDiffSummary(report));
}

function printHelp() {
  console.log(`seo-tool — small, read-only local SEO inspection CLI

Usage:
  node cli.js crawl <url>    [--max-pages=50] [--delay=250] [--concurrency=2]
                             [--timeout=10000] [--include-external] [--no-robots]
                             [--allow-private-network] [--json[=path]]
  node cli.js page <url>     [--timeout=10000] [--allow-private-network] [--json[=path]]
  node cli.js sitemap <urlOrPath> [--check-status] [--max-checks=20]
                             [--max-sitemaps=50] [--max-sitemap-depth=5] [--no-recurse]
                             [--allow-private-network] [--json[=path]]
  node cli.js robots <urlOrPath>  [--important=/a,/b] [--user-agent=Googlebot]
                             [--allow-private-network] [--json[=path]]
  node cli.js links <url>    [--max-pages=50] [--allow-private-network] [--json[=path]]
                             (crawl focused on the link graph)
  node cli.js audit <url>    [--max-pages=50] [--max-sitemaps=50] [--max-sitemap-depth=5]
                             [--allow-private-network] [--json[=path]]
                             (crawl + sitemap + robots + link graph)
  node cli.js project [path] [--json[=path]]
  node cli.js diff <report1.json> <report2.json> [--json[=path]]
                             (compare two --json=path report files —
                             regressions, improvements, added/removed pages)

A sitemap that is a <sitemapindex> is recursed into by default (bounded by
--max-sitemaps/--max-sitemap-depth) so validation and orphan detection see
every real page URL, not just the list of child sitemap filenames. Pass
--no-recurse to see only the root document.

By default, this tool refuses to fetch private/internal network addresses
(RFC1918, link-local/cloud-metadata 169.254.0.0/16, and their IPv6
equivalents) — a safety boundary, not an SEO feature. localhost and
127.0.0.1 (and ::1) remain allowed, since auditing a local dev server is a
documented use case. Pass --allow-private-network to deliberately audit a
target on your own internal network; see docs/tooling.md for exactly what
this does and does not protect against.

--json alone prints JSON to stdout instead of the human summary.
--json=path.json writes the JSON report to that file.

This tool is strictly read-only against everything it inspects. See ../../docs/tooling.md.
`);
}

export async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const { positional, flags } = parseArgs(rest);
  const target = positional[0];

  try {
    switch (command) {
      case 'page':
        if (!target) throw new Error('Usage: seo-tool page <url>');
        await cmdPage(target, flags);
        break;
      case 'crawl':
        if (!target) throw new Error('Usage: seo-tool crawl <url>');
        await cmdCrawl(target, flags, 'crawl');
        break;
      case 'links':
        if (!target) throw new Error('Usage: seo-tool links <url>');
        await cmdCrawl(target, flags, 'links');
        break;
      case 'sitemap':
        if (!target) throw new Error('Usage: seo-tool sitemap <urlOrPath>');
        await cmdSitemap(target, flags);
        break;
      case 'robots':
        if (!target) throw new Error('Usage: seo-tool robots <urlOrPath>');
        await cmdRobots(target, flags);
        break;
      case 'audit':
        if (!target) throw new Error('Usage: seo-tool audit <url>');
        await cmdAudit(target, flags);
        break;
      case 'project':
        await cmdProject(target, flags);
        break;
      case 'diff':
        if (!positional[0] || !positional[1]) throw new Error('Usage: seo-tool diff <report1.json> <report2.json>');
        await cmdDiff(positional[0], positional[1], flags);
        break;
      case undefined:
      case 'help':
      case '--help':
      case '-h':
        printHelp();
        break;
      default:
        console.error(`Unknown command: ${command}\n`);
        printHelp();
        process.exitCode = 1;
    }
  } catch (err) {
    console.error(`Error: ${err.message}`);
    process.exitCode = 1;
  }
}

// Only auto-run when this file is executed directly (`node cli.js ...`),
// not when it's imported — this lets tests import parseArgs/num/main
// without triggering a real run against the test runner's own argv.
// Standard, transparent ESM "am I the entry point" check: it has zero
// effect on normal `node cli.js ...` invocation.
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
