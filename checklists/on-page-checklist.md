# On-Page SEO Checklist

See `workflows/on-page-seo.md`. Run per representative page/template, not every single URL individually.

## Title tags
- [ ] Every indexable page has a unique `<title>`
- [ ] Titles reflect actual page content and primary search intent
- [ ] Titles are reasonably concise (avoid truncation in typical SERP display)
- [ ] Primary keyword/topic present near the front where it reads naturally
- [ ] No keyword stuffing or duplicated brand name repetition

## Meta descriptions
- [ ] Every indexable page has a unique meta description
- [ ] Descriptions accurately summarize the page and encourage a click without being clickbait
- [ ] Length reasonable for typical SERP display
- [ ] No keyword stuffing

## Headings
- [ ] Exactly one `<h1>` per page, matching the page's actual topic
- [ ] Heading hierarchy is logical (no skipped levels used purely for styling, e.g., h2 straight to h4)
- [ ] Headings use existing semantic/styling conventions from the codebase (see [[../rules/ui-preservation]])
- [ ] Headings aid scanability and reflect real content sections, not keyword lists

## Content signals
- [ ] Primary topic/entity clearly established early in the content
- [ ] Content matches the dominant search intent for its target query (see `workflows/search-intent.md`)
- [ ] No thin content on pages meant to rank for competitive terms
- [ ] No duplicate/near-duplicate content across pages targeting different intents (cannibalization — see `workflows/keyword-research.md`)
- [ ] Content passes the quality bar in [[../rules/content-quality]]

## URLs
- [ ] URL reflects the page's topic in readable form
- [ ] Consistent with site-wide URL conventions (see `checklists/technical-checklist.md`)

## Images
- [ ] Meaningful images have accurate, non-keyword-stuffed alt text
- [ ] Purely decorative images have empty alt (`alt=""`), not stuffed alt
- [ ] See `workflows/image-seo.md` and `checklists/performance-checklist.md` for format/sizing

## Internal links
- [ ] Body content links to relevant related pages using descriptive (not "click here") anchor text
- [ ] No orphaned important pages (see `workflows/internal-linking.md`)

## Open Graph / social metadata
- [ ] `og:title`, `og:description`, `og:image`, `og:url`, `og:type` present and accurate
- [ ] Twitter/X card metadata present (`twitter:card` at minimum; title/description/image as applicable)
- [ ] OG image exists, loads, and is an appropriate size/aspect ratio for link previews

## Output
- [ ] Findings scored and logged per `templates/seo-audit-report.md`; template-level issues flagged once, not once per page instance
