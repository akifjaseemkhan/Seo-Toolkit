# Usage

## Starting a session

Once installed (`docs/installation.md`), just ask for SEO work in plain language, or use the `/seo *` commands if your setup maps them:

- "Audit our SEO" → `commands/audit.md`
- "Fix the SEO issues you found" → `commands/implement.md`
- "What content should we write next" → `commands/content.md`
- "Why isn't this page showing up in Google" → routes into `workflows/indexing.md` directly (no need to name a command — the skill routes to the right workflow based on the request, per the routing table in `SKILL.md`)
- "Do a full SEO pass and fix what's safe to fix" → `commands/full.md`

You do not need to explain your site, framework, or SEO priorities up front. The first thing that happens is project inspection (`workflows/discovery.md`), not a Q&A session — see `docs/architecture.md` for how that works.

## What to expect from a typical engagement

1. **Discovery** — a short summary of what was found (stack, site type, existing SEO maturity).
2. **Findings or a plan** — depending on what you asked for, either a read-only report or a concrete implementation plan.
3. **A checkpoint before any risky change** — anything touching protected functionality or hard to reverse gets surfaced explicitly for your decision, not implemented silently. See [[../rules/implementation-safety]].
4. **A report at the end, always** — `templates/change-report.md` for implementation work, `templates/seo-audit-report.md` for audit-only work. This isn't optional even for a one-line fix.

## Providing information the skill can't derive from code

Some things genuinely can't be found in a codebase and the skill will ask for them rather than guess: real business NAP data for local SEO, real target markets for international SEO, Search Console/analytics exports for data-grounded prioritization, business priorities for tie-breaking between competing recommendations. Providing these up front (if you know the skill will need them) speeds things up but isn't required — it'll ask when it hits something it genuinely can't determine.

## Scoping a request

You can narrow any request: "just audit the checkout flow," "just fix our meta descriptions," "just look at our blog." The skill scopes accordingly rather than defaulting to the widest possible interpretation — see the routing table in `SKILL.md`.

## Reviewing before implementing

For anything beyond trivial fixes, expect a plan (`templates/implementation-plan.md`) before code changes, especially for canonical/indexing/robots/schema/IA work. Review it and confirm before the implementation phase runs — this is intentional friction on the higher-risk categories, not a stall.

## Getting a status update mid-project

Ask for `commands/monitor.md`-style analysis at any point, or request a `templates/monthly-seo-report.md` for a periodic summary if you're running this skill on a recurring cadence.

## Multi-project use

This skill is generic by design — the same copy can be installed into unrelated projects without modification. It builds its understanding of each project fresh from `workflows/discovery.md` every time, rather than carrying assumptions between projects.
