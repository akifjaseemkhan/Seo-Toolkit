# Local SEO Tooling

`tools/seo-tool` is a small, read-only, zero-dependency Node.js CLI that this skill can run to collect real facts about a project instead of relying only on reading source code or reasoning from general knowledge. This document explains what it is, when to use it, what it guarantees, and the JSON shape it produces.

## Three layers — keep them separate

Every SEO finding this skill produces should be traceable to one of three sources. Conflating them is how a report ends up making a claim it can't actually back up.

1. **Source inspection** — reading the project's actual code (`workflows/discovery.md`, `docs/architecture.md`). Tells you what the project is *supposed* to produce: which metadata API is wired up, what the sitemap generator's logic does, what the canonical logic says. It does not tell you what actually renders.
2. **Local SEO tools** (`tools/seo-tool`) — fetching real HTML/robots.txt/sitemap.xml (from a local dev server or a live deployed URL) and extracting facts from what was actually returned. Tells you what's *actually there*, closing the gap between "the code should produce X" and "the response actually contains X." This layer never interprets — it reports facts.
3. **Human/agent reasoning** — applying `workflows/*.md` and `rules/*.md` to the facts from layers 1 and 2 to decide severity, priority, and recommendations. The tool never does this step. A missing canonical tag is a fact from layer 2; "this is a High-severity finding because it risks duplicate-content indexing at catalog scale" is layer 3.

Never let the tool's output stand in for layer 3 reasoning, and never skip layer 2 in favor of assuming source inspection alone proves what renders — the two can and do diverge (a metadata API can be wired up correctly and still fail to render for a specific dynamic route, a CMS field can be empty in production while looking populated in a template).

## Local vs. live vs. external — what each can actually tell you

| Scope | What it proves | How to check it |
|---|---|---|
| **Local/project inspection** | What the source code is set up to do | `node tools/seo-tool/cli.js project [path]`, or manual inspection per `workflows/discovery.md` |
| **Local development server** | What actually renders in this environment, including dynamic behavior — but not necessarily what production renders (env vars, feature flags, and build mode can differ) | `node tools/seo-tool/cli.js page/crawl/audit http://localhost:PORT` |
| **Deployed/live website** | What a real crawler would actually see right now | `node tools/seo-tool/cli.js page/crawl/audit https://the-real-domain.com` |
| **External platforms** (Search Console, Google Business Profile, rank trackers, backlink indexes, analytics) | Real indexing/ranking/traffic/authority data | Cannot be fetched by this tool at all — see `workflows/search-console.md` and the "External Configuration Required" reporting category |

**Never present a local or source-code finding as if it were external data.** "The canonical tag is missing" (verified by the tool against a live URL) is a fact. "This page isn't ranking because of it" is an inference that needs Search Console data to actually confirm — see [[../rules/verification-rules]].

## When to use the toolkit

The toolkit is an accelerant for workflows that already tell you what to inspect — it is never mandatory, and workflows must still function fully by manual inspection when it can't reasonably be used (no network access to the target, a non-HTTP project, the user hasn't provided a URL).

Use it when:

- `workflows/discovery.md` step 4 (existing SEO implementation presence check) — run `project` to get framework/package-manager/config-file facts in one pass instead of manually globbing.
- `workflows/technical-seo.md` and `checklists/technical-checklist.md` — run `crawl` or `audit` against a live URL (dev or deployed) to get real status codes, redirect chains, canonical values, and indexability signals instead of inferring them from template code alone.
- `workflows/sitemap.md` — run `sitemap --check-status` to validate structure and, optionally, spot-check that listed URLs actually resolve.
- `workflows/robots.md` — run `robots --important=/path1,/path2` to check whether specific important paths are blocked.
- `workflows/internal-linking.md` and orphan-page analysis — run `audit` (which cross-references the sitemap against crawl-discovered links) rather than `crawl` alone; see the note in the JSON schema below about why a crawl by itself can't find orphans.
- Any `/seo audit` where a live or local URL is available — running `audit` once up front gives every subsequent pass real evidence to cite instead of assumptions.

Don't use it when:

- The user hasn't provided or confirmed a URL to inspect, and none is discoverable (e.g., no local dev server is running) — ask, don't guess at a URL.
- The finding is purely about source-code structure (e.g., "is this template using the right schema type") — that's layer 1, read the code.
- The target is large enough that a full crawl would be slow or heavy — scope it (`--max-pages`) or crawl a representative section rather than the whole site.

## Safety guarantee

Every command in `tools/seo-tool` is read-only against everything it inspects: it only ever issues `GET` HTTP requests (never a mutating method) and only ever reads local files. It never edits source files, never writes `robots.txt`/`sitemap.xml`/`package.json`, never modifies routes or configuration, and never touches Git state. The only thing it ever writes is its own JSON report, and only when you explicitly pass `--json=path`. This mirrors the audit/implement separation in `SKILL.md` — the toolkit only ever performs the "audit" half.

