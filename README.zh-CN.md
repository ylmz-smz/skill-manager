<p align="right">
  <a href="./README.md">English</a> | <strong>中文</strong>
</p>

# skill-manager

> **重度折腾派的本地 AI dotfiles 管家。**

`npm i -g` 一行装好。一个 CLI、一套本地 Web UI，统一管理 **Cursor / Claude Code / Codex / `~/.agents/skills`** 上的 **Skills / Subagents / MCP servers**——**所有写盘操作都先返回脱敏后的 Diff**。

- **跨工具 × 跨资源类型**：4 个工具链 × 3 种资源，统一清单。
- **改前 Diff + 密钥脱敏**：每一次 `enable` / `disable` 先返回 unified diff，`GITHUB_TOKEN` 等敏感值自动打码。
- **纯本地、零遥测**：单 npm 包，无云依赖、无登录、无远程注册表。

---

## 它为什么存在

| 需求 | 业界方案 | 本工具 |
| --- | --- | --- |
| 浏览 MCP 服务器目录 | Smithery / Glama / PulseMCP | 不是这个——去用上面的 |
| 通过 CLI 安装单个 MCP 服务器 | mcpm.sh | 不是这个——去用 mcpm.sh |
| **一份清单同时管 Skills + Subagents + MCP，跨 Cursor + Claude + Codex + Agents** | 空白 | **本工具** |
| **写盘前就能看到改动内容（含脱敏），确认后再 apply** | 空白 | **本工具** |

如果你同时折腾 `~/.cursor/`、`~/.claude/`、`~/.codex/`，而且经常发现"同一个 MCP server 在三处都开着、`env` 还略有差异"——这就是为你准备的。

---

## 安装

```bash
npm install -g skill-manager-cli
skills-manager --help
```

npm 包名是 `skill-manager-cli`，可执行命令是 `skills-manager`（不带 `-cli` 后缀的名字已被占用）。

Node ≥ 20.12。

---

## 快速上手

### 1. 查看所有资源

```bash
skills-manager skills list           # 所有工具的 skills
skills-manager agents list           # 所有 subagents
skills-manager mcp list              # 所有 MCP servers
skills-manager ui                    # 本地 Web UI，http://127.0.0.1:3210
```

### 2. 预览改动（不写盘）

```bash
skills-manager preview skill cursor my-skill --op disable
skills-manager preview mcp claude-code github --op disable
skills-manager preview subagent claude-code reviewer --op enable
```

输出是 git 风格的 unified diff，TTY 上自动着色，并附带：

- `+/-` 行：实际文件变更；
- `redacted: GITHUB_TOKEN, OPENAI_API_KEY, …`：被脱敏的 env keys；
- 每种 strategy（managed / symlink / native）对应的警告。

### 3. 确认后写盘（仍可回滚）

```bash
skills-manager skills disable --tool cursor my-skill --force
skills-manager skills enable  --tool cursor my-skill
skills-manager mcp disable    --tool claude-code github --apply
```

`disable` 把资源归档到 `~/.config/skill-manager/archive/`，`enable` 即可还原。MCP 写入 `~/.claude.json` 前会自动备份到 `.claude.json.bak.<iso>`。

### 4. 体检

```bash
skills-manager doctor    # 校验 state.json、归档路径、settings 可读性
```

---

## 杀手功能：带脱敏的 Diff Preview

每个写操作都走 `MutationPort.preview()` / `apply()`。同一份 diff，**CLI 终端看到的**、**Web UI 抽屉里看到的**、**`/api/v2/resources/preview` 返回的**完全一致——一处定义、三处使用。

一次扫描脱敏三种语法位置：

```
"GITHUB_TOKEN": "ghp_***"          # JSON 字段
GITHUB_TOKEN=ghp_***               # shell args
GITHUB_TOKEN: ghp_***              # YAML frontmatter
```

外加资源记录上声明的 `envKeys` 全部默认脱敏。**保守默认**：MCP 预览中 *所有* `env` value 都会被打码，包括看起来无害的 `DEBUG=1`。过度脱敏的代价小，泄露的代价是永久性的。

---

## 架构（一段话）

`src/domain/` 用 zod 定义了统一的 `Resource` 判别联合（`skill | subagent | mcp_server`），是 CLI / HTTP / React UI 之间**唯一共享的契约**。`src/discovery/*Port` 负责扫盘，`src/mutation/*Port` 负责生成 diff（`preview`）和真正写盘（`apply`）。HTTP 层（`src/ui/server.ts` + `src/ui/api-v2.ts`）只是薄薄一层 zod-validated 路由。前端在 `webapp/`，是 Vite + React + Tailwind + Zustand 应用，构建产物会被 inline 进 `src/ui/webapp.ts`，npm 包仍按单文件分发。

```
src/domain/schema.ts ───────────┐
                                │   (zod schemas)
                                ▼
        ┌── src/cli/commands ───┴── src/ui/api-v2.ts ──── webapp/src/api/types.ts
        │                                                      │
        ▼                                                      ▼
   skills-manager preview …                          /api/v2/resources/{preview,apply}
                                                      React UI 的 Diff Drawer
```

---

## 配置

可选。读取顺序：用户 `~/.config/skill-manager/config.{json,yaml}` → 项目 `<project>/.skills-manager.{json,yaml}`（项目覆盖用户）。

```yaml
scan:
  extraSkillRoots:
    - ~/Repos/agent-skills
  extraAgentRoots:
    - ~/Repos/team-agents
defaults:
  strategy: auto                # auto | native | managed | symlink
mcp:
  readOnly: false               # 设为 true 可全局禁止 MCP 写入
unified:
  roots:                        # --strategy symlink 时使用
    skills: ~/.local/share/skill-manager/skills
    agents: ~/.local/share/skill-manager/agents
```

可通过 UI 的 **Config** 标签（表单 ⇄ JSON 双向编辑）查看 / 修改，或在 CLI 用 `skills-manager config show`。

---

## API

本地 server（`skills-manager ui` 启动）暴露：

- `POST /api/v2/resources/preview` → 返回 `DiffPreview` JSON。**首选**。
- `POST /api/v2/resources/apply`   → 返回 `MutationResult` JSON。**首选**。
- `GET  /api/v1/{skills,agents,mcp}` → 旧 list 接口。响应带 `Deprecation: true` + `Sunset: 2026-12-31`，v0.5 移除。

请求体 schema 就是 `src/domain/schema.ts` 里的 zod schemas，请勿自造。

---

## 兼容性 & 安全

- `state.json` schema version 当前为 `4`。后续 bump 会自动迁移并生成时间戳备份。
- `disable` 设计上可逆——文件是被移动，不会被删除。
- CLI 不会写入 `~/.config/skill-manager/`、目标资源路径、`unified.roots` 之外的任何位置。
- 永不发起任何网络请求。

---

## 许可证

MIT。详见 `LICENSE`。
