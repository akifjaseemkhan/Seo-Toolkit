# Workflow: Technical SEO

**Purpose:** Diagnose and (when scoped to `/seo implement`) fix crawlability, indexability, URL structure, redirects, and duplicate-content issues.

**Modifies files:** Audit phase no; implementation phase yes, under [[../rules/implementation-safety]].

## Audit procedure

If a local or live URL is available, `node tools/seo-tool/cli.js crawl <url>` or `audit <url>` (see `docs/tooling.md`) gathers real status codes, redirect chains, canonical values, robots-meta directives, and indexability signals for every discovered page in one pass — use it as evidence for the checks below instead of inferring them from template code alone. It reports facts only; the interpretation below is still yours to do.

Work through `checklists/technical-checklist.md` systematically:

1. **Crawlability** — read `robots.txt` in full. Confirm indexable content isn't blocked and required rendering assets (JS/CSS) aren't blocked. Confirm a sitemap exists and is referenced.
2. **URL structure** — sample URLs across templates. Check trailing-slash consistency, case consistency, protocol/host consistency (https, www vs. non-www resolved to one canonical form).
3. **Status codes** — check for broken internal links, redirect chains/loops, and confirm 404s actually return 404 (not a 200-status "soft 404" page).
4. **Duplicate content and canonicalization** — check self-referencing canonicals exist on unique pages; check parameter-driven and pagination URL handling. See [[../rules/canonical-rules]] before touching any of this.
5. **Indexing signals** — check for unintended `noindex`, missing `noindex` on pages that should be excluded (internal search results, thank-you pages), and contradictions between sitemap/robots/noindex. See [[../rules/indexing-rules]] and `checklists/indexing-checklist.md`.
6. **Rendering** — confirm critical content and metadata are present in server-rendered output or reliably crawlable if client-rendered. Cross-reference `workflows/javascript-seo.md` for CSR/SPA projects.
7. **Mobile** — confirm responsive behavior; Google indexes mobile-first, so mobile rendering is the one that matters most.

## Prioritization guidance specific to technical SEO

Technical issues often have outsized impact relative to their fix effort (a missing canonical, a blocked asset path) — these should usually rank above content work in the priority queue. But scope of blast radius matters: a template-level `robots.txt`/canonical fix affecting thousands of URLs is higher-risk than it looks and needs the confirmation step in [[../rules/implementation-safety]] even though it's "just a config change."

## Implementation notes

- Redirect fixes: correct chains to single-hop 301s. Never introduce a new redirect hop to fix an old one — collapse it.
- Canonical fixes: never guess the preferred domain — verify per [[../rules/canonical-rules]].
- robots.txt fixes: read the entire existing file and understand every rule before adding to it; see [[../rules/indexing-rules]].
- Status-code fixes for broken links: fix the link (update the href) rather than only creating a redirect for the broken target, when the correct destination is knowable.

## External configuration

Some technical issues live outside the codebase: DNS-level redirects, CDN caching/header behavior, server-level redirect rules on managed hosting, domain-level www/non-www enforcement. Identify these clearly and report them under "External Configuration Required" (see `templates/change-report.md`) rather than attempting a code-only workaround that won't actually take effect.

## Output

Findings scored and logged per `templates/seo-audit-report.md`. Implementation changes reported per `templates/change-report.md`.
