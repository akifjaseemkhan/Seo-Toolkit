# Rule: Structured Data Standards

**Status:** Applies to all Schema.org / JSON-LD implementation.

## Core standard

Structured data must be a strict, accurate reflection of content already visible (or reliably derivable from verified data) on the page. It describes what's there — it doesn't add claims that aren't otherwise substantiated by the page.

## Requirements before adding any schema

1. **Format**: Use JSON-LD in a `<script type="application/ld+json">` block. Do not use microdata/RDFa unless the project already uses that pattern consistently — match existing convention if one exists.
2. **Placement**: Follow the framework's standard head/metadata injection mechanism (see `frameworks/*.md`). Don't hand-roll a new metadata injection path if the framework already has one.
3. **Every property must be verifiable**: if a property's value isn't visible on the page or backed by real project data, omit the property rather than inventing a value. See [[no-fabrication]].
4. **No orphaned or contradictory schema**: schema values must match visible content (price in schema must match displayed price, availability must match real stock state, etc.). Mismatches between schema and visible content violate guidelines and risk manual action.
5. **Don't over-mark**: not every page needs schema. Use the type that fits the page's actual primary entity — don't stack unrelated schema types onto a page to "cover more SERP features."

## Choosing the right type

Match schema type to actual page content:

- **Organization / WebSite** — site-wide, homepage. Include `sameAs` only for real, owned social/profile URLs.
- **WebPage / BreadcrumbList** — general pages with real navigational hierarchy.
- **Article / BlogPosting** — genuine authored content with a real `datePublished`/`dateModified` and real author.
- **Product / Offer** — real product with real price/currency/availability, sourced from the same data that drives the displayed price.
- **Review / AggregateRating** — only when real, collected reviews exist. Never a placeholder or estimated rating. This is one of the most heavily enforced areas of structured data policy — treat it as zero-tolerance.
- **FAQPage** — only when the Q&A content is genuinely visible and answerable on the page, not invented to gain the SERP feature. Note: FAQPage/HowTo rich result eligibility has narrowed significantly on Google over time — implement for genuine semantic value and accessibility, not purely for a rich-result assumption; verify current eligibility before promising a specific SERP feature outcome.
- **LocalBusiness** — only with real, verifiable NAP (name, address, phone) data. See `workflows/local-seo.md`.
- **SoftwareApplication** — for genuine software/app products, with real category, OS, and pricing data.
- **HowTo** — genuine step-by-step content matching visible steps.
- **Event** — only for real, scheduled events with a real date, and only kept live while accurate (stale/past Event schema left live is a guideline violation).
- **Person** — only for real, identifiable individuals who've consented to being represented (typically authors/team members with existing bios).

## Validation

After implementing, validate with Schema.org-compliant JSON parsing at minimum, and note in the report that the user should run Google's Rich Results Test / Search Console's Enhancement reports before relying on rich-result appearance — these are external verification steps this skill cannot execute directly.

## Never do these

- Never add Review/AggregateRating without real, collected review data.
- Never backfill `datePublished` with an invented date.
- Never mark up content that isn't actually present/visible on the rendered page (schema must reflect the page, not aspirational content).
- Never remove existing schema without a specific, reported technical reason (it's invalid, contradicts visible content, or duplicates another block).

See [[canonical-rules]] for the related discipline around canonical/URL identity, and `checklists/schema-checklist.md` for the implementation checklist.
