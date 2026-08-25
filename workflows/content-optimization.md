# Workflow: Content Optimization

**Purpose:** Improve an existing page's content to better match search intent and outperform what's currently ranking — without changing its voice, breaking its layout, or padding it.

**Modifies files:** Yes, for the content itself — under [[../rules/implementation-safety]] and [[../rules/content-quality]].

## Procedure

### 1. Establish the target

Confirm (or determine) what query/intent this page is meant to serve. If the page currently targets nothing clearly, or targets something misaligned with what it actually ranks for or gets traffic to, resolve that with `workflows/search-intent.md` before optimizing prose.

### 2. Baseline performance (if available)

Check Search Console data for this URL if accessible: current impressions, clicks, average position, and specifically what queries it's already getting impressions for (`workflows/search-console.md`). Pages already getting impressions but low clicks/position are often the best optimization ROI — they've already proven some relevance signal.

### 3. Gap analysis

Compare against what's currently ranking well for the target query (if visible): what do those pages cover that this one doesn't, what's structured differently, what's more specific or current. This is about identifying real information gaps, not matching competitor word count.

### 4. Identify the actual problem

Content underperformance usually traces to one or more of:
- **Intent mismatch** — wrong page type/angle for what's actually being searched (`workflows/search-intent.md`)
- **Thin coverage** — missing subtopics a thorough answer would include
- **Staleness** — outdated facts, pricing, screenshots, or references
- **Weak structure** — poor heading hierarchy, no scannability, key info buried
- **Weak on-page signals** — title/description not reflecting the content's actual strength (`workflows/on-page-seo.md`)
- **Weak internal linking** — the page isn't reinforced by related content (`workflows/internal-linking.md`)

Diagnose before rewriting — a structure/linking fix doesn't need new prose, and a thin-content problem isn't fixed by a better title.

### 5. Edit with discipline

- Preserve the existing voice and tone (see [[../rules/content-quality]]).
- Add genuine information gain — specifics, clearer explanations, missing subtopics, current data — not filler restating the heading.
- Update structure (headings, scannability) using existing design-system patterns.
- Never invent statistics, quotes, or authority signals to "beef up" the page (see [[../rules/no-fabrication]]).
- Keep edits scoped to the content and its immediate on-page signals; don't let this workflow drift into an unrelated redesign.

### 6. Update supporting signals together

Once content changes, revisit title/description (`workflows/on-page-seo.md`) and structured data (`workflows/schema.md`) if the page's substance changed enough that they're now stale — but don't touch them if the content edit didn't actually change what they describe.

## Output

Edited content plus a `templates/change-report.md` stating exactly what changed and why, referencing the diagnosed problem from step 4 — not just "improved content."
