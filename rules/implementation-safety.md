# Rule: Implementation Safety Procedure

**Status:** Required procedure for every `/seo implement`-class action.

## The eight-phase implementation workflow

Every implementation, regardless of size, follows this sequence. Skipping a phase for a "small" change is how small changes cause large incidents.

1. **Inspect** — read the actual current state of the files/routes/config you're about to touch. Never edit from assumption or from what the audit report said an hour ago; re-verify immediately before editing.
2. **Plan** — write down (in your response, or `templates/implementation-plan.md` for larger work) exactly what will change, file by file, and why.
3. **Risk-check** — classify the change using the reversibility test in [[zero-breakage]]. Identify anything touching protected functionality (auth, payments, APIs, DB, realtime, business logic) — see the full list in [[zero-breakage]]. If present, stop and confirm with the user before proceeding.
4. **Implement the smallest safe version** — do only what the plan specified. Do not opportunistically refactor, rename, reformat, or "improve while you're in there." Unrelated cleanup is a separate task, not a rider on an SEO change.
5. **Run available checks** — first inspect `package.json` scripts (or the equivalent — `composer.json`, a `Makefile`, CI config) to find out what actually exists in *this* project. Never run a command (`npm test`, `npm run build`, a framework CLI) speculatively without having confirmed it exists — a failure from a nonexistent script is noise, not signal, and wastes a cycle that should have been spent reading the manifest first. Run whatever subset genuinely exists: build, lint, type-check, test suite. Do not skip an existing check because it takes time.
6. **Inspect the diff** — read the actual diff of what changed before considering the work done. Confirm it matches the plan exactly — nothing more.
7. **Regression check** — walk through `checklists/final-regression-checklist.md`. For UI-adjacent changes, actually load the affected page(s) if a preview/dev environment is available.
8. **Report** — use `templates/change-report.md`. Every implementation gets a report, no exceptions, even a one-line meta description fix.

## Git discipline

- Check `git status` before editing if the project is a repo. Never edit into a dirty working tree without noting what was already uncommitted.
- Never discard, stash-drop, reset, or overwrite existing uncommitted changes.
- Never commit unless explicitly instructed.
- Keep changes scoped to files relevant to the SEO task — don't sweep in unrelated formatting diffs from an IDE auto-formatter.

## Change risk categories

Before implementing anything, classify it. This determines whether it's safe to just do, safe to do carefully, or something that requires stopping to ask.

### Category A — Safe

Additive, easily reversible, doesn't touch protected functionality or shared templates at meaningful scale. Implement directly once the specific change is planned and the eight-phase procedure is followed — no separate sign-off needed beyond the user's original request for the work.

Examples: adding a missing title tag or correcting a wrong meta description on a specific page or small template; adding a self-referencing canonical to a page that's missing one (domain already confirmed); adding structured data whose every property is sourced from real, already-visible content; adding or fixing an alt attribute; adding one genuinely relevant contextual internal link using existing link styling; fixing a single incorrect or missing sitemap entry; correcting one clearly-wrong `robots.txt` line that affects a single, specific path; fixing a broken internal link to point at the correct existing destination.

### Category B — Moderate

Template-level or shared-component changes with real blast radius (affects many pages) but still reversible and not touching protected functionality. Implement the smallest safe version, explain the change and its scope clearly in the report, and prefer a scoped pilot before a full rollout when the pattern is new or unproven (see `workflows/programmatic-seo.md`).

Examples: changing a metadata-generation template that affects many pages at once; adding a new visible UI element that surfaces genuinely existing content (a breadcrumb trail, an FAQ accordion for real, already-answerable Q&A — never invented Q&A, see [[ui-preservation]]); rewriting/optimizing existing page content; changing sitemap or robots.txt logic at the route-pattern level rather than a single URL; adding Product schema bound to a live data source across a product template.

### Category C — High risk

Hard to reverse, large blast radius, or adjacent to (without being) protected functionality. **Default behavior: INSPECT → EXPLAIN THE RISK → ASK FOR EXPLICIT APPROVAL for that specific change → only then implement.** A prior general go-ahead ("fix our SEO") does not cover a Category C item discovered along the way — get a fresh, specific confirmation.

Examples: any canonical or preferred-domain strategy change affecting more than a handful of URLs (see [[canonical-rules]]); any `noindex`/`robots.txt` change affecting a route pattern rather than one page (see [[indexing-rules]]); any URL-structure or routing change; any change to rendering strategy, framework configuration, or build configuration (see [[architecture-preservation]]); any change to redirect logic at scale; any change to middleware; any large-scale/programmatic page generation (see `workflows/programmatic-seo.md`); any change to server or deployment configuration files found in the repo.

### Category D — External

Cannot be performed inside the codebase at all, regardless of approval. Never attempt a code-only workaround. Report exactly what needs to change and where, under "External Configuration Required."

Examples: DNS records, domain-level redirects, CDN configuration/headers, hosting-panel settings, Google Search Console actions, Google Business Profile, analytics/tag-manager configuration, third-party API credentials.

### Not a category — out of scope entirely

Authentication, authorization, payment logic, database queries/schema, API behavior, and WebSocket/realtime logic are never implemented by this skill for an SEO reason, at any approval level — see [[zero-breakage]]. These aren't "Category C awaiting a yes"; a genuine SEO task should never require touching them. If one seems to, that's a sign the request needs a different kind of engineering work, and it should be named as such rather than folded into an SEO implementation.

## Other reasons to stop and ask rather than implement

- Required information is missing and would otherwise require a fabricated value — see [[no-fabrication]].
- The safe path and the maximally-effective path diverge significantly (e.g., a full migration would be "better SEO" but violates [[architecture-preservation]]) — present the tradeoff, don't pick silently.
- Domain/environment configuration (preferred domain, production vs. staging) can't be confirmed — see [[canonical-rules]].

## Batching

Large audits often surface many findings. Do not implement everything in one uncontrolled pass. Group by the prioritization framework (`docs/workflows.md` prioritization section — Severity × Impact × Effort × Risk), confirm scope for each batch, and implement in reviewable increments so any regression is easy to isolate and roll back.
