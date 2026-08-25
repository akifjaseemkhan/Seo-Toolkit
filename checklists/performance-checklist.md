# Performance Checklist (SEO-relevant)

See `workflows/performance.md`. This is an SEO-lens performance review, not a full performance audit — flag deep performance work as a separate engineering effort when it goes beyond SEO-relevant scope, per [[../rules/architecture-preservation]].

## Core Web Vitals risk factors
- [ ] Largest Contentful Paint (LCP) candidate element identified per key template — is it fast to render (not blocked by late JS, late-loading web fonts, or a large unoptimized image)?
- [ ] Cumulative Layout Shift (CLS) risk factors identified — images/embeds without explicit dimensions, late-injected banners/ads, web fonts causing reflow (FOIT/FOUT without size-matched fallback)
- [ ] Interaction to Next Paint (INP) risk factors identified — heavy main-thread JS work on key interactive pages

## Images
- [ ] Images sized appropriately for their display size (no full-resolution source scaled down via CSS only)
- [ ] Modern formats used where the project's build pipeline supports it (WebP/AVIF) without breaking fallback support
- [ ] `width`/`height` (or aspect-ratio) attributes present to prevent layout shift
- [ ] Below-the-fold images lazy-loaded; above-the-fold/LCP images NOT lazy-loaded
- [ ] See `workflows/image-seo.md` for the SEO-specific (alt text, filenames) counterpart

## Fonts
- [ ] Web fonts preloaded if they're render-critical
- [ ] `font-display: swap` (or equivalent) used to avoid invisible-text flash, sized to minimize shift

## JavaScript
- [ ] No unnecessarily large JS bundles blocking initial render on content-critical pages
- [ ] Render-blocking scripts identified; deferred/async where safe to do so without breaking execution order dependencies
- [ ] Third-party scripts (analytics, chat widgets, ads) audited for render-blocking impact; loaded async/deferred where the project's existing setup allows without functional regression

## Render-blocking resources
- [ ] CSS delivery reviewed for render-blocking impact on key templates
- [ ] No unnecessary synchronous resource chains before first paint

## Constraints
- [ ] No fix here compromises functionality or introduces a framework/build migration (see [[../rules/architecture-preservation]])
- [ ] No fix implemented automatically if it requires a significant architectural change — report it instead (see [[../rules/zero-breakage]])

## Output
- [ ] Findings scored; note that Core Web Vitals field data can only be confirmed externally (CrUX/Search Console) over time — see [[../rules/verification-rules]]
