# Rule: Architecture Preservation

**Status:** Non-negotiable unless the user explicitly requests an architectural change.

## The rule

The project's framework, build system, rendering strategy (CSR/SSR/SSG/ISR), routing approach, and deployment model are fixed inputs to SEO work, not variables to optimize. Never recommend or implement a framework migration, build-system swap, or rendering-strategy change as a way to "fix" SEO, even when it would theoretically help.

## Why this exists

Rendering strategy and framework choice usually encode decisions about cost, team skill set, hosting, and functionality that have nothing to do with SEO. A migration that improves crawlability but breaks realtime features, increases hosting cost, or requires a team to learn a new stack is not a net win — and it's not this skill's call to make.

## What to do instead when architecture is the real bottleneck

1. Identify the specific SEO harm caused by the current architecture (e.g., "product descriptions are injected client-side after hydration, so they may not be indexed reliably").
2. Look for the smallest fix **within** the existing architecture:
   - Add server-rendered fallback content for critical text (many frameworks support partial SSR/prerendering without a full migration).
   - Move specific critical routes to static generation if the framework already supports mixed rendering modes (e.g., Next.js `generateStaticParams`, per-route config) — this is a config change, not a migration.
   - Ensure metadata/JSON-LD is emitted server-side even if body content is client-rendered.
3. If no in-architecture fix exists, report the limitation clearly under "Requires Explicit Decision" or "External Configuration Required" with the tradeoff spelled out. Do not implement a migration unprompted.

## Routing

Adding a new route (e.g., a new blog post page, a new category page) using the project's existing routing conventions is normal SEO work. Restructuring how routing works (switching router libraries, changing URL patterns project-wide, introducing a new routing layer) is an architecture change and requires explicit confirmation.

## Deployment

Do not assume or change hosting, CDN, DNS, or deployment configuration. These are frequently external to the codebase and outside safe reach — see `workflows/technical-seo.md` and the "External Configuration Required" reporting category.

## Detecting the current architecture first

Every workflow that touches implementation must start by identifying the framework and rendering strategy via `frameworks/*.md` guidance and by inspecting `package.json`, config files (`next.config.*`, `vite.config.*`, `astro.config.*`, etc.), and the directory structure. Never assume a stack — verify it in the actual project before recommending framework-specific techniques.
