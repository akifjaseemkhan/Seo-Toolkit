# SEO Audit Report — Template

Use for `workflows/full-audit.md` and any read-only audit deliverable. Fill every section; remove none. If a section genuinely doesn't apply (e.g., no local SEO relevance), state that explicitly rather than deleting the section.

---

## Project Overview

- **Site type:** (e-commerce / SaaS / blog / local business / tool / marketplace / mixed)
- **Framework / stack:** (from `workflows/discovery.md`)
- **Rendering strategy:** (CSR / SSR / SSG / ISR / hybrid, per-route if mixed)
- **Approximate indexable page count:**
- **Audit scope:** (full site / specific section — state what was and wasn't covered)
- **Audit date:**

## Executive Summary

2–4 sentences: overall SEO health, the single biggest opportunity, and the single biggest risk. Written for someone who will only read this section.

## Internal SEO Scorecard

Reference `templates/seo-scorecard.md` — embed or link the completed scorecard here. Label clearly as an internal diagnostic heuristic, not an official score.

## Findings

Group by domain (Technical, On-Page, Content, Schema, Internal Linking, Performance, and any applicable site-type-specific section). Within each group, order by priority, not discovery order.

For each finding:

- **Finding:**
- **Evidence:** what was actually observed — a specific file/line, a rendered-output excerpt, a `tools/seo-tool` JSON field (e.g. `pages[3].canonical`, per `docs/tooling.md`'s schema), a checklist item that failed, or real external data (Search Console, etc.). A finding without evidence is a hunch, not a finding — don't include one you can't point to something concrete for.
- **Severity:** Critical / High / Medium / Low
- **Impact:** (expected SEO benefit if fixed — label whether this is grounded in real data or reasoned inference, per `workflows/keyword-research.md`'s data-source discipline)
- **Effort:** (rough implementation effort)
- **Risk category:** A / B / C / D per [[../rules/implementation-safety]]
- **Affected scope:** (single page / template affecting N pages / site-wide)
- **Recommendation:**
- **Implementation status:** Not yet implemented (audit-only) / Implemented this session — see `templates/change-report.md` / Requires explicit decision / Requires external configuration

## Prioritized Action Plan

A single ranked list pulling the highest Impact/Effort/Risk-adjusted findings to the top, independent of which domain they came from. This is what the user should actually do first.

## Requires Explicit Decision

Findings where the safe fix and the maximally-effective fix diverge, or where a change is high-risk/hard-to-reverse per [[../rules/implementation-safety]]. State the tradeoff plainly; do not recommend a default without flagging the risk.

## External Configuration Required

Anything needing DNS, hosting, CDN, Search Console, Google Business Profile, or other external-system action. Be precise about what to change and where.

## Out of Scope / Not Evaluated

State plainly what this audit did not cover, so absence isn't mistaken for a clean bill of health.

## Next Steps

Concrete, ordered. Reference the relevant `commands/*.md` or `workflows/*.md` for follow-up work.