It is also conservative by default: same-origin only (external links are recorded but not crawled unless `--include-external` is passed), a configurable page cap (`--max-pages`, default 50), a delay between request batches (`--delay`, default 250ms), bounded concurrency (`--concurrency`, default 2), a request timeout (`--timeout`), it respects `robots.txt` by default (`--no-robots` to override, e.g. for auditing your own project's disallowed paths), and it refuses private/internal network targets by default (`--allow-private-network` to override — see below).

### Private-network protection (a safety boundary, not an SEO feature)

By default, no command in this toolkit will fetch a target whose host is a private or internal network address: RFC1918 IPv4 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`), link-local IPv4 including the cloud metadata address `169.254.169.254` (`169.254.0.0/16`), the unspecified address `0.0.0.0`, and the IPv6 equivalents (link-local `fe80::/10`, unique-local `fc00::/7`, and the unspecified `::`) — including IPv4-mapped IPv6 forms of any of the above (e.g. `::ffff:169.254.169.254`) and the NAT64 well-known prefix `64:ff9b::/96` (RFC 6052) encoding the same (e.g. `64:ff9b::169.254.169.254`). This applies to **every** URL this tool fetches, including **every redirect hop**, not just the URL you typed — a public URL that redirects to a private address is blocked at the redirect, before that request is ever made.

**Loopback stays allowed by design**: `localhost`, `127.0.0.1` (the whole `127.0.0.0/8` range), and IPv6 `::1` are never blocked, because a loopback address can only ever reach back to the same machine running the tool — auditing your own local dev server is a documented, supported use case (`docs/installation.md`), not a risk this check exists to prevent.

A blocked target produces the same kind of result as any other fetch failure — `{ error: { type: 'blocked_private_network', message: '...' } }` — through the existing error/result model (`page.error`, `crawlResult.errors`, a command's `fetchError`), not a special case. No request is made to the blocked address, so no response from it can ever appear in the tool's output.

**`--allow-private-network`** deliberately lifts this restriction, for a legitimate case this tool cannot tell apart from a risk automatically: auditing a real site on your own internal network (an internal staging server, an on-prem deployment). It is off by default and must be passed explicitly and knowingly — it is not something to reach for casually, and it applies to the whole command's run (initial URL and every redirect hop), not a narrower scope.

**Known, deliberate limitation**: this check only recognizes *literal* IP addresses in the URL's host — it does not perform DNS resolution. A hostname that *resolves* to a private address (an internal DNS entry, or a domain deliberately set up to do this) is not caught. Adding that would require resolving every hostname before every request (and re-resolving on every redirect hop, since the resolved address can change between checks — a much larger, riskier scope than this check) — see `lib/url-utils.js`'s `isPrivateNetworkTarget` for the exact, literal policy this implements.

## Commands

Run from the repository (no global install, no `npm install` needed — zero dependencies):

```bash
node tools/seo-tool/cli.js crawl <url>    [--max-pages=50] [--delay=250] [--concurrency=2]
                                          [--timeout=10000] [--include-external] [--no-robots]
                                          [--allow-private-network] [--json[=path]]
node tools/seo-tool/cli.js page <url>     [--timeout=10000] [--allow-private-network] [--json[=path]]
node tools/seo-tool/cli.js sitemap <urlOrPath> [--check-status] [--max-checks=20]
                                               [--max-sitemaps=50] [--max-sitemap-depth=5] [--no-recurse]
                                               [--allow-private-network] [--json[=path]]
node tools/seo-tool/cli.js robots <urlOrPath>  [--important=/a,/b] [--user-agent=Googlebot]
                                               [--allow-private-network] [--json[=path]]
node tools/seo-tool/cli.js links <url>    [--max-pages=50] [--allow-private-network] [--json[=path]]
node tools/seo-tool/cli.js audit <url>    [--max-pages=50] [--max-sitemaps=50] [--max-sitemap-depth=5]
                                          [--allow-private-network] [--json[=path]]
node tools/seo-tool/cli.js project [path] [--json[=path]]
node tools/seo-tool/cli.js diff <report1.json> <report2.json> [--json[=path]]
```

`--json` alone prints the full JSON report to stdout; `--json=path.json` writes it to a file instead. Without `--json`, each command prints a short human-readable summary.

`sitemap` and `robots` accept either a URL or a local file path as their argument.

## What each command collects

- **`page`** — one URL's status, redirect chain, content type, title, meta description, canonical (resolved to an absolute URL against the page's real, post-redirect URL — see the canonical note below), hreflang declarations (also resolved to absolute URLs, with self-reference/duplicate/malformed evidence — see the hreflang note below), pagination (`rel="next"/"prev"`, also resolved, plus the canonical-conflict flag — see the pagination note below), viewport, `charset`, `lang`, favicon presence (see the charset-and-favicon note below), robots meta + `X-Robots-Tag` directives plus whether the two actively disagree (see the robots-directives-conflict note below), an indexability signal (see below), H1/H2 counts and text, Open Graph fields plus whether `og:url` disagrees with the canonical (see the og-url-canonical note below), Twitter card fields, JSON-LD blocks (parsed, with parse errors captured rather than thrown, plus which universally-required properties are missing — see the JSON-LD required-properties note below), internal/external links (with anchor text and `nofollow`), and images (`src`, `alt` presence vs. empty alt, plus explicit dimensions/`loading` evidence — see the image-dimensions note below).
- **`crawl`** — the same facts for every same-origin page reached by breadth-first traversal from the start URL, plus each page's crawl depth and which pages linked to it (within this crawl), plus cross-page duplicate-title/duplicate-meta-description detection across the whole crawled set (see the duplicate-content note below), plus internal links that only resolve after a redirect hop (see the internal-links-through-redirects note below), plus cross-page hreflang reciprocity checking across the whole crawled set (see the hreflang-reciprocity note below).
- **`sitemap`** — parses `<urlset>` or `<sitemapindex>`. A `<sitemapindex>` is recursed into by default (bounded by `--max-sitemaps`, default 50, and `--max-sitemap-depth`, default 5) so `entryCount`/`urls`/`issues` always reflect the full aggregated set of real page URLs across every child sitemap, never just the list of child filenames — pass `--no-recurse` to see only the root document. Recursion is same-origin, deduplicates repeated/cyclical child sitemap references (each fetched at most once), and records every file it touched in `sitemapsProcessed` plus anything it declined to follow (cross-origin, duplicate, or bound-exceeded) in `skipped`; a `truncated: true` flag means the bounds were hit before the whole tree was covered. Validation flags missing/malformed `loc` values, exact and trailing-slash-variant duplicates, and paths that heuristically look non-public (admin/account/cart-like segments) — a heuristic flag for a human to verify, not a claim of certainty. `--check-status` optionally spot-checks the first N aggregated URLs' real HTTP status.
- **`robots`** — parses groups/rules/`Sitemap:` declarations, and (with `--important`) flags whether specific paths are blocked for a given user-agent, using longest-match-wins evaluation with `*` wildcards and `$` end-anchors.
- **`links`** — the same crawl as `crawl`, with the human summary focused on the link graph.
- **`audit`** — runs `crawl` + fetches `robots.txt` + fetches `/sitemap.xml`, then cross-references the sitemap's URL list against the crawl's discovered internal links to find real orphan candidates (see the orphan-detection note below), and against each crawled page's indexability signal to find sitemap entries that are `noindex`, robots-blocked, or non-200 (see the sitemap/indexability conflict note below).
- **`project`** — local, read-only facts about the project itself: `package.json` dependencies/scripts, detected package manager (from lockfile), framework config files present, `app/`/`pages/`/`wp-content/` directory conventions, SEO-related files found at conventional locations (`robots.txt`, `sitemap.xml`, etc.), and which of a small set of metadata-implementation signal strings (`generateMetadata`, `next/head`, `react-helmet`, `application/ld+json`, etc.) appear in which files. This is a plain substring scan, not code analysis — see Known Limitations.
- **`diff`** — takes two previously-saved `--json=path` report files (not a live URL) and compares them: which pages were added/removed, which tracked fields changed on pages present in both, and the `indexable` transitions confident enough to call a regression or improvement — see the report-diff note below.

## The orphan-detection note

A crawl that starts from one page and only follows discovered links can, by construction, never find a page that truly has zero incoming links — if the crawler reached it, something linked to it. Real orphan detection needs an independent list of URLs that *should* exist to cross-reference against what the crawl actually found linked — that's what `audit` does by comparing the sitemap's URLs against the crawl's discovered link targets. `crawl`/`links` alone will typically report zero orphan candidates, which is expected and documented, not a bug — prefer `audit` when orphan detection specifically matters.

This cross-reference is sitemap-index-aware: `audit` resolves the full sitemap tree (see the `sitemap` command above) before comparing, so a site whose `/sitemap.xml` is actually a `<sitemapindex>` still gets real orphan detection instead of silently comparing against an empty list.

## The internal-links-through-redirects note

`checklists/internal-linking-checklist.md` flags "broken internal links... linking to 404s or redirect chains," and `workflows/internal-linking.md`/`workflows/technical-seo.md` are explicit about the fix: "fix the link's destination when the correct target is knowable... don't rely on a redirect alone," and "never introduce a new redirect hop to fix an old one — collapse it." `linkGraph.internalLinksThroughRedirects` lists `{ from, to, finalUrl, redirectHops }` for exactly this: every internal link whose target resolved successfully, but only after one or more redirect hops, on a real page this crawl actually verified.

This is deliberately a different, separate finding from `brokenInternalLinks`/`unverifiedInternalLinks` — a link through a redirect still works (the reader gets there), it just wastes a hop instead of pointing at the real destination, whereas "broken" means the target actually failed (4xx/5xx or a fetch error) and "unverified" means the crawl never reached the target at all to check. `finalUrl` is exactly what the link's `href` should be updated to. Unlike orphan/sitemap-conflict detection, this needs no independent URL list — it's derived purely from the crawl itself, so it's populated for `crawl`/`links` as well as `audit`, not just `audit`.

## The sitemap/indexability conflict note

`checklists/technical-checklist.md` requires "`noindex` and sitemap inclusion never contradict each other," and `checklists/indexing-checklist.md` requires "never leave a sitemap entry for a `noindex`ed, blocked, or non-200 URL" — a page listed in the sitemap is telling search engines "index this," so a sitemap entry that turns out to be `noindex`, robots-blocked, or a non-200 response is a real, contradictory signal. `audit`'s `linkGraph.sitemapIndexabilityConflicts` lists `{ url, reason }` for exactly this: every sitemap URL that was also reached and fetched within the crawl but turned out not indexable.

This uses the same `knownUrls` cross-reference orphan detection already does, so it shares the same honest bound: a sitemap URL is only checkable here if this crawl actually reached and fetched it — its indexability signal doesn't exist otherwise. A sitemap URL outside the crawl's reached scope is neither confirmed conflicting nor confirmed clean; it's simply not reported either way, not silently assumed fine. Like orphan detection, this is only meaningful for `audit` (the only command that has both a sitemap and a crawl to cross-reference) — `crawl`/`links` alone always report this as an empty list.

## The canonical-resolution note

The `canonical` field on a page is always resolved to an absolute URL, against that page's real, post-redirect URL — a relative (`widgets`), root-relative (`/widgets`), or already-absolute canonical href are all handled the same way, and a query string or fragment present in the href is preserved exactly as declared, not stripped. A canonical tag with no `href`, an empty `href`, or a non-navigable scheme (e.g. `javascript:`) resolves to `canonical: null` rather than throwing or silently keeping a broken value.

A page can declare more than one `<link rel="canonical">` — real search engines only honor one canonical signal per page, so this is a genuine, common SEO problem, not just noise. `page`/`crawl`'s facts always preserve the *first* declaration (in document order) as `canonical`, matching this tool's existing "first match wins" convention elsewhere — but `canonicalCount` and `multipleCanonicals` surface whether more than one was actually declared, and `canonicalRawHrefs` lists every declaration's href exactly as written in the markup (unresolved), in document order, so you can see what every one of them actually said rather than just the one that won. The human-readable `page` summary flags this on the `Canonical:` line instead of silently showing only the first as if there were no ambiguity.

## The hreflang note

`hreflangTags` lists every `<link rel="alternate" hreflang="...">` declaration on the page, in document order, as `{ hreflang, href, rawHref }` — `href` is resolved to an absolute URL the same way `canonical` is (relative/root-relative/absolute all handled consistently, query strings and fragments preserved); `rawHref` is the exact, unresolved value from the markup, for when `href` comes back `null` because it didn't resolve. `hreflangCount` is the total number of declarations found.

Three specific facts are surfaced because `workflows/international-seo.md` explicitly needs them for its audit procedure, not because this tool is guessing at what might be useful:
- **`selfReferencingHreflang`** — whether the page includes an entry pointing back to its own (real, post-redirect) URL. A correct hreflang set is supposed to reference every variant *including itself* — a page missing this is a real, common setup mistake.
- **`hasXDefault`** — whether an `hreflang="x-default"` (the reserved catch-all value) declaration is present. It's recognized as valid, never flagged as malformed.
- **`duplicateHreflangValues`** — hreflang values declared more than once pointing to genuinely *different* resolved targets (a real, conflicting signal — the same value repeated with the exact same target is a harmless, unflagged redundancy).
- **`malformedHreflang`** — `[{ hreflang, issue }]` for values that look wrong: empty, using an underscore instead of a hyphen (`en_US` instead of `en-US`), not shaped like a BCP47 tag at all, or the specific, very common `"xx-UK"` mistake (`"UK"` isn't a valid ISO 3166-1 region code — `"GB"` is). This is a shape/pattern check, not a real ISO-639/ISO-3166 code validator — it exists to catch the exact mistakes this project's own workflow docs already call out, not to certify a code is registered.

**Cross-page reciprocity is out of scope for this per-page extraction, deliberately** — whether the variant a page points to actually points *back* needs the whole crawled set, the same way real orphan-page detection needs the sitemap (see the orphan-detection note above), not just one page's HTML. `extractHreflang` gives you the per-page facts a reciprocity check needs; it doesn't perform that cross-reference itself — `crawl`/`links`/`audit` do, in a separate step, since they're the commands that actually have the whole crawled set. See the hreflang-reciprocity note below.

## The hreflang-reciprocity note

`checklists/international-seo-checklist.md` requires "Every language/region variant has a complete, reciprocal hreflang set (every page links to every variant, including itself)." The per-page `hreflangTags` fact above can't check this alone — it needs the whole crawled set, the same way real orphan detection needs the sitemap. `crawl`/`links`/`audit` compute it: `hreflangReciprocity.nonReciprocalHreflang` lists `{ from, to, hreflang }` for every hreflang declaration whose target page was also reached and fetched within this crawl, but that target page's own hreflang set doesn't declare a link back.

This shares the same honest bound `orphanCandidates`/`sitemapIndexabilityConflicts` already use: a declared hreflang target outside this crawl's reached scope (external, beyond `--max-pages`, robots-blocked, or errored) can't be confirmed reciprocal or not, so it is never reported either way — only a target this crawl actually verified and found not pointing back is flagged. A self-referencing declaration (a page linking to itself, already tracked per-page as `selfReferencingHreflang`) is never a reciprocity concern and is excluded. The human-readable `crawl`/`audit` summary shows a `Non-reciprocal hreflang links:` count when any are found.

## The pagination note

`isPaginated`, `paginationNext`, and `paginationPrev` reflect `<link rel="next"/"prev">` — `next`/`prev` resolved to absolute URLs the same way `canonical`/`hreflang` hrefs are. `isPaginated` is true whenever either tag is *present*, even if its href happens to be empty or unresolvable (`paginationNext`/`paginationPrev` then come back `null`) — the tag's presence, not its resolved value, is what marks a page as part of a paginated series.

`paginationCanonicalConflict` is the one specific, well-documented anti-pattern `rules/canonical-rules.md` calls out: "self-referencing canonical per page is current standard practice; canonicalizing all pages to page 1 is usually wrong and hides paginated content from indexing." It's `true` exactly when a paginated page's `canonical` resolves to a *different* URL than the page itself (a fragment-only difference doesn't count) — the concrete, checkable version of that guidance. This is deliberately narrower than a full pagination-strategy audit (it doesn't try to validate the actual page sequence, detect faceted-navigation/parameter-driven pagination, or judge whether pagination is the right strategy at all — see `workflows/technical-seo.md`'s pagination note for that broader judgment call) — it's exactly the one fact this checklist requirement needs.

## The robots-directives-conflict note

`checklists/metadata-checklist.md` requires "no conflicting robots directives between meta tag and HTTP header" — `<meta name="robots">` and the `X-Robots-Tag` HTTP header are two independent mechanisms that can both control the same page, and it's a real, common setup mistake for them to disagree (a CDN or server config adding a blanket `X-Robots-Tag: noindex` while the page's own template still declares `index, follow`, for instance). `robotsDirectivesConflict` is `true`, and `robotsDirectivesConflictReasons` lists exactly which directive family disagreed, whenever the two sources assert opposite values for the same directive pair: `index` vs. `noindex`, or `follow` vs. `nofollow`. The Google-documented shorthand values `all` (= `index, follow`) and `none` (= `noindex, nofollow`) are expanded before comparing, so `<meta name="robots" content="all">` against an `X-Robots-Tag: noindex` header is correctly caught too.

This is deliberately narrow: a directive present in only one of the two sources is never flagged — that's just one signal with nothing to disagree with, not a conflict, and directives with no opposite-pair counterpart (`noarchive`, `nosnippet`, `noimageindex`, etc.) are never compared at all. A conflict also never changes the `indexable` signal itself — a literal `noindex` from either source already makes `indexable: false` regardless of what the other source says (see `computeIndexabilitySignal`), so this is a separate, additive fact about the two sources actively disagreeing, not a new indexability rule. The human-readable `page` summary's `X-Robots-Tag:` line shows a `CONFLICT:` marker with the reason when one exists.

## The JSON-LD required-properties note

`checklists/schema-checklist.md` requires "Required properties for the chosen type present (`@context`, `@type`, and type-specific required fields)". Every JSON-LD block in `jsonLd` now carries `missingRequiredProperties` — the subset of `@context`/`@type` that block is missing, checked once its JSON has already parsed successfully (a block with a `parseError` has nothing further to check, so `missingRequiredProperties` is `null` for it instead of an empty array, so "not evaluated" is never confused with "checked, nothing missing"). The `@graph` container pattern (a root object bundling several typed nodes under one shared `@context`) is handled — `@type` isn't expected on the container itself, only its member nodes — and a top-level JSON-LD array (multiple independent node objects in one script, no `@graph` wrapper) is checked item-by-item, with any missing property from any item reported once. The human-readable `page` summary's `JSON-LD blocks:` line shows a missing-property count when any block is incomplete.

**Deliberately, only this much**: this checks the two universal, spec-level properties every JSON-LD/schema.org block needs, not the type-specific required-field lists `checklists/schema-checklist.md` also lists as examples (`Article` needs a real `datePublished`, `Product` needs `offers`, `Review` needs real review data, and so on for schema.org's hundreds of types). Validating those would mean building and maintaining a database of per-type requirements — an unnecessarily broad schema.org validator this tool does not attempt. That judgment stays with `rules/schema-rules.md`'s "Choosing the right type" section and `rules/no-fabrication.md`, applied by a human/agent reviewing the evidence, not this fact-gathering layer. Nodes nested inside a `@graph` are also not individually re-checked for their own missing properties, for the same reason.

## The image-dimensions note

`checklists/performance-checklist.md` and `workflows/performance.md` both name explicit image dimensions as a concrete Cumulative Layout Shift (CLS) risk factor and fix: "images/embeds without explicit dimensions" cause layout shift, and the documented fix-layer guidance is "attribute/config changes (`width`/`height`, `loading=\"lazy\"` ...) before code restructuring." Every entry in `images` now also carries `width`, `height` (the raw HTML attribute values, `null` if absent), `hasExplicitDimensions` (`true` when both `width` and `height` are present, or an inline `style` attribute declares `aspect-ratio` — the documented alternative), and `loading` (the raw attribute value, `null` if absent). `imagesMissingDimensions` is the page-level count, alongside the existing `imagesMissingAlt`.

**`hasExplicitDimensions`'s aspect-ratio check is inline-`style` only, not a CSS parser** — a real aspect-ratio applied via an external stylesheet or CSS class is invisible to this tool, the same class of limitation as the regex-based HTML extraction elsewhere in this file. **`loading` is captured as a raw fact only, never judged** — whether a *specific* image should or shouldn't be lazy-loaded depends on its position on the rendered page (above vs. below the fold), which this static-HTML tool has no way to determine; that judgment stays with the reasoning layer, per `checklists/performance-checklist.md`'s "Below-the-fold images lazy-loaded; above-the-fold/LCP images NOT lazy-loaded."

## The og-url-canonical note

`checklists/metadata-checklist.md` requires "`og:url` — matches canonical". `og:url` and `<link rel="canonical">` are two independent signals for "the one true URL of this page," and it's a real, common setup mistake for them to disagree (a stale `og:url` left over from a URL-structure change, or a canonical rewrite that never touched the Open Graph tags). `ogUrlCanonicalMismatch` is `true` exactly when both are present and, once `og:url` is resolved to an absolute URL the same way every other href in this tool is (it's supposed to already be absolute per the Open Graph spec, but this stays robust to a relative value), the two disagree — a fragment-only difference doesn't count, the same convention `paginationCanonicalConflict` already uses. Only evaluated when both `og:url` and `canonical` are present — a missing canonical is already its own, separately-reported problem, not an `og:url`-specific one. The human-readable `page` summary shows a `MISMATCH:` line when this fires.

