# Rule: UI Preservation

**Status:** Non-negotiable unless the user explicitly requests a visual/UX change.

## The rule

SEO work is invisible or additive to the visual design, not a redesign project. Unless explicitly asked, do not change:

- Colors, typography, spacing, or the design system's tokens/variables
- Layouts, grids, or component structure
- Buttons, cards, navigation bars, footers, menus
- Animations, transitions, interaction patterns
- Chat interfaces, dashboards, product UIs, checkout flows
- Responsive/breakpoint behavior

## What "SEO-safe" visible changes look like

Some SEO improvements are visible by nature (a heading, breadcrumb text, alt text, added body copy). These are acceptable when:

- They use the **existing** design system's components, classes, and tokens — not new ad hoc styles.
- They don't alter layout flow in a way a user would notice as "the page looks different now" beyond the intended content addition.
- They preserve existing copy voice/tone rather than replacing it wholesale.

Example: adding a visually-hidden (not `display:none`, not `visibility:hidden` — properly screen-reader-accessible) `<h1>` where one is missing is SEO-safe. Redesigning the hero section to "improve keyword density" is not.

## Breadcrumbs, headings, internal links

These often double as both UI and SEO surfaces. When adding or adjusting them:

- Match existing breadcrumb/heading component patterns already used elsewhere in the codebase.
- Do not introduce a new visual pattern where one doesn't already exist without asking.
- If the codebase has zero heading hierarchy conventions to follow, propose a minimal semantic fix (e.g., promote an existing styled div to a real `<h1>`) rather than inventing new visual chrome.

## When SEO genuinely requires a visible UI change

Examples: adding a visible breadcrumb trail where none exists; adding category descriptions above a product grid; adding a visible FAQ section that surfaces Q&A content that's already genuinely answered elsewhere on the page or in the project (support docs, existing copy) but not yet presented as a scannable FAQ.

This is Category B per [[implementation-safety]] — it requires the same confirmation as any other visible addition, but it does **not** license inventing the underlying content to justify the UI. The content comes first and must already be real and genuine; the accordion/UI is just a new presentation of it. Building an FAQ UI around fabricated or generic Q&A pairs in order to make `FAQPage` schema "fit" is a [[no-fabrication]] and [[schema-rules]] violation dressed up as a UI decision — see `checklists/schema-checklist.md`. If no genuine FAQ content exists yet, that's a content gap for `workflows/content-strategy.md` to evaluate on its own merits, not a UI task.

Do not implement silently. Propose it explicitly, show a description of what will appear, and get confirmation before implementing (see [[implementation-safety]]). Report exactly what changed visually in the "UI Changes" section of every report — never leave this blank or vague.

## Vague or blanket permission is not specific permission

A broad instruction like "fix our SEO and change whatever you need to" or "do whatever it takes" is real permission to touch code, but it is not a specific design brief — it does not, on its own, authorize a redesign. Treat it the same as no redesign permission at all: keep changes minimal and additive, only alter visible presentation where an SEO fix genuinely requires it (per the "When SEO genuinely requires a visible UI change" section above), and still describe each visible change explicitly before or as you make it rather than treating the broad phrasing as a blank check to go further than the SEO goal actually needs. If a change would benefit from genuinely redesigning something, say so and ask for that specific scope — don't infer it from a vague blanket statement.

## Explicitly prohibited

- "SEO redesigns" — restructuring a page's visual layout because it's supposedly better for engagement/SEO signals.
- Replacing a working, styled component with a new one to "make it more semantic," when the existing one can be fixed with an attribute or tag change instead.
- Adding visible keyword-stuffed text blocks (e.g., a wall of city names at the page bottom) purely for SEO. See [[no-black-hat]].
