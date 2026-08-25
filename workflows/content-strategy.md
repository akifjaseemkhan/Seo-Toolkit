# Workflow: Content Strategy

**Purpose:** Decide what new content is genuinely worth creating, based on real demand and real gaps — not just what a keyword tool surfaced.

**Modifies files:** No. This is a planning workflow that outputs `templates/content-roadmap.md`. Actual writing/publishing is a separate, explicitly-confirmed step.

## Procedure

### 1. Establish the topical foundation

From `workflows/keyword-research.md` output, identify the core topic clusters the site should own given what it actually offers. Don't import a generic industry content strategy — ground every cluster in the project's real products/services/expertise.

### 2. Identify genuine gaps

For each cluster, check what already exists on the site (`workflows/information-architecture.md` mapping) and what's currently ranking for it elsewhere. A gap is genuine when: real search demand exists, the site has nothing (or something weak/outdated) covering it, and the site has real, credible standing to cover it (see [[../rules/content-quality]] and [[../rules/no-fabrication]] — don't recommend content that would require fabricated expertise).

### 3. Assign intent and page type to every recommendation

Every roadmap entry must specify: target intent (`workflows/search-intent.md`), page type (blog post, comparison page, product page, landing page, tool, FAQ), and where it fits in the site's IA (`workflows/information-architecture.md`) — not just a topic and a keyword.

### 4. Evaluate against the quality bar

Apply [[../rules/content-quality]] to every candidate before it goes on the roadmap: real demand, distinct value, information gain, honesty, maintainability. Cut anything that's just keyword-fill.

### 5. Consider format and depth

Match depth to competitiveness and intent — a highly competitive commercial-intent term usually needs a thorough, well-structured page; a niche long-tail informational term can be served well by a focused, shorter piece. More words is not automatically better; matching what genuinely serves the query is.

### 6. Sequence

Prioritize by: estimated demand/impact, competitiveness, effort, and how well it reinforces the site's overall topical authority (content that strengthens an existing cluster the site is already building authority in often outperforms an isolated one-off, even at similar individual-page potential).

### 7. Flag programmatic/scaled opportunities separately

If a content opportunity looks like it could scale into many similar pages (e.g., one per product category, one per city), do not fold it into a normal roadmap entry — route it through `workflows/programmatic-seo.md`'s risk evaluation first.

## Output

`templates/content-roadmap.md`: prioritized list of content recommendations, each with topic, intent, page type, target cluster, priority score, and rationale. Individual piece optimization (once written or for existing content) is `workflows/content-optimization.md`.
