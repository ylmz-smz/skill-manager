<p align="right">
  <a href="./README.md">English</a> | <strong>中文</strong>
</p>

# skills-manager

一个用于统一管理的 CLI，覆盖：

- **Skills**（`SKILL.md`）
- **Subagents / Agents**（`.cursor/.claude/.codex 的 agents/*.md`）
- **MCP servers**（Cursor 的 `mcp.json`；Claude Code 的 `~/.claude.json` / `.mcp.json`）

提供统一列表、`--json` 脚本输出，以及**安全且可逆**的启停操作。

## 项目背景与目标

日常会在多个环境里使用「技能」：Claude Code 的用户/项目目录与插件市场、Cursor 的用户/项目技能与内置清单、以及自建的 `~/.agents/skills`。这些来源分散、启停方式不一（有的靠 `settings.json` 里的插件开关，有的靠 frontmatter，Cursor 内置项还只能在 IDE 里切）。

**skills-manager** 试图做三件事：

1. **一眼看清**：把多源技能汇总成同一张清单，标明来源、是否启用、以及判定方式（读配置还是读归档状态）。
2. **可脚本化**：`list --json` 便于和脚本、CI 集成；`enable` / `disable` 与明确的策略标志适合自动化。
3. **终端里顺手改**：在真实终端里用 `list --interactive` 选人、再确认开/关，无需记冗长的子命令参数（仍可用 `enable`/`disable` 做精确控制）。

设计取舍见仓库内实现：Claude 优先动 **`enabledPlugins`** 与 **`disable-model-invocation`**；Cursor/Agents 自定义目录默认 **整目录归档** 到 `~/.config/skill-manager/archive/`；Cursor **内置技能**只展示、不通过本 CLI 修改。

## 功能概览

| 能力 | 说明 |
|------|------|
| 多源扫描 | Claude 用户/项目 skills、插件市场内 `SKILL.md`、Cursor 用户/项目 skills、内置 manifest（只读）、`~/.agents/skills` 递归 |
| Subagents 扫描 | `~/.{cursor,claude,codex}/agents/` 与 `<project>/.{cursor,claude,codex}/agents/` |
| MCP 扫描 | Cursor：`~/.cursor/mcp.json` + `<project>/.cursor/mcp.json`；Claude Code：`~/.claude.json` + `<project>/.mcp.json`（同名项目覆盖） |
| 表格化列表 | 按工具分表；列为复选示意 `[x]`/`[ ]`、`skill-name`、`skill-desc`、`skill-path`、`skill-status`（enabled/disabled）；路径缩写成 `~/...` |
| 交互式列表 | `-i`：先打印**完整总表**；**选择列表仅含可在 CLI 开关的项**（内置等已省略并提示，避免表里是 enabled 却报「不可选」）；**当前行**反色 + `❯`，底部摘要含 **enabled/disabled 与将执行开或关** |
| 命令式启停 | `enable` / `disable`，支持 `--strategy`、`--path`、`--dry-run`、`--force`（关闭时） |
| 自检 | `doctor`：状态文件与归档路径、Claude 设置可读性 |
| 配置文件 | 可选的全局/项目 YAML 配置：额外扫描目录、MCP 写入闸门 |

## 安装与运行

### 从 npm 安装（全局命令 `skills-manager`）

包名 **`skill-manager-cli`**（npm 上 `skills-manager` 已被其他占用）。安装后全局可用 **`skills-manager`**：

```bash
npm install -g skill-manager-cli
skills-manager list --help
skills-manager list
```

发布前本地验证 tarball：`npm pack` 后 `npm install -g ./skill-manager-cli-0.1.0.tgz`，再执行 `skills-manager --version`。

### 从源码（pnpm）

```bash
cd skill-manager
pnpm install
pnpm run build   # 首次或改源码后：入口 shim 会加载 dist/cli.js
pnpm run skills-manager -- list
pnpm run skills-manager -- list cursor              # 只看 Cursor（位置参数）
pnpm run skills-manager -- list -i cursor         # 交互 + 仅 Cursor
pnpm run skills-manager -- list -i -t agents      # 同义：-t / --tool
pnpm run skills-manager -- list --json
# 或：pnpm run dev -- list
# 或：node bin/skills-manager.mjs list
```

**说明**：在本仓库根目录下，pnpm **不会**把当前包的 `bin` 放进可执行路径，因此不要用 `pnpm exec skills-manager`。请用 **`pnpm run skills-manager -- …`**，或在 `pnpm link --global` / 作为其他项目的依赖安装后再用 `pnpm exec`。

全局链接（可选）：在本仓库执行 `pnpm run build` 后 `pnpm link --global`。

## 命令说明

