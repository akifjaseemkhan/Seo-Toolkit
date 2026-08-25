# Rule: Canonical URL Discipline

**Status:** High caution. Canonical mistakes can deindex entire sections of a site.

## Why this is high-risk

A wrong canonical tells search engines "don't index this URL, index that other one instead." Applied incorrectly at scale (a templating bug, a wrong self-referencing default, a canonical pointing to the wrong domain), this can silently deindex large parts of a site with no visible symptom until traffic drops.

## Before touching canonical logic

Inspect and confirm, in this order:

1. **Existing canonical implementation** — is there one already? What does it currently do? Do not assume none exists.
2. **Preferred domain** — www vs. non-www, http vs. https. Determine this from actual deployment/redirect configuration (hosting config, DNS, existing redirect rules), not by guessing. If it cannot be determined with confidence, report it as a question rather than picking one.
3. **Trailing slash behavior** — check the framework/server's actual default and existing URLs in the sitemap or routes. Inconsistency here creates unintentional duplicate-URL signals.
4. **Query parameter handling** — does the project use tracking params, session IDs, or filter params that create URL variants of the same content? Canonical (and robots/indexing rules) need to account for these consistently.
5. **Pagination** — paginated series need a considered strategy (self-referencing canonical per page is current standard practice; canonicalizing all pages to page 1 is usually wrong and hides paginated content from indexing).
6. **Internationalization** — if hreflang is in use, canonical and hreflang must agree (see `workflows/international-seo.md`); a canonical that fights hreflang creates conflicting signals.

## Rules

- Canonical URLs must be **absolute**, not relative, and must use the confirmed preferred domain/protocol/trailing-slash form consistently.
- Self-referencing canonical is the correct default for unique, indexable pages.
- Cross-URL canonical (pointing page A at page B) is only correct when A and B are genuinely the same content/intent (e.g., a filtered/sorted variant pointing at its canonical unfiltered version). Never use canonical as a substitute for a real duplicate-content or thin-content fix.
- Never point canonical at a URL that itself 404s, redirects, or is noindexed — this creates a broken signal chain.
- Never guess the production domain. If it can't be verified from config, redirects, or the user, ask.

## Changes that require explicit confirmation before implementing

- Any canonical strategy change affecting more than a handful of URLs.
- Any change to the preferred domain/protocol.
- Any change to how paginated or faceted-navigation URLs are canonicalized.

Implement small, self-contained canonical fixes (a single page missing a self-referencing canonical, an obviously broken canonical URL) directly once verified. Escalate systemic/template-level canonical strategy changes — plan, confirm, then implement (see [[implementation-safety]]).

Related: [[indexing-rules]], `workflows/indexing.md`, `workflows/sitemap.md`.
