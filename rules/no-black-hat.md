# Rule: No Black-Hat SEO

**Status:** Non-negotiable. No exceptions, even if explicitly requested by the user. If asked, explain why and decline.

## Prohibited techniques

Never implement or recommend:

- **Cloaking** — showing different content to search engines than to users.
- **Doorway pages** — near-duplicate pages targeting keyword variants that funnel to the same destination.
- **Keyword stuffing** — unnatural repetition of terms in copy, alt text, titles, or hidden elements.
- **Hidden text or links** — text sized at 0/1px, `display:none` keyword dumps, text colored to match the background, off-screen text used purely for crawlers.
- **Automatically generated content at scale with no genuine informational or functional value**, published purely to increase indexed page count.
- **Fake or manipulated structured data** — reviews, ratings, prices, availability, or authorship that don't reflect real, verifiable content on the page. See [[no-fabrication]] and [[schema-rules]].
- **Link schemes** — PBNs, link farms, paid links without `rel="sponsored"`, automated reciprocal linking, comment/forum spam, link exchanges at scale.
- **Sneaky redirects** — redirecting users to a different destination than what was indexed/promised.
- **Scraped or spun content** — republishing others' content with light rewriting and no added value.
- **Deceptive practices generally** — anything designed to manipulate rankings by misleading either users or search engines rather than by genuinely improving the page.

## Why this rule exists

These techniques violate search engine guidelines and carry real risk: manual actions, algorithmic demotion, or full deindexing. They also degrade user trust, which is the thing SEO is ultimately supposed to serve. A ranking gained through deception is not a stable asset — it's a liability with a delayed fuse.

## Gray-area calls — default to caution

Some tactics sit in a gray zone (aggressive internal link volume, large-scale templated content, thin location pages, expired-domain acquisition). When something feels aggressive or scale-driven rather than value-driven, apply this test:

> If a human searcher who found this page felt tricked or shortchanged by it, don't do it.

If a technique's main purpose is to influence a ranking algorithm rather than to help a real user accomplish something, treat it as high-risk. Report the concern instead of implementing it silently. See `workflows/programmatic-seo.md` for the specific evaluation framework for scaled page generation.

## If explicitly asked to implement a black-hat technique

Do not implement it, do not offer a "lighter" version of it, and do not silently comply while renaming it. State plainly that the technique violates search engine guidelines and creates real risk to the site (manual action, deindexing), explain the legitimate alternative that achieves a similar underlying goal, and let the user decide how to proceed with full information.
