# Workflow: SEO Monitoring

**Purpose:** Define what should be checked on an ongoing basis after initial audit/implementation work, so regressions and new opportunities are caught early rather than discovered months later.

**Modifies files:** No, unless setting up an actual monitoring mechanism the project can run (e.g., a CI check, a scheduled script) is explicitly requested — treat that as its own scoped implementation task under [[../rules/implementation-safety]].

## What to monitor and why

- **Indexing status** (Search Console Coverage/Page Indexing) — catches accidental noindex/robots regressions from unrelated code changes. Check after any deploy touching routing, metadata, or config; otherwise periodically.
- **Core rankings/visibility for priority queries** — catches real-world impact of both this skill's changes and external factors (algorithm updates, competitor moves). Weekly-to-monthly cadence is typical; daily checking usually just adds noise.
- **Core Web Vitals field data** (CrUX via Search Console/PageSpeed Insights) — real-user data takes weeks to accumulate meaningfully; check monthly, not daily.
- **Crawl errors / 404s** — catches broken links and redirect issues introduced by ongoing site changes.
- **Sitemap processing status** — catches generation bugs early.
- **Structured data validity** (Search Console Enhancements) — catches schema drift when underlying content/data changes without the schema being updated to match (see [[../rules/schema-rules]]).
- **New/lost backlinks** (if a tool is available) — catches both new opportunities and toxic-link situations worth investigating.
- **Manual actions** — should be checked whenever an unexplained ranking drop occurs; this changes the diagnosis entirely if present.

## Cadence guidance

- **After every SEO implementation**: run `workflows/post-implementation.md` immediately, then re-check indexing/rendering after 1–2 weeks.
- **Routine cadence for an active project**: monthly review of rankings, traffic, Core Web Vitals, and crawl errors is a reasonable default; adjust to the site's actual change velocity and business priority.
- **Before any major site change** (redesign, migration, replatform): establish a full baseline snapshot first — this is the single most important monitoring discipline, since post-hoc diagnosis without a baseline is far harder.

## What this skill can and can't automate

This skill can define what to check and how to interpret it, and can implement code-level monitoring where the project has the infrastructure for it (e.g., a CI step that validates sitemap/robots on every build). It cannot itself poll Search Console or ranking trackers on a schedule outside of an active session — surface this limitation plainly rather than implying passive ongoing monitoring is happening.

## Output

A monitoring checklist/cadence tailored to the project, and — for any given session — a clear statement of what changed that specifically warrants closer-than-usual monitoring in the following weeks (feeds `workflows/reporting.md` and `templates/monthly-seo-report.md`).
