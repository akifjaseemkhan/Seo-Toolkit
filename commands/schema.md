# Command: /seo schema

**Modifies files:** Yes, under [[../rules/implementation-safety]] and strictly bound by [[../rules/schema-rules]] and [[../rules/no-fabrication]].

## Purpose

Audit and implement Schema.org / JSON-LD structured data.

## Procedure

1. Run `workflows/schema.md` in full: inventory existing schema, verify it still matches current content, identify legitimate gaps.
2. For each proposed addition, confirm real data sources for every property per `templates/schema-plan.md` — omit any property without a verifiable real value.
3. Implement using the framework's standard metadata mechanism (see the matching `frameworks/*.md`), matching existing JSON-LD conventions if present.
4. Validate JSON syntax and inspect actual rendered output (not just template source).
5. Apply `checklists/schema-checklist.md` in full before reporting complete.

## Hard constraints

- Zero tolerance for fabricated `Review`/`AggregateRating` data — see [[../rules/no-fabrication]].
- Every property must trace to real, verifiable content or data.
- Never add schema types the page doesn't genuinely represent purely to target more SERP features.

## Output

`templates/schema-plan.md` for planning, `templates/change-report.md` for implementation — explicitly noting that live rich-result appearance requires external verification (Google Rich Results Test, Search Console Enhancements) per [[../rules/verification-rules]].
