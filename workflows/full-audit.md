# Workflow: Full Audit

**Purpose:** A comprehensive, read-only SEO health check across all relevant domains. This is what `/seo audit` and `/seo full`'s audit phase run.

**Modifies files:** No. Read-only. Do not fix anything discovered during a full audit — report it, then let the user decide what to implement via `/seo implement` or a targeted command.

## When to use this vs. a targeted workflow

Use the full audit when the user asks for a general health check, a first-time assessment, or "how's our SEO." If the user asks about one specific domain ("is our schema correct," "why isn't this page indexing"), go directly to the targeted workflow instead — running a full audit for a narrow question wastes time and buries the answer.

## Procedure

### 1. Discovery

Run `workflows/discovery.md` in full if not already done this session.

### 2. Technical SEO pass

Run `workflows/technical-seo.md`, using `checklists/technical-checklist.md` and `checklists/indexing-checklist.md`. If a local or live URL is available, run `node tools/seo-tool/cli.js audit <url>` (see `docs/tooling.md`) first — it gathers real crawl, sitemap, and robots.txt evidence in one pass that this and the next several sections can cite directly instead of inferring from source alone.

### 3. On-page pass

Run `workflows/on-page-seo.md` using `checklists/on-page-checklist.md` and `checklists/metadata-checklist.md`. Sample representative pages per template rather than exhaustively auditing every URL — call out template-level issues once.

### 4. Structured data pass

Run `workflows/schema.md` using `checklists/schema-checklist.md`.

### 5. Information architecture and internal linking pass

Run `workflows/information-architecture.md` and `workflows/internal-linking.md` using `checklists/internal-linking-checklist.md`.

### 6. Content pass

Run `workflows/content-optimization.md` (evaluating existing content quality) — full new-content strategy (`workflows/content-strategy.md`) is usually a separate, deeper engagement; note it as a recommended follow-up rather than doing full keyword research inline unless asked.

### 7. Performance pass (SEO-relevant only)

Run `workflows/performance.md` using `checklists/performance-checklist.md`. Keep this scoped to SEO-relevant performance signals, not a full performance engineering audit.

### 8. JavaScript rendering pass (if applicable)

If the site is CSR/SPA or hybrid, run `workflows/javascript-seo.md`.

### 9. Site-type-specific pass

Run whichever of `workflows/ecommerce-seo.md`, `workflows/saas-seo.md`, `workflows/local-seo.md`, `workflows/international-seo.md`, `workflows/multilingual-seo.md` apply based on discovery.

### 10. Prioritize

Consolidate every finding from every pass into one list. Score each with Severity × Impact × Effort × Risk (see `docs/workflows.md`). Do not present findings in the order they were discovered — present them in priority order.

### 11. Score

Produce an `templates/seo-scorecard.md` summarizing health by category.

### 12. Report

Produce the full `templates/seo-audit-report.md`. This is the deliverable — it should stand alone and be understandable by someone who wasn't watching the audit happen.

## Notes

- A full audit on a large site can be long. If the project is large, say so up front and propose scoping (e.g., audit by template/section rather than every URL) rather than silently truncating coverage without explanation.
- Flag anything requiring external configuration or explicit user decision distinctly from actionable code-level findings — see `templates/seo-audit-report.md`.
