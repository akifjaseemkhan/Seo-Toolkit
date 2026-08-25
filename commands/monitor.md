# Command: /seo monitor

**Modifies files:** No, unless the user explicitly asks for an in-repo monitoring mechanism (e.g., a CI check) to be built, which is then its own scoped implementation under [[../rules/implementation-safety]].

## Purpose

Define or run a monitoring pass: what to check, at what cadence, and (if data is available) analyze real performance trends.

## Procedure

1. If this is a first-time setup: run `workflows/monitoring.md` to define what should be tracked for this specific project and at what cadence.
2. If real data (Search Console export, analytics data) is available: run `workflows/search-console.md`'s analysis procedures — pages ranking 8–30, high-impression/low-CTR pages, declining pages, query gaps — and connect findings to the relevant follow-up workflow (`workflows/on-page-seo.md`, `workflows/content-optimization.md`, `workflows/content-strategy.md`).
3. If checking status after a recent implementation: run `workflows/post-implementation.md`'s verification steps instead — that's the more specific workflow for immediately-after-a-change checks.

## Constraint

Never fabricate trend data or imply passive ongoing monitoring is happening between sessions — this skill only acts within an active session. State clearly what was checked now versus what the user should check going forward and when.

## Output

A monitoring checklist/cadence (first-time), or a data-grounded findings summary feeding into the appropriate follow-up workflow (ongoing).
