# Changelog

All notable changes to this project are documented in this file. Dates are in `YYYY-MM-DD` format. This project does not yet follow a formal versioning policy beyond marking its first stable release as `1.0.0` (see `tools/seo-tool/package.json`); future releases will be tagged in git as they're cut.

## [Unreleased]

### Added
- `.github/workflows/ci.yml` — GitHub Actions CI that runs the test suite on every push and pull request.
- `CHANGELOG.md` (this file).
- `CONTRIBUTING.md` — contribution guidelines specific to this repository's constraints (zero-breakage philosophy, zero dependencies, agent-agnostic design, test requirements).

### Changed
- `README.md`: removed two "Recommended improvements for a future version" bullets that had already been implemented (a local crawler/link-checker and a machine-readable JSON findings format both shipped as `tools/seo-tool`); added a License section and a Testing section; added a version/changelog pointer.
- `docs/tooling.md`: updated the Testing section to mention the CLI, `fetch-utils`, and `report.js` test files and sitemap-index recursion coverage added after this section was originally written.

## [1.0.0] — 2026-08-27

Initial stable release of the SEO Toolkit.

### Added
- The core SEO engineering skill: `SKILL.md` (agent-agnostic controller), `rules/`, `workflows/`, `checklists/`, `frameworks/`, `templates/`, and `commands/` — a reusable, evidence-driven SEO engineering system for any AI coding agent.
- `docs/` — installation, usage, architecture, safety, workflow, and tooling reference documentation.
- `tools/seo-tool` — a zero-dependency, read-only Node.js CLI for local SEO inspection: `crawl`, `page`, `links`, `sitemap`, `robots`, `audit`, and `project` commands, producing structured JSON evidence for the reasoning layer to consume.
- `README.md`'s Architecture section and Mermaid diagram describing the knowledge-layer / fact-gathering-layer split and the `AUDIT → PLAN → RISK CHECK → FIX → VERIFY → REPORT` loop.
- `README.md`'s "External SEO Work" section, documenting the SEO work that genuinely requires external platforms, external data, or business input (Search Console, analytics, keyword/backlink tools, competitor SERP data, Google Business Profile, business context, external infrastructure).
- MIT `LICENSE`.

### Improved (reliability & test infrastructure)
- Added dedicated test coverage for `cli.js` (command dispatch, argument parsing, exit codes, `--json`/`--json=path` output), `lib/fetch-utils.js` (timeouts, redirect chains, redirect loops, capped body reads, network-error classification), and `lib/report.js` (the documented JSON report schema) — none of these had direct test coverage before.
- Added `<sitemapindex>` recursion: `sitemap` and `audit` now resolve the full tree of child sitemaps by default — bounded (`--max-sitemaps`, `--max-sitemap-depth`), same-origin restricted, duplicate/cycle-protected, and never aborting the whole tree on one malformed or unreachable child. This fixed a real bug where `audit`'s orphan-page detection silently produced empty results against any site whose sitemap was an index rather than a single `<urlset>`.
- Fixed a Windows-specific bug where a local file path (e.g. `D:\path\to\sitemap.xml`) passed to the sitemap resolver was misparsed as a URL with a one-letter scheme, which would have incorrectly rejected every child sitemap as "cross-origin."
- Test suite grew from 69 to 132 tests as part of this work, all passing.
- Updated `docs/safety.md` to reflect the authoritative Category A/B/C/D risk model already in use in `SKILL.md` and `rules/implementation-safety.md`.
- Cleaned up minor review findings: removed a dead conditional in the sitemap CLI summary, replaced an ambiguous `entryCount` field (which meant different units for `urlset` vs. `sitemapindex` nodes) with clearly-named `urlCount`/`childCount` fields, removed an unused internal field, and documented the bounded worst-case latency of sequential sitemap-index processing.