## The charset-and-favicon note

`checklists/metadata-checklist.md`'s "Required baseline" section requires "`<meta charset=\"utf-8\">` present" and "Favicon present and loading" — the two items in that section this tool had no coverage for (`canonical`, `viewport`, and `lang` were already extracted). `charset` is the raw declared value (`null` if absent), handling both the modern `<meta charset="...">` form and the legacy `<meta http-equiv="Content-Type" content="...; charset=...">` form. `hasFavicon`/`faviconHref` reflect whether any icon-family `<link>` is declared (`icon`, `shortcut icon`, `apple-touch-icon`, `apple-touch-icon-precomposed`, `mask-icon`, matched by a substring check on each rel token rather than an exhaustive list), with `faviconHref` resolved to an absolute URL the same way canonical/hreflang hrefs are.

**"...and loading" is deliberately not verified** — confirming the favicon URL actually resolves would mean an extra network request per page fetched, by default, for every page this tool visits, which is a bigger behavioral change than a fact-gathering pass should make silently (every other optional extra verification in this tool, e.g. `sitemap --check-status`, is an explicit opt-in). A page with no declared favicon link also isn't checked against the browser-default `/favicon.ico` convention, for the same reason. The human-readable `page` summary shows a `Charset:`/`Favicon:` line either way.