| 命令 | 作用 |
|------|------|
| `list` |（兼容入口）扫描并列出技能；`--tool`、`--project`；`--json` 输出 JSON；`-i` / `--interactive` 交互选择与确认 |
| `skills` | 管理 skills（`skills list|enable|disable`） |
| `agents` | 列出并启停 subagents（`agents enable/disable`） |
| `mcp` | 列出并启停 MCP servers（`mcp enable/disable`），受配置与 `--apply` 保护 |
| `config` | 查看/校验配置文件（`config path|validate`） |
| `disable` | 关闭技能（需 `--force` 或环境变量 `SKILLS_MANAGER_YES=1`，交互模式已口头确认故不需要） |
| `enable` | 开启技能 |
| `doctor` | 检查 `~/.config/skill-manager/state.json`、归档目录与 Claude 设置 |

### 配置文件（可选）

- **全局**：`~/.config/skill-manager/config.yaml`
- **项目**：`<project>/skill-manager.yaml`

示例：

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

命令：

```bash
skills-manager config path --project .
skills-manager config validate --project .
```

### Subagents（agents）

```bash
skills-manager agents
skills-manager agents --json
skills-manager agents cursor --project .

skills-manager agents disable --tool cursor verifier --force
skills-manager agents enable --tool cursor verifier
```

### MCP servers（mcp）

```bash
skills-manager mcp
skills-manager mcp cursor --project .
skills-manager mcp --json
```

写入保护：

- 默认 `mcp.readOnly: true` **禁止写入**
- 允许写入后仍必须加 `--apply`
- 编辑 `~/.claude.json` 需要 `--force` 且会生成时间戳备份

```bash
skills-manager mcp disable --tool cursor github --apply
skills-manager mcp enable --tool cursor github --apply
```
**list 常用参数**

- **筛选工具**：`--tool` / **`-t`**，或与子命令等价的**位置参数** `list [toolArg]`。示例：`list cursor`、`list cc`（Claude）、`list a`（agents）、`list all` 或省略表示全部。与 `-t` 同时指定且不一致时会报错。
- `--project <dir>` 包含项目级 `.claude/skills`、`.cursor/skills`
- `-i, --interactive`：需 **TTY**；先打印格式化列表，再选择技能，最后确认 **开启** 或 **关闭**
- `--strategy auto|native|managed`：仅在与 `-i` 联用时影响后续启停策略（默认 `auto`）
- `--global`：与 Claude + `-i` 联用时写入用户级 `~/.claude/settings.local.json`
- `--dry-run`：与 `-i` 联用时只模拟不写盘

非交互的 `enable`/`disable` 仍支持：`--dry-run`、`--strategy`、`--path`、`--global` 等（见下表与各工具语义）。

## 各工具「启用」含义与默认策略

| 工具 | 列表里「启用」含义 | 默认关闭方式 | 说明 |
|------|-------------------|-------------|------|
| **Claude Code**（插件技能） | 合并后的 `settings.json` / `settings.local.json` 中 **`enabledPlugins`** | **native** | 写入 **`settings.local.json`**（项目或用户）。`list` 会显示 **`pluginKey`** 便于对照配置。 |
| **Claude Code**（用户/项目 `SKILL.md`） | 未设 `disable-model-invocation` | **native** | 改 `SKILL.md` 的 YAML frontmatter。 |
| **Cursor**（用户/项目 `SKILL.md`） | 未设 `disable-model-invocation` | **managed** | 将技能目录移到 `~/.config/skill-manager/archive/cursor/<id>/`，状态写入 `state.json`。 |
| **Cursor**（内置） | 清单中展示为启用 | 不可 CLI | 请在 **Cursor → 设置 → Rules / Skills** 中切换。 |
| **Agents** | 同 Cursor 自定义技能 | **managed** | 归档在 `archive/agents/` 下。 |

若只希望改 frontmatter、**不**移动目录，对 Cursor/Agents 使用 **`--strategy native`**。

## 扫描路径摘要

- **Claude**：`~/.claude/skills/*`、`<project>/.claude/skills/*`、`~/.claude/plugins/marketplaces/**/SKILL.md`（有深度上限）。
- **Cursor**：`~/.cursor/skills/*`、`<project>/.cursor/skills/*`，以及只读的 `~/.cursor/skills-cursor/.cursor-managed-skills-manifest.json`。
- **Agents**：`~/.agents/skills/**/SKILL.md`（有深度上限）。

## 本地状态文件

托管式关闭会在 **`~/.config/skill-manager/state.json`** 中记录原路径、归档路径与时间，可用 **`doctor`** 做一致性检查。

## 开发

```bash
pnpm run dev -- list --tool all
pnpm test
```

## 发布

```bash
pnpm run release          # 交互式选择版本号（patch / minor / major）
```

脚本会自动完成：版本号更新 → 构建 → git tag → 发布到 npm。详见 `scripts/release.ts`。

## 许可证

MIT
