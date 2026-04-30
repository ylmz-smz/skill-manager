# skill-manager v2 — 统一规划

面向 **Skills、Subagents（Agent）、MCP** 的全局/项目配置治理，以及 **可读的 CLI + 本地可视化**。本文档是重构的单一事实来源（后续实现以本文为准迭代）。

---

## 1. 背景与目标

### 1.1 要解决什么问题

| 问题 | v1 现状 | v2 方向 |
|------|---------|---------|
| 只覆盖 Skills，不含 Subagents / MCP | 仅扫描 `skills`、插件等 | 三类资源统一模型 + 分适配器 |
| Agent（Cursor/Claude/Codex）未纳入 | 无 `agents/` 扫描 | 扫描 `~/.{cursor,claude,codex}/agents` 与项目级路径 |
| CLI 难用 | 长参数、`list` 承载过多、工具缩写不直观 | 子命令按资源划分、合理默认、交互式向导可选 |
| 无可视化 | 仅终端表格 / `-i` | 本地 Web 仪表盘（只监听 127.0.0.1） |
| 扩展目录 | 部分硬编码路径 | `skill-manager.yaml` 声明额外 roots |

### 1.2 非目标（首期）

- 云端同步、账号登录、团队 SaaS。
- 修改 **Cursor 内置 Skills**、**ChatGPT 网页端** 账号设置（无稳定本地文件契约）。
- 双向合并冲突的「全自动仲裁」（首期以 **显式覆盖策略 + dry-run 预览** 为主）。

---

## 2. 设计原则

1. **真相仍在各工具原生文件**：本工具是 **索引 + 受控写入 + 归档状态**，不当唯一配置源。
2. **Never break userspace**：保留 `skills-manager` 入口；v1 的 `state.json` 与行为通过兼容层迁移。
3. **安全默认**：MCP 含密钥 → **默认只读**；写入需 `--apply` 或 UI 确认。
4. **同一核心库**：CLI、UI、未来 IDE 插件共用 `packages/core`（或 `src/core`）逻辑。

---

## 3. 领域模型

### 3.1 资源类型 `ResourceKind`

| Kind | 含义 | 典型磁盘形态 |
|------|------|----------------|
| `skill` | SKILL.md 技能 | `.cursor/skills`, `.claude/skills`, 插件市场等（沿用 v1） |
| `subagent` | Subagent / Agent | `**/.cursor/agents/*.md`, `**/.claude/agents/*.md`, `**/.codex/agents/*.md` |
| `mcp_server` | MCP 服务条目 | `mcp.json` / Cursor & Claude 各自路径（适配器解析） |

每条记录包含：`id`, `displayName`, `description`, `tool`（产品维度）, `sourceKind`（user-global | project | plugin | …）, `path`, `enabled` / `enabledSemantic`, `resourceKind`, `notes`。

### 3.2 工具维度 `ToolId`（产品）

建议扩展为（命名可微调，实现时保持 JSON 稳定）：

- `claude-code`, `cursor`, `vscode`, `codebuddy`
- `agents` → **保留**：仍表示 `~/.agents/skills`（自建 agents 目录技能），避免与 `subagent` 混淆；文档中改称 **「Agents 目录技能」**。
- **新增** `codex`：仅用于 `.codex/agents/`（及未来若存在的 `.codex/skills` 等，按文档追加）。

Subagent 文件可能同时落在 `.cursor/agents` 与 `.claude/agents`（团队混用）；列表里 **按真实路径去重或分行展示**，冲突规则遵循 Cursor 文档（`.cursor` 优先于 `.claude`/`.codex`）。

### 3.3 启停语义

| 资源 | 首选「原生」操作 | 备选「托管」 |
|------|------------------|--------------|
| Skill（markdown） | frontmatter `disable-model-invocation` | 整目录归档（v1 已有） |
| Skill（Claude 插件） | `enabledPlugins` | 一般不归档插件 |
| Subagent | 若 frontmatter 将来有禁用字段则写文件；否则 **归档 = 移出 agents 目录** | 同 v1 archive 结构，按 `tool` + `resourceKind` 分区 |
| MCP | 改 JSON 列表 / enabled 字段 | **首期不做归档**，仅编辑或注释式禁用（若格式支持） |

`state.json` 演进为 **v2**：`archived[]` 条目增加 `resourceKind`；迁移脚本读取 v1 缺省视为 `skill`。

---

## 4. 配置分层

### 4.1 配置文件位置（建议）

| 范围 | 文件 | 用途 |
|------|------|------|
| 用户全局 | `~/.config/skill-manager/config.yaml`（或 `.json`） | 额外扫描路径、默认策略、UI 端口 |
| 项目 | `<project>/skill-manager.yaml`（可选） | 项目 roots、是否继承全局、团队约定 |

### 4.2 Manifest 字段（草案）

```yaml
version: 1
scan:
  extraSkillRoots: []      # 追加的 SKILL 根目录
  extraAgentRoots: []      # 追加的 agents 根目录
defaults:
  strategy: auto           # auto | native | managed
mcp:
  readOnly: true           # 默认只读
tools:
  codex:
    enabled: true
```

