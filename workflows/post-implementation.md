# Workflow: Post-Implementation Verification

**Purpose:** The mandatory closing step after any `/seo implement`-class work — confirm nothing broke, confirm what was actually achieved locally, and set correct expectations for what takes time to show up externally.

**Modifies files:** No — verification only. If verification surfaces a problem, fix it under [[../rules/implementation-safety]] and re-verify before reporting complete.

## Procedure

### 1. Run the final regression pass

Execute `checklists/final-regression-checklist.md` and `checklists/security-safety-checklist.md` in full. Do not skip either for a "small" change.

### 2. Confirm local verification per [[../rules/verification-rules]]

Build, lint, tests, diff review, rendered-output inspection, functional spot-check — whatever subset applies to what was actually changed.

### 3. Distinguish "verified" from "expected"

Be precise in the report about what's actually confirmed versus what's expected to happen but can't be confirmed yet:

- **Verified now**: build passes, page renders correctly, metadata/schema is correct in rendered output, existing functionality still works.
- **Expected, not yet verifiable**: search engines will re-crawl and re-index the change (timeline: hours to weeks depending on the site's crawl frequency and the page's importance), rankings may shift (timeline: weeks to months), rich results may begin appearing (timeline: days to weeks, contingent on Google's own eligibility evaluation, not guaranteed).

### 4. Give the user a concrete external checklist

Tell them specifically what to check and where, and roughly when it's meaningful to check it:

- Search Console → Page Indexing report, for the specific URLs changed (check after ~1–2 weeks for re-crawl signals)
- Search Console → Enhancements, for structured-data validity (check within days once Google reprocesses)
- Rich Results Test, for immediate structured-data validation (available now, doesn't require waiting)
- Search Console → Performance report, for ranking/traffic impact (check after several weeks minimum — shorter windows are noise)
- Core Web Vitals / PageSpeed Insights field data, if performance was the target (check after CrUX accumulates enough real-user data, typically weeks)

### 5. Log the change for future comparison

Note what changed and when, so a future monitoring check (`workflows/monitoring.md`) has a clear before/after reference point.

## Constraints

- Never claim an SEO outcome (ranking improvement, indexing fixed, traffic increase) as already achieved based only on local verification — that's a category error per [[../rules/verification-rules]].
- Never skip this workflow because the change felt small — small changes are exactly where skipped verification causes silent regressions.

## Output

Feeds directly into `templates/change-report.md`'s "Testing" and "Remaining SEO Opportunities" sections, and sets up `workflows/monitoring.md`'s next check.
