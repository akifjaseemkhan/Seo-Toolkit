# Framework Guide: Next.js

Read after `workflows/discovery.md` confirms Next.js. Covers both the App Router and Pages Router since many production projects still run Pages Router or a mid-migration hybrid — confirm which is in use (presence of an `app/` directory vs. `pages/` directory) before applying guidance.

## Rendering strategy detection

Next.js supports SSR, SSG, and ISR per-route, plus client components within the App Router. Never assume one strategy site-wide — check each route/segment's actual configuration:

- **App Router**: check for `export const dynamic`, `generateStaticParams`, `revalidate` exports per route; check whether a component is a Server Component (default) or `"use client"`.
- **Pages Router**: check for `getStaticProps`/`getStaticPaths` (SSG/ISR), `getServerSideProps` (SSR), or neither (CSR-only page).

This determines what's actually reliable for `workflows/javascript-seo.md` on a per-route basis.

## Metadata

- **App Router**: use the built-in Metadata API (`export const metadata` or `generateMetadata`) — this is the framework-native, server-rendered mechanism. Don't hand-roll `<head>` tags in a client component when this API exists and is already in use.
- **Pages Router**: metadata typically goes through `next/head`. Confirm it's used consistently; a page missing a `<Head>` block entirely often means it's silently using a default/shared title.
- JSON-LD: inject via a `<script type="application/ld+json">` in the same server-rendered location as other metadata — App Router Server Components can safely render this without hydration concerns.

## Routing and dynamic routes

- File-based routing (`app/` or `pages/`) with `[slug]`, `[...catchAll]` for dynamic routes. Confirm `generateStaticParams` (App Router) or `getStaticPaths` (Pages Router) actually covers the full real URL set your sitemap should include — a mismatch here is a common source of sitemap/reality drift (see `workflows/sitemap.md`).

## Sitemap and robots

- Next.js supports file-convention sitemap/robots generation (`app/sitemap.ts`, `app/robots.ts` in App Router) that can pull from real data sources (a CMS query, a route list) — prefer this over a hand-maintained static file when available, per `workflows/sitemap.md`'s "derive from real route source" guidance.

## Canonical and redirects

- `metadata.alternates.canonical` (App Router) or manual `<link rel="canonical">` (Pages Router).
- Redirects: `next.config.js` `redirects()` for permanent/temporary redirects at the framework level — prefer this over ad hoc in-component redirect logic for anything meant to be crawlable/cacheable as a real 301.

## Common pitfalls to check for

- Client Components silently used for content that should be server-rendered for crawlability (check for unnecessary `"use client"` on content-heavy components).
- Metadata defined only in a root layout with no per-page override, producing duplicate titles/descriptions across many pages.
- ISR `revalidate` set too long for content that changes frequently, causing stale metadata/schema to persist.

## Never

Never migrate Pages Router → App Router (or vice versa) as an SEO fix — that's an architecture change per [[../rules/architecture-preservation]], even though App Router's Metadata API is often more ergonomic.
