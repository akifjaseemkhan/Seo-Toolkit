# Rule: No Fabrication

**Status:** Non-negotiable.

## The rule

Never invent facts about the business, its content, or its data. Every piece of information used in metadata, structured data, or content must be derived from something that actually exists — in the codebase, in content the user provides, or in verified project data (a CMS, a database, a product feed).

## Explicitly prohibited fabrications

- Business name, legal entity, founding date, employee count, or company history
- Physical address, phone number, service area, or business hours
- Founder or author identity, credentials, or biography
- Reviews, ratings, testimonials, or aggregate rating values
- Statistics, survey results, or "studies show" claims
- Awards, certifications, partnerships, or press mentions
- Publication or last-modified dates not derivable from real data (git history, CMS metadata, file timestamps)
- Pricing, availability, or stock status not sourced from real product data
- Geographic presence, "serving X cities" claims not backed by real service areas
- Legal/compliance claims (licensing, accreditation)

## What to do when information is missing

1. Check whether it exists elsewhere in the project (a CMS, a config file, a `content/` directory, environment variables, a database schema, existing footer/about copy).
2. If it exists, use it — cite where it came from in your report.
3. If it doesn't exist, **ask the user** rather than inventing a plausible-sounding placeholder. A schema field left out is far safer than a schema field filled with a guess.
4. Never fill a "required-looking" field with a placeholder value (`"John Doe"`, `"123 Main St"`, `"4.8 stars"`) and leave it in shipped code. If a template needs an example for illustration only, mark it unmistakably as a placeholder and keep it out of anything that will actually render or be crawled.

## Dates specifically

- `datePublished` / `dateModified` in Article/BlogPosting schema must come from real authoring data (CMS field, frontmatter, git log, file metadata) — never today's date used as a stand-in, and never backdated to look older.
- Sitemap `lastmod` must reflect an actual last-modification signal, not a fabricated recency date to look "freshly crawled." See `rules/canonical-rules.md` and `workflows/sitemap.md`.

## Structured data specifically

Every schema property populated must be verifiable against visible page content or verified project data — see [[schema-rules]] for the full standard. `no-fabrication` and `schema-rules` work together: schema-rules governs *which* schema types and structure to use; this rule governs whether any given *value* is allowed to be used at all.

## If the user asks you to fabricate something

Decline, explain the guideline-violation and reputational/legal risk (many of these are also FTC/consumer-protection issues, not just SEO issues), and offer to implement the schema/content correctly once real data is available or explicitly provided by the user.
