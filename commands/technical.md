# Command: /seo technical

**Modifies files:** Audit phase no; fixes yes, under [[../rules/implementation-safety]].

## Purpose

Focused technical SEO work: crawlability, indexing, canonicals, redirects, sitemap, robots.txt, rendering — without running a full multi-domain audit.

## Procedure

1. Run `workflows/technical-seo.md`, pulling in `workflows/indexing.md`, `workflows/sitemap.md`, `workflows/robots.md`, and `workflows/javascript-seo.md` as relevant to what's found.
2. Apply `checklists/technical-checklist.md` and `checklists/indexing-checklist.md`.
3. If the user wants findings fixed in the same session, apply [[../rules/implementation-safety]] per fix — plan, risk-check (canonical/indexing/robots changes are explicitly high-risk per [[../rules/canonical-rules]] and [[../rules/indexing-rules]]), implement, verify.
4. Run `checklists/final-regression-checklist.md` before reporting any implemented change.

## High-risk items requiring explicit confirmation

Per [[../rules/canonical-rules]] and [[../rules/indexing-rules]]: any preferred-domain change, any canonical strategy affecting more than a handful of URLs, any robots.txt/noindex change affecting a route pattern rather than a single page. Confirm scope before implementing these.

## Output

`templates/seo-audit-report.md` (findings-only) or `templates/change-report.md` (if fixes implemented) as applicable.
