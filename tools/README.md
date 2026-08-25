# tools/

Local, read-only inspection tools that support this skill's SEO reasoning — they collect facts; they don't make SEO decisions and they never modify anything they inspect.

- **[`seo-tool/`](seo-tool)** — a small, zero-dependency Node.js CLI for crawling a site, extracting SEO facts from HTML, and checking `sitemap.xml`/`robots.txt`. See [`docs/tooling.md`](../docs/tooling.md) for when and how the SEO workflows should use it, and [`seo-tool`'s own usage/commands](seo-tool/cli.js) via `node tools/seo-tool/cli.js --help`.

**Read-only guarantee:** nothing in this directory ever edits a target project's files, writes to its `robots.txt`/`sitemap.xml`, modifies its `package.json`, or touches its Git state. Every tool here only reads and reports. See `docs/tooling.md`'s Safety section for the full guarantee and its verification.

This directory is optional infrastructure, not a replacement for the reasoning in `workflows/`, `rules/`, and `checklists/`. Deleting it doesn't break the skill — workflows fall back to manual inspection as they did before it existed.
