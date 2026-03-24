# skills-manager

CLI to **discover** and **enable/disable** skills across **Claude Code**, **Cursor**, and **`~/.agents/skills`**.

## Install / run

```bash
cd skill-manager
pnpm install
pnpm run build   # required once: shim loads dist/cli.js
pnpm run skills-manager -- list --json
# or: pnpm run dev -- list
# or: node bin/skills-manager.mjs list
```

Note: **pnpm does not put this package’s own `bin` on `PATH` inside the repo**, so `pnpm exec skills-manager` fails here. Use `pnpm run skills-manager -- …` locally, or `pnpm link --global` / install as a dependency elsewhere—then `pnpm exec skills-manager` works.

Global install (optional): `pnpm link --global` from this repo after `pnpm run build`.

## Commands

| Command | Purpose |
|--------|---------|
| `list` | Scan configured locations; optional `--project DIR`, `--tool`, `--json` |
| `disable` | Disable a skill (requires `--force` unless `SKILLS_MANAGER_YES=1`) |
| `enable` | Enable a skill |
| `doctor` | Check `~/.config/skill-manager/state.json`, archive paths, Claude settings readability |

Common flags: `--dry-run`, `--strategy auto|native|managed`, `--path <dir>` (disambiguate duplicate ids), `--global` (Claude: write user `~/.claude/settings.local.json` instead of project).

## `enabled` semantics by tool

| Tool | `enabled` (list) | Default disable strategy | Notes |
|------|------------------|---------------------------|--------|
| **Claude Code** (plugin skill) | From merged `settings.json` / `settings.local.json` **`enabledPlugins`** | **native** | Writes **`settings.local.json`** (project or user). Use `list` `pluginKey` column for copy/paste keys. |
| **Claude Code** (user/project `SKILL.md`) | From YAML **`disable-model-invocation`** | **native** | Toggles frontmatter on `SKILL.md`. |
| **Cursor** (user/project `SKILL.md`) | From **`disable-model-invocation`** | **managed** | Moves skill dir to `~/.config/skill-manager/archive/cursor/<id>/`; state tracks restore path. |
| **Cursor** (built-ins) | Always listed as on | n/a | **Not** modified by this CLI — change in Cursor **Settings → Rules / Skills**. |
| **Agents** (`~/.agents/skills`) | From **`disable-model-invocation`** | **managed** | Same archive pattern under `archive/agents/`. |

Use **`--strategy native`** on Cursor/agents to only flip **`disable-model-invocation`** without moving directories.

## Paths scanned

- Claude: `~/.claude/skills/*`, `<project>/.claude/skills/*`, `~/.claude/plugins/marketplaces/**/SKILL.md` (depth-capped).
- Cursor: `~/.cursor/skills/*`, `<project>/.cursor/skills/*`, plus read-only manifest `~/.cursor/skills-cursor/.cursor-managed-skills-manifest.json`.
- Agents: `~/.agents/skills/**/SKILL.md` (depth-capped).

## State

Managed disables are recorded in **`~/.config/skill-manager/state.json`** (original path, archive path, timestamps).

## Development

```bash
pnpm run dev -- list --tool all
pnpm test
```