## The duplicate-content note

`checklists/on-page-checklist.md` requires "every indexable page has a unique `<title>`" and "every indexable page has a unique meta description" — checking that across a real site means comparing every crawled page's title/description against every other one, which doesn't scale to eyeballing. `crawl`/`links`/`audit` do this automatically: `duplicateContent.duplicateTitles` and `duplicateContent.duplicateMetaDescriptions` each list `{ value, urls }` groups — every distinct title/description text that's shared, verbatim, by more than one crawled page, with the list of pages that share it, most-duplicated group first.

This is an exact-match check (after trimming and collapsing internal whitespace, so a stray extra space doesn't hide a real duplicate) — it's deliberately **not** a fuzzy/near-duplicate or similarity comparison, and it's case-sensitive (`"Widgets"` and `"widgets"` are treated as genuinely different text, not a templating artifact). A page with a missing (or empty/whitespace-only) title/description is excluded entirely rather than counted as a duplicate of other missing ones — that's a separate, already-visible problem (`title`/`metaDescription` come back `null`), not this check's concern. External, robots-skipped, errored, and explicitly non-indexable pages (`indexable: false` — a noindex page, or a non-200 response that still returned a real body, like a shared custom error page) are excluded too: the checklist requirement is specifically about *indexable* pages, so two 404s sharing a generic "Page Not Found" title is expected and harmless, not flagged as a finding.

This is `page`'s single-page facts turned into a cross-page comparison, the same way `duplicateContent` is derived alongside `linkGraph` — both are pure post-processing over a completed crawl's page list, so they're only present for `crawl`/`links`/`audit`, never `page` alone (one page can't be a duplicate of nothing).

