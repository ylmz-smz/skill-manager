<p align="right">
  <strong>English</strong> | <a href="./README.zh-CN.md">中文</a>
</p>

# skills-manager

A CLI tool for **discovering and toggling** skills across **Claude Code**, **Cursor**, and **`~/.agents/skills`**. It scans `SKILL.md` files and related configurations with a unified data model — modifying native config files when supported, or using a reversible archive-directory strategy with local state tracking otherwise.

## Background & Goals

Skills are scattered across multiple environments: Claude Code user/project directories and its plugin marketplace, Cursor user/project skills and built-in manifests, and the self-managed `~/.agents/skills`. Each has a different toggle mechanism — some use `settings.json` plugin switches, some use frontmatter flags, and Cursor built-in skills can only be managed inside the IDE.

**skills-manager** aims to solve three problems:

1. **Unified view**: Aggregate skills from all sources into a single list showing origin, status, and how the status was determined (config vs. archive state).
2. **Scriptable**: `list --json` for CI/script integration; `enable` / `disable` with explicit strategy flags for automation.
3. **Terminal-friendly**: `list --interactive` for picking and confirming enable/disable in a real terminal — no need to memorize verbose subcommand arguments (precise `enable`/`disable` still available).

Design trade-offs: Claude prefers modifying **`enabledPlugins`** and **`disable-model-invocation`**; Cursor/Agents custom directories default to **whole-directory archival** under `~/.config/skill-manager/archive/`; Cursor **built-in skills** are display-only and not modifiable via this CLI.

## Feature Overview

| Capability | Description |
|------------|-------------|
| Multi-source scan | Claude user/project skills, marketplace `SKILL.md`, Cursor user/project skills, built-in manifest (read-only), `~/.agents/skills` recursive |
| Tabular listing | Grouped by tool; columns: checkbox `[x]`/`[ ]`, `skill-name`, `skill-desc`, `skill-path`, `skill-status` (enabled/disabled); paths abbreviated to `~/…` |
| Interactive listing | `-i`: prints **full table** first; **selection only includes CLI-toggleable items** (built-ins omitted with notice); **current row** highlighted with `❯`, bottom summary shows **enabled/disabled and pending action** |
| Imperative toggle | `enable` / `disable` with `--strategy`, `--path`, `--dry-run`, `--force` (for disable) |
| Health check | `doctor`: validates state file, archive paths, and Claude settings readability |

## Installation & Usage

### Install from npm (global command `skills-manager`)

The package name is **`skill-manager-cli`** (`skills-manager` was already taken on npm). After installation the global command **`skills-manager`** is available:

```bash
npm install -g skill-manager-cli
skills-manager list --help
skills-manager list
```

Pre-publish local verification: `npm pack`, then `npm install -g ./skill-manager-cli-<version>.tgz`, then `skills-manager --version`.

### From source (pnpm)

```bash
cd skill-manager
pnpm install
pnpm run build   # Required on first run or after source changes
pnpm run skills-manager -- list
pnpm run skills-manager -- list cursor              # Cursor only (positional arg)
pnpm run skills-manager -- list -i cursor           # Interactive + Cursor only
pnpm run skills-manager -- list -i -t agents        # Same: -t / --tool
pnpm run skills-manager -- list --json
# Or: pnpm run dev -- list
# Or: node bin/skills-manager.mjs list
```

**Note**: In this repo root, pnpm does **not** put the current package's `bin` on the executable path. Use **`pnpm run skills-manager -- …`**, or use `pnpm exec` after `pnpm link --global` or installing as a dependency in another project.

Global link (optional): run `pnpm run build` then `pnpm link --global` in this repo.

## Commands

| Command | Description |
|---------|-------------|
| `list` | Scan and list skills; `--tool`, `--project`; `--json` for JSON output; `-i` / `--interactive` for interactive selection |
| `disable` | Disable a skill (requires `--force` or env `SKILLS_MANAGER_YES=1`; interactive mode confirms verbally) |
| `enable` | Enable a skill |
| `doctor` | Check `~/.config/skill-manager/state.json`, archive directories, and Claude settings |

**Common `list` options**

- **Filter by tool**: `--tool` / **`-t`**, or equivalent **positional argument** `list [toolArg]`. Examples: `list cursor`, `list cc` (Claude), `list a` (agents), `list all` or omit for all. Conflicting `--tool` and positional arg raises an error.
- `--project <dir>` — include project-level `.claude/skills`, `.cursor/skills`
- `-i, --interactive` — requires **TTY**; prints formatted list, then pick a skill and confirm **enable** or **disable**
- `--strategy auto|native|managed` — only affects subsequent toggle when used with `-i` (default: `auto`)
- `--global` — with Claude + `-i`: write to user-level `~/.claude/settings.local.json`
- `--dry-run` — with `-i`: simulate without writing to disk

Non-interactive `enable`/`disable` also support: `--dry-run`, `--strategy`, `--path`, `--global`, etc.

## "Enabled" Semantics & Default Strategy Per Tool

| Tool | "Enabled" means | Default disable method | Notes |
|------|-----------------|----------------------|-------|
| **Claude Code** (plugin skills) | Present in merged `settings.json` / `settings.local.json` **`enabledPlugins`** | **native** | Writes to **`settings.local.json`** (project or user). `list` shows **`pluginKey`** for reference. |
| **Claude Code** (user/project `SKILL.md`) | No `disable-model-invocation` flag | **native** | Modifies `SKILL.md` YAML frontmatter. |
| **Cursor** (user/project `SKILL.md`) | No `disable-model-invocation` flag | **managed** | Moves skill directory to `~/.config/skill-manager/archive/cursor/<id>/`, state written to `state.json`. |
| **Cursor** (built-in) | Shown as enabled in listing | Not via CLI | Toggle in **Cursor → Settings → Rules / Skills**. |
| **Agents** | Same as Cursor custom skills | **managed** | Archived under `archive/agents/`. |

To only modify frontmatter **without** moving directories, use **`--strategy native`** for Cursor/Agents.

## Scan Paths Summary

- **Claude**: `~/.claude/skills/*`, `<project>/.claude/skills/*`, `~/.claude/plugins/marketplaces/**/SKILL.md` (depth-limited).
- **Cursor**: `~/.cursor/skills/*`, `<project>/.cursor/skills/*`, and read-only `~/.cursor/skills-cursor/.cursor-managed-skills-manifest.json`.
- **Agents**: `~/.agents/skills/**/SKILL.md` (depth-limited).

## Local State File

Managed disables are recorded in **`~/.config/skill-manager/state.json`** with original path, archive path, and timestamp. Use **`doctor`** for consistency checks.

## Development

```bash
pnpm run dev -- list --tool all
pnpm test
```

## Release

```bash
pnpm run release          # Interactive version selection (patch / minor / major)
```

The script automates: version bump → build → git tag → publish to npm. See `scripts/release.ts` for details.

## License

MIT
