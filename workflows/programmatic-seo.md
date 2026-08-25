# Workflow: Programmatic SEO Evaluation

**Purpose:** Rigorously evaluate whether a proposed large-scale, templated page pattern (e.g., one page per city × service, per integration, per comparison pair) is legitimate before any implementation — and refuse or scope down the ones that aren't.

**Modifies files:** No, until the evaluation passes and a scoped plan is confirmed.

## Why this gets its own workflow

Programmatic SEO is one of the highest-risk, highest-blast-radius categories of SEO work. Done well, it's a legitimate way to serve genuine long-tail demand with real, differentiated data. Done poorly, it's exactly the doorway-page pattern search engines actively demote — and because it's programmatic, the mistake ships at scale instantly. This workflow exists to slow that decision down.

## Mandatory evaluation, before any implementation

Answer every question honestly. If more than one or two land on the risky side, do not implement — report the concern instead per [[../rules/no-black-hat]].

1. **Real data per page** — does each generated page have genuinely distinct, real underlying data (real pricing per location, real inventory per category, real integration details), or is the only thing changing a template variable name with otherwise identical boilerplate around it?
2. **Search demand per variant** — is there real search demand for enough of these individual variants to justify the pattern, or does demand only exist for the head term while the long-tail combinations are speculative?
3. **User value per page** — if a real searcher landed on one specific generated page, would they get something genuinely useful and specific to that page, or would they feel like they hit a template with their search term swapped in?
4. **Uniqueness threshold** — after removing the templated boilerplate, how much genuinely unique content remains per page? A handful of unique data points wrapped in three paragraphs of identical filler prose fails this test even if the data points are real.
5. **Maintenance reality** — can the real data behind these pages actually be kept accurate at this scale, or will it silently go stale (e.g., "in stock" claims, pricing, availability)?
6. **Indexing risk at scale** — could this pattern, if it under-delivers on the above, cause search engines to view the site's overall quality lower (site-wide demotion risk), not just fail to rank the new pages?

## If it passes evaluation

- Start with a small pilot batch, not the full scale, to validate real-world performance and maintenance burden before generating the complete set.
- Ensure the underlying data pipeline is real and the template code pulls from it correctly — verify a sample of generated pages manually against source data.
- Apply the full `checklists/content-checklist.md` "Scale checks" section.
- Canonical/indexing strategy for the full set must be deliberate, not default (see [[../rules/canonical-rules]] and [[../rules/indexing-rules]]) — decide up front whether every variant should be indexed, or only ones meeting a demand/data-completeness threshold.
- Plan and confirm with the user before generating at full scale — this is exactly the kind of hard-to-reverse, large-blast-radius change [[../rules/implementation-safety]] requires escalation for.

## If it fails evaluation

Report clearly: what was proposed, which evaluation criteria it failed, and why implementing it as-is risks a doorway-page/thin-content problem. Offer a legitimate alternative if one exists (e.g., a smaller set of genuinely well-differentiated pages, or one strong page covering the topic instead of many thin ones) rather than just declining.

## Output

A pass/fail evaluation with reasoning, and — if passed — a scoped `templates/implementation-plan.md` starting with a pilot batch.
