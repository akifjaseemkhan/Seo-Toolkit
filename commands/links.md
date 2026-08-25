# Command: /seo links

**Modifies files:** Yes, for additive internal link fixes — under [[../rules/implementation-safety]] and [[../rules/ui-preservation]].

## Purpose

Internal linking and information architecture work: orphan pages, crawl depth, anchor text, link equity distribution.

## Procedure

1. Run `workflows/information-architecture.md` to establish structural context.
2. Run `workflows/internal-linking.md` using `checklists/internal-linking-checklist.md`.
3. Produce `templates/internal-link-map.md`.
4. If implementing fixes: add links using existing link/component styling only (see [[../rules/ui-preservation]]), with genuinely relevant anchor text — never volume-maximized or forced insertions (see [[../rules/no-black-hat]]).
5. Structural IA changes (new categories, URL hierarchy changes) found along the way are out of scope for a quick link fix — flag them for a separately-scoped `templates/implementation-plan.md` rather than folding them in.

## Output

`templates/internal-link-map.md` plus, if links were added, `templates/change-report.md` stating exactly what new links/anchor text appeared and where.
