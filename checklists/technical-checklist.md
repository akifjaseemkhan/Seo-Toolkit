# Technical SEO Checklist

Read-only audit checklist. See `workflows/technical-seo.md`. Pair with `checklists/indexing-checklist.md` for indexing-specific items.

## Crawlability
- [ ] `robots.txt` exists, is valid, and doesn't block indexable content or required assets
- [ ] No accidental `Disallow: /` or environment-leaked staging rules in production
- [ ] XML sitemap exists, is valid, and is referenced in `robots.txt`
- [ ] Sitemap contains only indexable, canonical, 200-status URLs
- [ ] Internal links use crawlable `<a href>` elements (not JS-only click handlers with no real href)
- [ ] No excessive crawl depth (important pages reachable within ~3-4 clicks from home)

## URL structure
- [ ] URLs are human-readable and stable
- [ ] Consistent trailing-slash behavior site-wide
- [ ] Consistent case (no mixed-case URL variants of the same page)
- [ ] No unnecessary URL parameters for canonical content
- [ ] Consistent protocol (https enforced) and host (www vs. non-www resolved to one)

## Status codes and redirects
- [ ] No broken internal links (404s) to real pages
- [ ] Redirects are 301 (permanent) for permanent moves, not 302 misused long-term
- [ ] No redirect chains (A→B→C) — collapse to single-hop
- [ ] No redirect loops
- [ ] Custom 404 page exists and returns real 404 status (not 200)

## Duplicate content and canonicalization
- [ ] Every indexable page has a self-referencing or correctly cross-referenced canonical (see [[../rules/canonical-rules]])
- [ ] No duplicate content across www/non-www, http/https, trailing-slash variants
- [ ] Parameter-driven URL variants (sort, filter, tracking) handled consistently (canonical and/or robots)
- [ ] Pagination handled correctly (see `workflows/technical-seo.md`)

## Indexing signals
- [ ] No unintended `noindex` on pages that should rank
- [ ] No missing `noindex` on pages that shouldn't rank (internal search results, thank-you pages, filtered duplicates)
- [ ] `noindex` and sitemap inclusion never contradict each other

## Rendering
- [ ] Critical content (main copy, headings, links) present in server-rendered/initial HTML, or confirmed reliably renderable by modern crawlers if CSR — see `workflows/javascript-seo.md`
- [ ] Metadata (title, description, canonical, OG, schema) emitted server-side, not injected only after client hydration

## Mobile
- [ ] Site is responsive / mobile-usable (Google indexes mobile-first)
- [ ] No mobile-specific blocking issues (intrusive interstitials, unusable tap targets)

## Security-adjacent
- [ ] HTTPS enforced site-wide
- [ ] Mixed-content warnings absent
- [ ] No sensitive paths exposed via `robots.txt` `Disallow` entries (see [[../rules/indexing-rules]])

## Output
- [ ] Every failed item scored (Severity/Impact/Effort/Risk) and logged per `templates/seo-audit-report.md`
