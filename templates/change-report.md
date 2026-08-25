# Change Report — Template

**Required after every implementation session, regardless of size.** See `workflows/post-implementation.md` and [[../rules/verification-rules]]. Populate every section — "None." is a valid, honest answer for several of them, but the section must still be addressed explicitly.

---

## SEO Improvements Implemented

Specific, concrete list of what changed and the SEO rationale for each.

## Files Changed

Every file touched, listed explicitly.

## Why

The reasoning connecting the changes to a real finding or goal (link to the audit finding or plan if applicable).

## UI Changes

Exactly what changed visually, if anything. State precisely — "added a visually-hidden h1" is different from "added visible breadcrumb text." If nothing visible changed: **"None."**

## Functionality Protection

Explicit confirmation that protected functionality (auth, payments, APIs, DB, realtime, business logic — per [[../rules/zero-breakage]]) was not touched, or if it was necessarily adjacent, exactly what was verified to confirm it still works correctly.

## Testing

List the specific checks run per `checklists/final-regression-checklist.md` and their results — build, lint, tests, diff review, rendered-output inspection, functional spot-check. State any check that could not be run and why (e.g., no test suite exists in this project).

## Risks

Remaining risk, if any, even after verification — nothing here means state that explicitly.

## Not Implemented

What was intentionally left out of scope, and why (see [[../rules/architecture-preservation]] and [[../rules/implementation-safety]] for common reasons — high-risk, requires explicit decision, requires architecture change).

## External Configuration Required

Anything needing action outside this codebase (DNS, hosting, CDN, Search Console, Google Business Profile). Precise instructions, not vague pointers. "None." if genuinely nothing applies.

## Remaining SEO Opportunities

Prioritized next steps, referencing the relevant `workflows/*.md` or `commands/*.md` for follow-up.

## Verify Externally (and when)

Per `workflows/post-implementation.md` — what the user should check in Search Console/Rich Results Test/etc., and a realistic timeline for when it's meaningful to check.
