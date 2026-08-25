# Workflow: SaaS SEO

**Purpose:** Apply SEO practices specific to software/subscription products — marketing site vs. app boundary, feature/use-case pages, comparison content, and pricing-page considerations.

**Modifies files:** Yes, under [[../rules/implementation-safety]]. See `frameworks/saas.md`.

**Only apply when discovery confirms this is a SaaS/software product site.**

## Key structural consideration: marketing site vs. application

Most SaaS products have a clear boundary between the public marketing/content site (meant to be indexed) and the authenticated application (meant not to be). Confirm this boundary explicitly:

- The authenticated app (dashboards, user-specific views, in-app pages) should generally be `noindex`ed or naturally unreachable/unlinked for crawlers — verify this is actually the case, since app routes accidentally left indexable is a common and often embarrassing leak.
- The marketing site (homepage, feature pages, pricing, comparisons, blog, docs) is the indexable surface this workflow optimizes.

## Audit procedure

1. **Homepage and core value proposition** — clear primary keyword/positioning reflected in title, H1, and above-the-fold content, matching how real prospects search.
2. **Feature pages** — one page per genuinely distinct feature/use case with real differentiated content, not a shared template with only the feature name swapped (apply `workflows/programmatic-seo.md` evaluation if this pattern is proposed at scale).
3. **Comparison pages ("X vs Y", "alternatives to X")** — must be honest and substantive (real feature comparison, real tradeoffs) — a comparison page that's transparently biased marketing copy performs poorly and risks trust; see [[../rules/content-quality]].
4. **Pricing page** — often a high-intent transactional page; ensure it's indexable (unless there's a deliberate reason not to be, e.g., variable/custom pricing shown only after signup) and technically clean.
5. **Documentation/help content** — if public, check indexability strategy is deliberate (often valuable for long-tail informational queries; sometimes deliberately gated).
6. **SoftwareApplication schema** — only where genuinely applicable and populated with real category/pricing/OS data (see [[../rules/schema-rules]]).

## Common high-leverage fixes

- Confirming/fixing the noindex boundary between marketing site and app.
- Building out genuine comparison/alternative pages for terms with real commercial-intent demand (a strong SaaS content category when done honestly).
- Fixing feature-page templates that are too thin/interchangeable to individually rank.

## Constraints

- Never fabricate customer counts, review scores, or "trusted by" claims not backed by real data — see [[../rules/no-fabrication]].
- Never let comparison content cross into misleading claims about competitors.

## Output

Findings/fixes reported per standard templates.
