# Safety Overview

This document is a map of the `rules/` directory and how the safety system fits together. Read the individual rule files for full detail — this is the index and the reasoning for why the system is shaped this way.

## The layered model

1. **[[../rules/zero-breakage]]** — the parent rule. Existing functionality always outranks SEO improvement. Every other rule exists to operationalize this for a specific domain.
2. **Domain-specific constraints**, each governing one category of risk:
   - [[../rules/ui-preservation]] — don't change what things look like without being asked
   - [[../rules/architecture-preservation]] — don't change how things are built without being asked
   - [[../rules/no-black-hat]] — don't use techniques that violate search engine guidelines, ever
   - [[../rules/no-fabrication]] — don't invent facts, data, dates, reviews, or authorship
   - [[../rules/content-quality]] — content must serve real users, not just fill a keyword slot
   - [[../rules/schema-rules]] — structured data must strictly reflect real, visible content
   - [[../rules/canonical-rules]] — canonical/URL-identity changes are high-blast-radius; verify before touching
   - [[../rules/indexing-rules]] — crawl/index control changes are high-blast-radius; verify before touching
3. **Process rules**, governing how any change actually gets made:
   - [[../rules/implementation-safety]] — the eight-phase procedure every implementation follows
   - [[../rules/verification-rules]] — what "done" requires before reporting complete

## Why this is layered instead of one big rule

Different categories of mistake have different shapes. A UI regression, a broken payment flow, a deindexed section, and a fabricated review are all "bad outcomes" but require completely different checks to prevent. Splitting them into focused rules means each one can be specific and checkable rather than a vague general warning that's easy to satisfy technically while still causing harm.

## The core safety mechanism: the reversibility test

Nearly every rule above ultimately routes back to one question from [[../rules/zero-breakage]]: **if this change turns out to be wrong, how hard is it to undo?**

- Easy to reverse (a meta tag, one schema block, one alt attribute) → implement directly once planned.
- Hard to reverse (canonical strategy at scale, a routing change, a broad robots.txt rule) → escalate: plan, explain the tradeoff, get explicit confirmation.

This single test is what lets the skill move fast on the many low-risk fixes that make up most real SEO work, while still stopping hard before the small number of changes that could cause real damage.

## The authoritative risk model: Category A/B/C/D

The reversibility test above is the *principle*; [[../rules/implementation-safety]] and `SKILL.md`'s "Change risk categories" turn it into the actual, checkable procedure every implementation is sorted through before it happens. This is one model, not a second one layered on top — the categories are the reversibility test made concrete and given a fixed default behavior for each answer:

| Category | What it means | Default behavior |
|---|---|---|
| **A — Safe** | Additive, easily reversible, doesn't touch protected functionality (a meta tag, an alt attribute, real structured data, a sitemap entry) | Implement directly once planned, per the eight-phase procedure |
| **B — Moderate** | Template-level or site-wide-component changes; still reversible but with real blast radius | Implement the smallest safe version; explain clearly in the report; consider a scoped pilot first |
| **C — High risk** | Hard to reverse, large blast radius, or adjacent to protected functionality (routing, rendering strategy, redirects at scale, framework/build config) | **Stop. Explain the risk. Get explicit approval for that specific change before implementing.** |
| **D — External** | Outside the codebase entirely (DNS, hosting, CDN, Search Console, Google Business Profile) | Never attempt a code workaround; report precisely what to change and where |

Authentication, authorization, payment logic, database queries, API behavior, and WebSocket/realtime logic are not Category C awaiting approval — they are **out of scope for this skill entirely**, per [[../rules/zero-breakage]]. See [[../rules/implementation-safety]] for the full table with worked examples per category.

## What "explicit confirmation" actually requires

Per [[../rules/implementation-safety]]: a clear description of the change and its risk, presented to the user in chat, with an actual response from them before proceeding — not an assumption that a prior general go-ahead ("yes, fix the SEO issues") covers a specific high-risk item discovered along the way. See the Instruction source boundary and Action categories guidance the assistant operates under more broadly — this skill's safety rules are additive to that, not a replacement for it.

## Escalation, not silent failure

When something is out of safe reach — an architecture change would genuinely help, a fact can't be verified, external configuration is required — the correct response per every rule above is to **report it clearly**, not to implement a workaround, not to guess, and not to silently skip it without mention. See `templates/change-report.md`'s "Not Implemented" and "External Configuration Required" sections and "Requires Explicit Decision" in `templates/seo-audit-report.md`.

## A separate concern: the tool's own network safety

Everything above is about the *risk of a change this skill makes to a site*. It's a different axis from the *risk of the tool itself making a dangerous network request*: `tools/seo-tool` refuses by default to fetch private/internal network addresses (RFC1918, link-local/cloud-metadata, and their IPv6 equivalents), on every URL it fetches including every redirect hop, so that pointing it at an untrusted or attacker-influenced URL can't be turned into a probe of the machine's own internal network. See [`docs/tooling.md`](tooling.md#private-network-protection-a-safety-boundary-not-an-seo-feature) for what's blocked and why — that protection is a property of the tool's fetch layer, not part of the Category A/B/C/D content-change model above.
