# Implementation Plan — Template

Required before implementing anything beyond a trivial single-file fix. See [[../rules/implementation-safety]]. This is written and, where the risk-check flags it, confirmed with the user *before* any code changes.

---

## Objective

What SEO problem this addresses and why it matters (link to the audit finding if one exists).

## Scope

Exactly what will change. Be specific — file paths, templates, route patterns. Anything not listed here is out of scope for this plan.

## Files to be changed

| File / template | Change | Reason |
|---|---|---|
| | | |

## Risk Classification

- **Reversibility:** Easy / Hard (per [[../rules/zero-breakage]] reversibility test)
- **Touches protected functionality?** (auth / payments / APIs / DB / realtime / business logic — Yes/No, and if yes, what and how)
- **Blast radius:** (single page / N pages via template / site-wide)
- **Requires explicit user confirmation before proceeding?** Yes/No — and why

## Dependencies / Prerequisites

Anything that must be true or confirmed before implementing (e.g., preferred domain confirmed, real business data provided, pilot batch approved for a programmatic pattern).

## Implementation Steps

Ordered, specific steps — not a restatement of the objective.

## Verification Plan

What will be checked per [[../rules/verification-rules]] and `checklists/final-regression-checklist.md` — specific to this change, not the generic checklist restated verbatim.

## Rollback Plan

How to undo this if it turns out wrong. If genuinely hard to roll back, this should already have triggered explicit confirmation above.

## Out of Scope (explicitly)

Related things this plan deliberately does not address, so scope creep doesn't happen silently during implementation.
