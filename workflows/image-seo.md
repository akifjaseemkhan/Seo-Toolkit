# Workflow: Image SEO

**Purpose:** Ensure images are discoverable, accessible, and performant, without turning alt text into a keyword-stuffing surface.

**Modifies files:** Yes — low-risk, additive changes under [[../rules/implementation-safety]].

## Audit procedure

1. **Alt text presence and quality** — meaningful/content images should have accurate, descriptive alt text; purely decorative images should have empty `alt=""` (not omitted, not keyword-stuffed). Check a representative sample across templates.
2. **Filenames** — descriptive filenames (`red-leather-sofa.jpg`) are a minor positive signal over generic ones (`IMG_2837.jpg`); worth fixing prospectively for new uploads, rarely worth a bulk rename of existing production assets (which can break references/caching) unless specifically requested.
3. **Sizing and format** — cross-reference `checklists/performance-checklist.md`; appropriately sized, modern-format images with explicit dimensions.
4. **Image sitemaps** — for image-heavy/visually-driven sites (e-commerce, portfolios), consider whether an image sitemap adds discovery value; not necessary for most sites.
5. **Captions and surrounding context** — search engines use surrounding text/captions as relevance signals for images; check that important images aren't dropped into content with zero contextual text nearby.

## Writing good alt text

- Describe what's actually in the image, specifically enough to be useful to a screen-reader user who can't see it — this is fundamentally an accessibility requirement that SEO benefits from, not the other way around.
- Don't describe the image generically ("image," "photo") and don't keyword-stuff ("red sofa living room furniture couch sale cheap red sofa").
- Keep it concise — a sentence, not a paragraph.
- For purely decorative images (spacers, background flourishes with no informational content), use `alt=""` so screen readers skip them — this is correct practice, not a thing to "fix" by adding text.
- For functional images (an icon that's also a button/link), describe the function, not the icon's appearance.

## Implementation

- Fix at the template/component level where alt text is generated dynamically from data (e.g., product images) — bind to real, descriptive source data (product name/description) rather than a generic fallback.
- For manually-authored content (blog posts, CMS entries), fix per-instance where missing, using real image content as the source of truth.
- Never fabricate descriptive detail not actually visible in the image just to make alt text longer.

## Output

Findings/fixes reported per standard templates.
