# Rule: Content Quality Standard

**Status:** Applies to all content recommendations and content implementation.

## The bar

Content exists to serve a real searcher's intent first. Any ranking benefit is downstream of that, not a separate goal to chase in parallel. Before recommending or writing any content, it must clear all of the following:

1. **Genuine search demand** — there is real evidence people search for this (keyword research signal, Search Console query data, or clearly reasoned user need), not just a template variable that happens to be fillable.
2. **Distinct user value** — the page answers something existing pages on the site don't already answer as well, and does so better than what's currently ranking, not just "differently worded."
3. **Information gain** — it adds something (specificity, data, a clearer explanation, a missing angle) rather than restating what competitors already say.
4. **Honesty** — no invented expertise, credentials, statistics, or authority signals (see [[no-fabrication]]).
5. **Maintainability** — someone can plausibly keep this accurate over time; it isn't a one-off page that will silently go stale (pricing, availability, dated facts).

## Explicitly rejected patterns

- Writing a page because a keyword tool surfaced a keyword, without checking whether the page would offer anything real.
- Padding word count to look comprehensive.
- Restating the H1 in slightly different words as the intro paragraph, filler style.
- Mass-producing near-identical pages from a template with only the noun swapped and no meaningfully distinct content (see `workflows/programmatic-seo.md` for the specific threshold and evaluation).
- Duplicate or near-duplicate content across pages targeting different keywords for the same intent — this causes cannibalization, not incremental traffic. See `workflows/keyword-research.md` on cannibalization.

## Search intent match

Content type must match the dominant intent of the target query (informational, commercial, transactional, navigational — see `workflows/search-intent.md`). A product page trying to rank for an informational "how does X work" query, or a blog post trying to rank for a clear transactional "buy X" query, is a content-type mismatch and won't perform regardless of on-page quality.

## Voice and tone

Match the existing site's voice. Do not impose a generic "SEO content" tone (listicle headers, forced FAQ sections, keyword-first sentence construction) onto a site with an established editorial or brand voice. If no existing voice can be inferred, ask rather than defaulting to generic marketing copy.

## E-E-A-T as a practical lens, not a checklist to game

Experience, Expertise, Authoritativeness, Trust are outcomes of real editorial practice (real author, real sourcing, real accuracy), not fields to populate. Do not add an "About the Author" box with a fabricated bio to simulate expertise — see [[no-fabrication]]. If genuine author/expertise information exists, surfacing it is a legitimate, encouraged recommendation.

## Related

[[no-black-hat]] governs technique; this rule governs substance. `workflows/content-strategy.md` and `workflows/content-optimization.md` apply this standard operationally.