## The report-diff note

`workflows/monitoring.md` calls for establishing "a full baseline snapshot first" and comparing later crawls against it, and `workflows/post-implementation.md` calls for logging a change "for future comparison" — both need a way to actually compare two previously-saved reports, not just eyeball two JSON files. `diff <report1.json> <report2.json>` reads two files previously written with `--json=path` (either the same command run twice at different times, or two different commands, as long as both are reports this tool produced) and compares them, treating `report1` as "before" and `report2` as "after."

Both files must be valid JSON and must look like a report this tool produced (`meta.tool === "seo-tool"`) — a missing file, invalid JSON, or a JSON file that isn't one of this tool's reports each produce a clear error and exit 1, not a crash or a silently-empty diff.

Comparison is by content, not by position or literal formatting:
- **Pages** are matched between the two reports by normalized URL (the same equivalence `orphanCandidates`/broken-link matching already uses elsewhere in this tool), never by array order or index — reordering a report's `pages` array between runs never produces a false "changed" page. A page present in `report2` but not `report1` is `added`; the reverse is `removed`; a page present in both is compared field-by-field across a specific, bounded set of SEO-meaningful fields (`status`, `indexable`, `canonical`, `multipleCanonicals`, `title`, `metaDescription`, `robotsMetaDirectives`, `xRobotsTagDirectives`, `robotsDirectivesConflict`, `h1Count`, `isPaginated`, `paginationCanonicalConflict`, `ogUrlCanonicalMismatch`, `charset`, `hasFavicon`) and reported as `changed` (with the specific fields and their before/after values) or left out of `changed` entirely if none of those tracked fields differ. `canonical` is compared via the same URL-normalization equivalence as page matching, so a canonical that's identical in every way that matters (host case, a default port written out) but differs as a literal string is correctly *not* reported as a change. Array-valued fields (`robotsMetaDirectives`, `xRobotsTagDirectives`) are compared as sets, not by order. Fields like `internalLinks`/`externalLinks`/`images`/`jsonLd` are deliberately not tracked — their ordinary churn (a new blog post adding one more internal link) is noise, not the regression signal `workflows/monitoring.md` is actually asking to catch.
- **`linkGraph`**, **`duplicateContent`**, and **`hreflangReciprocity`** findings (orphan candidates, broken/redirect-hop internal links, sitemap/indexability conflicts, duplicate title/description groups, non-reciprocal hreflang links) are each diffed as added/removed by their own identity (URL, or `from`→`to` pair, or duplicate value) when both reports being compared have that section — a report that doesn't have a given section (e.g. diffing two `page` reports, which have no `linkGraph`) reports that section as `null` rather than guessing.
- **`regressions`/`improvements`** are populated from exactly one signal: a page's `indexable` flipping `true → false` (regression) or `false → true` (improvement) between the two reports — the one transition `workflows/monitoring.md` itself names ("catches accidental noindex/robots regressions") as confident enough to classify. Every other tracked-field difference is reported as a plain, unjudged `changed` entry, not editorialized as good or bad — a `canonical` or `title` change doesn't have an unambiguous "better/worse" direction this tool can determine on its own.

