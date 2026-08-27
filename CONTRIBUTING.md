# Contributing

This repository has a few constraints that aren't obvious from the code alone. Read this before changing anything — it'll save you from a PR that has to be reworked.

## What this repository actually is

Two things, bundled together: an agent-agnostic SEO engineering skill (`SKILL.md`, `rules/`, `workflows/`, `checklists/`, `frameworks/`, `templates/`, `commands/`, `docs/`) — plain Markdown meant to be read and followed by any AI coding agent — and `tools/seo-tool`, a small, zero-dependency, read-only Node.js CLI that gathers real SEO facts to feed that reasoning. Most contributions will touch one or the other, rarely both.

## Running the tests

```bash
cd tools/seo-tool
npm test
```

This runs `node --test test/*.test.js` — Node's built-in test runner, no dependencies to install first. CI (`.github/workflows/ci.yml`) runs the exact same command on every push and pull request.

## Non-negotiable constraints

- **Zero-breakage philosophy.** This skill exists to make SEO changes to *other people's* projects without breaking them. That same discipline applies here: don't refactor working code "while you're in there," don't rename things without a reason tied to the actual change, and don't fix an unrelated thing in the same PR as a real fix.
- **Every behavior change needs a test.** `tools/seo-tool` had real bugs (a sitemap-index that silently produced empty results, a Windows path misparsed as a URL) that only surfaced once real tests were written against real behavior — not against implementation details. If you change what the CLI or a `lib/` module does, add or update a test that would have caught the old behavior being wrong. PRs that change behavior without a corresponding test change will be asked to add one.
- **Zero runtime dependencies, and it stays that way.** `tools/seo-tool/package.json` has an empty `dependencies` object on purpose — it uses only Node built-ins: the global `fetch()` for HTTP, `node:http` for the test suite's local fixture servers, `node:test` as the test runner, and so on. Don't add an npm package to solve something Node's standard library already does, even if the package would be more convenient. If you genuinely believe a dependency is justified, open an issue explaining why before sending the PR.
- **Agent-agnostic design.** `SKILL.md` and everything under it must remain usable by any AI coding agent capable of reading local files and following instructions — not just one specific product. If you're adding something that only makes sense for one agent's specific mechanism (e.g., a slash-command format), keep it clearly scoped and labeled as optional/agent-specific rather than baking it into the core instructions.
- **Read-only stays read-only.** `tools/seo-tool` only ever reads — it fetches with `GET` (never a mutating method), reads local files, and writes only its own JSON report when explicitly asked (`--json=path`). Don't add a code path that writes to, or mutates, the project being inspected.
- **No black-hat SEO, ever, even if requested.** See `rules/no-black-hat.md`. This isn't a style preference — recommendations or tooling that could be used for cloaking, doorway pages, fake reviews, link schemes, or similar will be rejected regardless of how the request is framed.

## Making a change

1. Figure out which layer you're touching: SEO knowledge (`rules/`, `workflows/`, `checklists/`, `frameworks/`, `templates/`, `commands/`) or the CLI tool (`tools/seo-tool/`). Keep the change scoped to that layer unless the two genuinely need to change together (e.g., a workflow's documentation reference to a CLI flag that changed).
2. For a CLI change: write or update the test first if you can, then implement, then run `npm test` from `tools/seo-tool/` and confirm the full suite passes — not just your new test.
3. For a skill/knowledge change: check `docs/tooling.md`, `docs/safety.md`, and any workflow files that reference what you're changing, so cross-references don't go stale (a quick `grep -rn` for the old name/path across the repo before you commit is usually enough).
4. Keep the diff to what the change actually requires. If you notice something unrelated worth fixing, mention it in the PR description instead of fixing it inline.

## Submitting a pull request

- Open the PR against `main`.
- Describe what changed and why in plain terms — for a CLI change, include what you tested and how; for a skill/knowledge change, note which files you checked for stale cross-references.
- Make sure CI is green before asking for review.
- Small, focused PRs are much easier to review than large ones that mix several unrelated changes.
