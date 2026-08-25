# Structured Data Plan — Template

Output of `workflows/schema.md`. Every property listed must trace to a real, verifiable data source per [[../rules/no-fabrication]] and [[../rules/schema-rules]].

---

## Existing Schema Inventory

| Template / page | Type(s) present | Valid? | Matches current visible content? | Notes |
|---|---|---|---|---|

## Proposed Additions

### [Template / page name]

- **Schema type:** (most specific applicable type — see [[../rules/schema-rules]])
- **Properties and data sources:**

| Property | Value source | Verified real? |
|---|---|---|
| | (rendered content / CMS field / product data source / config) | Yes — omit if not |

- **Properties intentionally omitted (no real data available):**
- **Special caution items applicable:** (Review/AggregateRating — real data confirmed? / dates — real source confirmed? / price-availability — bound to live data source?)

Repeat per template.

## Stale Schema Found (existing schema no longer matching content)

| Template / page | Issue | Fix |
|---|---|---|

## Validation Plan

- [ ] JSON-LD syntax validated
- [ ] Rendered output inspected (not just source template)
- [ ] User informed to run Google Rich Results Test / Search Console Enhancements post-deploy (external verification — see [[../rules/verification-rules]])
