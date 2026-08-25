# Site-Type Guide: Tool / Calculator Website

Covers single-purpose utility sites (calculators, converters, generators, checkers) — a distinct SEO profile from content or e-commerce sites: often very little body copy, the "content" is the tool's function itself.

## The core challenge

Tools are often thin on traditional text content by nature — the calculator/converter/generator IS the value, and forcing in unnecessary text around it purely to "have content" often produces exactly the low-value padding [[../rules/content-quality]] prohibits. The right approach is usually: get technical/on-page fundamentals precisely right, and add genuinely useful *supporting* content (methodology explanation, common use cases, an FAQ addressing real questions users have) rather than generic filler.

## On-page fundamentals matter more here, proportionally

Since there's often minimal body text to signal relevance, title, H1, meta description, and any supporting explanatory content carry proportionally more weight for establishing what the tool does and for whom. Verify these are precise and specific (e.g., "Mortgage Payment Calculator — Monthly & Total Cost" beats a generic "Calculator").

## Legitimate supporting content

- A brief explanation of what the tool calculates/converts and why it matters
- The methodology/formula used, if genuinely informative and accurate
- Common use cases or worked examples
- A genuine FAQ addressing real user questions (not fabricated Q&A for schema eligibility — see [[../rules/no-fabrication]] and [[../rules/schema-rules]])

## Programmatic variants

Tool sites very commonly generate variant pages (unit-converter pairs, "X to Y" conversion pages, per-currency/per-unit calculators). This is a textbook `workflows/programmatic-seo.md` case — evaluate rigorously: does each variant have genuine per-variant value (real, distinct calculation relevant to that specific pair/unit) or is it the same generic tool with a URL slug swapped and no real differentiation? Real unit/currency conversion pairs usually do have genuine per-page utility (a real, different calculation); purely cosmetic variants don't.

## Structured data

`SoftwareApplication` or `WebApplication` schema can apply if genuinely representative — real category and functionality description, no fabricated rating (see [[../rules/schema-rules]]). `HowTo` schema is sometimes tempting for "how to use this calculator" content — only use it if there's a genuine, visible step-by-step process being marked up, not synthesized to gain a rich result.

## Performance

Tools are often interactive/JS-heavy by nature — cross-reference `workflows/performance.md` and `workflows/javascript-seo.md` carefully, since the interactive core of the tool itself is usually the thing most at risk of CSR-related crawlability gaps if the supporting explanatory content isn't server-rendered separately from the interactive widget.

## Never

Never pad a thin tool page with generic filler text purely to appear more substantial — this fails [[../rules/content-quality]] and doesn't actually help ranking for a tool-intent query anyway (searchers wanted the tool, not an essay).
