# Indexing Checklist

See `workflows/indexing.md` and [[../rules/indexing-rules]]. Use when diagnosing "pages aren't showing up in Google" or before/after any indexing-affecting change.

## Diagnostic order (cheapest/most-likely first)

- [ ] Confirm the page actually returns HTTP 200 (not 404, not redirecting)
- [ ] Confirm the page is not `noindex`ed (meta robots tag and `X-Robots-Tag` header)
- [ ] Confirm the page is not blocked by `robots.txt`
- [ ] Confirm the page's canonical points to itself (or to another intentionally-indexed URL, not away from an important page)
- [ ] Confirm the page is linked from somewhere crawlable (not orphaned — see `workflows/internal-linking.md`)
- [ ] Confirm the page is in the sitemap (helps discovery; not required for indexing but a positive signal)
- [ ] Confirm critical content is present in server-rendered/initial HTML or reliably crawlable if CSR (see `workflows/javascript-seo.md`)
- [ ] Confirm the page isn't a near-duplicate of another indexed page (content quality/uniqueness — see [[../rules/content-quality]])
- [ ] Confirm the page meets a basic quality bar — Google can choose not to index technically-valid but low-value pages
- [ ] Check Search Console Coverage/Page Indexing report for the specific exclusion reason if access is available (see `workflows/search-console.md`) — this is authoritative and should be checked early if available, not last

## Before making an indexing-affecting change
- [ ] Current state of `robots.txt`, sitemap, and the specific page's meta robots captured as baseline
- [ ] Environment confirmed (production vs. staging/preview) — see [[../rules/indexing-rules]]
- [ ] Scope of change confirmed (single page vs. template/pattern-wide)
- [ ] If pattern-wide: explicit user confirmation obtained per [[../rules/implementation-safety]]

## After making an indexing-affecting change
- [ ] Diff of `robots.txt`/sitemap/meta robots reviewed line by line
- [ ] No unintended pages newly blocked or newly exposed
- [ ] Sitemap validated (well-formed XML, no contradictory entries — see [[../rules/indexing-rules]])
- [ ] User informed that actual reindexing takes time and where to verify externally (Search Console) — see `workflows/post-implementation.md`

## Never
- [ ] Never treat `robots.txt` as access control (see [[../rules/indexing-rules]])
- [ ] Never leave a sitemap entry for a `noindex`ed, blocked, or non-200 URL
- [ ] Never remove an existing `noindex` without understanding why it was added first
