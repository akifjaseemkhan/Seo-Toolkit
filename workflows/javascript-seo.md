# Workflow: JavaScript SEO

**Purpose:** Ensure client-rendered/SPA content and metadata are reliably crawlable and indexable, and identify the smallest safe fix when they aren't — without migrating rendering strategy or framework.

**Modifies files:** Yes, for scoped fixes within the existing rendering strategy — under [[../rules/architecture-preservation]] and [[../rules/implementation-safety]].

## Why this needs special handling

Search engines can execute JavaScript, but rendering is a second, resource-constrained pass, not a guarantee — and it can be delayed, incomplete, or fail on content that depends on client-side data fetching, complex hydration, or client-only routing. This risk scales with how much critical content/metadata depends purely on client execution.

## Audit procedure

1. **Confirm actual rendering strategy per route** — CSR, SSR, SSG, ISR, or hybrid (per-route config in the framework). Don't assume uniformity across the app.
2. **Check what's in the initial server-rendered/static HTML** for key templates — view the actual raw HTML response (not the post-hydration DOM). Is the primary content, are the headings, are the internal links, and is the metadata (title, description, canonical, schema) present without requiring JS execution?
3. **Check client-side routing** — does client-side navigation between routes produce unique, crawlable URLs with server-renderable initial states, or does it rely on client-only routing that never round-trips through the server for a fresh crawl?
4. **Check data-fetching timing** — is critical content fetched client-side after initial paint (risking incomplete rendering snapshots) versus fetched server-side/at build time and included in the initial payload?
5. **Check for JS-only links** — internal links implemented as `onClick` handlers with no real `href`/anchor are not reliably crawlable; confirm real anchor elements are used even where a JS handler also exists for client-side navigation (a normal, safe pattern in most frameworks' routers).

## Fixing within the existing architecture

Per [[../rules/architecture-preservation]], never recommend a framework/rendering migration to solve this. Instead, look for:

- **Per-route rendering config** — many frameworks allow choosing SSR/SSG/ISR per route without migrating anything; moving a handful of critical, content-heavy routes to a static/server-rendered mode is often a config change, not an architecture change.
- **Server-rendered metadata even with client-rendered body** — ensuring title/description/canonical/schema are emitted server-side is usually achievable even when the main content itself stays client-rendered, and captures a large share of the SEO benefit on its own.
- **Critical-content fallback** — rendering essential text/links server-side or at build time even if the interactive/enhanced version hydrates client-side afterward (progressive enhancement pattern).
- **Real anchor tags** for internal navigation even in SPA routers (virtually every modern router supports this natively).

## When no in-architecture fix exists

Report the limitation plainly under "Requires Explicit Decision," describe the actual SEO risk in concrete terms (not fear-based generalities), and let the user weigh it against the cost of a larger architectural change. Never implement that larger change unprompted.

## Output

Findings/fixes reported per standard templates. Explicitly note in the report which content/metadata is confirmed present in server-rendered output and which still depends on client execution.
