# Workflow: Search Intent Analysis

**Purpose:** Determine what a searcher actually wants for a given query, so content type and page structure match it. Intent mismatch is one of the most common reasons a well-optimized page still doesn't rank.

**Modifies files:** No. Feeds `workflows/keyword-research.md`, `workflows/content-strategy.md`, `workflows/content-optimization.md`.

## The four intent categories

- **Informational** — the searcher wants to learn or understand something ("how does X work," "what is Y"). Best served by explainer content, guides, comparisons. Not typically a hard sell.
- **Navigational** — the searcher wants a specific known destination ("[brand] login," "[product] pricing page"). Best served by making that exact destination easy to find and fast to load — not by inserting marketing content in the way.
- **Commercial (investigation)** — the searcher is evaluating options before a decision ("best X for Y," "X vs Y," "X reviews"). Best served by comparison content, honest pros/cons, genuine differentiation — not thin listicle content that avoids real comparison.
- **Transactional** — the searcher is ready to act ("buy X," "X pricing," "sign up for X"). Best served by a direct, low-friction path to the action — product/pricing/signup pages, not a blog post.

## Determining intent for a real query

1. Read the query literally — modifiers like "how," "what," "best," "vs," "buy," "near me," "pricing" are strong signals.
2. If uncertain, check what's actually ranking for the term today (if accessible) — search engines' current results are the most direct evidence of what they've determined the intent to be, regardless of what intent seems "correct" in theory.
3. Consider that intent can be mixed or ambiguous — some queries have blended informational/commercial intent ("best CRM for small business" wants both education and comparison). Match content breadth to this rather than forcing a single lane.

## Applying intent to content decisions

- If existing content type doesn't match dominant intent (e.g., a product page trying to rank for a clearly informational "how does X work" query, or a thin blog post trying to rank for an obviously transactional "buy X near me" query), that's a structural mismatch — no amount of on-page polish fixes it. The fix is either a different page type or accepting the term isn't a good target for this page.
- New content recommendations (`workflows/content-strategy.md`) must specify intended intent and page type together, not just a topic.
- For clusters spanning multiple intents (e.g., "email marketing" broadly touches informational and commercial intent depending on the specific long-tail), separate pages per intent are usually correct rather than one page trying to serve all of them.

## Output

Intent classification feeds directly into `templates/keyword-map.md` and `templates/content-roadmap.md` — every entry in those templates should carry an explicit intent label, not just a topic.
