<p align="right">
  <strong>English</strong> | <a href="./README.zh-CN.md">中文</a>
</p>

# skills-manager

A CLI tool for **discovering and managing**:

- **Skills** (`SKILL.md`)
- **Subagents** (`.cursor/.claude/.codex agents/*.md`)
- **MCP servers** (Cursor `mcp.json`, Claude Code `~/.claude.json` / `.mcp.json`)

…across **Cursor**, **Claude Code**, **Codex compatibility paths**, and **`~/.agents/skills`**, with unified listing, scriptable JSON output, and safe reversible toggles.

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
| Subagents scan | Cursor/Claude/Codex subagents under `~/.{cursor,claude,codex}/agents/` and `<project>/.{cursor,claude,codex}/agents/` |
| MCP scan | Cursor: `~/.cursor/mcp.json` + `<project>/.cursor/mcp.json`; Claude Code: `~/.claude.json` + `<project>/.mcp.json` (project overrides) |
| Local UI dashboard | `skills-manager ui` starts a local web dashboard (no secrets shown). Config tab supports **Form ⇄ JSON** editing + save |
| Tabular listing | Grouped by tool; columns: checkbox `[x]`/`[ ]`, `skill-name`, `skill-desc`, `skill-path`, `skill-status` (enabled/disabled); paths abbreviated to `~/…` |
| Interactive listing | `-i`: prints **full table** first; **selection only includes CLI-toggleable items** (built-ins omitted with notice); **current row** highlighted with `❯`, bottom summary shows **enabled/disabled and pending action** |
| Imperative toggle | `enable` / `disable` with `--strategy`, `--path`, `--dry-run`, `--force` (for disable) |
| Health check | `doctor`: validates state file, archive paths, and Claude settings readability |
| Config files | Optional global & project YAML/JSON config for extra scan roots, unified management roots, and MCP write guard |

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

## UI dashboard

Start a local dashboard (read-only by default; no secrets shown):

```bash
skills-manager ui --port 8787
skills-manager ui --port 8787 --project .
```

## Commands

| Command | Description |
|---------|-------------|
| `list` | (Compatibility) Scan and list skills; `--tool`, `--project`; `--json` for JSON output; `-i` / `--interactive` for interactive selection |
| `skills` | Manage skills (`skills list|enable|disable`) |
| `agents` | List and toggle subagents (`agents enable/disable`) |
| `mcp` | List and toggle MCP servers (`mcp enable/disable`) — guarded by config + `--apply` |
| `config` | Inspect/validate config files (`config path|validate`) |
| `ui` | Start local web dashboard (`ui --port 8787 --project .`) |
| `disable` | Disable a skill (requires `--force` or env `SKILLS_MANAGER_YES=1`; interactive mode confirms verbally) |
| `enable` | Enable a skill |
| `doctor` | Check `~/.config/skill-manager/state.json`, archive directories, and Claude settings |

### Config files (optional)

Config supports **YAML or JSON**:

- **Global**: `~/.config/skill-manager/config.yaml` or `~/.config/skill-manager/config.json`
- **Project**: `<project>/skill-manager.yaml` or `<project>/skill-manager.json`

Example:

```yaml
version: 1
scan:
  extraSkillRoots:
    - ~/my-skills
  extraAgentRoots:
    - ~/my-agents
mcp:
  readOnly: true
```

### Unified management roots + symlink toggle (optional)

You can centrally manage selected Skills / Subagents / MCP servers, and toggle them via **symlinks** (mount/unmount).

```yaml
version: 1
defaults:
  strategy: symlink
unified:
  mode: symlink
  roots:
    skills: ~/unified/skills
    agents: ~/unified/agents
    mcp: ~/unified/mcp
  select:
    # stored as array: "<tool>:<id>"
    skills:
      - cursor:my-skill
      - claude-code:my-claude-skill
    agents:
      - cursor:verifier
    mcp:
      - cursor:github
      - claude-code:my-server
```

MCP unified directory layout (per-server):

```text
<unified.mcp>/
  servers/<tool>/<id>.json     # canonical server object
  enabled/<tool>/<id>.json     # symlink -> servers/<tool>/<id>.json (exists = enabled)
```

Commands:

```bash
skills-manager config path --project .
skills-manager config validate --project .
```

### Subagents (agents)

List:

```bash
skills-manager agents
skills-manager agents --json
skills-manager agents cursor --project .
```

Toggle (managed archive, reversible):

```bash
skills-manager agents disable --tool cursor verifier --force
skills-manager agents enable --tool cursor verifier
```

### MCP servers (mcp)

List:

```bash
skills-manager mcp
skills-manager mcp cursor --project .
skills-manager mcp --json
```

Write guard:

- Writes are **disabled by default** via `mcp.readOnly: true`
- Even when allowed, writes require `--apply`
- Editing `~/.claude.json` requires `--force` and creates a timestamped backup

Toggle:

```bash
# disable: remove from config and stash into state (reversible)
skills-manager mcp disable --tool cursor github --apply

# restore from state stash
skills-manager mcp enable --tool cursor github --apply
```

Symlink-based MCP toggle (per-server):

- When `unified.roots.mcp` is set and `<tool>:<id>` is listed under `unified.select.mcp`,
  `skills-manager mcp enable/disable` toggles it via the unified directory + enabled symlink,
  then syncs the generated set back into the tool MCP config JSON.

**Common `list` options**

- **Filter by tool**: `--tool` / **`-t`**, or equivalent **positional argument** `list [toolArg]`. Examples: `list cursor`, `list cc` (Claude), `list a` (agents), `list all` or omit for all. Conflicting `--tool` and positional arg raises an error.
- `--project <dir>` — include project-level `.claude/skills`, `.cursor/skills`
- `-i, --interactive` — requires **TTY**; prints formatted list, then pick a skill and confirm **enable** or **disable**
- `--strategy auto|native|managed|symlink` — only affects subsequent toggle when used with `-i` (default: `auto`)
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
To use symlink mount/unmount with centralized roots, use **`--strategy symlink`** and configure `unified.*`.

## Scan Paths Summary

- **Claude**: `~/.claude/skills/*`, `<project>/.claude/skills/*`, `~/.claude/plugins/marketplaces/**/SKILL.md` (depth-limited).
- **Cursor**: `~/.cursor/skills/*`, `<project>/.cursor/skills/*`, and read-only `~/.cursor/skills-cursor/.cursor-managed-skills-manifest.json`.
- **Agents**: `~/.agents/skills/**/SKILL.md` (depth-limited).
- **Subagents**: `~/.{cursor,claude,codex}/agents/*.md` and `<project>/.{cursor,claude,codex}/agents/*.md`
- **MCP**: Cursor `~/.cursor/mcp.json` / `<project>/.cursor/mcp.json`; Claude `~/.claude.json` / `<project>/.mcp.json`

## Local State File

Managed disables are recorded in **`~/.config/skill-manager/state.json`**:

- Skills/Subagents: archive metadata (reversible move)
- MCP: stashed `mcpServers[id]` payload for reversible restore
 - Symlink mode: symlink-managed entries may be recorded so disabled items remain visible

Use **`doctor`** for consistency checks.

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
