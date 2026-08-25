# Workflow: robots.txt

**Purpose:** Ensure `robots.txt` correctly guides crawler behavior without blocking anything that should be indexed or exposing anything sensitive.

**Modifies files:** Yes, under [[../rules/implementation-safety]] and [[../rules/indexing-rules]]. Treat every change here as meaningful — this one small file has site-wide reach.

## Audit procedure

`node tools/seo-tool/cli.js robots <urlOrPath> --important=/path1,/path2` (see `docs/tooling.md`) parses the file into its groups/rules and, given a list of important paths, reports exactly which rule blocks each one using the same longest-match-wins evaluation real crawlers use — more reliable than eyeballing wildcard/`$`-anchor patterns by hand.

1. Read the entire existing file first — every `Disallow`, `Allow`, `Sitemap`, and user-agent block. Understand intent before changing anything.
2. Confirm it's serving from the production domain root (`/robots.txt`) and isn't accidentally a staging/preview default.
3. Check for rules that block:
   - Indexable content paths
   - Assets required to render indexable pages (JS/CSS bundles) — this can prevent proper rendering evaluation even if the HTML itself isn't blocked
4. Check for rules that are missing:
   - Internal search-results paths, admin paths, or other genuinely non-public functional paths that don't need to be crawled (note: this is crawl-efficiency guidance, not access control — see below)
5. Confirm a `Sitemap:` directive points to the correct, current sitemap URL.
6. Confirm no environment leakage — a `Disallow: /` meant for staging must never reach production, and vice versa a production file should never be missing rules that were intentionally staging-only.

## Key distinction to apply every time

`robots.txt` controls **crawling** (whether a bot fetches a URL), not **indexing** (whether a URL appears in search results) and not **access** (whether a human/bot can reach the URL at all). A disallowed-but-linked page can still get indexed by URL alone from external links, just without a fetched snippet. If the actual goal is "keep this out of search results," the correct tool is `noindex`, not `robots.txt` (see `workflows/indexing.md`). If the actual goal is "keep this private," the correct tool is real authentication/authorization, not `robots.txt` — disallowing a path can even advertise that it exists.

## Implementation

- Small, obviously-correct fixes (a single wrongly-blocked path, a missing/incorrect sitemap directive): implement directly once verified.
- Rules affecting broad path patterns or crawl budget site-wide: confirm scope and intent with the user before implementing, per [[../rules/implementation-safety]].
- Never add a rule that blocks a path containing pages you want indexed, even temporarily "to test something."

## Output

Diff of the file plus `templates/change-report.md` explaining exactly what changed and why, and confirmation that indexable content and render-critical assets remain unblocked (`checklists/indexing-checklist.md`).
