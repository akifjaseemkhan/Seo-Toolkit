# Workflow: Reporting

**Purpose:** Produce clear, honest, stakeholder-ready output for both audit-only work and implementation work. Every other workflow feeds into this one — reporting is not an afterthought, it's the deliverable.

**Modifies files:** No.

## Choosing the right template

- **Audit-only work** (no code changed): `templates/seo-audit-report.md`, optionally paired with `templates/seo-scorecard.md` for a quick-scan summary.
- **Implementation work** (code changed): `templates/change-report.md` — required for every implementation session, regardless of size.
- **Ongoing/periodic reporting**: `templates/monthly-seo-report.md`.
- **Planning artifacts**: `templates/implementation-plan.md`, `templates/keyword-map.md`, `templates/content-roadmap.md`, `templates/internal-link-map.md`, `templates/schema-plan.md`, `templates/competitor-analysis.md` — as produced by their respective workflows.

## Principles for every report

1. **Lead with what matters.** Prioritized findings/impact first, exhaustive detail after — a stakeholder reading only the top of the report should still get the real picture.
2. **Be honest about uncertainty.** Directional inference is labeled as inference; real data is labeled as real data (see `workflows/keyword-research.md`, `workflows/competitor-analysis.md`). Never blur the two.
3. **State what wasn't done and why.** "Not Implemented" and "Requires External Configuration" sections are not optional filler — they're often the most actionable part of the report for the user.
4. **Quantify blast radius where relevant.** "This template affects ~340 product pages" is more useful than "fixed product page titles."
5. **No inflated claims.** Never claim a ranking/traffic outcome as achieved — see [[../rules/verification-rules]] and `workflows/post-implementation.md`. Report what was implemented and verified locally; frame outcomes as expected and externally verifiable over time.
6. **Make next steps concrete and prioritized**, not a generic "continue optimizing" close.

## Internal scoring is internal

Any score produced (`templates/seo-scorecard.md`) must be clearly labeled as this skill's internal diagnostic heuristic — never presented as an official Google score or a guarantee of ranking outcome.

## Audience awareness

Adjust depth and jargon to who's receiving the report — a technical implementation report for a developer can assume technical fluency; a stakeholder summary should lead with business impact and keep technical detail available but secondary (e.g., in an appendix or on request), without dumbing down the substance.

## Output

The applicable template(s) above, fully populated — not a template shell with placeholders left in.
