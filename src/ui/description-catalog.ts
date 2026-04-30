import type { ToolId } from "../types.js";

export type DescriptionI18n = { zh?: string; en?: string };

type Key = `${ToolId}:${string}`;

const CATALOG: Record<Key, Required<DescriptionI18n>> = {
  // ---- common (agents / claude-code / codebuddy) ----
  "agents:create-adaptable-composable": {
    zh: "生成可复用的 Vue composable：支持 MaybeRef / getter 输入，使用 toValue()/toRef() 规范化，确保 watch/watchEffect 内行为稳定可预测。",
    en: "Create a library-grade Vue composable that accepts maybe-reactive inputs (MaybeRef / MaybeRefOrGetter) so callers can pass a plain value, ref, or getter. Normalize inputs with toValue()/toRef() inside reactive effects (watch/watchEffect) to keep behavior predictable and reactive. Use this skill when user asks for creating adaptable or reusable composables.",
  },
  "claude-code:create-adaptable-composable": {
    zh: "生成可复用的 Vue composable：支持 MaybeRef / getter 输入，使用 toValue()/toRef() 规范化，确保 watch/watchEffect 内行为稳定可预测。",
    en: "Create a library-grade Vue composable that accepts maybe-reactive inputs (MaybeRef / MaybeRefOrGetter) so callers can pass a plain value, ref, or getter. Normalize inputs with toValue()/toRef() inside reactive effects (watch/watchEffect) to keep behavior predictable and reactive. Use this skill when user asks for creating adaptable or reusable composables.",
  },
  "agents:find-skills": {
    zh: "当用户问“怎么做 X / 有没有技能做 Y”时，用它来发现并安装合适的技能或能力扩展。",
    en: "Helps users discover and install agent skills when they ask questions like \"how do I do X\", \"find a skill for X\", \"is there a skill that can...\", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill.",
  },
  "claude-code:find-skills": {
    zh: "当用户问“怎么做 X / 有没有技能做 Y”时，用它来发现并安装合适的技能或能力扩展。",
    en: "Helps users discover and install agent skills when they ask questions like \"how do I do X\", \"find a skill for X\", \"is there a skill that can...\", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill.",
  },
  "codebuddy:find-skills": {
    zh: "当用户问“怎么做 X / 有没有技能做 Y”时，用它来发现并安装合适的技能或能力扩展。",
    en: "Helps users discover and install agent skills when they ask questions like \"how do I do X\", \"find a skill for X\", \"is there a skill that can...\", or express interest in extending capabilities. This skill should be used when the user is looking for functionality that might exist as an installable skill.",
  },
  "agents:frontend-design": {
    zh: "把设计意图落地为高质量前端界面：适合做页面/组件/仪表盘/落地页，强调审美、可用性和生产可用代码。",
    en: "Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.",
  },
  "claude-code:frontend-design": {
    zh: "把设计意图落地为高质量前端界面：适合做页面/组件/仪表盘/落地页，强调审美、可用性和生产可用代码。",
    en: "Create distinctive, production-grade frontend interfaces with high design quality. Use this skill when the user asks to build web components, pages, artifacts, posters, or applications (examples include websites, landing pages, dashboards, React components, HTML/CSS layouts, or when styling/beautifying any web UI). Generates creative, polished code and UI design that avoids generic AI aesthetics.",
  },
  "agents:prompt-optimizer": {
    zh: "对提示词/系统规则做迭代优化：用多维度评分评估并改写，自动识别是 Prompt 还是 Rules，并按场景给出更稳的版本。",
    en: "Iteratively evaluate and optimize task prompts or system rules using a 6-dimension scoring system. Auto-detects whether input is a Prompt or Rule and switches scoring criteria accordingly. Use when the user mentions \"optimize prompt\", \"improve prompt\", \"prompt scoring\", \"refine prompt\", \"优化提示词\", \"改进 prompt\", \"打磨提示词\", \"优化 rules\", \"改进规则\", \"optimize rule\", or wants to improve the quality of any prompt or rule.",
  },
  "agents:skill-creator": {
    zh: "创建/改造技能（skills）：支持从零编写、重构、改进触发描述、以及通过评测/基准测试来验证技能质量。",
    en: "Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.",
  },
  "claude-code:skill-creator": {
    zh: "创建/改造技能（skills）：支持从零编写、重构、改进触发描述、以及通过评测/基准测试来验证技能质量。",
    en: "Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.",
  },
  "codebuddy:skill-creator": {
    zh: "创建/改造技能（skills）：支持从零编写、重构、改进触发描述、以及通过评测/基准测试来验证技能质量。",
    en: "Create new skills, modify and improve existing skills, and measure skill performance. Use when users want to create a skill from scratch, edit, or optimize an existing skill, run evals to test a skill, benchmark skill performance with variance analysis, or optimize a skill's description for better triggering accuracy.",
  },
  "agents:tailwindcss-advanced-layouts": {
    zh: "Tailwind CSS 高级布局技巧：CSS Grid / Flexbox 组合与常见布局模式。",
    en: "Tailwind CSS advanced layout techniques including CSS Grid and Flexbox patterns",
  },
  "claude-code:tailwindcss-advanced-layouts": {
    zh: "Tailwind CSS 高级布局技巧：CSS Grid / Flexbox 组合与常见布局模式。",
    en: "Tailwind CSS advanced layout techniques including CSS Grid and Flexbox patterns",
  },
  "codebuddy:tailwindcss-advanced-layouts": {
    zh: "Tailwind CSS 高级布局技巧：CSS Grid / Flexbox 组合与常见布局模式。",
    en: "Tailwind CSS advanced layout techniques including CSS Grid and Flexbox patterns",
  },
  "agents:ui-animation": {
    zh: "UI 动效与动画指南：过渡/关键帧/缓动/无障碍减弱动画等，适合设计或评审交互动效。",
    en: "Guidelines and examples for UI motion and animation. Use when designing, implementing, or reviewing motion, easing, timing, reduced-motion behaviour, CSS transitions, keyframes, framer-motion, or spring animations.",
  },
  "claude-code:ui-animation": {
    zh: "UI 动效与动画指南：过渡/关键帧/缓动/无障碍减弱动画等，适合设计或评审交互动效。",
    en: "Guidelines and examples for UI motion and animation. Use when designing, implementing, or reviewing motion, easing, timing, reduced-motion behaviour, CSS transitions, keyframes, framer-motion, or spring animations.",
  },
  "codebuddy:ui-animation": {
    zh: "UI 动效与动画指南：过渡/关键帧/缓动/无障碍减弱动画等，适合设计或评审交互动效。",
    en: "Guidelines and examples for UI motion and animation. Use when designing, implementing, or reviewing motion, easing, timing, reduced-motion behaviour, CSS transitions, keyframes, framer-motion, or spring animations.",
  },
  "agents:using-superpowers": {
    zh: "会话启动时使用：建立“先匹配并调用技能”的工作流约束，要求在回复/行动前先调用相关 skill。",
    en: "Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions",
  },
  "claude-code:using-superpowers": {
    zh: "会话启动时使用：建立“先匹配并调用技能”的工作流约束，要求在回复/行动前先调用相关 skill。",
    en: "Use when starting any conversation - establishes how to find and use skills, requiring Skill tool invocation before ANY response including clarifying questions",
  },
  "agents:vercel-react-best-practices": {
    zh: "Vercel 工程团队的 React / Next.js 性能最佳实践：渲染优化、数据获取、bundle 控制等。",
    en: "React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be used when writing, reviewing, or refactoring React/Next.js code to ensure optimal performance patterns. Triggers on tasks involving React components, Next.js pages, data fetching, bundle optimization, or performance improvements.",
  },
  "claude-code:vercel-react-best-practices": {
    zh: "Vercel 工程团队的 React / Next.js 性能最佳实践：渲染优化、数据获取、bundle 控制等。",
    en: "React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be used when writing, reviewing, or refactoring React/Next.js code to ensure optimal performance patterns. Triggers on tasks involving React components, Next.js pages, data fetching, bundle optimization, or performance improvements.",
  },
  "codebuddy:vercel-react-best-practices": {
    zh: "Vercel 工程团队的 React / Next.js 性能最佳实践：渲染优化、数据获取、bundle 控制等。",
    en: "React and Next.js performance optimization guidelines from Vercel Engineering. This skill should be used when writing, reviewing, or refactoring React/Next.js code to ensure optimal performance patterns. Triggers on tasks involving React components, Next.js pages, data fetching, bundle optimization, or performance improvements.",
  },
  "agents:vue-best-practices": {
    zh: "Vue 任务必用：推荐 Vue 3 Composition API + `<script setup>` + TS，覆盖 SSR/Volar/vue-tsc 等。",
    en: "MUST be used for Vue.js tasks. Strongly recommends Composition API with `<script setup>` and TypeScript as the standard approach. Covers Vue 3, SSR, Volar, vue-tsc. Load for any Vue, .vue files, Vue Router, Pinia, or Vite with Vue work. ALWAYS use Composition API unless the project explicitly requires Options API.",
  },
  "claude-code:vue-best-practices": {
    zh: "Vue 任务必用：推荐 Vue 3 Composition API + `<script setup>` + TS，覆盖 SSR/Volar/vue-tsc 等。",
    en: "MUST be used for Vue.js tasks. Strongly recommends Composition API with `<script setup>` and TypeScript as the standard approach. Covers Vue 3, SSR, Volar, vue-tsc. Load for any Vue, .vue files, Vue Router, Pinia, or Vite with Vue work. ALWAYS use Composition API unless the project explicitly requires Options API.",
  },
  "agents:vue-debug-guides": {
    zh: "Vue 3 调试指南：常见运行时错误/警告、异步失败、SSR/hydration 问题的定位与处理。",
    en: "Vue 3 debugging and error handling for runtime errors, warnings, async failures, and SSR/hydration issues. Use when diagnosing or fixing Vue issues.",
  },
  "claude-code:vue-debug-guides": {
    zh: "Vue 3 调试指南：常见运行时错误/警告、异步失败、SSR/hydration 问题的定位与处理。",
    en: "Vue 3 debugging and error handling for runtime errors, warnings, async failures, and SSR/hydration issues. Use when diagnosing or fixing Vue issues.",
  },
  "agents:vue-options-api-best-practices": {
    zh: "Vue 3 Options API 写法与最佳实践：`data()`/`methods`/`this` 语境等（仅给 Options API 方案）。",
    en: "Vue 3 Options API style (data(), methods, this context). Each reference shows Options API solution only.",
  },
  "claude-code:vue-options-api-best-practices": {
    zh: "Vue 3 Options API 写法与最佳实践：`data()`/`methods`/`this` 语境等（仅给 Options API 方案）。",
    en: "Vue 3 Options API style (data(), methods, this context). Each reference shows Options API solution only.",
  },
  "agents:vue-pinia-best-practices": {
    zh: "Pinia 状态管理最佳实践：store 组织、组合式写法、响应式陷阱与模式。",
    en: "Pinia stores, state management patterns, store setup, and reactivity with stores.",
  },
  "claude-code:vue-pinia-best-practices": {
    zh: "Pinia 状态管理最佳实践：store 组织、组合式写法、响应式陷阱与模式。",
    en: "Pinia stores, state management patterns, store setup, and reactivity with stores.",
  },
  "agents:vue-router-best-practices": {
    zh: "Vue Router 4 最佳实践：导航守卫、路由参数、路由与组件生命周期交互等。",
    en: "Vue Router 4 patterns, navigation guards, route params, and route-component lifecycle interactions.",
  },
  "claude-code:vue-router-best-practices": {
    zh: "Vue Router 4 最佳实践：导航守卫、路由参数、路由与组件生命周期交互等。",
    en: "Vue Router 4 patterns, navigation guards, route params, and route-component lifecycle interactions.",
  },
  "agents:web-design-guidelines": {
    zh: "UI/UX 规范审查：对照 Web Interface Guidelines 检查可用性与无障碍，适合做界面审计/评审。",
    en: "Review UI code for Web Interface Guidelines compliance. Use when asked to \"review my UI\", \"check accessibility\", \"audit design\", \"review UX\", or \"check my site against best practices\".",
  },
  "claude-code:web-design-guidelines": {
    zh: "UI/UX 规范审查：对照 Web Interface Guidelines 检查可用性与无障碍，适合做界面审计/评审。",
    en: "Review UI code for Web Interface Guidelines compliance. Use when asked to \"review my UI\", \"check accessibility\", \"audit design\", \"review UX\", or \"check my site against best practices\".",
  },
  "codebuddy:web-design-guidelines": {
    zh: "UI/UX 规范审查：对照 Web Interface Guidelines 检查可用性与无障碍，适合做界面审计/评审。",
    en: "Review UI code for Web Interface Guidelines compliance. Use when asked to \"review my UI\", \"check accessibility\", \"audit design\", \"review UX\", or \"check my site against best practices\".",
  },

  // ---- claude-only ----
  "claude-code:e2e-testing": {
    zh: "Playwright E2E 测试套路：Page Object、配置/CI 集成、产物管理与 flaky 测试治理。",
    en: "Playwright E2E testing patterns, Page Object Model, configuration, CI/CD integration, artifact management, and flaky test strategies.",
  },
  "claude-code:eval-harness": {
    zh: "评测框架：用于构建/运行会话级评估（EDD：评测驱动开发）并量化改动效果。",
    en: "Formal evaluation framework for Claude Code sessions implementing eval-driven development (EDD) principles",
  },
  "claude-code:exa-search": {
    zh: "用 Exa（MCP）做语义搜索：适合联网检索网页/代码/公司信息等深度研究。",
    en: "Neural search via Exa MCP for web, code, and company research. Use when the user needs web search, code examples, company intel, people lookup, or AI-powered deep research with Exa's neural search engine.",
  },
  "claude-code:frontend-patterns": {
    zh: "前端通用模式与最佳实践：React/Next、状态管理、性能优化与 UI 工程化套路。",
    en: "Frontend development patterns for React, Next.js, state management, performance optimization, and UI best practices.",
  },
  "claude-code:ocr": {
    zh: "图片 OCR：用 macOS Vision 的 `ocr` CLI 从截图/照片中提取文本，支持批处理。",
    en: "Extract text from images using the `ocr` CLI tool (macOS Vision framework). Use this skill whenever the user wants to read text from an image, screenshot, photo, scan, or document image. Also use it when the user shares an image path and asks \"what does this say\", \"extract the text\", \"OCR this\", \"read this screenshot\", or needs to batch-process images for text extraction. Triggers on any mention of OCR, text recognition, or reading/extracting text from image files (png, jpg, jpeg, webp).",
  },
  "claude-code:security-review": {
    zh: "安全审查清单：输入校验、鉴权、密钥处理、API 风险等；适合涉及敏感数据或支付/认证功能时使用。",
    en: "Use this skill when adding authentication, handling user input, working with secrets, creating API endpoints, or implementing payment/sensitive features. Provides comprehensive security checklist and patterns.",
  },
  "claude-code:tdd-workflow": {
    zh: "TDD 工作流：新功能/修 bug/重构时按测试驱动推进，强调覆盖率与可回归性。",
    en: "Use this skill when writing new features, fixing bugs, or refactoring code. Enforces test-driven development with 80%+ coverage including unit, integration, and E2E tests.",
  },
  "claude-code:ui-ux-pro-max": {
    zh: "UI/UX 设计智库：提供大量风格/配色/字体/组件栈与审查动作，适合做高质量界面设计与评审。",
    en: "UI/UX design intelligence. 67 styles, 96 palettes, 57 font pairings, 25 charts, 13 stacks (React, Next.js, Vue, Svelte, SwiftUI, React Native, Flutter, Tailwind, shadcn/ui). Actions: plan, build, create, design, implement, review, fix, improve, optimize, enhance, refactor, check UI/UX code. Projects: website, landing page, dashboard, admin panel, e-commerce, SaaS, portfolio, blog, mobile app, .html, .tsx, .vue, .svelte. Elements: button, modal, navbar, sidebar, card, table, form, chart. Styles: glassmorphism, claymorphism, minimalism, brutalism, neumorphism, bento grid, dark mode, responsive, skeuomorphism, flat design. Topics: color palette, accessibility, animation, layout, typography, font pairing, spacing, hover, shadow, gradient. Integrations: shadcn/ui MCP for component search and examples.",
  },
  "claude-code:verification-loop": {
    zh: "验证闭环：在声称“完成/修复/通过”前强制跑验证命令并基于证据收口。",
    en: "A comprehensive verification system for Claude Code sessions.",
  },

  // ---- cursor tool (Cursor Skills) ----
  "cursor:babysit": {
    zh: "保持 PR 可合并：循环处理 review 评论、解决冲突、修 CI，直到 merge-ready。",
    en: "Keep a PR merge-ready by triaging comments, resolving clear conflicts, and fixing CI in a loop.",
  },
  "cursor:create-rule": {
    zh: "创建/维护 Cursor Rules：写 `.cursor/rules/*` 或 `RULE.md`，沉淀项目级约束与规范。",
    en: "Create Cursor rules for persistent AI guidance.",
  },
  "cursor:create-skill": {
    zh: "创建 Cursor Agent Skill：生成 `SKILL.md` 结构、描述触发条件与最佳实践。",
    en: "Guides users through creating effective Agent Skills for Cursor.",
  },
  "cursor:create-subagent": {
    zh: "创建 Subagent：编写 agents 配置与行为规范，把复杂任务拆给专用子代理。",
    en: "Create subagents.",
  },
  "cursor:migrate-to-skills": {
    zh: "迁移到 Skills：把旧规则/提示迁移为标准 skill 结构，便于复用与管理。",
    en: "Migrate to skills.",
  },
  "cursor:shell": {
    zh: "命令行专家：执行终端命令、跑脚本/构建/测试等（更擅长 shell 流程）。",
    en: "Command execution specialist for running bash commands.",
  },
  "cursor:update-cursor-settings": {
    zh: "修改 Cursor/VSCode settings：更新 `settings.json`（主题、格式化、字体、快捷键等）。",
    en: "Modify Cursor/VSCode user settings in settings.json.",
  },
};

export function lookupDescriptionI18n(tool: ToolId, id: string): DescriptionI18n | undefined {
  const key = `${tool}:${id}` as Key;
  const v = CATALOG[key];
  if (!v) return undefined;
  return { zh: v.zh, en: v.en };
}

