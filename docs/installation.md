# Installation

This skill is a standalone, portable folder — it doesn't depend on any specific project's code, framework, or content, and it doesn't depend on any specific AI product. It's plain Markdown instructions cross-referenced by relative path, plus one optional zero-dependency CLI (`tools/seo-tool`). Any AI coding agent capable of reading local files and following written instructions can use it.

## Universal installation (any agent)

1. **Copy the entire `seo-engineering-skill/` folder** (or however you've named this repository) into the target project, or into wherever your agent reads shared/global instructions from, depending on whether you want it available to one project or all of them.
2. **Do not rename `SKILL.md`.** It's the entry point — the file every agent should be pointed at or told to read first. Some agents (see the Claude Code section below) discover it automatically by this exact filename; for any other agent, just tell it to read `SKILL.md` and follow it.
3. **Leave the internal structure intact.** Workflows, rules, checklists, templates, frameworks, and commands cross-reference each other by relative path (`workflows/technical-seo.md`, `[[../rules/zero-breakage]]`, etc.) — moving individual files out of their directories will break those references.
4. **No configuration step is required.** This skill doesn't need environment variables, API keys, or a config file — it operates purely by inspecting the target project's own files when invoked.
5. **The optional local toolkit (`tools/seo-tool`) needs Node.js ≥18.17** on the machine your agent runs on — nothing else. It has zero npm dependencies, so no `npm install` step is needed; run it directly with `node tools/seo-tool/cli.js ...`. If Node isn't available, the skill still works fully — workflows fall back to manual/source inspection. See `docs/tooling.md`.

## Claude Code specific notes

These are conveniences specific to Claude Code — none of them are required for any other agent, which can skip straight to "Verifying installation" below.

- Claude Code auto-discovers a skill by the exact filename `SKILL.md` plus its YAML frontmatter (`name:`/`description:`). Placing this folder where Claude Code looks for skills (commonly a project-scoped `.claude/skills/` directory, or your user-level global skills location — follow your Claude Code setup's convention) is enough; no separate registration step.
- Project-scoped: place it inside the target project's skills directory so it's available only there.
- Global: place it in your user-level Claude Code skills directory so it's available across every project without copying it repeatedly.
- Claude Code can map the `/seo *` commands documented in `commands/` to actual slash commands, depending on your setup.

## Verifying installation

Start a session with your AI agent in the target project and ask something that should trigger the skill (e.g., "audit our SEO," or point the agent at `SKILL.md` directly and ask it to follow the skill). The agent should begin with `workflows/discovery.md`-style project inspection rather than asking you to explain your SEO needs from scratch — that's the signal the skill loaded correctly. On Claude Code specifically, this can also be triggered via `/seo audit` if slash commands are mapped.

## Updating

To update, replace the folder contents with a newer version of this skill. Nothing in the skill itself is meant to be edited per-project — see `docs/usage.md` for what customization (if any) is appropriate at the project level versus what should stay generic in the skill itself.

## Uninstalling

Delete the folder. Nothing else in the target project depends on it or is modified by its mere presence.
