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
import { setTimeout as sleep } from 'node:timers/promises';

import { fetchFollowingRedirects, DEFAULT_TIMEOUT_MS } from './lib/fetch-utils.js';
import { extractSeoFacts } from './lib/html-extract.js';
import { crawl, fetchRobotsForOrigin } from './lib/crawler.js';
import { buildLinkGraph } from './lib/link-graph.js';
import { parseRobotsTxt, checkImportantPathConflicts, ROBOTS_NOT_SECURITY_NOTE } from './lib/robots.js';
import { parseSitemap, validateSitemapEntries } from './lib/sitemap.js';
import { inspectProject } from './lib/project-inspect.js';
import { assembleReport } from './lib/report.js';

function parseArgs(argv) {
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

function num(flags, key, def) {
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

function readLocalOrFetch(target, timeoutMs) {
  if (/^https?:\/\//i.test(target)) {
    return fetchFollowingRedirects(target, { timeoutMs }).then((result) => ({
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
  console.log(`  Canonical: ${page.canonical || '(missing)'}`);
  console.log(`  H1 count: ${page.h1Count ?? '?'}  H2 count: ${page.h2Count ?? '?'}`);
  console.log(`  Robots meta: ${(page.robotsMetaDirectives || []).join(', ') || '(none)'}`);
  console.log(`  Indexable signal: ${page.indexable === undefined ? '?' : page.indexable}${page.indexabilityReasons && page.indexabilityReasons.length ? ` (${page.indexabilityReasons.join('; ')})` : ''}`);
  console.log(`  JSON-LD blocks: ${page.jsonLd ? page.jsonLd.length : 0}`);
  console.log(`  Internal links: ${page.internalLinks ? page.internalLinks.length : 0}  External links: ${page.externalLinks ? page.externalLinks.length : 0}`);
  console.log(`  Images missing alt: ${page.imagesMissingAlt ?? '?'}`);
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
    console.log(`  Error: ${sitemapResult.error}`);
    return;
  }
  console.log(`  Entries: ${sitemapResult.entryCount}`);
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

// ---------- commands ----------

async function cmdPage(url, flags) {
  const startedAt = new Date().toISOString();
  const timeoutMs = num(flags, 'timeout', DEFAULT_TIMEOUT_MS);
  const result = await fetchFollowingRedirects(url, { timeoutMs });
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
    options: { timeoutMs },
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
  };
  const crawlResult = await crawl(url, options);
  const linkGraph = buildLinkGraph(crawlResult.pages, url);
  const report = assembleReport({ command: commandName, target: url, options, startedAt, crawlResult, linkGraph });
  await emit(report, flags, () => printCrawlSummary(report));
  if (crawlResult.pages.length === 0 && crawlResult.errors.length > 0) process.exitCode = 1;
}

async function cmdSitemap(target, flags) {
  const startedAt = new Date().toISOString();
  const timeoutMs = num(flags, 'timeout', 10000);
  const { text, source, fetchError } = await readLocalOrFetch(target, timeoutMs);

  let parsed = { type: 'invalid', error: fetchError || 'no content available' };
  let issues = [];
  if (text) {
    parsed = parseSitemap(text);
    if (parsed.type === 'urlset') issues = validateSitemapEntries(parsed.urls);
  }

  let statusChecks;
  if (flags['check-status'] && parsed.type === 'urlset') {
    const maxChecks = num(flags, 'max-checks', 20);
    const delayMs = num(flags, 'delay', 250);
    statusChecks = [];
    for (const entry of parsed.urls.slice(0, maxChecks)) {
      if (!entry.loc) continue;
      const r = await fetchFollowingRedirects(entry.loc, { timeoutMs, readBody: false });
      statusChecks.push({ loc: entry.loc, status: r.status, finalUrl: r.finalUrl, redirected: (r.redirectChain || []).length > 0, error: r.error });
      if (delayMs > 0) await sleep(delayMs);
    }
  }

  const sitemapResult = { source, ...parsed, issues, statusChecks, fetchError };
  const report = assembleReport({ command: 'sitemap', target, options: {}, startedAt, sitemapResult });
  await emit(report, flags, () => printSitemapSummary(sitemapResult));
}

async function cmdRobots(target, flags) {
  const startedAt = new Date().toISOString();
  const timeoutMs = num(flags, 'timeout', 10000);
  const { text, source, fetchError } = await readLocalOrFetch(target, timeoutMs);
  const parsed = parseRobotsTxt(text || '');
  const importantPaths = flags.important ? String(flags.important).split(',').map((s) => s.trim()).filter(Boolean) : [];
  const userAgent = typeof flags['user-agent'] === 'string' ? flags['user-agent'] : '*';
  const conflicts = importantPaths.length ? checkImportantPathConflicts(parsed, importantPaths, userAgent) : [];

  const robotsResult = { source, found: !fetchError, ...parsed, importantPathConflicts: conflicts, note: ROBOTS_NOT_SECURITY_NOTE, fetchError };
  const report = assembleReport({ command: 'robots', target, options: {}, startedAt, robotsResult });
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
  };
  const crawlResult = await crawl(url, options);

  const origin = new URL(url).origin;
  const robotsInfo = await fetchRobotsForOrigin(origin, { timeoutMs: options.timeoutMs });
  const robotsResult = { source: robotsInfo.robotsUrl, found: robotsInfo.found, ...robotsInfo.parsed, note: ROBOTS_NOT_SECURITY_NOTE, fetchError: robotsInfo.fetchError || null };

  const sitemapUrl = new URL('/sitemap.xml', origin).toString();
  const sitemapFetch = await fetchFollowingRedirects(sitemapUrl, { timeoutMs: options.timeoutMs });
  let sitemapResult;
  if (!sitemapFetch.error && sitemapFetch.status === 200 && sitemapFetch.body) {
    const parsed = parseSitemap(sitemapFetch.body);
    const issues = parsed.type === 'urlset' ? validateSitemapEntries(parsed.urls) : [];
    sitemapResult = { source: sitemapUrl, ...parsed, issues };
  } else {
    sitemapResult = { source: sitemapUrl, type: 'not_found', fetchError: sitemapFetch.error ? sitemapFetch.error.message : `status ${sitemapFetch.status}` };
  }

  // Cross-referencing the sitemap's URL list against the crawl's discovered
  // links is what makes orphan detection actually meaningful — see
  // lib/link-graph.js's doc comments on why a crawl alone can't do this.
  const knownUrls = sitemapResult.type === 'urlset' ? sitemapResult.urls.map((u) => u.loc).filter(Boolean) : [];
  const linkGraph = buildLinkGraph(crawlResult.pages, url, { knownUrls });

  const report = assembleReport({ command: 'audit', target: url, options, startedAt, crawlResult, linkGraph, sitemapResult, robotsResult });
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

function printHelp() {
  console.log(`seo-tool — small, read-only local SEO inspection CLI

Usage:
  node cli.js crawl <url>    [--max-pages=50] [--delay=250] [--concurrency=2]
                             [--timeout=10000] [--include-external] [--no-robots] [--json[=path]]
  node cli.js page <url>     [--timeout=10000] [--json[=path]]
  node cli.js sitemap <urlOrPath> [--check-status] [--max-checks=20] [--json[=path]]
  node cli.js robots <urlOrPath>  [--important=/a,/b] [--user-agent=Googlebot] [--json[=path]]
  node cli.js links <url>    [--max-pages=50] [--json[=path]]   (crawl focused on the link graph)
  node cli.js audit <url>    [--max-pages=50] [--json[=path]]   (crawl + sitemap + robots + link graph)
  node cli.js project [path] [--json[=path]]

--json alone prints JSON to stdout instead of the human summary.
--json=path.json writes the JSON report to that file.

This tool is strictly read-only against everything it inspects. See ../../docs/tooling.md.
`);
}

async function main() {
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

main();
