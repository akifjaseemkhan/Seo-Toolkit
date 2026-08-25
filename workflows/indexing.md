# Workflow: Indexing Diagnosis

**Purpose:** Diagnose why specific pages aren't indexed/ranking, or verify indexing signals are correctly set before/after a change.

**Modifies files:** Only for confirmed, scoped fixes — under [[../rules/implementation-safety]] and [[../rules/indexing-rules]].

## When to use this

"This page isn't showing up in Google," "we deindexed something by accident," "how do I get this new page indexed faster," or as a verification step before/after any change that touches robots.txt, sitemap, canonical, or noindex.

## Diagnostic procedure

Follow `checklists/indexing-checklist.md` in order — it's ordered cheapest/most-likely-cause first:

1. Confirm the page returns 200, not 404/redirect.
2. Confirm no unintended `noindex` (meta tag and HTTP header both — they can disagree).
3. Confirm not blocked by `robots.txt`.
4. Confirm canonical points to itself (or an intentional target), not away.
5. Confirm it's actually linked from somewhere crawlable — orphan pages are discovered far more slowly, if at all (`workflows/internal-linking.md`).
6. Confirm it's in the sitemap.
7. Confirm critical content renders without requiring JS execution search engines might not fully process, or is otherwise reliably crawlable (`workflows/javascript-seo.md`).
8. Confirm it's not a near-duplicate of another indexed page.
9. Confirm it meets a basic quality bar — a technically-indexable but very thin/low-value page can be excluded by Google's own quality filtering, independent of any technical block.
10. **If Search Console access is available, check the Page Indexing report's stated exclusion reason directly** — this is authoritative and should be consulted early, not as a last resort, since it eliminates guesswork on the rest of the list. See `workflows/search-console.md`.

## Common root causes and their fixes

- **Accidental blanket noindex from a staging default leaking to production** — fix the environment-conditional logic, not just the symptom on one page.
- **New page not yet discovered** — confirm it's linked and sitemapped; indexing of genuinely new content takes real time, this isn't always a bug.
- **Canonical pointing elsewhere** — fix per [[../rules/canonical-rules]], verify domain/URL correctness first.
- **Duplicate content self-competition** — resolve via consolidation or clearer differentiation (`workflows/keyword-research.md` cannibalization section).
- **Quality-based exclusion** — no code fix exists; the content itself needs to improve (`workflows/content-optimization.md`) or the page may not be worth indexing.

## Implementation

Single-page, clearly-diagnosed fixes: implement directly once confirmed. Pattern/template-wide fixes (a shared layout injecting `noindex` incorrectly across many pages): confirm scope and get explicit sign-off before implementing, per [[../rules/implementation-safety]].

## Output

Diagnosis reported plainly: root cause identified, fix applied (or recommended), and — critically — that reindexing takes real time and must be verified externally via Search Console over the following days/weeks, not assumed instant. See `workflows/post-implementation.md`.
