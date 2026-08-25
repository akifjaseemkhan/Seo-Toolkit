# Site-Type Guide: SaaS

Pairs with `workflows/saas-seo.md`. This guide covers structural/technical notes specific to SaaS products; the workflow covers strategy.

## The marketing-site/app boundary is the first thing to verify

Nearly every SaaS product's codebase spans two very different surfaces:

- A **marketing/content site** (homepage, features, pricing, comparisons, blog, docs) — meant to be indexed, this skill's primary focus.
- An **authenticated application** (dashboard, in-app pages, user-specific views) — meant not to be indexed, and often not even meant to be crawlable/reachable without auth.

Confirm during `workflows/discovery.md` how these are actually separated in this specific codebase: separate route trees, a separate deployment/subdomain, or interleaved routes gated only by client-side auth checks (the riskiest pattern — client-side-only gating can still leave server-rendered content or metadata crawlable before the auth check runs). Verify the noindex/access boundary matches intent — this is one of the highest-value, easy-to-miss checks for this site type.

## Common architecture patterns

- **Monorepo with a marketing site and app as separate packages/deployments** — the marketing site is usually its own simpler stack (often static/SSG) even if the app is a heavy SPA; apply the marketing site's actual framework guide, not the app's.
- **Single app, route-based split** (e.g., `/app/*` gated, everything else public) — verify the gate is enforced correctly and that public marketing routes aren't accidentally using the app's heavier CSR-only rendering pattern (`frameworks/react.md` cautions apply if so) when a lighter, more crawlable approach would serve the marketing pages better.
- **Docs subdomain/subpath** — often a separate static-site-generator or docs-specific tool (Docusaurus, Mintlify, etc.) — apply `frameworks/static-html.md` or the relevant generator's conventions if distinct from the main app's stack.

## Pricing and signup pages

Often the highest commercial-intent pages on the site. Verify they're indexable (unless deliberately not, e.g., enterprise-only custom pricing shown post-signup) and technically clean — these are worth extra scrutiny in `workflows/technical-seo.md` and `workflows/on-page-seo.md` passes given their conversion value.

## Structured data

`SoftwareApplication` schema (see [[../rules/schema-rules]]) only where genuinely applicable, with real category/OS/pricing data — don't apply it to marketing pages that aren't actually representing the product entity itself (e.g., a blog post).

## Never

Never recommend removing or weakening the app-side auth/noindex boundary to "improve indexing" — this is exactly the kind of protected-functionality-adjacent risk [[../rules/zero-breakage]] exists to prevent.