解析顺序：**默认值 → 全局 manifest → 项目 manifest → CLI 参数**。

---

## 5. 架构建议（仓库结构）

在 **单仓 npm 包**内采用清晰分层（不必一上来拆多个 npm 包，可选用 `src/` 子目录模拟）：

```
src/
  domain/           # 类型、校验、路径常量
  discovery/        # 扫描：skills / subagents / mcp（按工具拆分 adapters）
  mutation/         # enable/disable，策略与归档
  config/           # manifest 加载与合并
  ipc/              # UI 用的 JSON API（与 CLI 共用）
cli/                # Commander 入口，薄包装
web/                # 静态前端 + 或由 CLI `serve` 提供
```

CLI **二进制名**：保留 `skills-manager`，可增加 **`sm`** 作为短别名（可选）。包名可仍为 `skill-manager-cli`。

---

## 6. CLI 重新设计

### 6.1 痛点对照

| v1 | v2 |
|----|-----|
| `list` + 一堆 flags | 顶层按资源：`skills`、`agents`、`mcp` |
| `--tool` 与位置参数易混 | 要么只要 `--tool`，要么只要位置参数，冲突时明确报错（沿用严谨校验） |
| `enable/disable` 必须记 skill-id | 支持 **交互式选择**（默认 TTY 下可选向导），非 TTY 仍要求 id |

### 6.2 建议命令树

```text
sm doctor [--project <dir>]
sm config path          # 打印使用的配置文件路径
sm config validate

sm skills list [tool] [--project] [--json] [--interactive]
sm skills enable <id> [--tool] [--project] [--strategy] ...
sm skills disable <id> ...

sm agents list [tool] [--project] [--json] [--interactive]
sm agents enable <id> ...
sm agents disable <id> ...

sm mcp list [--tool cursor|claude-code] [--project] [--json]
sm mcp enable <server-id> ...    # 若 readOnly 默认拒绝，需 --apply

sm ui [--port 8787]               # 启动本地仪表盘
```

**兼容**：保留 `skills-manager list` → 等价 `skills list` 或打印 deprecation 提示指向新子命令（至少一个大版本周期）。

### 6.3 交互体验

- `list --interactive`：**先展示过滤后的表格**，再选序号；底部固定 **当前选中项 + 将执行操作**（v1 已有部分，保留并统一三套资源）。
- 全局 **`--dry-run`**、**`SKILLS_MANAGER_YES`** 等行为保持一致并写入 README。

---

## 7. 可视化（本地 Web）

1. `sm ui`：启动 **仅 127.0.0.1** 的 HTTP 服务；浏览器打开列表、筛选、详情、开关（与 mutation 层相同）。
2. API：`GET /api/v1/skills`、`/agents`、`/mcp`；`POST` 启停需同源或 token（极简共享密钥可选）。
3. 技术选型：与仓库现有栈一致优先（当前为 TS + 无前端框架 → 可引入 **轻量 Vite + Vanilla/React**，按维护成本选）。

---

## 8. MCP 实施策略

1. **Phase A**：只读解析 + 列表 + doctor 检查路径存在性。
2. **Phase B**：enable/disable 映射到各工具 JSON（严格 dry-run diff）。
3. 密钥：**不在列表 JSON 中默认回显完整 env**；UI 打码。

各工具 `mcp.json` / settings 路径以适配器单元测试锁定。

---

## 9. 迁移与兼容

1. **state.json**：版本号 `2`，迁移时给旧 `archived` 补 `resourceKind: "skill"`。
2. **CLI**：旧命令转发或 deprecation warning。
3. **测试**：保留 v1 核心 vitest，新增 discovery/mutation 按资源类型拆分。

---

## 10. 实施阶段（建议）

| 阶段 | 交付物 |
|------|--------|
| **P0** | 领域类型 + `agents list`（subagent 扫描）+ `state` v2 迁移草案 + CLI 子命令骨架（skills 迁到新结构） |
| **P1** | `mcp list` 只读 + manifest `extra*` + `doctor` 扩展 |
| **P2** | `sm ui` MVP（只读列表） |
| **P3** | MCP/agents 写入 + UI 启停 |
| **P4** | 旧 CLI 废弃周期与 README 大更新 |

---

## 11. 验收标准（v2.0）

- [ ] 三种资源均可 `list --json`，且 schema 稳定版本化。
- [ ] Subagent 覆盖 Cursor / Claude / Codex 官方路径（用户级 + 项目级）。
- [ ] 全局/项目 manifest 生效并有测试。
- [ ] 本地 UI 可浏览三类资源；写入路径与 CLI 一致。
- [ ] 旧仓库用户升级后归档记录不丢失（迁移验证）。

---

## 12. 参考文献（路径约定）

- Cursor Subagents：<https://cursor.com/docs/agent/subagents>（`.cursor/agents`, `~/.codex/agents` 等）
- Claude Subagents：<https://code.claude.com/docs/en/sub-agents.md>（`~/.claude/agents`）

本文档随实现 PR 修订 **版本号与日期**。
