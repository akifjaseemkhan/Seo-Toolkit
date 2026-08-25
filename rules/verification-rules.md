# Rule: Verification Standard

**Status:** Required after every implementation, before reporting completion.

## The rule

An SEO change is not "done" when the edit is made — it's done when it's been verified not to have broken anything and to actually produce the intended SEO effect where that's testable locally.

## Before implementation — capture baseline

Record enough of the current state to compare against afterward:

- Current build/lint/test status (does it pass now, independent of your change?)
- Current output of the specific thing you're changing (existing meta tags, existing schema, existing sitemap contents, existing robots.txt) — so you can diff before/after.
- Current visual state of any page whose rendered output you'll touch, if a preview environment is available.

## After implementation — verify

Run whatever subset applies to the change:

- **Build** — the project builds without new errors or warnings.
- **Lint / type-check** — passes using the project's existing configuration; don't introduce new suppressions to force a pass.
- **Tests** — existing test suite still passes. Never delete or weaken a test to make it pass — if a test fails because it encodes an assumption your change legitimately updates, that's a signal to slow down and confirm, not to edit the test away.
- **Routes** — the routes you touched (and their neighbors, if you touched shared layout/template code) still resolve and render.
- **Metadata** — inspect actual rendered `<head>` output (view-source or SSR output, not just the source template) for title, meta description, canonical, Open Graph, Twitter/X tags.
- **Structured data** — validate JSON-LD is syntactically valid and matches visible page content per [[schema-rules]].
- **Sitemap/robots** — if touched, confirm the file is well-formed and contains/excludes exactly the intended URLs.
- **Console errors** — check browser console for new errors introduced on affected pages, if a preview environment is available.
- **Existing functionality spot-check** — manually exercise the core flow(s) on any page you touched (a form still submits, a product still adds to cart, navigation still works) — don't rely on the build passing alone as proof nothing broke.

## What you cannot verify locally — say so

Some effects only show up externally and take time:

- Actual indexing status changes (Search Console, days to weeks)
- Actual ranking changes (weeks to months)
- Rich-result eligibility/appearance in live SERPs (Search Console Enhancements, Rich Results Test)
- Real Core Web Vitals field data (CrUX, weeks of real-user data)

Never claim these are "fixed" or "improved" as a completed outcome. State what was implemented, what you verified locally, and what the user should check externally and when (see `workflows/post-implementation.md` and `workflows/search-console.md`).

## Reporting verification

Every `templates/change-report.md` must list exactly what was verified, not just "tested successfully." State the specific checks run and their results, including any check that could not be run and why (e.g., no test suite exists in this project).
