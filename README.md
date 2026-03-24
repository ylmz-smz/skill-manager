# skills-manager

面向 **Claude Code**、**Cursor** 与 **`~/.agents/skills`** 的 Skills **发现与启停**命令行工具。用统一的数据模型扫描各工具下的 `SKILL.md` 与相关配置，在支持原生配置时改配置文件，否则用可逆的归档目录策略并记录本地状态。

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
| 表格化列表 | 按工具分表；列为复选示意 `[x]`/`[ ]`、`skill-name`、`skill-desc`、`skill-path`、`skill-status`（enabled/disabled）；路径缩写成 `~/...` |
| 交互式列表 | `-i`：选择技能 → 确认开启或关闭（内置项不可选或提示去 IDE） |
| 命令式启停 | `enable` / `disable`，支持 `--strategy`、`--path`、`--dry-run`、`--force`（关闭时） |
| 自检 | `doctor`：状态文件与归档路径、Claude 设置可读性 |

## 安装与运行

```bash
cd skill-manager
pnpm install
pnpm run build   # 首次或改源码后：入口 shim 会加载 dist/cli.js
pnpm run skills-manager -- list
pnpm run skills-manager -- list --interactive
pnpm run skills-manager -- list --json
# 或：pnpm run dev -- list
# 或：node bin/skills-manager.mjs list
```

**说明**：在本仓库根目录下，pnpm **不会**把当前包的 `bin` 放进可执行路径，因此不要用 `pnpm exec skills-manager`。请用 **`pnpm run skills-manager -- …`**，或在 `pnpm link --global` / 作为其他项目的依赖安装后再用 `pnpm exec`。

全局链接（可选）：在本仓库执行 `pnpm run build` 后 `pnpm link --global`。

## 命令说明

| 命令 | 作用 |
|------|------|
| `list` | 扫描并列出技能；`--tool`、`--project`；`--json` 输出 JSON；`-i` / `--interactive` 交互选择与确认 |
| `disable` | 关闭技能（需 `--force` 或环境变量 `SKILLS_MANAGER_YES=1`，交互模式已口头确认故不需要） |
| `enable` | 开启技能 |
| `doctor` | 检查 `~/.config/skill-manager/state.json`、归档目录与 Claude 设置 |

**list 常用参数**

- `--tool claude-code|cursor|agents|all`
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

## 许可证

MIT
