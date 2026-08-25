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

## What "explicit confirmation" actually requires

Per [[../rules/implementation-safety]]: a clear description of the change and its risk, presented to the user in chat, with an actual response from them before proceeding — not an assumption that a prior general go-ahead ("yes, fix the SEO issues") covers a specific high-risk item discovered along the way. See the Instruction source boundary and Action categories guidance the assistant operates under more broadly — this skill's safety rules are additive to that, not a replacement for it.

## Escalation, not silent failure

When something is out of safe reach — an architecture change would genuinely help, a fact can't be verified, external configuration is required — the correct response per every rule above is to **report it clearly**, not to implement a workaround, not to guess, and not to silently skip it without mention. See `templates/change-report.md`'s "Not Implemented" and "External Configuration Required" sections and "Requires Explicit Decision" in `templates/seo-audit-report.md`.
