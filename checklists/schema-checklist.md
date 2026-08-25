# Structured Data Checklist

See `workflows/schema.md` and [[../rules/schema-rules]]. Never add schema that fails any item here.

## Before adding
- [ ] Existing structured data inventoried (don't duplicate or contradict what's already there)
- [ ] Correct schema type chosen for the page's actual primary entity (see [[../rules/schema-rules]] for the type list)
- [ ] Every property planned is verifiable from visible content or verified project data (see [[../rules/no-fabrication]])

## Implementation
- [ ] JSON-LD format used (`<script type="application/ld+json">`), matching existing project convention if one exists
- [ ] Injected via the framework's standard head/metadata mechanism, not a bespoke injection path
- [ ] Valid JSON (no trailing commas, correct escaping)
- [ ] Required properties for the chosen type present (`@context`, `@type`, and type-specific required fields)
- [ ] No placeholder/example values left in — every value real

## Type-specific checks
- [ ] **Article/BlogPosting**: real `datePublished`/`dateModified`, real `author`, matches visible byline/date
- [ ] **Product/Offer**: `price`/`priceCurrency`/`availability` match the actually displayed price and stock state exactly
- [ ] **Review/AggregateRating**: only present if real, collected reviews exist — zero tolerance for invented ratings (see [[../rules/no-fabrication]])
- [ ] **FAQPage**: Q&A pairs match visible, answerable content on the page exactly
- [ ] **LocalBusiness**: NAP data matches real, verified business information (see `workflows/local-seo.md`)
- [ ] **Event**: date is real and the schema is removed/updated once the event has passed
- [ ] **BreadcrumbList**: matches the real navigational hierarchy/URL structure

## Consistency
- [ ] Schema values match visible page content exactly (price, availability, title, author, date)
- [ ] No unrelated schema types stacked onto a page just to target more SERP features
- [ ] Multiple schema blocks (if used) don't contradict each other

## Post-implementation
- [ ] JSON-LD parses without error (validated programmatically)
- [ ] User informed to run Google Rich Results Test / Search Console Enhancements for live validation (external step — see [[../rules/verification-rules]])
- [ ] Reported: what schema was added/changed, on which pages/templates, and why
