<p align="right">
  <strong>English</strong> | <a href="./README.zh-CN.md">中文</a>
</p>

# skill-manager

> **The local AI dotfiles housekeeper for power users.**

One `npm i -g`. One CLI, one local web UI. Manage **Skills**, **Subagents**, and **MCP servers** across the AI tools you actually use — with **redacted diff previews** before any write.

- **Cross-tool, cross-resource.** Skills for Claude Code, Cursor, VS Code, CodeBuddy, and `~/.agents/skills`; subagents for Cursor, Claude Code, and Codex; MCP for Cursor and Claude Code.
- **Diff before write, secrets redacted.** Every preview/apply path uses the same unified diff; `GITHUB_TOKEN` and friends are masked.
- **Local-only, zero telemetry.** Single npm package; no cloud, no auth, no remote registry.

---

## Why this exists

| Need | Today's options | This tool |
| --- | --- | --- |
| Discover MCP servers in a marketplace | Smithery, Glama, PulseMCP | not this — go there |
| Install one MCP server via CLI | mcpm.sh | not this — go there |
| **One inventory that spans Skills + Subagents + MCP across local AI tool configs** | nothing | **this** |
| **See exactly what `enable` will write — with secrets redacted — before pressing apply** | nothing | **this** |

If you live in `~/.cursor/`, `~/.claude/`, `~/.codex/`, `.vscode/`, and `~/.agents/skills` simultaneously, and you keep finding the same capability enabled in three different configs with three slightly different `env` blocks, this is for you.

---

## Install

```bash
npm install -g skill-manager-cli
skills-manager --help
```

The package is `skill-manager-cli`; the binary is `skills-manager` (the un-prefixed name was already taken on npm).

Node ≥ 20.12 required.

---

## Quick tour

### 1. See everything

```bash
skills-manager skills list             # all skills: claude-code/cursor/vscode/codebuddy/agents
skills-manager skills list --tool vs   # VS Code / GitHub Copilot-style skills
skills-manager agents --tool codex     # Codex subagents
skills-manager mcp --tool cursor       # Cursor MCP servers
skills-manager ui                      # local web UI at http://127.0.0.1:3210
```

### 2. Preview a change (no writes)

```bash
skills-manager preview skill cursor my-skill --op disable
skills-manager preview mcp claude-code github --op disable
skills-manager preview subagent claude-code reviewer --op enable
```

Output is git-style unified diff, ANSI-coloured on TTY, with:
- `+/-` lines for the actual file change,
- `redacted: GITHUB_TOKEN, OPENAI_API_KEY, …` after the diff,
- per-strategy warnings (managed/symlink/native).

### 3. Apply (still reversible)

After verifying the preview:

```bash
skills-manager skills disable --tool cursor my-skill --force
skills-manager skills enable  --tool cursor my-skill
skills-manager agents disable --tool codex reviewer --force
skills-manager mcp disable    --tool claude-code github --apply --force
```

Skill and subagent `disable` archives the resource under `~/.config/skill-manager/archive/`; `enable` restores it. MCP `disable` removes the server from config and stashes the raw server object in `state.json`; `enable` restores it. Writes to global Claude MCP config (`~/.claude.json`) require `--force`.

### 4. Doctor

```bash
skills-manager doctor    # validates state.json, archive paths, settings readability
```

---

## The killer feature: redacted Diff Preview

Every mutation goes through a `MutationPort` that exposes both `preview()` and `apply()`. The same diff the CLI shows is what the local UI's drawer shows is what `/api/v2/resources/preview` returns. One source of truth, three surfaces.

Three syntactic positions are scrubbed in one pass:

```
"GITHUB_TOKEN": "ghp_***"          # JSON
GITHUB_TOKEN=ghp_***               # shell args
GITHUB_TOKEN: ghp_***              # YAML frontmatter
```

Plus everything an adapter declared under `envKeys` (read from the resource record itself). Conservative-by-default: in MCP previews, *every* env value is masked, including innocuous ones like `DEBUG=1`. The cost of over-masking is small; the cost of leaking is forever.

---

## Architecture (one paragraph)

`src/domain/` defines a single `Resource` discriminated union (`skill | subagent | mcp_server`) backed by zod schemas — these schemas are the only shared contract between the CLI, the HTTP server, and the React UI. `src/discovery/*Port` implementations scan the disk; `src/mutation/*Port` implementations build the diff (`preview`) and run the write (`apply`). The HTTP layer (`src/ui/server.ts` + `src/ui/api-v2.ts`) is a thin zod-validated router. The frontend (`webapp/`) is a Vite + React + Tailwind + Zustand app whose build artefact is inlined into `src/ui/webapp.ts` so the npm package ships as a single tree.

```
src/domain/schema.ts ───────────┐
                                │   (zod schemas)
                                ▼
        ┌── src/cli/commands ───┴── src/ui/api-v2.ts ──── webapp/src/api/types.ts
        │                                                      │
        ▼                                                      ▼
   skills-manager preview …                          /api/v2/resources/{preview,apply}
                                                      Diff drawer in the React UI
```

---

## Configuration

Optional. Read from `~/.config/skill-manager/config.{json,yaml}` and `<project>/skill-manager.{json,yaml}` (project extends user config).

```yaml
version: 1
scan:
  extraSkillRoots:
    - ~/Repos/agent-skills
  extraAgentRoots:
    - ~/Repos/team-agents
defaults:
  strategy: auto                # auto | native | managed | symlink
mcp:
  readOnly: true                # default; set false to allow MCP writes
unified:
  mode: symlink
  roots:                        # used by --strategy symlink
    skills: ~/.local/share/skill-manager/skills
    agents: ~/.local/share/skill-manager/agents
    mcp: ~/.local/share/skill-manager/mcp
  select:
    mcp:
      - cursor:github
      - claude-code:github
```

Inspect and edit the resolved config via the UI's **Config** tab (form ⇄ JSON editor). From the CLI, use `skills-manager config path` to see loaded config files and `skills-manager config validate` to verify them.

---

## API

The local server (`skills-manager ui`) exposes:

- `POST /api/v2/resources/preview` → returns a `DiffPreview` JSON. **Use this.**
- `POST /api/v2/resources/apply`   → returns a `MutationResult` JSON. **Use this.**
- `GET  /api/v2/workbench/inventory` → scans the configured workbench library for sync candidates.
- `GET  /api/v1/{skills,agents,mcp}` → legacy list endpoints. Sent with `Deprecation: true` + `Sunset: 2026-12-31`. v0.5 removes them.

Request schemas are the zod schemas in `src/domain/schema.ts`; do not invent your own shape.

---

## Compatibility & safety

- `state.json` schema version is `4`. Future bumps auto-migrate with a timestamped backup.
- `disable` is reversible by design — files are moved, never deleted.
- The CLI never writes outside `~/.config/skill-manager/`, the discovered resource path, or the configured `unified.roots`.
- No network calls. Ever.

---

## License

MIT. See `LICENSE`.
