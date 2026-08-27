# Local SEO Tooling

`tools/seo-tool` is a small, read-only, zero-dependency Node.js CLI that this skill can run to collect real facts about a project instead of relying only on reading source code or reasoning from general knowledge. This document explains what it is, when to use it, what it guarantees, and the JSON shape it produces.

## Three layers — keep them separate

Every SEO finding this skill produces should be traceable to one of three sources. Conflating them is how a report ends up making a claim it can't actually back up.

1. **Source inspection** — reading the project's actual code (`workflows/discovery.md`, `docs/architecture.md`). Tells you what the project is *supposed* to produce: which metadata API is wired up, what the sitemap generator's logic does, what the canonical logic says. It does not tell you what actually renders.
2. **Local SEO tools** (`tools/seo-tool`) — fetching real HTML/robots.txt/sitemap.xml (from a local dev server or a live deployed URL) and extracting facts from what was actually returned. Tells you what's *actually there*, closing the gap between "the code should produce X" and "the response actually contains X." This layer never interprets — it reports facts.
3. **Human/agent reasoning** — applying `workflows/*.md` and `rules/*.md` to the facts from layers 1 and 2 to decide severity, priority, and recommendations. The tool never does this step. A missing canonical tag is a fact from layer 2; "this is a High-severity finding because it risks duplicate-content indexing at catalog scale" is layer 3.

Never let the tool's output stand in for layer 3 reasoning, and never skip layer 2 in favor of assuming source inspection alone proves what renders — the two can and do diverge (a metadata API can be wired up correctly and still fail to render for a specific dynamic route, a CMS field can be empty in production while looking populated in a template).

## Local vs. live vs. external — what each can actually tell you

| Scope | What it proves | How to check it |
|---|---|---|
| **Local/project inspection** | What the source code is set up to do | `node tools/seo-tool/cli.js project [path]`, or manual inspection per `workflows/discovery.md` |
| **Local development server** | What actually renders in this environment, including dynamic behavior — but not necessarily what production renders (env vars, feature flags, and build mode can differ) | `node tools/seo-tool/cli.js page/crawl/audit http://localhost:PORT` |
| **Deployed/live website** | What a real crawler would actually see right now | `node tools/seo-tool/cli.js page/crawl/audit https://the-real-domain.com` |
| **External platforms** (Search Console, Google Business Profile, rank trackers, backlink indexes, analytics) | Real indexing/ranking/traffic/authority data | Cannot be fetched by this tool at all — see `workflows/search-console.md` and the "External Configuration Required" reporting category |

**Never present a local or source-code finding as if it were external data.** "The canonical tag is missing" (verified by the tool against a live URL) is a fact. "This page isn't ranking because of it" is an inference that needs Search Console data to actually confirm — see [[../rules/verification-rules]].

## When to use the toolkit

The toolkit is an accelerant for workflows that already tell you what to inspect — it is never mandatory, and workflows must still function fully by manual inspection when it can't reasonably be used (no network access to the target, a non-HTTP project, the user hasn't provided a URL).

Use it when:

- `workflows/discovery.md` step 4 (existing SEO implementation presence check) — run `project` to get framework/package-manager/config-file facts in one pass instead of manually globbing.
- `workflows/technical-seo.md` and `checklists/technical-checklist.md` — run `crawl` or `audit` against a live URL (dev or deployed) to get real status codes, redirect chains, canonical values, and indexability signals instead of inferring them from template code alone.
- `workflows/sitemap.md` — run `sitemap --check-status` to validate structure and, optionally, spot-check that listed URLs actually resolve.
- `workflows/robots.md` — run `robots --important=/path1,/path2` to check whether specific important paths are blocked.
- `workflows/internal-linking.md` and orphan-page analysis — run `audit` (which cross-references the sitemap against crawl-discovered links) rather than `crawl` alone; see the note in the JSON schema below about why a crawl by itself can't find orphans.
- Any `/seo audit` where a live or local URL is available — running `audit` once up front gives every subsequent pass real evidence to cite instead of assumptions.

Don't use it when:

- The user hasn't provided or confirmed a URL to inspect, and none is discoverable (e.g., no local dev server is running) — ask, don't guess at a URL.
- The finding is purely about source-code structure (e.g., "is this template using the right schema type") — that's layer 1, read the code.
- The target is large enough that a full crawl would be slow or heavy — scope it (`--max-pages`) or crawl a representative section rather than the whole site.

## Safety guarantee

