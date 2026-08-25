# Workflow: Sitemap

**Purpose:** Ensure the XML sitemap accurately represents exactly the set of URLs that should be indexed — no more, no less.

**Modifies files:** Yes, under [[../rules/implementation-safety]] and [[../rules/indexing-rules]].

## Audit procedure

`node tools/seo-tool/cli.js sitemap <urlOrPath> --check-status` (see `docs/tooling.md`) parses the file, flags missing/malformed entries, exact and trailing-slash-variant duplicates, and non-public-looking paths, and can spot-check a capped number of listed URLs' real HTTP status — use it to gather the evidence for the checks below rather than reading the raw XML by hand for a large sitemap.

1. Locate the sitemap — a static file, a generated route, or a plugin-driven output (WordPress). Confirm it's referenced in `robots.txt`.
2. Validate it's well-formed XML and (if large) correctly uses a sitemap index if the entry count approaches the per-file limit.
3. Cross-check every included URL:
   - Returns 200 (not 404/redirect)
   - Not `noindex`ed
   - Not blocked by `robots.txt`
   - Is the canonical version of itself (not a non-canonical duplicate)
4. Cross-check for omissions: real, indexable, canonical pages that should be listed but aren't (often dynamic routes the generator doesn't know about).
5. Check `lastmod` values — must reflect a real modification signal (CMS updated-at field, git history, build data), never a fabricated/blanket "today" value across every entry. See [[../rules/no-fabrication]].
6. Confirm excluded categories are correct: admin/auth pages, private/user-specific pages, internal search results, duplicate parameter variants, and any intentionally `noindex`ed content should never appear.

## Implementation approach

- **Prefer deriving the sitemap from the actual route source** (the framework's route table, the CMS's published-content query, the product catalog) over a hand-maintained static list, so it can't silently drift out of sync with reality. If the project already generates dynamically, fix the generation logic rather than patching the output.
- If a static/hand-maintained sitemap is the existing pattern and a full dynamic rewrite would be a larger architectural change than warranted, a scoped fix (adding missing entries, removing stale ones) is fine — but flag the drift risk to the user as a longer-term recommendation.
- Exclude URLs per the checklist above at the generation-logic level, not by manually deleting rows after the fact (which will just regenerate incorrectly next build).

## Constraints

- Never include a `noindex`ed, blocked, or non-200 URL — see [[../rules/indexing-rules]].
- Never fabricate `lastmod` dates.
- Never sitemap private/user-specific/session URLs — this can also be a privacy issue, not just an SEO one.
- Sitemap changes affecting large numbers of URLs at once (e.g., changing the generation logic for a whole content type) should be scoped and confirmed per [[../rules/implementation-safety]] before implementing.

## Output

Validated sitemap plus `templates/change-report.md`. Note that sitemap submission/resubmission in Search Console (if changed significantly) is a user action — see `workflows/search-console.md`.
