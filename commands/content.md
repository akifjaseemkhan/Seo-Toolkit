# Command: /seo content

**Modifies files:** For research/strategy phases, no. For actual content writing/editing, yes — under [[../rules/implementation-safety]] and strictly bound by [[../rules/content-quality]] and [[../rules/no-fabrication]].

## Purpose

Content-focused work: keyword research, content strategy/roadmap, or optimizing/writing specific content.

## Procedure

1. Determine what's actually being asked: a strategy/roadmap (no writing yet) vs. optimizing existing content vs. writing new content.
2. **Strategy request**: run `workflows/keyword-research.md` → `workflows/search-intent.md` → `workflows/content-strategy.md`. Output `templates/keyword-map.md` and `templates/content-roadmap.md`. No files modified.
3. **Optimize existing content**: run `workflows/content-optimization.md`. Modifies the specific content file(s) identified, with a diagnosed reason per that workflow.
4. **Write new content**: confirm the content passed evaluation in `workflows/content-strategy.md` (or run that evaluation now if not already done) before writing. Apply `checklists/content-checklist.md` in full to the finished piece before considering it done.
5. If the request looks like it could scale into many similar pages (e.g., "write a page for every X"), route through `workflows/programmatic-seo.md`'s evaluation first — do not write at scale before that evaluation passes.

## Constraints

- Never fabricate statistics, credentials, quotes, or authority signals — see [[../rules/no-fabrication]].
- Match existing site voice/tone; don't impose generic "SEO content" style.
- A keyword having demand is never sufficient justification alone — the content-quality bar in [[../rules/content-quality]] must also be met.

## Output

Depending on request: `templates/keyword-map.md` + `templates/content-roadmap.md` (strategy), or edited/new content plus `templates/change-report.md` (implementation).
