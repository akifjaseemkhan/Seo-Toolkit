# Rule: Indexing Control Discipline

**Status:** High caution. Indexing mistakes are among the most damaging and hardest-to-notice SEO errors.

## The rule

Anything that controls whether a page is crawled or indexed — `robots.txt`, `<meta name="robots">` / `X-Robots-Tag`, `noindex`, canonical-as-deindex, sitemap inclusion/exclusion — must be changed deliberately, verified before and after, and never as a side effect of an unrelated change.

## Before changing anything

1. Read the current `robots.txt` in full. Understand every existing rule before adding to it.
2. Check for existing `noindex`/`nofollow` directives project-wide (search the codebase for `robots`, `noindex`, `X-Robots-Tag`) — understand why they exist before touching any of them. A `noindex` on a staging-only route, an internal search-results page, or a thin auto-generated page is often intentional.
3. Confirm which environment you're looking at. Many projects apply a blanket `noindex`/`Disallow: /` on staging or preview deployments — never let a staging-environment default leak into what you recommend for production, and never accidentally do the reverse (verify a "noindex everything" rule isn't actually the production default from a botched prior deploy).
4. Understand the difference between `robots.txt` (crawl control — doesn't prevent indexing of a URL that's linked elsewhere) and `noindex` (indexing control) and use the right tool for the actual goal. See `workflows/robots.md` and `workflows/indexing.md`.

## Hard rules

- Never `Disallow` a path that contains pages you want indexed.
- Never `Disallow` a path that contains assets (JS/CSS) required to render pages that are indexed — this can prevent search engines from evaluating the rendered page correctly.
- Never add a blanket `noindex` to a template that's shared across indexable and non-indexable pages without scoping it correctly per-instance.
- Never remove an existing `noindex` without understanding why it was added — it may be protecting against duplicate content, thin content, or a legal/privacy requirement.
- Never treat `robots.txt` as an access-control or privacy mechanism — it's a public file and a crawl-behavior hint, not a security boundary. If private content is exposed via `robots.txt` disallow rules (which reveal the path exists) instead of real access control, report this as a security concern, not just an SEO one.
- Never let a sitemap include a URL that is simultaneously `noindex`ed, blocked by `robots.txt`, or redirects/404s — this is a contradictory signal. See `workflows/sitemap.md`.

## Scope of change

- **Single-page, obviously-correct fixes** (a specific page missing a needed `noindex` on an internal duplicate, one route accidentally blocked) — implement directly once verified.
- **Anything affecting a route pattern, template, or crawl budget broadly** — plan, confirm with the user, implement, then verify indexing status changes are visible in Search Console over the following weeks (report this as an expected external verification step, since indexing changes are not instant).

Related: [[canonical-rules]], `workflows/robots.md`, `workflows/indexing.md`, `checklists/indexing-checklist.md`.
