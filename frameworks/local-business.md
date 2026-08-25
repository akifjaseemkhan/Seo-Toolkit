# Site-Type Guide: Local Business

Pairs with `workflows/local-seo.md`. Covers structural notes specific to single-location and multi-location local/service businesses.

## Typical site structures

- **Single location**: usually a small site (home, services, about, contact) — most of the SEO leverage is in getting NAP, LocalBusiness schema, and on-page local relevance signals right on a small number of pages, rather than a large technical/architecture project.
- **Multi-location**: a location-page pattern (often `/locations/[city]` or similar), each needing genuinely distinct real content per `workflows/local-seo.md` and the `workflows/programmatic-seo.md` evaluation if the pattern is templated.
- **Service-area business without a public storefront address** (e.g., plumbers, contractors): address may be deliberately withheld from public schema/pages for privacy/safety even though a service area is claimed — confirm with the user rather than assuming a full address should be published; LocalBusiness schema supports service-area businesses without requiring a public street address.

## Stack considerations

Local business sites are commonly built on WordPress (see `frameworks/wordpress.md`), a website builder/CMS, or simple static HTML (see `frameworks/static-html.md`) — apply the matching stack guide for the technical implementation layer, and this guide plus `workflows/local-seo.md` for the local-SEO substance.

## Data sourcing is the hard constraint here, not code

Unlike most other site-type work, the primary blocker for local SEO tasks is almost never technical — it's that real business data (exact NAP formatting the business wants used everywhere, real service areas, real hours, whether an address should be public) must come from the user or already exist correctly in the project. See [[../rules/no-fabrication]]. Don't let a local SEO task stall on guessing — ask directly for exactly what's missing.

## Google Business Profile

Site changes and Google Business Profile are related but separate — this skill can advise on Business Profile completeness/accuracy relative to what's on-site (e.g., "your site lists a different phone number than what you've described for your Business Profile") but cannot manage the profile itself. Flag as external per `workflows/local-seo.md`.

## Never

Never invent or "reasonably guess" an address, phone number, or hours to fill a schema field. Never expand claimed service areas beyond what the business actually confirms it serves, even if it would target more geo-keywords.
