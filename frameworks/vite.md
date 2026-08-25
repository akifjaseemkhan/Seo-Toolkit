# Framework Guide: Vite

Vite is a build tool, not a rendering framework — confirm what's actually built on top of it before applying guidance. Common patterns: Vite + React/Vue (CSR, no SSR layer — apply `frameworks/react.md` or a Vue-equivalent CSR approach), Vite SSR (custom-built), or a Vite-based meta-framework (SvelteKit, Astro-with-Vite, Nuxt 3, Qwik). If a specific meta-framework is in use, prefer its dedicated guide/conventions over generic Vite guidance.

## Determining the actual setup

Check `vite.config.*` for SSR-related config (`build.ssr`, `ssr.noExternal`, a separate server entry) and check `package.json` scripts for a custom server (`vite-plugin-ssr`, a hand-rolled Express/Node SSR entry) versus a pure static `vite build` + client-only output. Don't assume Vite implies CSR-only — it's commonly used as the build layer under real SSR setups too.

## If it's CSR-only (no SSR layer)

Apply `frameworks/react.md` (or the equivalent for whatever UI library is in use) directly — the SEO constraints and fix options are the same regardless of build tool.

## If it's a custom SSR setup

- Verify metadata (title, description, canonical, OG, JSON-LD) is actually generated in the server-render path, not only in a client-side effect that runs after hydration — this is easy to get wrong in hand-rolled SSR since there's no framework enforcing the pattern.
- Verify the server-rendered HTML sent to the client actually contains the real content (not just a shell that then hydrates content in) by checking raw response HTML, not the post-hydration DOM.

## Prerendering plugins

Vite has a healthy plugin ecosystem for static prerendering (generating HTML snapshots per route at build time) without requiring a full SSR server. If the project is CSR-only and a rendering-strategy change is off the table per [[../rules/architecture-preservation]], check whether a prerendering plugin can be added as a build-config addition — this is usually the best available middle ground, same as in `frameworks/react.md`.

## Static asset handling

Vite's default static build output is straightforward to serve `robots.txt` and a static `sitemap.xml` from the public directory — confirm these are actually included in the build output and deployed, not just present in source but excluded by the build config.

## Never

Never recommend switching Vite for another build tool, or bolting on a full meta-framework, purely to fix SEO rendering — evaluate in-pipeline options (prerendering plugins, fixing an existing custom SSR path) first per [[../rules/architecture-preservation]].
