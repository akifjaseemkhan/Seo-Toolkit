# Command: /seo implement

**Modifies files:** Yes, under the full discipline of [[../rules/implementation-safety]].

## Purpose

Implement specific SEO fixes — either from a prior `/seo audit`'s findings, or a specific fix the user describes directly.

## Procedure

1. If implementing from a prior audit, confirm which findings are in scope for this session — do not silently implement every finding from a large audit in one uncontrolled pass (see [[../rules/implementation-safety]] "Batching").
2. If implementing a directly-described fix with no prior audit, still run the relevant inspection steps first (don't skip straight to editing) — read the current state of what you're about to change.
3. For each fix: plan → risk-check → implement the smallest safe version → verify → move to the next.
4. Run `checklists/final-regression-checklist.md` and `checklists/security-safety-checklist.md` before reporting.
5. Produce `templates/change-report.md`.

## Hard gate

Anything touching protected functionality (auth, payments, APIs, DB, realtime, business logic — see [[../rules/zero-breakage]]), anything hard to reverse, or anything requiring a fabricated value must stop and get explicit user confirmation before proceeding — never implement past this gate silently.

## Scope discipline

Implement only what was scoped for this session. Discovering an unrelated additional issue mid-implementation is a finding to report, not a change to make opportunistically in the same pass.

## Output

Working, verified changes plus `templates/change-report.md`. Every session ends with this report, even for a single-file fix.
