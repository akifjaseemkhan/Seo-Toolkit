# Site-Type Guide: E-commerce

Pairs with `workflows/ecommerce-seo.md` and `checklists/ecommerce-checklist.md`. This guide covers platform-specific technical notes; the workflow covers the SEO strategy itself.

## Platform identification matters

E-commerce SEO fixes differ significantly by platform — identify which is in use before implementing:

- **Shopify**: theme-based (Liquid templates), limited direct server access, metadata typically edited via theme `.liquid` files or the admin's SEO fields per product/collection. Check for an installed SEO app before hand-coding — same duplication risk as `frameworks/wordpress.md`. Canonical/sitemap/robots.txt are largely platform-managed with limited override; verify what Shopify controls automatically versus what's actually editable before proposing a fix.
- **WooCommerce**: see `frameworks/wordpress.md` — same plugin-first discipline applies, with WooCommerce-specific schema typically handled by the active SEO plugin's WooCommerce integration.
- **Custom-built catalog** (Next.js/React/etc. + a headless commerce backend or own database): apply the relevant `frameworks/*.md` stack guide for the frontend, with product/category data sourced from the real catalog/database — never hardcoded.
- **Other platforms** (BigCommerce, Magento, custom): identify the actual template/theming and metadata-override mechanism before implementing; don't assume a pattern from another platform transfers directly.

## Platform-managed vs. code-fixable

Hosted platforms (Shopify, BigCommerce) often control canonical tags, sitemap generation, and some robots behavior at the platform level with limited or app-mediated override. Before proposing a code fix, confirm it's actually achievable within the platform's constraints — if not, this is "External Configuration Required" (a platform setting or app) rather than a code change.

## Catalog scale considerations

E-commerce sites often have the largest page counts of any site type this skill will encounter. This raises the stakes on:

- Template-level fixes over one-off edits (see `workflows/ecommerce-seo.md`)
- Faceted-navigation indexing strategy (can generate effectively unbounded URLs — a deliberate policy is mandatory, not optional, at real catalog scale)
- Sitemap generation reliability at scale (must be derived from the live catalog, never hand-maintained at this size — see `workflows/sitemap.md`)
- Crawl budget awareness — very large catalogs can have search engines simply not crawl everything; prioritizing which pages most need crawl attention (via internal linking and sitemap structure) becomes a real, not theoretical, concern

## Data integrity

Product schema (`workflows/schema.md`) must bind to the same live data source as the displayed price/availability — never a separately-maintained or stale value. This is the most common e-commerce structured-data failure mode and a direct [[../rules/no-fabrication]] / [[../rules/schema-rules]] risk if not bound correctly.
