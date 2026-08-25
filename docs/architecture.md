# Architecture Detection

This document details the procedure `workflows/discovery.md` uses to identify a project's stack and site type without assuming anything in advance. It's referenced by every `frameworks/*.md` guide as the "how did we get here" step.

## Why detection comes before everything

Every piece of framework-specific and site-type-specific guidance in this skill (`frameworks/*.md`) is conditional on correctly identifying the stack first. Applying Next.js guidance to a plain Vite+React CSR app, or e-commerce assumptions to a SaaS product, produces confidently wrong recommendations. Detection is not a formality — it's the gate that makes every subsequent workflow's advice actually applicable.

## Stack detection procedure

1. **Read the manifest file** — `package.json` for JS/TS projects (check `dependencies`/`devDependencies` for framework packages: `next`, `react`, `vite`, `astro`, `nuxt`, `@sveltejs/kit`, etc.), `composer.json` for PHP, or look for `wp-config.php` specifically for WordPress.
2. **Read framework config files** if present — `next.config.js`/`.mjs`/`.ts`, `vite.config.*`, `astro.config.*`, `nuxt.config.*`. These often reveal rendering-strategy defaults (e.g., Next.js `output: 'export'` signals static export mode).
3. **Inspect the directory structure** — `app/` vs `pages/` (Next.js App vs Pages Router), `src/pages/` (Astro/SvelteKit convention), `wp-content/` (WordPress), a flat directory of `.html` files (static site).
4. **Determine rendering strategy per route where relevant** — don't assume uniformity. Modern meta-frameworks mix SSR/SSG/ISR/CSR per route; check actual per-route config/exports rather than the framework's theoretical default. See `frameworks/nextjs.md` and `frameworks/vite.md` for the specific signals to check.
5. **Identify the build/output pipeline** — build script in `package.json`, output directory, and (if determinable) deployment target from config (`vercel.json`, `netlify.toml`, a `Dockerfile`, CI config referencing a host).

## Site-type detection procedure

Infer from what the code and content actually do, not from assumption:

- **E-commerce**: product/cart/checkout routes or components, a product data model, payment integration references.
- **SaaS**: pricing/signup/dashboard routes, a subscription/billing data model, an authenticated app area distinct from marketing pages.
- **Blog/content**: a CMS integration or Markdown content directory, post/article routing patterns, publish-date-driven data.
- **Local business**: single or few locations, service pages, contact-focused structure, no cart/checkout.
- **Tool/calculator**: a single-purpose interactive component with minimal supporting content, often little to no CMS/blog layer.
- **Marketplace/directory**: multi-party listings (not one company's own products), a listings data model with multiple contributors/sellers.
- **Mixed**: many real projects combine these (a SaaS product with a blog, an e-commerce site with a local storefront) — identify each relevant facet and apply the corresponding `frameworks/*.md` guide for each, rather than forcing a single label.

## When detection is ambiguous

If the stack or site type can't be confidently determined from inspection alone (unusual custom setup, minimal signal), state the ambiguity plainly and ask the user rather than guessing and proceeding on a wrong assumption — an incorrect stack assumption cascades into incorrect recommendations throughout the rest of the engagement.

## Output

A stack + site-type identification that every other workflow in this engagement can rely on without re-deriving it, and the specific `frameworks/*.md` file(s) to keep loaded for the rest of the session.
