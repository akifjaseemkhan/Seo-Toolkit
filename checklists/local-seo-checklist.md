# Local SEO Checklist

See `workflows/local-seo.md`. Only apply where the project genuinely represents a physical/local-service business, confirmed via `workflows/discovery.md` or the user.

## NAP data
- [ ] Name, Address, Phone sourced from real, user-provided or already-in-project data — never invented (see [[../rules/no-fabrication]])
- [ ] NAP consistent across every page it appears on (footer, contact page, schema)
- [ ] NAP format consistent with what's used elsewhere (existing Google Business Profile, if the user shares it) to avoid signal fragmentation — flag mismatches for the user to reconcile rather than picking a version yourself

## LocalBusiness schema
- [ ] Correct subtype used if a more specific one applies (Restaurant, Dentist, LegalService, etc.) and matches the real business
- [ ] `address`, `telephone`, `openingHours`, `geo` only populated with real, verified data
- [ ] `priceRange` only included if genuinely representative
- [ ] No fabricated `aggregateRating` (see [[../rules/no-fabrication]] and [[../rules/schema-rules]])

## Location pages (multi-location businesses)
- [ ] Each location page has genuinely distinct content (real address, real local details, not a templated city-name swap with identical boilerplate — see `workflows/programmatic-seo.md`)
- [ ] Each location has its own accurate NAP and, if applicable, its own LocalBusiness schema instance
- [ ] No location pages created for areas the business doesn't actually serve

## Service-area content
- [ ] Service-area claims match real, confirmed service areas — never inflated to target more geo-keywords
- [ ] Local content (neighborhood references, local landmarks) is genuine, not generic filler with the city name swapped in

## Off-page (reportable, not directly implementable by this skill)
- [ ] Google Business Profile completeness/accuracy flagged as an external action item if issues are found (see `workflows/local-seo.md`)
- [ ] Citation consistency across major directories flagged as an external action item, not fabricated or auto-submitted

## Output
- [ ] Any missing real-world data (address, phone, hours) requested from the user explicitly rather than filled with a placeholder
