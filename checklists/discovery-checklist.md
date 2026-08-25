# Discovery Checklist

Run this before any other SEO work on a project you haven't inspected yet. See `workflows/discovery.md` for the full procedure.

## Stack identification
- [ ] `package.json` read (dependencies, scripts, `type`)
- [ ] Framework identified (React, Next.js, Vite, Astro, Nuxt, Vue, Svelte, WordPress, static HTML, other)
- [ ] Rendering strategy identified (CSR, SSR, SSG, ISR, hybrid)
- [ ] Build system and output directory identified
- [ ] Deployment target identified if determinable (Vercel, Netlify, static host, custom server, WordPress hosting)
- [ ] Matching `frameworks/*.md` guide identified and read

## Site type identification
- [ ] Primary site type determined (e-commerce, SaaS, blog/content, local business, tool/calculator, marketplace, directory, docs, mixed)
- [ ] Matching site-type guide in `frameworks/` read if applicable

## Routing and structure
- [ ] Route/page structure mapped (directory-based, config-based, CMS-based)
- [ ] Dynamic route patterns identified (slugs, params, catch-alls)
- [ ] Total approximate indexable page count estimated

## Existing SEO implementation
- [ ] `robots.txt` located and read (or confirmed absent)
- [ ] `sitemap.xml` (or sitemap generation code) located and read (or confirmed absent)
- [ ] Existing metadata pattern found (per-page title/description mechanism)
- [ ] Existing canonical logic found (or confirmed absent)
- [ ] Existing structured data found (or confirmed absent)
- [ ] Existing Open Graph / Twitter card implementation found (or confirmed absent)
- [ ] Existing hreflang/i18n setup found (or confirmed absent)
- [ ] Existing analytics/Search Console verification found (or confirmed absent)

## Critical functionality inventory
- [ ] Authentication mechanism identified
- [ ] Authorization/permission boundaries identified
- [ ] Payment/checkout flow identified (if applicable)
- [ ] API routes/endpoints identified
- [ ] Database/data layer identified
- [ ] WebSocket/realtime features identified (if applicable)
- [ ] Core business logic locations noted

## Repo hygiene
- [ ] `git status` run — working tree state noted before any edits
- [ ] Existing test suite located (or confirmed absent)
- [ ] Existing lint/type-check config located

## Output
- [ ] Findings summarized before proceeding to any workflow-specific audit or implementation
