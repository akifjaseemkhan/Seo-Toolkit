# Workflows Reference

This document explains how the `workflows/` directory works as a system, and defines the prioritization framework shared across all of them. For the routing table (which workflow to use for a given request), see `SKILL.md`.

## Workflow anatomy

Every file in `workflows/` follows the same shape:

- **Purpose** — what it's for and when to use it.
- **Modifies files** — whether it's read-only (audit-style) or can make changes (implementation-style), and under what conditions.
- **Procedure** — the actual step-by-step method, cross-referencing relevant `rules/` and `checklists/`.
- **Output** — which `templates/` file(s) the workflow produces.

Workflows are designed to be composable: a real request usually touches several (e.g., "improve our product pages" spans `on-page-seo.md`, `schema.md`, `internal-linking.md`, and `ecommerce-seo.md`). Run every relevant one rather than picking a single "closest match."

## The prioritization framework

Every finding, across every workflow, gets scored on four axes:

- **Severity** — Critical / High / Medium / Low. How much this actively hurts the site right now (e.g., accidentally noindexed money pages = Critical; a slightly suboptimal meta description = Low).
- **Impact** — the expected SEO benefit if fixed. Grounded in real signal where available (Search Console data) or reasoned estimate where not — labeled accordingly.
- **Effort** — rough implementation cost. A one-line config fix is low effort; a template rewrite affecting hundreds of pages is high effort.
- **Risk** — per the reversibility test in [[../rules/zero-breakage]]: how bad is it if this change turns out wrong, and how hard is it to undo?

### How to combine them

There's no single formula that mechanically outranks every case — use judgment, but with a consistent bias:

1. **High Impact + Low Effort + Low Risk** always goes first. These are the "obviously do this" items and should never get buried under a long list of theoretical improvements.
2. **High Severity** items (even if higher effort) generally outrank cosmetic improvements, because they're actively suppressing performance right now.
3. **High Risk** items (hard to reverse, touch protected functionality, large blast radius) get pulled out of the normal ranking entirely and routed to "Requires Explicit Decision" rather than silently ranked and auto-implemented, regardless of how high their Impact score is — see [[../rules/implementation-safety]].
4. When two items are otherwise comparable, prefer the one with more real (vs. inferred) evidence behind its Impact estimate.

## Read-only vs. implementation workflows

Workflows marked "Modifies files: No" (most `discovery`, `keyword-research`, `search-intent`, `information-architecture` audit passes, `competitor-analysis`, `backlink-strategy`, `search-console`, `monitoring`, `reporting`) never edit the project regardless of how they're invoked. Workflows marked "Yes" only do so within the implementation discipline in [[../rules/implementation-safety]] — inspect, plan, risk-check, implement smallest-safe-version, verify, report.

## Extending this system

If a genuinely new, recurring SEO domain emerges that doesn't fit an existing workflow, add a new file following the anatomy above, add it to `SKILL.md`'s routing table, and add a corresponding checklist if the domain has enough discrete checkable items to warrant one. Don't duplicate content that already lives in a `rules/` file — link to it instead.