**Deliberately out of scope**: diffing the `sitemap`/`robots` sections themselves (an entry-count change there isn't inherently good or bad the way an `indexable` flip is), and any severity/prioritization judgment on the differences found — `diff` reports facts the same way every other command does; layer-3 reasoning (see "Three layers" above) about what a given change means still belongs to the workflow/rules layer, not this tool. `diff` also never sets a failing exit code based on regressions found, for the same reason — it reports, it doesn't gate.

## Known limitations (read before treating an absence as proof)

- **HTML/sitemap parsing is regex-based, not a full parser or DOM.** It handles realistic, reasonably well-formed markup (any attribute order, single/double-quoted or unquoted values, mixed-case tags) but is not a substitute for a browser. Unusual or deeply malformed markup can produce a false negative (a tag present but not detected). Treat a missing result as "not found by this pass," and fall back to manual/browser inspection for anything surprising before concluding a tag truly doesn't exist.
- **No JavaScript execution.** The crawler fetches raw HTML only — it does not render client-side JavaScript. For CSR/SPA content, what this tool sees is exactly what a crawler would see *before* any client-side rendering pass, which is precisely the signal `workflows/javascript-seo.md` needs — but it means content that only appears after hydration will correctly show up as *absent* here. That's the tool doing its job, not a bug to explain away.
- **`project`'s metadata-signal scan is a plain substring match**, not semantic code analysis. A signal string found in a comment, a string literal, or unrelated context will still be reported as a "hit." It reports file counts and sample paths so the reasoning layer can verify each hit, not as a verified-implementation claim.
- **Indexability is a signal, not a verdict.** `page`/`crawl`'s `indexable` field only reflects status code + robots meta/`X-Robots-Tag` + canonical-target agreement for that one response. It does not check `robots.txt` blocking (a separate, crawl-level concern already applied during `crawl`) or quality-based exclusion, which no local tool can determine. Feed it into `checklists/indexing-checklist.md`'s full diagnostic order.
- **No external/authority data.** Nothing here touches Search Console, rank trackers, backlink indexes, or analytics — see the Local vs. live vs. external table above.
- **Sitemap-index recursion is sequential, not concurrent.** Child sitemaps are fetched one at a time, so a pathologically large or slow index can take up to `--max-sitemaps` × `--timeout` in the worst case (roughly 8 minutes at the defaults of 50 × 10s, if every single child timed out). This is bounded, not unbounded — it will always stop — but it can be slow on an unusually large index. Lower `--max-sitemaps`/`--timeout` for a quicker, partial look, or raise them if a large site's index genuinely needs the headroom.

## JSON output schema

Every command produces the same top-level envelope via `assembleReport` (`tools/seo-tool/lib/report.js`); only the populated sections differ by command.

```jsonc
{
  "meta": {
    "tool": "seo-tool",
    "version": "1.0.0",
    "command": "audit",              // page | crawl | links | sitemap | robots | audit | project | diff
    "target": "https://example.com",
    "startedAt": "2026-08-25T12:00:00.000Z",
    "finishedAt": "2026-08-25T12:00:03.500Z",
    "options": { "maxPages": 50, "delayMs": 250, "concurrency": 2, "timeoutMs": 10000, "includeExternal": false, "respectRobots": true, "allowPrivateNetwork": false }
  },
  "pages": [                          // present for page/crawl/links/audit
    {
      "requestedUrl": "...", "finalUrl": "...", "status": 200,
      "redirectChain": [ { "url": "...", "status": 301, "location": "..." } ],
      "contentType": "text/html; charset=utf-8", "isHtml": true,
      "title": "...", "metaDescription": "...",
      "canonical": "...",                 // resolved to an absolute URL; null if missing/malformed — see the canonical-resolution note above
      "canonicalCount": 1, "multipleCanonicals": false, "canonicalRawHrefs": ["..."], // every declared href, unresolved, in document order
      "hreflangTags": [ { "hreflang": "en-US", "href": "...", "rawHref": "..." } ], // every declaration, href resolved the same way canonical is
      "hreflangCount": 1, "hasXDefault": false, "selfReferencingHreflang": true,
      "duplicateHreflangValues": [], "malformedHreflang": [],  // see the hreflang note above
      "isPaginated": false, "paginationNext": null, "paginationPrev": null, "paginationCanonicalConflict": false, // see the pagination note above
      "viewport": "...", "charset": "utf-8", "lang": "en",
      "hasFavicon": true, "faviconHref": "...", // see the charset-and-favicon note below
      "robotsMetaDirectives": ["noindex"], "xRobotsTagDirectives": [],
      "robotsDirectivesConflict": false, "robotsDirectivesConflictReasons": [], // see the robots-directives-conflict note below
      "indexable": false, "indexabilityReasons": ["noindex directive present ..."],
      "h1Count": 1, "h1Texts": ["..."], "h2Count": 3, "h2Texts": ["...", "..."],
      "openGraph": { "title": "...", "description": "...", "image": "...", "url": "..." },
      "ogUrlCanonicalMismatch": false, // see the og-url-canonical note below
      "twitter": { "card": "summary_large_image" },
      "jsonLd": [ { "raw": "...", "parsed": {}, "parseError": null, "missingRequiredProperties": [] } ], // missingRequiredProperties is null instead when parseError is set — see the JSON-LD required-properties note below
      "internalLinks": [ { "url": "...", "text": "...", "nofollow": false } ],
      "externalLinks": [ { "url": "...", "text": "...", "nofollow": false } ],
      "invalidHrefs": ["..."],
      "images": [ { "src": "...", "alt": "...", "hasAlt": true, "isEmptyAlt": false, "width": "600", "height": "400", "hasExplicitDimensions": true, "loading": "lazy" } ], // see the image-dimensions note below
      "imagesMissingAlt": 0,
      "imagesMissingDimensions": 0,
      "depth": 2, "discoveredFrom": ["..."], "isExternal": false,
      "skipped": false, "skipReason": null,
      "error": null
    }
  ],
  "crawlSummary": { "startUrl": "...", "pagesFetched": 12, "truncatedByMaxPages": false, "robots": { "checked": true, "robotsUrl": "..." } },
  "sitemap": { "source": "...", "type": "urlset",              // urlset | sitemapindex | invalid | not_found — reflects the ROOT document; urls/entryCount/issues are always the full aggregated tree
    "entryCount": 40, "urls": [ { "loc": "...", "lastmod": "...", "changefreq": null, "priority": null } ],
    "issues": [ { "type": "duplicate_exact", "loc": "...", "index": 3 } ],
    "sitemapsProcessed": [ { "url": "...", "depth": 0, "type": "urlset", "urlCount": 40, "error": null }, { "url": "...", "depth": 0, "type": "sitemapindex", "childCount": 3, "error": null } ], // urlCount = real page URLs in that file; childCount = child <sitemap> references in that index — never the same field, since they're different units
    "skipped": [ { "url": "...", "reason": "cross-origin child sitemap skipped (same-origin restriction)" } ],
    "truncated": false,
    "statusChecks": [ { "loc": "...", "status": 200, "finalUrl": "...", "redirected": false, "error": null } ] },
  "robots": { "source": "...", "found": true, "groups": [ { "agents": ["*"], "rules": [ { "type": "disallow", "path": "/admin" } ] } ], "sitemaps": ["..."], "unknownDirectives": [], "importantPathConflicts": [], "note": "robots.txt is a crawl-behavior hint, not access control ..." },
  "linkGraph": { "orphanCandidates": ["..."], "orphanDetectionUsedKnownUrls": true, "crawlDepthOutliers": [ { "url": "...", "depth": 5 } ], "brokenInternalLinks": [ { "from": "...", "to": "...", "status": 404 } ], "unverifiedInternalLinks": [ { "from": "...", "to": "..." } ], "internalLinksThroughRedirects": [ { "from": "...", "to": "...", "finalUrl": "...", "redirectHops": 1 } ], "sitemapIndexabilityConflicts": [ { "url": "...", "reason": "noindex directive present ..." } ], "note": "..." },
  "duplicateContent": { "duplicateTitles": [ { "value": "...", "urls": ["...", "..."] } ], "duplicateMetaDescriptions": [ { "value": "...", "urls": ["...", "..."] } ] }, // present for crawl/links/audit — see the duplicate-content note below
  "hreflangReciprocity": { "nonReciprocalHreflang": [ { "from": "...", "to": "...", "hreflang": "fr-FR" } ], "note": "..." }, // present for crawl/links/audit — see the hreflang-reciprocity note below
  "project": { "rootDir": "...", "packageJson": { "dependencies": ["next", "react"], "scripts": {} }, "packageManager": "npm", "frameworkConfigFiles": ["next.config.js"], "directoryConventions": { "hasAppRouterDir": true }, "seoRelatedFilesFound": ["public/robots.txt"], "metadataImplementationSignals": { "generateMetadata": { "fileCount": 4, "samplePaths": ["..."] } }, "scan": { "filesWalked": 812, "truncated": false } },
  "diff": { // present only for diff — see the report-diff note above
    "pages": { "added": ["..."], "removed": ["..."], "changed": [ { "url": "...", "changes": [ { "field": "indexable", "before": true, "after": false } ] } ], "unchangedCount": 11 },
    "linkGraph": { "orphanCandidates": { "added": ["..."], "removed": [] }, "brokenInternalLinks": { "added": [], "removed": [] }, "internalLinksThroughRedirects": { "added": [], "removed": [] }, "sitemapIndexabilityConflicts": { "added": [], "removed": [] } }, // null if either report lacks linkGraph
    "duplicateContent": { "duplicateTitles": { "added": [], "removed": [] }, "duplicateMetaDescriptions": { "added": [], "removed": [] } }, // null if either report lacks duplicateContent
    "hreflangReciprocity": { "nonReciprocalHreflang": { "added": [], "removed": [] } }, // null if either report lacks hreflangReciprocity
    "regressions": [ { "url": "...", "field": "indexable", "before": true, "after": false } ],
    "improvements": [],
    "summary": { "pagesAdded": 0, "pagesRemoved": 0, "pagesChanged": 1, "regressions": 1, "improvements": 0 }
  },
  "errors": [ { "url": "...", "message": "..." } ],
  "warnings": [ "..." ]
}
```

Keep this schema in sync with `tools/seo-tool/lib/report.js` when either changes. This shape is designed to drop directly into `templates/seo-audit-report.md`'s `Evidence` field (cite the specific page/field from the JSON) rather than requiring a separate translation step.

## Testing

`tools/seo-tool` has its own test suite (`node --test test/*.test.js` from within `tools/seo-tool/`, or `npm test`), covering:

- Every HTML extractor (title, description, robots meta, H1/H2 counting, JSON-LD, internal/external link classification) and URL normalization.
- Robots meta / `X-Robots-Tag` conflict detection specifically: genuine index/noindex and follow/nofollow disagreements flagged (with the specific reason); `all`/`none` shorthand expanded before comparing; correctly *not* flagged when the two sources agree, when a directive is present in only one source, or for directives with no opposite-pair counterpart; and — through the real CLI against a real fixture page with a genuinely conflicting header — both `--json` and the human-readable `X-Robots-Tag:` line's `CONFLICT:` marker, plus the no-conflict case showing a plain line with no marker.
- JSON-LD required-properties detection specifically: a missing `@context`, a missing `@type`, or both flagged correctly; a `@graph` container correctly not requiring its own `@type`; a top-level JSON-LD array checked item-by-item with results deduplicated; `null` (not an empty array) when the block's JSON never parsed in the first place; never throwing on `null`, a non-object, or an empty array; and — through the real CLI against a real fixture page mixing one complete and one incomplete block — both `--json` and the human-readable `JSON-LD blocks:` line's missing-property count, plus the all-complete case showing no count at all.
- Image-dimensions detection specifically: `width`/`height` both present correctly satisfying `hasExplicitDimensions`, width alone correctly not satisfying it, an inline `aspect-ratio` style correctly satisfying it as the documented alternative, the raw `loading` attribute value captured without judgment, and the page-level `imagesMissingDimensions` count; and — through the real CLI against a real fixture page mixing a fully-dimensioned and a dimension-less image — both `--json` and the human-readable `Images missing dimensions:` count.
- og:url/canonical mismatch detection specifically: a genuine disagreement flagged; agreement, a missing `og:url`, and a missing `canonical` all correctly not flagged; a relative `og:url` resolved against the page URL before comparing; a fragment-only difference ignored; never throwing on a malformed `og:url`; and — through the real CLI against a real fixture page with a genuinely stale `og:url` — both `--json` and the human-readable `MISMATCH:` line, plus the no-mismatch case showing no line at all.
- Charset and favicon extraction specifically: the modern `<meta charset>` form and the legacy `http-equiv` Content-Type form both read correctly; `null` when neither is present; every icon-family `rel` variant (`icon`, `shortcut icon`, `apple-touch-icon`, etc.) recognized; a present-but-empty-href icon tag correctly not counted as a usable favicon; and — through the real CLI against fixture pages with and without both declared — both `--json` and the human-readable `Charset:`/`Favicon:` line in each case.
- Canonical extraction specifically: absolute/relative/root-relative href resolution, query-string/fragment preservation, multiple-declaration detection (first-wins plus the full raw-href evidence list), missing/empty/no-href/non-navigable-scheme cases, and — through a real crawl against a local fixture server — a relative canonical on a redirected page resolving against its real post-redirect URL, not the originally-requested one.
- hreflang extraction specifically: href resolution (same absolute/relative/root-relative cases as canonical), self-referencing detection (present and absent), `x-default` recognition, duplicate-value detection (conflicting vs. harmless-repeat targets), malformed-code detection (empty, underscore separator, non-BCP47 shape, the `"xx-UK"` mistake), non-hreflang `rel="alternate"` links correctly ignored, and — through both a real crawl and the real CLI — resolution/self-reference against a page's real post-redirect URL.
- Pagination extraction specifically: `rel="next"`/`rel="prev"` resolution (including href-empty-but-tag-present still marking `isPaginated`), the canonical-to-page-1 conflict flag both firing and correctly staying `false` for a self-referencing canonical or a non-paginated page, and — through the real CLI — the `Pagination:` summary line appearing only when a page is actually paginated.
- `robots.txt` parsing and rule evaluation, including wildcard/end-anchor patterns and longest-match-wins.
- Sitemap parsing and validation, and `<sitemapindex>` tree resolution specifically — recursion into nested indexes, duplicate/cycle protection, same-origin enforcement, and bounded truncation (`maxSitemaps`/`maxDepth`).
- Link-graph orphan/broken-link detection, and sitemap/indexability conflict detection specifically: flagging noindex, non-200, and robots-blocked sitemap entries; correctly ignoring genuinely indexable ones; correctly leaving unreached sitemap URLs unreported either way; matching by either the requested or final (post-redirect) crawled URL; not double-reporting a repeated sitemap entry; and — through the real CLI against a real crawl — that it's actually wired into `audit`'s JSON and human-readable output.
- Internal-links-through-redirects detection specifically: flagging a link whose target only resolved after one or more redirect hops (with the correct hop count and final URL); correctly not flagging a direct link, a broken/errored target, or a target outside the crawl's scope (each a different, already-reported concern); not double-reporting a repeated from→to pair; and — through the real CLI against a real crawl — that it's wired into both `crawl` and `audit`'s JSON and human-readable output.
- Cross-page duplicate title/meta-description detection: exact-match grouping, whitespace normalization without over-matching case differences, missing-value exclusion, external/skipped/errored-page exclusion, most-duplicated-first ordering, no double-counting a repeated page entry, and — through the real CLI against a real crawl — that it's actually wired into both `crawl` and `audit`.
- Cross-page hreflang reciprocity detection specifically: a real non-reciprocal link correctly flagged; self-referencing declarations, targets outside the crawl's reached scope, and targets that were skipped/errored all correctly excluded; matching by normalized URL rather than literal string equality; no double-reporting a repeated declaration; and — through the real CLI against a real crawl of two linked pages, one of which doesn't declare a link back — both `--json` and the human-readable `Non-reciprocal hreflang links:` count, including the no-hreflang-at-all case showing no line at all.
- A full crawl against a local HTTP fixture server (redirects, 404s, robots blocking, external-link handling), and project inspection against a fixture directory.
- The CLI entry point itself (`cli.js`) as a real subprocess: command dispatch, argument parsing, exit codes, and both output modes (`--json`, `--json=path`).
- `lib/fetch-utils.js` directly: timeouts, redirect chains, redirect loops, capped body reads, and network-error classification.
- Private-network blocking (`lib/url-utils.js`'s `isPrivateNetworkTarget` and its use in `fetch-utils.js`): IPv4/IPv6 range classification including boundary cases, both IPv4-embedded-in-IPv6 forms (`::ffff:0:0/96` and the NAT64 well-known prefix `64:ff9b::/96`), and — against real local HTTP fixture servers, not mocks — that a redirect to a private or cloud-metadata address is blocked *before* it is fetched, at whichever hop first becomes private, with `--allow-private-network`/`allowPrivateNetwork` verified as a working, explicit opt-out.
- `lib/report.js`'s assembled JSON report shape against the schema documented above, including passing a `diff` result through unchanged.
- Report diffing (`lib/report-diff.js`) specifically: page matching by normalized URL rather than array order/position; added/removed/changed/unchanged classification across the tracked field set; array-order-insensitive comparison for `robotsMetaDirectives`-style fields; URL-equivalence comparison for `canonical` (host-case/default-port differences correctly not flagged, a genuinely different target correctly flagged); `indexable` regression/improvement classification in both directions, with every other field difference reported as a plain change, not judged; `linkGraph`/`duplicateContent` section diffing, each `null` when either report lacks that section; graceful, non-crashing handling of disjoint URL sets, unparseable URLs, minimal/partial reports, and comparing two reports of different command types; and — through the real CLI against real `--json=path` report files, including an actual `indexable` regression end-to-end — both `--json` and human-readable output, plus all of `diff`'s error paths (missing file, invalid JSON, valid JSON that isn't a seo-tool report, a missing report argument).

Run it after any change to `tools/seo-tool`. GitHub Actions CI (`.github/workflows/ci.yml`) runs the same command on every push and pull request.
