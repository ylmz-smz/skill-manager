import type { SkillRecord, SourceKind, ToolId } from "./types.js";

const TOOL_ORDER: ToolId[] = ["claude-code", "cursor", "agents"];

const TOOL_TITLE: Record<ToolId, string> = {
  "claude-code": "Claude Code",
  cursor: "Cursor",
  agents: "Agents（~/.agents/skills）",
};

const SOURCE_LABEL: Record<SourceKind, string> = {
  "user-global": "用户目录",
  project: "项目",
  plugin: "插件",
  "cursor-builtin": "内置（IDE）",
};

export function shortenPath(absPath: string, homedir: string): string {
  const h = homedir.replace(/\\/g, "/");
  const p = absPath.replace(/\\/g, "/");
  if (p === h || p.startsWith(`${h}/`)) {
    return `~${p.slice(h.length)}`;
  }
  return absPath;
}

export function sourceKindLabel(k: SourceKind): string {
  return SOURCE_LABEL[k];
}

export function toolTitle(tool: ToolId): string {
  return TOOL_TITLE[tool];
}

function truncate(s: string, max: number): string {
  const t = s.replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Plain-text grouped list for terminals. */
export function formatSkillListText(
  rows: SkillRecord[],
  homedir: string,
  termWidth = 96,
): string {
  const width = Math.max(60, Math.min(termWidth, 120));
  const line = (ch: string) => ch.repeat(Math.min(width, 72));
  const byTool = new Map<ToolId, SkillRecord[]>();
  for (const t of TOOL_ORDER) byTool.set(t, []);
  for (const r of rows) {
    const arr = byTool.get(r.tool);
    if (arr) arr.push(r);
  }

  const out: string[] = [];
  out.push(line("─"));
  out.push(` 共 ${rows.length} 条技能 · 启用 ${rows.filter((r) => r.enabled).length} · 停用 ${rows.filter((r) => !r.enabled).length}`);
  out.push(line("─"));

  for (const tool of TOOL_ORDER) {
    const group = byTool.get(tool)!;
    if (group.length === 0) continue;
    out.push("");
    out.push(`▸ ${TOOL_TITLE[tool]}  (${group.length})`);
    out.push(line("·"));

    for (const r of group) {
      const status = r.enabled ? "● 启用" : "○ 停用";
      const sem =
        r.enabledSemantic === "native" ? "配置/元数据" : "归档托管";
      const src = SOURCE_LABEL[r.sourceKind];
      out.push(`  ${status}   来源:${src}   (${sem})`);
      out.push(`    标识  ${r.id}`);
      if (r.description) {
        out.push(`    说明  ${truncate(r.description, width - 8)}`);
      }
      out.push(`    路径  ${shortenPath(r.path, homedir)}`);
      if (r.pluginKey) {
        out.push(`    插件键 enabledPlugins  ${r.pluginKey}`);
      }
      if (r.invocation?.disableModelInvocation) {
        out.push(`    元数据  disable-model-invocation: true`);
      }
      if (r.notes) {
        out.push(`    提示  ${truncate(r.notes, width - 8)}`);
      }
      out.push("");
    }
  }

  out.push(line("─"));
  out.push(" 脚本/自动化请使用:  skills-manager list --json");
  out.push(" 交互式开关:          skills-manager list --interactive");
  out.push(line("─"));
  return `${out.join("\n")}\n`;
}
