# Framework Guide: React (client-rendered / CRA-style, no meta-framework)

Read after `workflows/discovery.md` confirms a plain React app (Create React App, a custom Webpack/Vite React setup) without a meta-framework's SSR/SSG layer. If a meta-framework (Next.js, Remix, Gatsby) is actually in use, use its dedicated guide instead — this guide is specifically for pure client-side-rendered React.

## The core constraint

A pure CSR React app ships a near-empty initial HTML shell; all content and metadata are produced client-side by JavaScript. This is the highest-risk rendering pattern for SEO per `workflows/javascript-seo.md` — treat every recommendation here through that lens.

## What's actually achievable without a rendering-strategy migration

Per [[../rules/architecture-preservation]], do not recommend migrating to Next.js/Remix/Gatsby as the fix, even though it would help. Instead:

- **Static `index.html` metadata** — the base HTML file's `<head>` (title, description, OG tags, canonical) is the only guaranteed-crawlable metadata unless something else changes this. For a single-page app with one real "page," ensure this static content is accurate and complete — this alone covers homepage crawlability reasonably well.
- **Per-route metadata via a library that manipulates `<head>`** (e.g., `react-helmet-async` or similar, if already in the project) — better than nothing for user-facing tab titles, but understand this only reliably reaches crawlers that execute JS and wait for it, which is not guaranteed for every crawler or every page on every crawl pass. Don't oversell this as equivalent to server-rendered metadata.
- **Prerendering** — if the build pipeline supports a prerendering step (generating static HTML snapshots per route at build time, e.g., via a plugin) without a full framework migration, this is often the single highest-leverage fix available within this architecture. Evaluate whether the existing build tooling (Vite, Webpack) has a prerendering plugin option before ruling this out — it's a build-config addition, not an architecture change, when it fits into the existing pipeline.
- **Real anchor tags** for all internal navigation (React Router's `<Link>` renders real `<a href>` by default — confirm nothing overrides this with a JS-only click handler).

## Routing

Confirm React Router (or equivalent) is producing real, unique URLs per view (not everything living under one hash-routed or query-param-routed URL, which severely limits per-page indexing).

## Structured data

Inject via the same `<head>`-manipulation mechanism as metadata; understand it carries the same crawl-timing caveat as above.

## When to escalate rather than patch further

If the site's core value depends on rich, unique per-page content that must be reliably indexed (e.g., a content-heavy blog or product catalog built as a pure CSR SPA), and prerendering/static-shell fixes aren't enough, this is exactly the kind of tradeoff to report under "Requires Explicit Decision" per [[../rules/implementation-safety]] rather than silently accepting reduced SEO ceiling or silently recommending a migration.

## Never

Never recommend cloaking (serving a different pre-rendered version to crawlers than to real users beyond what legitimate prerendering/dynamic-rendering techniques do transparently) — see [[../rules/no-black-hat]]. Legitimate prerendering serves the same content to everyone; it's a caching/timing optimization, not content substitution.
