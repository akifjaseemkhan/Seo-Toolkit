// Assembles the final JSON output shape. Pure data assembly — no analysis,
// no scoring. The schema is documented in docs/tooling.md; keep the two in
// sync when this changes.

export const TOOL_VERSION = '1.0.0';

export function assembleReport({
  command,
  target,
  options = {},
  crawlResult = null,
  sitemapResult = null,
  robotsResult = null,
  linkGraph = null,
  duplicateContent = null,
  hreflangReciprocity = null,
  projectFacts = null,
  diffResult = null,
  startedAt,
  finishedAt = new Date().toISOString(),
}) {
  const errors = [];
  const warnings = [];

  if (crawlResult) {
    errors.push(...(crawlResult.errors || []));
    warnings.push(...(crawlResult.warnings || []));
  }

  return {
    meta: {
      tool: 'seo-tool',
      version: TOOL_VERSION,
      command,
      target,
      startedAt,
      finishedAt,
      options,
    },
    pages: crawlResult ? crawlResult.pages : undefined,
    crawlSummary: crawlResult
      ? {
          startUrl: crawlResult.startUrl,
          pagesFetched: crawlResult.pages.length,
          truncatedByMaxPages: crawlResult.truncatedByMaxPages,
          robots: crawlResult.robots,
        }
      : undefined,
    sitemap: sitemapResult || undefined,
    robots: robotsResult || undefined,
    linkGraph: linkGraph || undefined,
    duplicateContent: duplicateContent || undefined,
    hreflangReciprocity: hreflangReciprocity || undefined,
    project: projectFacts || undefined,
    diff: diffResult || undefined,
    errors,
    warnings,
  };
}
