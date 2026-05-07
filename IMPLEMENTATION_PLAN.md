# skill-manager UI 优化 — 实施计划

> 单一事实来源；落地完成后会从仓库移除。

## 背景

CLI 三件套（skills / agents / mcp）已稳定，但 `src/ui/webapp.ts`（1087 行单文件 HTML 模板字符串 + 全量 `innerHTML` 重渲染 + 浏览器原生 `confirm/alert`）阻碍了实际使用。本次按四个阶段落地优化，并优先修复"禁用 skill 提示没权限"的具体卡点。

## 约束

- 保持 npm 单包发布，不拆 monorepo
- 前端不引入运行时 dep，仅以 CDN 字符串内联 petite-vue
- `/api/v1` 路径与 JSON schema 不破坏
- `mcp.readOnly=true` 默认值不动

## 阶段 P0：修复"禁用 skill 提示没权限"

**目标**：`disableSkill` 在原文件不可写时给出可操作的提示，UI 抽屉允许选择 `strategy`（auto/native/managed）。

**完成标准**：
- 后端 EACCES → 抛出友好错误，建议改 `--strategy managed`
- UI 抽屉禁用前可选 strategy（默认 auto，下拉到 managed 走归档不写原文件）
- 已有 vitest 全部通过 + 新增 1 条 EACCES 转译测试

**测试用例**：
- `disableSkill` 写只读 SKILL.md 时抛出"writable"相关消息
- UI 提交 `strategy=managed` 时调用归档分支

**状态**：进行中

## 阶段 1：基础体验救命包

**目标**：UI 启动顺滑，状态可记忆，渲染从全量 innerHTML 切换到响应式。

**完成标准**：
- `skills-manager ui` 默认 `--open` 自动打开浏览器（可 `--no-open` 关闭）
- 端口被占用时自动尝试 +1（最多 +10），并打印实际使用端口
- localStorage 持久化：tab、搜索词、工具筛选、语言、描述模式
- 把 `src/ui/webapp.ts` 拆为 `src/ui/web/{index.html,app.js,styles.css}`
- 新增 `scripts/build-web.ts`：把上述三件套 inline 到 `src/ui/webapp.ts` 的 `WEBAPP_HTML` 常量（保持单文件分发）
- 引入 petite-vue（CDN 字符串内联），列表与抽屉切换为响应式 v-for / v-if
- 抽屉打开/关闭、tab 切换不再触发整表 innerHTML 重写

**测试用例**：
- 启动 ui 时端口冲突自动 fallback（单测：不绑端口仅检测 listen 错误处理路径）
- localStorage 键值约定文档化在 README

**状态**：未开始

## 阶段 2：操作可用性

**目标**：替换原生 confirm/alert，支持批量与变更预览。

**完成标准**：
- 自定义 `<Modal>` / `<Toast>` 组件（petite-vue 实现）
- 列表加复选框，顶部出现 bulk action bar：批量启用 / 批量禁用 / 批量加入 unified.select
- 后端新增 `POST /api/v1/{skills,agents,mcp}/preview`：复用 `dryRun:true`，返回将变更的文件路径与摘要（无副作用）
- 抽屉禁用按钮先触发 preview，弹出「预计变更」模态，确认后才真正写入
- 操作失败错误信息以 Toast 长显示并可复制
- MCP 改 `~/.claude.json` 的双重 confirm 改为单一带详细差异的 Modal

**测试用例**：
- preview API 不写盘 + 返回 paths
- 批量操作并发限制（每次最多 5）

**状态**：未开始

## 阶段 3：配置编辑器联动

**目标**：unified.select 不再要求手敲 `tool:id`。

**完成标准**：
- skills/agents/mcp 列表行加「加入统一管理」复选框，状态来自 `unified.select.<kind>`
- 勾选 ⇄ 配置编辑器自动同步（前端状态机）
- extra*Roots 改为可拖拽列表 + 添加按钮 + 路径校验（文件存在性来自后端 GET /api/v1/fs/exists）
- form ⇄ json 双向同步保留，并在 JSON 视图加 schema 错误高亮

**测试用例**：
- 勾选/取消 unified.select 后保存的 yaml 与列表勾选状态一致
- 路径校验对不存在路径给出 warn 但不阻塞保存

**状态**：未开始

## 阶段 4：增强与质量

**目标**：实时刷新与冒烟测试兜底。

**完成标准**：
- `GET /api/v1/events` SSE 推送：`fs.watch` 监听 archive 目录、各 mcp.json、用户/项目 skills/agents 根，节流 200ms 通知前端 reload
- doctor 结果以顶部 banner 显示（warn/error 才出现）
- Playwright E2E：启动 ui server，覆盖 skills/agents/mcp 各一个 enable→disable→enable 流程（mock 用例文件）
- README 与 README.zh-CN 全面更新 UI 章节

**测试用例**：
- SSE: 触发归档后 1s 内收到 event
- E2E: 三类资源冒烟绿灯

**状态**：未开始

## 节奏

每完成一个阶段：跑 `pnpm test`、`pnpm build`、手动 `pnpm run skills-manager -- ui` 验证，再开下一阶段。出现阻碍按 CLAUDE.md 三次尝试规则记录后转向。
