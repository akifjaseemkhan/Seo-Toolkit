# Command: /seo audit

**Modifies files:** No. Strictly read-only.

## Purpose

Run a comprehensive, read-only SEO health check and produce a prioritized report. This is the entry point for "how's our SEO," a first-time assessment, or a periodic health check.

## Procedure

1. Run `workflows/discovery.md` if the project hasn't been inspected this session.
2. Run `workflows/full-audit.md` in full.
3. Produce `templates/seo-audit-report.md` with an embedded `templates/seo-scorecard.md`.

## Explicit constraint

This command never edits files. If the user wants findings fixed, they run `/seo implement` (or a targeted command) as a separate, explicit next step — auditing and implementing are deliberately decoupled so the user can review findings before anything changes.

## Scoping

If the user specifies a narrower scope ("audit our checkout pages," "audit our blog"), scope the audit accordingly rather than running the full site — state the scope explicitly in the report's "Project Overview" and "Out of Scope / Not Evaluated" sections.

## Output

`templates/seo-audit-report.md`, delivered in full — not summarized down to a paragraph unless the user asks specifically for a summary.
