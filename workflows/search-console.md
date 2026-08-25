# Workflow: Google Search Console Workflows

**Purpose:** Use Search Console data (when accessible) to ground prioritization in real performance data, and know what actions in Search Console are the user's to take.

**Modifies files:** No. This skill cannot access Search Console directly unless the user provides exported data or a connected tool/integration is available in the session. Treat all guidance here as "what to do with this data" and "what to ask the user for," not an assumption of live access.

## What Search Console data is uniquely valuable for

- **Real query data** — actual search terms driving impressions to this exact site, far more reliable than inferred keyword research (`workflows/keyword-research.md`).
- **Indexing ground truth** — the Page Indexing report states the actual reason a page isn't indexed, replacing guesswork in `workflows/indexing.md`.
- **Performance trends** — impressions, clicks, CTR, average position over time, by page and by query — the best source for prioritizing `workflows/content-optimization.md` targets.
- **Coverage/error reports** — crawl errors, sitemap processing status, mobile usability issues.
- **Manual actions** — critical to check if a site has ever had unexplained ranking drops; a manual action changes the entire diagnosis.

## If the user has data to share

Ask for relevant exports/screenshots when they'd materially change prioritization (e.g., before finalizing a content-optimization target list, before diagnosing an indexing issue if step 10 of `checklists/indexing-checklist.md` is reachable). Use real data over inference whenever it's available.

## High-value analyses to run on provided data

- **Pages ranking positions 8–30 for decent-volume queries** — often the highest-ROI optimization targets: already relevant enough to rank on page 1-3, usually fixable with on-page/content improvements rather than needing new content or links.
- **Pages with high impressions but low CTR** — title/description problem, not a ranking problem; fix per `workflows/on-page-seo.md`.
- **Pages with declining impressions/clicks over time** — investigate for content staleness (`workflows/content-optimization.md`), a new stronger competitor, or a technical regression (`workflows/technical-seo.md`).
- **Queries with impressions but no matching page** — real content gaps, feeding `workflows/content-strategy.md` with actual demand evidence instead of inference.

## Actions that are the user's to take (never claim to have done these)

- Submitting/resubmitting a sitemap
- Requesting indexing for a specific URL
- Setting international targeting
- Reviewing/resolving manual actions
- Managing property verification and user access
- Reviewing Core Web Vitals field-data reports

Report these clearly under "External Configuration Required" or as follow-up steps in `templates/change-report.md` — with precise instructions for what to click/where, not vague pointers.

## Output

Data-grounded prioritization feeding into whichever workflow the data applies to; a monitoring cadence recommendation feeding `workflows/monitoring.md`.
