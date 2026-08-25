# Workflow: Multilingual SEO

**Purpose:** Ensure correct technical and content handling for sites serving multiple languages (distinct from multi-country targeting — see `workflows/international-seo.md`; a site can be multilingual without being multi-country, or both).

**Modifies files:** Yes for technical fixes; content translation work requires explicit scoping since it's substantial effort and a quality/trust issue if done poorly.

**Only apply when discovery/user confirms multiple language versions are real and intended.**

## Audit procedure

Work through `checklists/international-seo-checklist.md` (shared with international SEO for the technical items):

1. **`<html lang="...">`** — correct per page/locale, not a single hardcoded value across all language versions.
2. **hreflang** — complete, reciprocal set per language variant (see `workflows/international-seo.md` for the full standard — the same rules apply).
3. **Language switcher** — must use real, crawlable links (`<a href>` to the actual translated URL), not a JS-only redirect with no real href, so search engines can discover the language variants by crawling.
4. **Content quality per language** — translated content must meet the same bar as source content: genuinely localized (not word-for-word machine translation left unreviewed), accurate, and in the site's actual voice adapted per-market. See [[../rules/content-quality]].
5. **Duplicate-language variants** — check for near-identical content across variants of the same language with no real reason for both to exist (e.g., en-US and en-GB that are 99% identical) — this creates unnecessary duplicate-content surface.

## Implementation notes

- Technical fixes (hreflang, html lang, switcher links) — implement directly once the correct variant set is confirmed, following [[../rules/canonical-rules]] to ensure hreflang and canonical agree.
- Translation work is substantial and quality-sensitive. If asked to translate/localize content:
  - Preserve meaning and intent, not literal word-for-word translation.
  - Flag machine-generated translations explicitly as needing native-speaker review before publishing — don't present them as finished, reviewed copy.
  - Don't invent locale-specific claims (currency support, local contact info, local availability) that aren't real — see [[../rules/no-fabrication]].

## Constraints

- Never publish unreviewed machine translation silently — always flag it.
- Never assume a language variant should exist just because the framework/CMS supports i18n — verify with the user that the target market/language is real and intended.

## Output

Findings/fixes reported per standard templates. Any translation work explicitly labeled with its review status (machine-translated/unreviewed vs. human-reviewed).
