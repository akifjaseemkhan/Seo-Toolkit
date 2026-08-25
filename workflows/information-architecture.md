# Workflow: Information Architecture

**Purpose:** Evaluate and improve how content is organized, categorized, and made reachable — the structural layer that internal linking, crawlability, and topical authority all depend on.

**Modifies files:** Audit phase no; structural changes are high-risk and almost always require explicit confirmation per [[../rules/implementation-safety]] before implementation.

## Why this matters for SEO specifically

Search engines use site structure as a relevance and importance signal: URL hierarchy, breadcrumb depth, and category groupings all communicate what a page is about and how important it is relative to its siblings. Poor IA also directly causes orphan pages, excessive crawl depth, and diluted topical authority.

## Audit procedure

1. **Map the current hierarchy** — home → top-level categories → subcategories → leaf pages. Use actual routes/URLs, not just the visible nav (structure can exist without being surfaced in navigation, and vice versa).
2. **Check hierarchy logic** — does the URL/category structure reflect genuine topical relationships, or is it flat/arbitrary (e.g., every page one level under home regardless of topic)?
3. **Check crawl depth** — how many clicks from home to the least-reachable important page? Depth beyond ~3-4 clicks for genuinely important content is a red flag (see `workflows/internal-linking.md`).
4. **Check for structural duplication** — the same content reachable through multiple, differently-structured paths (e.g., a product under two category trees with two different URLs) creates canonical/duplicate-content complexity (see [[../rules/canonical-rules]]).
5. **Check topical clustering** — for content-heavy sites, do related pieces of content link to and reinforce a clear pillar/hub structure, or are they scattered with no clear topical grouping?

## Recommending changes

- Small, additive fixes (adding a breadcrumb, adding a missing category link, reclassifying one orphaned page into an existing category) are low-risk — plan and implement directly.
- Structural changes (introducing new top-level categories, changing URL hierarchy, splitting or merging sections) are high-risk: they affect URLs at scale, require redirect planning, and touch navigation UI. Always plan (`templates/implementation-plan.md`), get explicit confirmation, and implement incrementally with redirects handled per [[../rules/canonical-rules]] and `workflows/technical-seo.md`.
- Never restructure IA as a side effect of an unrelated fix. If restructuring is genuinely warranted, it's its own scoped project.

## Constraints

- New or adjusted navigation UI must use the existing design system — see [[../rules/ui-preservation]].
- URL structure changes require a redirect plan before implementation, not after — a structural change without redirects silently orphans every inbound link and prior ranking signal on the old URLs.

## Output

Findings feed `workflows/internal-linking.md` directly. Larger restructuring proposals go into `templates/implementation-plan.md` with an explicit risk section per [[../rules/implementation-safety]].
