# Workflow: Internal Linking

**Purpose:** Improve how link equity and crawl paths flow through the site by fixing orphan pages, excessive crawl depth, weak anchor text, and broken internal links.

**Modifies files:** Yes, for additive link fixes — under [[../rules/implementation-safety]] and [[../rules/ui-preservation]].

## Audit procedure

Work through `checklists/internal-linking-checklist.md`:

1. **Orphan pages** — indexable pages with no internal inbound links. Cross-check the sitemap/route list against what's actually linked from navigation, footer, and body content across the site. `node tools/seo-tool/cli.js audit <url>` (see `docs/tooling.md`) automates exactly this cross-reference — it flags sitemap URLs that never appeared as a link target during the crawl. Note that `crawl`/`links` alone cannot find orphans (a single-seed crawl can only reach pages something links to, by construction) — use `audit` specifically for this check.
2. **Crawl depth** — for important pages, count clicks from home. Deep-buried important pages (e.g., a key product 6 clicks deep) need either a structural fix (`workflows/information-architecture.md`) or added contextual links from higher-authority pages.
3. **Link equity distribution** — check whether global nav/footer links are spending link equity on low-value utility pages (privacy policy, terms) at the expense of high-value content, and whether the most important pages are actually the most internally-linked.
4. **Anchor text** — flag generic anchor text ("click here," "read more," "this page") on links where descriptive text would help both users and search engines understand the destination.
5. **Broken internal links** — links pointing to 404s or unnecessary redirect hops.

## Adding links

- Prefer contextual, in-content links where genuinely relevant over bolted-on "related links" lists, but both are legitimate depending on the page.
- Anchor text should be descriptive and natural in context — not exact-match keyword repetition every time (varied, natural phrasing is healthier and reads better).
- Use the existing link component/styling — don't introduce a new visual treatment for links without confirmation. See [[../rules/ui-preservation]].
- Don't add links that don't serve the reader. A page linked from twelve unrelated places to "build link equity" with no topical relevance is a link-scheme pattern — see [[../rules/no-black-hat]].

## Fixing orphan pages

Prioritize by the page's actual business value, not just "it's technically orphaned." A genuinely low-value orphaned page might be better `noindex`ed or removed than linked into prominence — that's a judgment call to surface to the user, not to make unilaterally if the page's value is unclear.

## Fixing broken links

Fix the link's destination when the correct target is knowable (update the href). Don't rely on a redirect alone as the fix when the link itself is simply wrong.

## Output

Findings mapped in `templates/internal-link-map.md`. Implementation changes reported per `templates/change-report.md`, with the "UI Changes" section stating exactly what new links/anchor text appeared where.
