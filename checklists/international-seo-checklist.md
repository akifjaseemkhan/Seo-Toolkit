# International & Multilingual SEO Checklist

See `workflows/international-seo.md` and `workflows/multilingual-seo.md`. Only apply where the project genuinely targets multiple countries/languages.

## Structure strategy
- [ ] URL strategy identified/confirmed (ccTLD, subdomain, subdirectory, or parameter-based) — do not change this without explicit confirmation, it's a high-effort, hard-to-reverse decision (see [[../rules/architecture-preservation]])
- [ ] Strategy is consistent across the whole site, not mixed ad hoc

## hreflang
- [ ] Every language/region variant has a complete, reciprocal hreflang set (every page links to every variant, including itself)
- [ ] hreflang values use correct ISO language/region codes
- [ ] `x-default` set where there's a genuine language/region-neutral fallback
- [ ] hreflang and canonical don't contradict each other (see [[../rules/canonical-rules]])

## Content
- [ ] Localized content is genuinely translated/adapted for the market, not machine-translated boilerplate with no review (quality bar per [[../rules/content-quality]])
- [ ] Currency, units, and locale-specific details (date formats, phone formats) correct per target market
- [ ] No duplicate content across language variants targeting the same language (e.g., en-US and en-GB with identical untranslated text and no reason for both to exist)

## Technical
- [ ] `<html lang="...">` correct per page/variant
- [ ] Language/region switcher (if present) uses real crawlable links, not JS-only redirects with no href
- [ ] Sitemap includes all variants with correct hreflang annotations if using sitemap-based hreflang

## Geo-targeting
- [ ] Search Console international targeting settings flagged as an external configuration step if relevant (see `workflows/search-console.md`) — not something this skill can set directly

## Never
- [ ] Never auto-translate and publish content without flagging it as machine-translated/unreviewed to the user
- [ ] Never invent a market presence (legal entity, local address, local currency support) that doesn't actually exist (see [[../rules/no-fabrication]])

## Output
- [ ] Findings logged; structural hreflang/URL-strategy issues escalated for explicit confirmation before any site-wide fix
