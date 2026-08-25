# Workflow: On-Page SEO

**Purpose:** Diagnose and fix title tags, meta descriptions, headings, URL readability, and other on-page signals.

**Modifies files:** Audit phase no; implementation phase yes, under [[../rules/implementation-safety]].

## Audit procedure

Work through `checklists/on-page-checklist.md` and `checklists/metadata-checklist.md`. Sample by template — inspect the metadata-generation logic (a component, a framework metadata API, a CMS field) once per template rather than every individual page, then spot-check a handful of rendered instances to confirm the template actually produces correct output in practice.

Key questions per template:

- Is title/description generation dynamic and content-aware, or hardcoded/generic across every instance of the template?
- Does every instance produce a genuinely unique value, or do edge cases (empty fields, missing data) fall back to a duplicate default?
- Is there exactly one `<h1>` and a logical heading hierarchy, using the existing design system's heading styles?
- Do Open Graph/Twitter tags exist and resolve to real, appropriately-sized images?

## Writing titles and descriptions

- Title: reflect the page's actual primary topic and dominant search intent, lead with the most important term where it reads naturally, keep it concise enough to typically avoid SERP truncation. Don't force a formula (e.g., "Keyword | Keyword | Brand") if it reads unnaturally — clarity and accuracy first.
- Description: an accurate, compelling one-to-two sentence summary that earns the click without misleading about what's on the page. Not a keyword list.
- Both must be unique per page. A template producing the same title for every instance (e.g., every product using the generic category name) is a bug to fix at the template level, not page by page.

## Headings

- Promote or fix heading levels using the existing semantic markup and CSS classes already in the codebase — don't introduce new heading styles. See [[../rules/ui-preservation]].
- If a visually-styled element is functioning as a heading but isn't marked up as one (a styled `<div>` or `<span>` used as a de facto title), this is a legitimate, low-risk semantic fix: change the tag, keep the existing classes/styling intact.

## Content signal checks

Cross-reference `workflows/search-intent.md` — does the page's content type and depth actually match what someone searching this term expects to find? A mismatch here isn't fixed by better titles; it needs `workflows/content-optimization.md`.

## Implementation notes

- Fix at the template/component level whenever an issue is systemic, not by patching individual page instances.
- Never fabricate a description or title value when source data is missing — derive it from real page content, or flag the specific pages needing manual input from the user. See [[../rules/no-fabrication]].
- Verify rendered `<head>` output after any change — the template may look correct in source but fail to interpolate correctly for edge-case data. See [[../rules/verification-rules]].

## Output

Findings and fixes reported per the standard templates. Template-level issues should be reported once with an estimate of how many page instances they affect, not duplicated per instance.
