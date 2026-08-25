# Workflow: Discovery

**Purpose:** Build an accurate model of the project before any audit or implementation work. This is always the first workflow run on a project the skill hasn't inspected yet — never skip it, and never open by asking the user to explain the site.

**Modifies files:** No. Read-only.

## Procedure

### 1. Stack identification

Read `package.json` (or the equivalent manifest — `composer.json` for PHP/WordPress, etc.). Identify:

- Framework and version (React, Next.js, Vite + React, Astro, Nuxt, Vue, Svelte, WordPress, plain static HTML)
- Relevant config files: `next.config.*`, `vite.config.*`, `astro.config.*`, `nuxt.config.*`, `wp-config.php`
- Build scripts and output directory
- Rendering strategy — this is the single most important technical fact for SEO. Determine CSR vs. SSR vs. SSG vs. ISR vs. hybrid by reading the actual config and route code, not by assuming based on framework name (e.g., Next.js supports all four, per-route).

Once identified, open the matching guide in `frameworks/` and keep it loaded for the rest of the engagement.

### 2. Site type identification

Infer from routes, data models, and copy: e-commerce (product/cart/checkout present), SaaS (pricing/signup/dashboard present), blog/content (posts/articles/CMS present), local business (single location, service pages, contact-focused), tool/calculator (single-purpose utility, often little content), marketplace/directory (listings from multiple parties), documentation, or a mix. Load the matching `frameworks/*.md` site-type guide.

### 3. Route and information architecture mapping

Map how pages are produced: file-based routing directory, a routes config, a CMS with dynamic slugs, or a mix. Identify dynamic route patterns (`[slug]`, `:id`, catch-alls) and roughly how many indexable pages they represent. This feeds `workflows/information-architecture.md`.

### 4. Existing SEO implementation audit (presence check only — depth comes later)

For each of the following, determine present/absent/partial, and where it lives in the codebase:

- `robots.txt`
- XML sitemap (static file or generated route)
- Per-page metadata mechanism (a `<Head>`/`<Metadata>` component, framework metadata API, manual tags)
- Canonical tag logic
- Structured data (search for `application/ld+json`, `schema.org`)
- Open Graph / Twitter card tags
- hreflang / i18n routing
- Analytics and Search Console verification

Do not assume absence — grep before concluding something doesn't exist. `node tools/seo-tool/cli.js project [path]` (see `docs/tooling.md`) can gather steps 1 and 4's raw facts — package manager, framework config files, directory conventions, SEO-related file presence — in one pass; it reports facts only, so still do the interpretation yourself.

### 5. Critical functionality inventory

Locate (don't yet analyze in depth): authentication, authorization boundaries, payment/checkout code, API routes, database/data access layer, WebSocket/realtime features, core business logic modules. This is the protected-functionality map referenced throughout [[../rules/zero-breakage]] for the rest of the engagement.

### 6. Repo hygiene

Run `git status` if it's a repo — note any pre-existing uncommitted changes before you touch anything (never attribute them to yourself later). Locate existing test suite and lint/type-check configuration.

### 7. Synthesize

Summarize findings in plain terms: stack, site type, existing SEO maturity level, and anything that raises risk flags (missing tests, no build config found, unusual architecture). Use this summary to select the next workflow(s) from the routing table in `SKILL.md`.

## Checklist

Use `checklists/discovery-checklist.md` to confirm nothing was missed.

## Output

A discovery summary (in-conversation is fine for small projects; use `templates/seo-audit-report.md`'s "Project Overview" section for larger engagements) that every subsequent workflow can be run against without re-discovering the basics.
