# Workflow: International SEO

**Purpose:** Ensure correct targeting and technical setup for sites serving multiple countries/regions (distinct from multilingual — see `workflows/multilingual-seo.md` for the language-specific counterpart; many sites need both together).

**Modifies files:** Yes for hreflang/technical fixes; URL-strategy changes require explicit confirmation per [[../rules/implementation-safety]] and [[../rules/architecture-preservation]].

**Only apply when discovery/user confirms multi-country targeting is real and intended.**

## Audit procedure

Work through `checklists/international-seo-checklist.md`:

1. **Identify current URL strategy** — ccTLD (`.de`, `.fr`), subdomain (`de.example.com`), subdirectory (`example.com/de/`), or parameter-based. This is a foundational, hard-to-reverse decision — never propose changing it casually; if it's genuinely wrong, that's a major project requiring explicit scoping, not a quick fix.
2. **hreflang completeness** — every regional/language variant must reference every other variant, including itself, reciprocally. A one-directional or incomplete hreflang set is worse than none in some cases (partial signal confusion).
3. **hreflang/canonical agreement** — hreflang must not point to a URL that a canonical tag then redirects away from; they must tell a consistent story. See [[../rules/canonical-rules]].
4. **Region-specific content accuracy** — currency, units, shipping/service availability claims must be accurate per region, not copy-pasted from a default market.
5. **Search Console international targeting** — if the site uses a setup that supports Search Console country targeting, confirm it's configured correctly; this is an external/user action to flag, not something this skill sets directly. See `workflows/search-console.md`.

## Implementation notes

- hreflang fixes (adding missing tags, fixing incorrect codes, fixing non-reciprocal sets) are usually template-level and moderate-risk — implement once the correct full variant set is confirmed.
- URL-strategy changes are high-risk, hard to reverse, and require a redirect plan — treat as a distinct, explicitly-scoped project (`templates/implementation-plan.md`), never a quick fix folded into an audit response.
- ISO language/region codes must be correct (`en-US` not `en_US`, `en-GB` not `en-UK`).

## Constraints

- Never invent a market presence, local entity, or local currency/shipping capability that doesn't actually exist — see [[../rules/no-fabrication]].
- Never auto-translate content and present it as reviewed/native without flagging it as machine-translated to the user (see `workflows/multilingual-seo.md`).

## Output

Findings/fixes reported per standard templates; structural URL-strategy issues escalated separately with an explicit "requires a dedicated project" flag rather than folded into routine findings.
