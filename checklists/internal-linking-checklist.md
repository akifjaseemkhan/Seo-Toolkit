# Internal Linking Checklist

See `workflows/internal-linking.md` and `workflows/information-architecture.md`.

## Audit
- [ ] Orphan pages identified (indexable pages with zero internal inbound links)
- [ ] Crawl-depth outliers identified (important pages buried more than ~3-4 clicks from home)
- [ ] Link equity distribution reviewed — are the most important pages the most-linked-to, or is link equity concentrated on low-value pages (e.g., legal/utility pages in global nav/footer)?
- [ ] Anchor text reviewed for descriptiveness (no "click here"/"read more" where a descriptive phrase would help both users and crawlers)
- [ ] Broken internal links identified (linking to 404s or redirect chains)
- [ ] Navigation and footer link sets reviewed for relevance and bloat

## Contextual linking
- [ ] Related-content opportunities identified within body copy (linking genuinely related pages to each other, not force-fitting keywords)
- [ ] Hub/pillar pages (if content strategy defines them) link out to their cluster members, and cluster members link back to the hub
- [ ] No excessive link density that would look manipulative or overwhelm the page's real content

## Implementation constraints
- [ ] New links use existing link/component styling — no new visual pattern introduced without confirmation (see [[../rules/ui-preservation]])
- [ ] Links added to body copy read naturally in context, not inserted as a bolted-on list
- [ ] No link scheme patterns (reciprocal link farms, excessive footer link stuffing) — see [[../rules/no-black-hat]]

## Output
- [ ] Findings mapped in `templates/internal-link-map.md`
- [ ] Orphan pages and crawl-depth issues prioritized by the page's actual business value, not just technical severity