Every command in `tools/seo-tool` is read-only against everything it inspects: it only ever issues `GET` HTTP requests (never a mutating method) and only ever reads local files. It never edits source files, never writes `robots.txt`/`sitemap.xml`/`package.json`, never modifies routes or configuration, and never touches Git state. The only thing it ever writes is its own JSON report, and only when you explicitly pass `--json=path`. This mirrors the audit/implement separation in `SKILL.md` — the toolkit only ever performs the "audit" half.

It is also conservative by default: same-origin only (external links are recorded but not crawled unless `--include-external` is passed), a configurable page cap (`--max-pages`, default 50), a delay between request batches (`--delay`, default 250ms), bounded concurrency (`--concurrency`, default 2), a request timeout (`--timeout`), and it respects `robots.txt` by default (`--no-robots` to override, e.g. for auditing your own project's disallowed paths).

## Commands

Run from the repository (no global install, no `npm install` needed — zero dependencies):

```bash
node tools/seo-tool/cli.js crawl <url>    [--max-pages=50] [--delay=250] [--concurrency=2]
                                          [--timeout=10000] [--include-external] [--no-robots] [--json[=path]]
node tools/seo-tool/cli.js page <url>     [--timeout=10000] [--json[=path]]
node tools/seo-tool/cli.js sitemap <urlOrPath> [--check-status] [--max-checks=20]
                                               [--max-sitemaps=50] [--max-sitemap-depth=5] [--no-recurse] [--json[=path]]
node tools/seo-tool/cli.js robots <urlOrPath>  [--important=/a,/b] [--user-agent=Googlebot] [--json[=path]]
node tools/seo-tool/cli.js links <url>    [--max-pages=50] [--json[=path]]
node tools/seo-tool/cli.js audit <url>    [--max-pages=50] [--max-sitemaps=50] [--max-sitemap-depth=5] [--json[=path]]
node tools/seo-tool/cli.js project [path] [--json[=path]]
```

`--json` alone prints the full JSON report to stdout; `--json=path.json` writes it to a file instead. Without `--json`, each command prints a short human-readable summary.

`sitemap` and `robots` accept either a URL or a local file path as their argument.

## What each command collects

- **`page`** — one URL's status, redirect chain, content type, title, meta description, canonical, viewport, `lang`, robots meta + `X-Robots-Tag` directives, an indexability signal (see below), H1/H2 counts and text, Open Graph fields, Twitter card fields, JSON-LD blocks (parsed, with parse errors captured rather than thrown), internal/external links (with anchor text and `nofollow`), and images (`src`, `alt` presence vs. empty alt).
- **`crawl`** — the same facts for every same-origin page reached by breadth-first traversal from the start URL, plus each page's crawl depth and which pages linked to it (within this crawl).
- **`sitemap`** — parses `<urlset>` or `<sitemapindex>`. A `<sitemapindex>` is recursed into by default (bounded by `--max-sitemaps`, default 50, and `--max-sitemap-depth`, default 5) so `entryCount`/`urls`/`issues` always reflect the full aggregated set of real page URLs across every child sitemap, never just the list of child filenames — pass `--no-recurse` to see only the root document. Recursion is same-origin, deduplicates repeated/cyclical child sitemap references (each fetched at most once), and records every file it touched in `sitemapsProcessed` plus anything it declined to follow (cross-origin, duplicate, or bound-exceeded) in `skipped`; a `truncated: true` flag means the bounds were hit before the whole tree was covered. Validation flags missing/malformed `loc` values, exact and trailing-slash-variant duplicates, and paths that heuristically look non-public (admin/account/cart-like segments) — a heuristic flag for a human to verify, not a claim of certainty. `--check-status` optionally spot-checks the first N aggregated URLs' real HTTP status.
- **`robots`** — parses groups/rules/`Sitemap:` declarations, and (with `--important`) flags whether specific paths are blocked for a given user-agent, using longest-match-wins evaluation with `*` wildcards and `$` end-anchors.
- **`links`** — the same crawl as `crawl`, with the human summary focused on the link graph.
- **`audit`** — runs `crawl` + fetches `robots.txt` + fetches `/sitemap.xml`, then cross-references the sitemap's URL list against the crawl's discovered internal links to find real orphan candidates (see the note below on why `crawl` alone can't do this).
- **`project`** — local, read-only facts about the project itself: `package.json` dependencies/scripts, detected package manager (from lockfile), framework config files present, `app/`/`pages/`/`wp-content/` directory conventions, SEO-related files found at conventional locations (`robots.txt`, `sitemap.xml`, etc.), and which of a small set of metadata-implementation signal strings (`generateMetadata`, `next/head`, `react-helmet`, `application/ld+json`, etc.) appear in which files. This is a plain substring scan, not code analysis — see Known Limitations.

## The orphan-detection note

A crawl that starts from one page and only follows discovered links can, by construction, never find a page that truly has zero incoming links — if the crawler reached it, something linked to it. Real orphan detection needs an independent list of URLs that *should* exist to cross-reference against what the crawl actually found linked — that's what `audit` does by comparing the sitemap's URLs against the crawl's discovered link targets. `crawl`/`links` alone will typically report zero orphan candidates, which is expected and documented, not a bug — prefer `audit` when orphan detection specifically matters.

This cross-reference is sitemap-index-aware: `audit` resolves the full sitemap tree (see the `sitemap` command above) before comparing, so a site whose `/sitemap.xml` is actually a `<sitemapindex>` still gets real orphan detection instead of silently comparing against an empty list.

## Known limitations (read before treating an absence as proof)

- **HTML/sitemap parsing is regex-based, not a full parser or DOM.** It handles realistic, reasonably well-formed markup (any attribute order, single/double-quoted or unquoted values, mixed-case tags) but is not a substitute for a browser. Unusual or deeply malformed markup can produce a false negative (a tag present but not detected). Treat a missing result as "not found by this pass," and fall back to manual/browser inspection for anything surprising before concluding a tag truly doesn't exist.
- **No JavaScript execution.** The crawler fetches raw HTML only — it does not render client-side JavaScript. For CSR/SPA content, what this tool sees is exactly what a crawler would see *before* any client-side rendering pass, which is precisely the signal `workflows/javascript-seo.md` needs — but it means content that only appears after hydration will correctly show up as *absent* here. That's the tool doing its job, not a bug to explain away.
- **`project`'s metadata-signal scan is a plain substring match**, not semantic code analysis. A signal string found in a comment, a string literal, or unrelated context will still be reported as a "hit." It reports file counts and sample paths so the reasoning layer can verify each hit, not as a verified-implementation claim.
- **Indexability is a signal, not a verdict.** `page`/`crawl`'s `indexable` field only reflects status code + robots meta/`X-Robots-Tag` + canonical-target agreement for that one response. It does not check `robots.txt` blocking (a separate, crawl-level concern already applied during `crawl`) or quality-based exclusion, which no local tool can determine. Feed it into `checklists/indexing-checklist.md`'s full diagnostic order.
- **No external/authority data.** Nothing here touches Search Console, rank trackers, backlink indexes, or analytics — see the Local vs. live vs. external table above.
- **Sitemap-index recursion is sequential, not concurrent.** Child sitemaps are fetched one at a time, so a pathologically large or slow index can take up to `--max-sitemaps` × `--timeout` in the worst case (roughly 8 minutes at the defaults of 50 × 10s, if every single child timed out). This is bounded, not unbounded — it will always stop — but it can be slow on an unusually large index. Lower `--max-sitemaps`/`--timeout` for a quicker, partial look, or raise them if a large site's index genuinely needs the headroom.

## JSON output schema

Every command produces the same top-level envelope via `assembleReport` (`tools/seo-tool/lib/report.js`); only the populated sections differ by command.

```jsonc
{
  "meta": {
    "tool": "seo-tool",
    "version": "1.0.0",
    "command": "audit",              // page | crawl | links | sitemap | robots | audit | project
    "target": "https://example.com",
    "startedAt": "2026-08-25T12:00:00.000Z",
    "finishedAt": "2026-08-25T12:00:03.500Z",
    "options": { "maxPages": 50, "delayMs": 250, "concurrency": 2, "timeoutMs": 10000, "includeExternal": false, "respectRobots": true }
  },
  "pages": [                          // present for page/crawl/links/audit
    {
      "requestedUrl": "...", "finalUrl": "...", "status": 200,
      "redirectChain": [ { "url": "...", "status": 301, "location": "..." } ],
      "contentType": "text/html; charset=utf-8", "isHtml": true,
      "title": "...", "metaDescription": "...", "canonical": "...",
      "viewport": "...", "lang": "en",
      "robotsMetaDirectives": ["noindex"], "xRobotsTagDirectives": [],
      "indexable": false, "indexabilityReasons": ["noindex directive present ..."],
      "h1Count": 1, "h1Texts": ["..."], "h2Count": 3, "h2Texts": ["...", "..."],
      "openGraph": { "title": "...", "description": "...", "image": "..." },
      "twitter": { "card": "summary_large_image" },
      "jsonLd": [ { "raw": "...", "parsed": {}, "parseError": null } ],
      "internalLinks": [ { "url": "...", "text": "...", "nofollow": false } ],
      "externalLinks": [ { "url": "...", "text": "...", "nofollow": false } ],
      "invalidHrefs": ["..."],
      "images": [ { "src": "...", "alt": "...", "hasAlt": true, "isEmptyAlt": false } ],
      "imagesMissingAlt": 0,
      "depth": 2, "discoveredFrom": ["..."], "isExternal": false,
      "skipped": false, "skipReason": null,
      "error": null
    }
  ],
  "crawlSummary": { "startUrl": "...", "pagesFetched": 12, "truncatedByMaxPages": false, "robots": { "checked": true, "robotsUrl": "..." } },
  "sitemap": { "source": "...", "type": "urlset",              // urlset | sitemapindex | invalid | not_found — reflects the ROOT document; urls/entryCount/issues are always the full aggregated tree
    "entryCount": 40, "urls": [ { "loc": "...", "lastmod": "...", "changefreq": null, "priority": null } ],
    "issues": [ { "type": "duplicate_exact", "loc": "...", "index": 3 } ],
    "sitemapsProcessed": [ { "url": "...", "depth": 0, "type": "urlset", "urlCount": 40, "error": null }, { "url": "...", "depth": 0, "type": "sitemapindex", "childCount": 3, "error": null } ], // urlCount = real page URLs in that file; childCount = child <sitemap> references in that index — never the same field, since they're different units
    "skipped": [ { "url": "...", "reason": "cross-origin child sitemap skipped (same-origin restriction)" } ],
    "truncated": false,
    "statusChecks": [ { "loc": "...", "status": 200, "finalUrl": "...", "redirected": false, "error": null } ] },
  "robots": { "source": "...", "found": true, "groups": [ { "agents": ["*"], "rules": [ { "type": "disallow", "path": "/admin" } ] } ], "sitemaps": ["..."], "unknownDirectives": [], "importantPathConflicts": [], "note": "robots.txt is a crawl-behavior hint, not access control ..." },
  "linkGraph": { "orphanCandidates": ["..."], "orphanDetectionUsedKnownUrls": true, "crawlDepthOutliers": [ { "url": "...", "depth": 5 } ], "brokenInternalLinks": [ { "from": "...", "to": "...", "status": 404 } ], "unverifiedInternalLinks": [ { "from": "...", "to": "..." } ], "note": "..." },
  "project": { "rootDir": "...", "packageJson": { "dependencies": ["next", "react"], "scripts": {} }, "packageManager": "npm", "frameworkConfigFiles": ["next.config.js"], "directoryConventions": { "hasAppRouterDir": true }, "seoRelatedFilesFound": ["public/robots.txt"], "metadataImplementationSignals": { "generateMetadata": { "fileCount": 4, "samplePaths": ["..."] } }, "scan": { "filesWalked": 812, "truncated": false } },
  "errors": [ { "url": "...", "message": "..." } ],
  "warnings": [ "..." ]
}
```

Keep this schema in sync with `tools/seo-tool/lib/report.js` when either changes. This shape is designed to drop directly into `templates/seo-audit-report.md`'s `Evidence` field (cite the specific page/field from the JSON) rather than requiring a separate translation step.

## Testing

`tools/seo-tool` has its own test suite (`node --test test/*.test.js` from within `tools/seo-tool/`, or `npm test`), covering:

- Every HTML extractor (title, description, canonical, robots meta, H1/H2 counting, JSON-LD, internal/external link classification) and URL normalization.
- `robots.txt` parsing and rule evaluation, including wildcard/end-anchor patterns and longest-match-wins.
- Sitemap parsing and validation, and `<sitemapindex>` tree resolution specifically — recursion into nested indexes, duplicate/cycle protection, same-origin enforcement, and bounded truncation (`maxSitemaps`/`maxDepth`).
- Link-graph orphan/broken-link detection.
- A full crawl against a local HTTP fixture server (redirects, 404s, robots blocking, external-link handling), and project inspection against a fixture directory.
- The CLI entry point itself (`cli.js`) as a real subprocess: command dispatch, argument parsing, exit codes, and both output modes (`--json`, `--json=path`).
- `lib/fetch-utils.js` directly: timeouts, redirect chains, redirect loops, capped body reads, and network-error classification.
- `lib/report.js`'s assembled JSON report shape against the schema documented above.

Run it after any change to `tools/seo-tool`. GitHub Actions CI (`.github/workflows/ci.yml`) runs the same command on every push and pull request.
