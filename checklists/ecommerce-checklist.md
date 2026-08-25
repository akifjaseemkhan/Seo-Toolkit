# E-commerce SEO Checklist

See `workflows/ecommerce-seo.md` and `frameworks/ecommerce.md`. Only apply to projects actually identified as e-commerce per `workflows/discovery.md`.

## Product pages
- [ ] Unique title/description per product (not manufacturer boilerplate copy-pasted verbatim across every retailer, if avoidable)
- [ ] Product schema present with accurate `price`, `priceCurrency`, `availability` matching displayed values exactly (see [[../rules/schema-rules]])
- [ ] Canonical set correctly for products reachable via multiple URLs (e.g., via multiple category paths)
- [ ] Out-of-stock/discontinued products handled deliberately (kept indexed with clear status, redirected to a real substitute, or intentionally removed — not left as a silent dead end)

## Category pages
- [ ] Category pages have real, unique descriptive content (not just a product grid with no on-page text signal)
- [ ] Canonical strategy defined for sorted/filtered views of the same category (see [[../rules/canonical-rules]])
- [ ] Pagination handled correctly across category listing pages

## Faceted navigation / filters
- [ ] Filter-generated URLs don't create unbounded duplicate-content combinations
- [ ] Indexing strategy for filter URLs is deliberate (canonical to unfiltered version, or `noindex`, or selectively indexed high-demand combinations only) — not left to crawl accidentally
- [ ] Crawl budget impact of faceted URLs considered for larger catalogs

## Variants
- [ ] Color/size/style variants handled consistently (separate indexable pages vs. one canonical page with variant selector) per a deliberate, documented strategy

## Structured data
- [ ] `BreadcrumbList` present reflecting real category hierarchy
- [ ] `AggregateRating`/`Review` only present with real collected review data (see [[../rules/no-fabrication]])

## Internal linking
- [ ] Cross-sell/related-product links are genuinely relevant, not forced for link volume
- [ ] Category → product → related-product paths keep crawl depth reasonable

## Content quality
- [ ] No thin/duplicate product pages for near-identical SKUs without real differentiation (see [[../rules/content-quality]])

## Output
- [ ] Findings scored per the standard framework; e-commerce catalogs at scale should have template-level fixes prioritized over one-off product edits
