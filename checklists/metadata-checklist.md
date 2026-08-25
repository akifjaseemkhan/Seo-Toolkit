# Metadata Checklist

Covers `<head>` metadata beyond title/description (those are in `checklists/on-page-checklist.md`). See `workflows/on-page-seo.md` and `workflows/technical-seo.md`.

## Required baseline
- [ ] `<html lang="...">` set correctly (and per-locale if multilingual — see `workflows/multilingual-seo.md`)
- [ ] `<meta charset="utf-8">` present
- [ ] `<meta name="viewport" content="width=device-width, initial-scale=1">` present
- [ ] Canonical `<link rel="canonical">` present and correct (see [[../rules/canonical-rules]])
- [ ] Favicon present and loading

## Open Graph
- [ ] `og:title` — accurate, page-specific
- [ ] `og:description` — accurate, page-specific
- [ ] `og:image` — resolves, correct aspect ratio (~1.91:1 typical), reasonable file size
- [ ] `og:url` — matches canonical
- [ ] `og:type` — matches content (`website`, `article`, `product`, etc.)
- [ ] `og:site_name` set site-wide

## Twitter/X
- [ ] `twitter:card` set (`summary_large_image` typical for content with images)
- [ ] `twitter:title` / `twitter:description` present (or correctly falling back to OG equivalents per platform behavior)
- [ ] `twitter:image` resolves

## Robots directives
- [ ] `<meta name="robots">` (or `X-Robots-Tag`) reflects actual intended indexing state — see `checklists/indexing-checklist.md`
- [ ] No conflicting robots directives between meta tag and HTTP header

## Alternate/hreflang (if applicable)
- [ ] `<link rel="alternate" hreflang="...">` present for each language/region variant
- [ ] Self-referencing hreflang included
- [ ] `x-default` set where appropriate
- [ ] hreflang set is reciprocal across all variant pages (see `workflows/international-seo.md`)

## Verification / ownership tags (only if legitimately needed)
- [ ] Search Console verification meta tag present only if the user has confirmed ownership setup — never add without being asked, since this can affect account access
- [ ] No stray/unused verification tags left from a prior, unrelated tool

## Consistency
- [ ] All values match what actually renders visually and functionally on the page (no metadata claiming something the page doesn't do)
- [ ] Verified in actual rendered HTML output (view-source or SSR output), not just source template — see [[../rules/verification-rules]]
