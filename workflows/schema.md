# Workflow: Structured Data (Schema.org)

**Purpose:** Audit and implement JSON-LD structured data that accurately reflects real page content.

**Modifies files:** Yes, under [[../rules/implementation-safety]] and strictly bound by [[../rules/schema-rules]] and [[../rules/no-fabrication]].

## Audit procedure

1. Inventory existing structured data across templates (search for `application/ld+json`). Note what types are already used, where, and whether they validate.
2. For each existing block, verify every property still matches current visible page content — schema goes stale when content changes but the block doesn't (e.g., price updates but schema doesn't, or an event schema stays live after the event passed).
3. Identify templates with no structured data where a type would genuinely apply (see the type list in [[../rules/schema-rules]]) and where the required real data exists to populate it accurately.

## Implementation procedure

1. Determine correct schema type from actual page content/purpose — don't default to a generic type; use the most specific one that fits.
2. Determine the data source for each property: rendered page content, CMS field, product data, or existing config. Every property must trace to something real — see [[../rules/no-fabrication]]. If a property's real value isn't available, omit the property.
3. Write JSON-LD matching existing project convention (or, if none exists, the framework's standard metadata/head mechanism — see `frameworks/*.md`).
4. Special caution items:
   - **Review/AggregateRating**: implement only with real, collected review data connected to an actual data source (a reviews table, a CMS field populated by real submissions) — never a static/placeholder value. Zero tolerance per [[../rules/no-fabrication]].
   - **Article/BlogPosting dates**: pull from real authoring metadata (CMS field, frontmatter, git history) — never today's date as a stand-in.
   - **Product/Offer**: bind directly to the same data source driving the displayed price/availability so they can't drift out of sync.
   - **LocalBusiness**: bind to real, user-confirmed NAP data — see `workflows/local-seo.md`.
5. Validate JSON syntax programmatically before considering the change complete.
6. Confirm rendered output (not just source) actually includes the block correctly interpolated, especially for dynamic/templated pages — check a live instance, not just the template code.

## What not to do

- Don't add schema types the page doesn't genuinely represent, purely to chase more SERP real estate.
- Don't leave stale schema in place after content changes underneath it — flag drift as a finding even outside a dedicated schema task.
- Don't remove existing schema without a specific technical reason (invalid, contradicts content, duplicated) — report the reason.

## Output

Findings/changes logged in `templates/schema-plan.md` for planning, and `templates/change-report.md` for implementation. Note in every schema report that live rich-result appearance can only be confirmed externally via Search Console / Rich Results Test — see [[../rules/verification-rules]].
