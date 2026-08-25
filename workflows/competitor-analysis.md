# Workflow: Competitor Analysis

**Purpose:** Understand what's working for competitors to inform this site's strategy — without ever recommending blind copying.

**Modifies files:** No. Research/strategy workflow feeding `workflows/content-strategy.md`, `workflows/keyword-research.md`, `workflows/information-architecture.md`.

## Identifying competitors

Use competitors the user names, or infer from the site's actual category/offering — not a generic industry list. Distinguish direct competitors (same product/service, same audience) from SERP competitors (whoever currently ranks for target terms, which may include publishers/aggregators the site isn't directly competing with commercially but is competing with for that specific query).

## What to analyze

1. **Content gaps** — topics/queries competitors cover that this site doesn't, evaluated against real demand (`workflows/keyword-research.md`), not just "they have it so we should too."
2. **Information architecture patterns** — how competitors structure categories/navigation, useful as a reference point, not a template to clone.
3. **On-page patterns** — title/description conventions, content depth/structure on comparable pages — useful for calibrating what "competitive" looks like for a given query.
4. **Structured data usage** — what schema types competitors use that might reveal a SERP-feature opportunity this site is missing.
5. **Backlink profile characteristics** (if data is available/provided) — what kinds of sites/content earn them links, informing `workflows/backlink-strategy.md` opportunity ideas.
6. **UX patterns relevant to SEO** — internal linking density, breadcrumb usage, content formatting choices that seem to correlate with strong rankings.

## Explicit constraint: no copying

Findings inform strategy; they don't get implemented verbatim. Never:

- Copy competitor content or content structure closely enough to create duplication/plagiarism risk.
- Recommend matching competitor claims (certifications, customer counts, guarantees) without verifying this site can honestly make the same claim — see [[../rules/no-fabrication]].
- Assume a competitor's approach is correct just because they rank — correlation isn't causation; note when a pattern looks more like brand/authority advantage than a replicable tactic.

## Data sourcing

Like `workflows/keyword-research.md`, this skill doesn't have built-in access to live competitive-intelligence tools unless the user provides data or a connected tool is available. Work from what's directly observable (competitors' actual public pages, their visible structured data, their visible content) plus any data the user supplies, and be explicit about which is which.

## Output

A prioritized set of gap-driven opportunities and structural observations, feeding directly into `templates/content-roadmap.md`, `templates/keyword-map.md`, and `workflows/information-architecture.md` recommendations — captured in `templates/competitor-analysis.md`.
