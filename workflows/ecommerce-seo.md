# Workflow: E-commerce SEO

**Purpose:** Apply SEO practices specific to online stores — product pages, category pages, faceted navigation, and catalog-scale concerns.

**Modifies files:** Yes, under [[../rules/implementation-safety]]. See `frameworks/ecommerce.md` for platform-specific notes (e.g., Shopify, WooCommerce, custom catalogs).

**Only apply when discovery confirms this is an e-commerce site.**

## Audit procedure

Work through `checklists/ecommerce-checklist.md`:

1. **Product pages** — unique titles/descriptions per product (flag manufacturer-boilerplate duplication where avoidable), Product schema bound to real price/availability data, canonical set correctly when a product is reachable via multiple category paths.
2. **Category pages** — real, unique descriptive content beyond the product grid; deliberate canonical/pagination strategy for sorted/filtered views.
3. **Faceted navigation** — identify unbounded filter-combination URL generation; confirm a deliberate indexing strategy exists (canonical to base category, `noindex` on low-value combinations, or selective indexing of genuinely high-demand filter combos).
4. **Variants** — confirm a consistent, deliberate strategy for color/size/style variants (separate pages vs. single page with selector).
5. **Out-of-stock/discontinued handling** — confirm a deliberate policy: keep indexed with clear status and suggest alternatives, redirect to a genuine substitute, or intentionally remove — never a silent dead page.

## Implementation notes

- Template-level fixes (Product schema binding, category description slots, canonical logic) should be prioritized over one-off product edits — the catalog scale means template fixes have outsized leverage.
- Faceted-navigation indexing decisions are high-risk at catalog scale (can affect thousands of URLs and crawl budget) — confirm scope and strategy with the user before implementing broadly, per [[../rules/implementation-safety]].
- Never fabricate `AggregateRating`/`Review` — see [[../rules/no-fabrication]] and [[../rules/schema-rules]]. This is especially tempting and especially risky in e-commerce.
- Cross-sell/related-product internal links must be genuinely relevant (`workflows/internal-linking.md`), not volume-maximized.

## Common high-leverage fixes

- Binding Product schema price/availability to the live data source instead of a stale/manual value.
- Fixing category pages that have zero unique content beyond the grid (a frequent thin-content flag).
- Establishing a deliberate faceted-navigation indexing policy where none currently exists (often the single highest-impact e-commerce technical fix on larger catalogs).

## Output

Findings/fixes reported per standard templates, explicitly noting catalog-scale impact (how many pages/products a template-level fix affects).
