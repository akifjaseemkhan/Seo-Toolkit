# Framework Guide: Static HTML

Read after `workflows/discovery.md` confirms plain static HTML/CSS/JS (no build framework, or a static site generator like Eleventy/Jekyll/Hugo producing plain HTML output).

## What's different about this stack

No rendering-strategy risk (`workflows/javascript-seo.md` largely doesn't apply — content is HTML from the start), but also no framework-provided metadata/schema abstraction — everything is manual, per-file, which means duplication and drift risk instead.

## Metadata

- Check whether metadata is hand-duplicated per HTML file (high drift risk — a sitewide change like adding a new OG tag means editing every file) or generated via a static-site-generator templating layer (a shared layout/partial). If hand-duplicated across many files and a templating layer is available in the existing toolchain but unused for this, a shared-partial refactor is a reasonable, low-risk recommendation — but confirm it doesn't exceed the scope of an SEO task before treating it as automatic (see [[../rules/zero-breakage]] on unrelated refactors).
- Verify every real page has been checked individually if no template system exists — there is no single source of truth to audit once.

## Sitemap and robots

- Almost always a hand-maintained static file for pure static HTML sites. Per `workflows/sitemap.md`, prefer generating this from the actual set of HTML files/build output if the toolchain supports it (many static-site generators have a sitemap plugin); if truly static and hand-built with no generator, keep it manually in sync carefully and flag the drift risk.

## Canonical

- Manual `<link rel="canonical">` per file. Check consistency of the preferred domain/protocol/trailing-slash form across every file per [[../rules/canonical-rules]] — this is the stack most prone to inconsistency since there's no central config enforcing it.

## Structured data

- Manual JSON-LD blocks per file. Same drift risk as metadata — verify each instance still matches its page's actual content rather than assuming a template keeps them in sync (there may be no template).

## Static-site generators specifically (Eleventy, Jekyll, Hugo, etc.)

If a generator is in use, prefer its templating/data layer for metadata, sitemap, and schema generation over hand-editing output HTML — treat the generator as the framework and apply the same "fix at the template level" discipline as any other framework guide.

## Deployment

Static HTML is typically deployed to a static host or CDN directly. Redirects and headers (including security/robots-adjacent headers) may need to be configured at the host/CDN level (`_redirects`, `netlify.toml`, host-specific config) rather than in application code — flag these as potentially "External Configuration Required" if the specific hosting setup can't be confirmed from the repo.

## Never

Never introduce a build framework/generator purely to solve an SEO drift problem — that's an architecture change per [[../rules/architecture-preservation]]; recommend it as a reported option, don't implement it unprompted.
