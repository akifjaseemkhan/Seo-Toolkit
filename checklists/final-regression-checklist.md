# Final Regression Checklist

Run this immediately before reporting any implementation complete. See [[../rules/implementation-safety]] and [[../rules/verification-rules]]. This is the last gate — nothing skips it, including "small" changes.

## Build & code health
- [ ] Project builds successfully
- [ ] Lint passes (project's existing config, no new suppressions added)
- [ ] Type-check passes (if applicable)
- [ ] Existing test suite passes in full — no test deleted or weakened to force a pass

## Diff review
- [ ] `git diff` read in full, file by file
- [ ] Every changed line traces back to the plan — nothing extra crept in
- [ ] No unrelated formatting/whitespace churn from an auto-formatter sweeping untouched code
- [ ] No accidental deletion of existing metadata, schema, sitemap logic, or robots rules

## Functional spot-check
- [ ] Every page/route touched still loads without error
- [ ] Core interactive flows on touched pages still work (forms submit, buttons function, navigation works, cart/checkout works if e-commerce, auth-gated content still gates correctly)
- [ ] No new browser console errors on touched pages
- [ ] No new network request failures on touched pages

## Visual check
- [ ] Touched pages visually match pre-change state except for the specific, intended, reported SEO addition (see [[../rules/ui-preservation]])
- [ ] No layout shift or broken responsive behavior introduced

## SEO-specific verification
- [ ] Rendered `<head>` output inspected directly (not just source template) for metadata correctness
- [ ] Structured data (if touched) is valid JSON and matches visible content
- [ ] Sitemap/robots (if touched) are well-formed and contain exactly the intended URLs
- [ ] Canonical URLs (if touched) resolve correctly and don't create redirect/noindex contradictions

## Security pass
- [ ] `checklists/security-safety-checklist.md` completed

## Reporting readiness
- [ ] Every item above has a clear pass/fail/not-applicable status ready to go into `templates/change-report.md`
- [ ] Anything that failed or couldn't be verified is called out explicitly, not omitted
