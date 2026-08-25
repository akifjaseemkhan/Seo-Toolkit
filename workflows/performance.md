# Workflow: Performance (SEO-relevant)

**Purpose:** Address Core Web Vitals and load-performance factors that materially affect search ranking and user experience, scoped to what's safely fixable without an architectural overhaul.

**Modifies files:** Yes, for scoped fixes — under [[../rules/implementation-safety]] and [[../rules/architecture-preservation]].

## Scope boundary

This workflow covers SEO-relevant performance: Core Web Vitals (LCP, CLS, INP) and the factors that most directly affect them (images, fonts, render-blocking resources, third-party scripts, JS payload on content-critical paths). It does not cover general performance engineering (backend latency, database query optimization, caching architecture) unless those directly affect the metrics above — flag those as a separate engineering concern if found.

## Audit procedure

Work through `checklists/performance-checklist.md`:

1. Identify the likely LCP element per key template (usually the largest above-the-fold image or text block) and check whether anything delays it unnecessarily.
2. Identify CLS risk factors: images/embeds without explicit dimensions, late-injected content (banners, ads, cookie notices) that shifts layout, web fonts causing visible reflow.
3. Identify INP risk factors: heavy synchronous JS work triggered by common interactions on key pages.
4. Check image delivery: appropriate sizing, modern formats where the build pipeline supports them, lazy-loading below the fold (never on the LCP image itself).
5. Check font loading: preloading render-critical fonts, using a font-display strategy that avoids invisible text.
6. Check script loading: render-blocking scripts that could safely defer/async without breaking execution-order dependencies; third-party scripts (analytics, chat widgets) evaluated for blocking impact.

## Implementation guidance

- Fix at the safest possible layer: attribute/config changes (`width`/`height`, `loading="lazy"`, `font-display`, `defer`/`async`) before code restructuring, before build-pipeline changes, before framework/architecture changes.
- Any fix must be verified not to change functional behavior — e.g., deferring a script that other code depends on loading synchronously will break things; check dependencies before changing load order.
- If a real fix requires a significant architectural change (e.g., moving a client-rendered critical section to server rendering, restructuring how a heavy third-party widget loads), do not implement it silently — report it under "Not Implemented" with the tradeoff explained, per [[../rules/architecture-preservation]].

## What this workflow does not do

- Does not chase a synthetic Lighthouse score at the expense of real functionality.
- Does not recommend framework/build-tool migration to fix performance — see [[../rules/architecture-preservation]].
- Does not fabricate a "fixed" claim — Core Web Vitals field data (what actually matters for ranking) comes from real-user CrUX data over weeks, not from a local synthetic test. See [[../rules/verification-rules]].

## Output

Findings/fixes reported per standard templates, explicitly noting: what was verified locally (build succeeds, no functional regression, synthetic metrics if measurable) versus what requires external field-data confirmation over time (`workflows/post-implementation.md`).
