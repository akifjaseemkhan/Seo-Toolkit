# Framework Guide: WordPress

Read after `workflows/discovery.md` confirms WordPress (presence of `wp-config.php`, `wp-content/`, theme/plugin structure).

## First: identify what's already handling SEO

WordPress sites very frequently already run an SEO plugin (Yoast SEO, Rank Math, All in One SEO, or similar). **Check for one before recommending or building anything** — duplicating or conflicting with an active SEO plugin's output (double metadata, double schema, double sitemap) is a common, easily-avoidable mistake.

- If an SEO plugin is active: work within it. Recommend configuration changes and content-level fixes through the plugin's existing mechanisms (its meta title/description fields, its schema settings) rather than hand-coding a parallel system in `functions.php` or a theme file.
- If no SEO plugin is active: hand-coded fixes in the active theme (`functions.php`, template files) are reasonable, but note to the user that a well-maintained plugin often covers this ground more robustly and with less custom-code maintenance burden — a recommendation, not something to install unprompted (installing a plugin is a dependency change; confirm first).

## Theme vs. plugin vs. core

- **Never edit WordPress core files.** Any legitimate fix belongs in the active theme (prefer a child theme if the site uses one, to survive parent-theme updates) or a plugin.
- Check whether the active theme is a child theme before editing theme files — editing a parent theme directly means changes are lost on the next theme update.
- Custom fixes should go in the child theme (or a small site-specific plugin) so they survive updates to the parent theme or any SEO plugin.

## Content editing

- Content lives in the database (posts/pages via wp-admin), not in flat files — content-level SEO fixes (titles, descriptions, body content) are typically made through wp-admin or the plugin's meta box, not by editing a template file, unless the fix is structural/template-wide.
- If working with exported content or a headless WordPress setup (WP as a CMS behind a separate frontend), confirm which side (WP admin/API vs. frontend framework) actually owns metadata rendering before making changes — apply the frontend's own framework guide for that half.

## Structured data

- If an SEO plugin is active, it likely already generates Organization/WebSite/Article/Product schema — verify its output matches [[../rules/schema-rules]] rather than adding a duplicate block. Only hand-add schema for something the active plugin genuinely doesn't cover.

## Sitemap and robots

- Most SEO plugins generate `sitemap.xml` (or `sitemap_index.xml`) and offer robots.txt editing through their settings — prefer these over a separate hand-built file, since a hand-built one can silently conflict with the plugin's own output at the same path.

## E-commerce (WooCommerce)

If WooCommerce is present, cross-reference `workflows/ecommerce-seo.md` and `frameworks/ecommerce.md` — product/category schema is often handled by an SEO plugin's WooCommerce integration; check before duplicating.

## Never

Never edit WordPress core. Never install/activate a new plugin without explicit confirmation. Never hand-code a parallel metadata/schema/sitemap system alongside an already-active SEO plugin doing the same job.
