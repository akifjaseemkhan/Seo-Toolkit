# Workflow: Keyword Research

**Purpose:** Identify what terms are worth targeting and how they map to the site's actual pages, without ever letting keyword existence alone justify a page.

**Modifies files:** No. This is a research and strategy workflow feeding `workflows/content-strategy.md` and `templates/keyword-map.md`.

## Inputs this skill can and cannot access

This skill does not have direct access to live keyword-volume tools (Google Keyword Planner, Ahrefs, SEMrush, etc.) unless the user provides that data or a connected tool is available in the session. Work with what's available:

- **Search Console query data**, if accessible — the single best source, since it reflects real queries already driving impressions to this exact site (see `workflows/search-console.md`).
- **User-supplied research** — if the user has existing keyword data/exports, use it directly rather than re-deriving from scratch.
- **Reasoned inference from the site's actual content, product/service catalog, and known competitors** — weaker than real volume data, but honestly labeled as inference, not presented as if it were measured data.

Never present invented search-volume numbers as real data. If asked for volume estimates without a real data source, say so plainly and offer directional reasoning (e.g., "this is a broader/more competitive term than that one based on specificity and typical demand patterns") instead of a fabricated number.

## Procedure

### 1. Seed terms

Start from what the project already tells you: product/service names, category names, existing page titles/headings, existing content topics. Expand from there, not from a generic industry list unrelated to what this specific project actually offers.

### 2. Cluster by topic and intent

Group related terms into topic clusters. Within each cluster, separate by intent (informational, commercial, transactional, navigational — see `workflows/search-intent.md`), since intent determines page type, not just keyword choice.

### 3. Map to existing pages

For each cluster, check: is there already a page targeting this? If yes, is it the *right* page, or is there a stronger page elsewhere on the site competing for the same term (cannibalization)? If no page exists, that's a genuine content gap — feed to `workflows/content-strategy.md`.

### 4. Identify cannibalization

Two or more pages ranking for/targeting the same query with the same intent split authority and confuse search engines about which is canonical for that topic. Resolve by consolidating into one strongest page (with a redirect from the weaker one, handled per [[../rules/canonical-rules]]) or by clearly differentiating intent/angle if both pages genuinely deserve to exist.

### 5. Long-tail and entity considerations

Long-tail terms (more specific, lower competition, often higher intent-match) are usually a better fit for new content than head terms, especially on smaller/newer sites. Consider entities and semantic relationships (related concepts, not just exact keyword variants) — modern search doesn't require exact-match keyword insertion to understand relevance.

### 6. Prioritize

Score clusters by: estimated demand (from real data where available), competitiveness, relevance to actual business goals, and content-creation effort. Feed into `templates/keyword-map.md`.

## Hard rule

A keyword existing (or having search volume) is never sufficient justification for creating a page. The page must also pass the value bar in [[../rules/content-quality]]. If a keyword cluster doesn't correspond to anything the site can genuinely, usefully address, don't recommend a page for it — say so.

## Output

`templates/keyword-map.md`, feeding `workflows/content-strategy.md` and `workflows/information-architecture.md`.
