# Command: /seo full

**Modifies files:** Yes — this is the complete audit-through-implementation cycle, under full [[../rules/implementation-safety]] discipline throughout.

## Purpose

Run the complete loop end to end: discover, audit, prioritize, plan, implement the agreed scope, verify, and report. Use when the user wants the full engagement rather than a single domain.

## Procedure

1. `workflows/discovery.md`
2. `workflows/full-audit.md` → produces `templates/seo-audit-report.md` with `templates/seo-scorecard.md`
3. Present the prioritized findings to the user and confirm scope for implementation — **do not proceed to implementation without this checkpoint.** A full audit often surfaces more than should be implemented in one uncontrolled pass (see [[../rules/implementation-safety]] "Batching").
4. For the confirmed scope: `commands/implement.md` procedure, batch by batch, with the hard gate for protected-functionality/high-risk items applied per batch, not just once at the start.
5. `workflows/post-implementation.md` after implementation.
6. Final `templates/change-report.md` covering everything implemented, plus a carried-forward list of audit findings not yet implemented (for a future session).

## Explicit checkpoint requirement

Step 3's confirmation checkpoint is mandatory, not a formality — `/seo full` is the highest-blast-radius command in this skill precisely because it chains audit and implementation together. The pause between them is what keeps that safe.

## Output

`templates/seo-audit-report.md` followed by `templates/change-report.md`, plus a clear "Remaining SEO Opportunities" list carrying forward anything not implemented in this pass.
