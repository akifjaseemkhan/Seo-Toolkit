# Rule: Zero-Breakage Policy

**Status:** Non-negotiable. Applies to every workflow, every command, every session.

## The rule

No SEO change may break, degrade, or destabilize existing functionality. If an SEO improvement and an existing feature conflict, the existing feature wins. This is true even if the SEO improvement is high-impact and the conflict seems minor.

Functionality outranks optimization in this order:

1. Existing functionality (the app does what it did before)
2. Existing business logic (rules, pricing, permissions, workflows)
3. Existing user experience (visual design, interaction patterns, flows)
4. Existing security (auth, authorization, data handling)
5. Existing architecture (framework, routing, build system, deployment model)
6. SEO improvements

## Required sequence before any modification

1. Inspect the project (framework, build system, routes, components).
2. Identify existing SEO implementation (don't assume there is none).
3. Identify critical functionality: auth, APIs, payments, database access, realtime/WebSocket features.
4. Identify deployment architecture (static host, server, edge, CDN).
5. Form a written plan (see [[implementation-safety]]).
6. Implement only the smallest change that achieves the SEO goal.
7. Verify nothing else changed (see [[verification-rules]]).
8. Report.

Skipping steps 1–5 to "just implement it" is a violation of this rule regardless of how confident the change seems.

## Hard stops — never do these automatically

- Redesign UI or change visual identity for SEO reasons.
- Replace a working component instead of extending it.
- Rewrite the application, migrate frameworks, or migrate build systems.
- Change routing architecture beyond what's needed (e.g., adding a route ≠ restructuring routing).
- Change authentication, authorization, payment logic, or business logic.
- Change APIs, WebSocket behavior, or realtime functionality.
- Change database schema or query logic.
- Remove existing functionality, metadata, structured data, sitemap logic, or robots rules "to clean up" without a specific, reported reason.
- Generate large volumes of near-duplicate pages (see [[no-black-hat]] and `workflows/programmatic-seo.md`).

If a genuinely valuable SEO change requires touching any of the above, do not implement it. Stop, describe the tradeoff, and let the user decide. Report it under "Not Implemented" / "Requires Explicit Decision" (see `templates/change-report.md`).

## Reversibility test

Before implementing, ask: if this change turns out to be wrong, how hard is it to undo?

- **Easy to reverse** (a meta tag, a schema block, an alt attribute, a sitemap entry): safe to implement directly once planned.
- **Hard to reverse** (canonical strategy across thousands of URLs, a redirect map, a routing change, a robots.txt rule that affects crawl budget broadly): treat as high-risk. Prefer a scoped pilot, get explicit confirmation, or report instead of implementing.

## Relationship to other rules

This is the parent rule. [[ui-preservation]], [[architecture-preservation]], [[implementation-safety]], and [[verification-rules]] all exist to operationalize it for specific domains. When rules conflict, zero-breakage wins.
