# Workflow: Local SEO

**Purpose:** Optimize for a physical/local-service business's discoverability in local search and maps results.

**Modifies files:** Yes, for on-site elements — under [[../rules/implementation-safety]] and strictly bound by [[../rules/no-fabrication]]. Off-site actions (Google Business Profile, citations) are reportable, not directly implementable by this skill.

**Only apply when discovery confirms this is a local/physical business. Ask the user for real business data before implementing anything requiring it — never infer or invent it.**

## Audit procedure

Work through `checklists/local-seo-checklist.md`:

1. **NAP consistency** — Name, Address, Phone must be identical (format included) everywhere they appear on-site: footer, contact page, LocalBusiness schema. Inconsistency (even a suite-number format difference) fragments local ranking signals.
2. **LocalBusiness schema** — correct subtype for the actual business, real address/phone/hours/geo only, no fabricated rating.
3. **Multi-location handling** — each location page must have genuinely distinct, real content (real address, real local details) — not a templated city-swap (see `workflows/programmatic-seo.md` if this is proposed at scale).
4. **Service-area accuracy** — claimed service areas must match reality; don't recommend expanding claimed coverage to target more geo-keywords without the business actually serving that area.
5. **On-page local signals** — genuine local content (real neighborhood/landmark references relevant to that specific location), not generic copy with the city name swapped in.

## Implementation

- Populate NAP and LocalBusiness schema only from data the user explicitly provides or that already exists correctly in the project — never invent an address, phone number, or hours. See [[../rules/no-fabrication]].
- If NAP data conflicts across pages, ask the user which is correct rather than picking one.
- Location page content must be written with real, specific local detail — if the user can't supply that, a thin location page is a `workflows/programmatic-seo.md` risk, not a safe default.

## Off-site / external (report, don't implement)

- Google Business Profile completeness and accuracy — flag issues found (e.g., site NAP doesn't match a GBP listing the user mentions) as an external action item.
- Citation consistency across directories (Yelp, industry directories) — flag as an external action item; never auto-submit to third-party directories.
- Review generation strategy — legitimate approaches only (asking real customers), never incentivized/fake reviews or review-gating that violates platform policies.

## Output

Findings/fixes reported per standard templates. Any missing required real-world data listed explicitly as a request to the user, not filled with placeholders.
