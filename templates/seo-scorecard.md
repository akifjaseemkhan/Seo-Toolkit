# SEO Scorecard — Template

**This is an internal diagnostic heuristic produced by this skill. It is not an official Google score, not a guarantee of ranking outcome, and not comparable across unrelated projects — state this plainly wherever the scorecard is presented.**

Score each category 0–10 based on the corresponding checklist's pass rate and severity-weighted findings (a single Critical failure should cap the category score low even if most items pass).

| Category | Score (0–10) | Basis |
|---|---|---|
| Technical SEO / Crawlability | | `checklists/technical-checklist.md` |
| Indexability | | `checklists/indexing-checklist.md` |
| On-Page SEO | | `checklists/on-page-checklist.md`, `checklists/metadata-checklist.md` |
| Content Quality & Coverage | | `checklists/content-checklist.md` |
| Internal Linking / Architecture | | `checklists/internal-linking-checklist.md` |
| Structured Data | | `checklists/schema-checklist.md` |
| Performance / Core Web Vitals | | `checklists/performance-checklist.md` |
| Site-Type-Specific (e-commerce/local/international, if applicable) | | relevant specialized checklist |
| Authority / Off-Site (if evaluated) | | `workflows/backlink-strategy.md` findings |

**Overall composite:** (simple average, or weighted toward the categories most material to this specific site's business goals — state which method was used and why)

## Interpretation guide

- **8–10:** Strong; remaining work is incremental optimization.
- **5–7:** Solid foundation with specific, addressable gaps — normal state for an actively-developed site.
- **3–4:** Meaningful structural issues likely suppressing visibility; prioritize the top findings before content expansion.
- **0–2:** Foundational problems (e.g., indexing broadly blocked, no metadata strategy) that should be fixed before investing in content/authority work — those investments won't pay off until the foundation is sound.

## What moved since last scorecard (if applicable)

If a prior scorecard exists for this project, show delta per category and note what specifically drove the change.
