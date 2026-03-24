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
  if (max <= 0) return "";
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}

function padCell(s: string, width: number): string {
  const t = truncate(s, width);
  return t.padEnd(width, " ");
}

function borderLine(widths: number[], junction: "┌┬┐" | "├┼┤" | "└┴┘"): string {
  const [a, b, c] = [...junction];
  return (
    a +
    widths.map((w) => "─".repeat(w + 2)).join(b) +
    c
  );
}

function dataRow(cells: string[], widths: number[]): string {
  const parts = cells.map((cell, i) => ` ${padCell(cell, widths[i]!)} `);
  return `│${parts.join("│")}│`;
}

/** Checkbox-style first column: checked = enabled. */
function checkCell(enabled: boolean): string {
  return enabled ? "[x]" : "[ ]";
}

/**
 * Table list: col0 = pseudo-checkbox, then skill-name, skill-desc, skill-path, skill-status (English).
 * Renders one table per tool group (non-empty).
 */
export function formatSkillListTable(
  rows: SkillRecord[],
  homedir: string,
  termWidth = 96,
): string {
  const innerBudget = Math.max(64, Math.min(termWidth, 128) - 2);
  const checkW = 5;
  const statusW = 12; // fits header "skill-status" and values enabled/disabled
  const nameW = Math.max(
    14,
    Math.min(28, Math.floor(innerBudget * 0.2)),
  );
  const pathW = Math.max(
    18,
    Math.min(42, Math.floor(innerBudget * 0.28)),
  );
  const descW = Math.max(
    12,
    innerBudget - checkW - nameW - pathW - statusW - 14,
  );
  const widths = [checkW, nameW, descW, pathW, statusW];

  const headers = [
    "[ ]",
    "skill-name",
    "skill-desc",
    "skill-path",
    "skill-status",
  ];

  const byTool = new Map<ToolId, SkillRecord[]>();
  for (const t of TOOL_ORDER) byTool.set(t, []);
  for (const r of rows) {
    const arr = byTool.get(r.tool);
    if (arr) arr.push(r);
  }

  const out: string[] = [];
  const on = rows.filter((r) => r.enabled).length;
  const off = rows.length - on;
  out.push(
    `共 ${rows.length} 条技能 · 启用 ${on} · 停用 ${off} · 复选列 [x]=启用 [ ]=停用`,
  );
  out.push("");

  for (const tool of TOOL_ORDER) {
    const group = byTool.get(tool)!;
    if (group.length === 0) continue;

    out.push(`── ${TOOL_TITLE[tool]} (${group.length}) ──`);
    out.push(borderLine(widths, "┌┬┐"));
    out.push(dataRow(headers, widths));
    out.push(borderLine(widths, "├┼┤"));

    for (const r of group) {
      const name = r.id;
      let desc = r.description?.trim() || "—";
      if (r.pluginKey) {
        desc = truncate(`${desc} · ${r.pluginKey}`, descW);
      } else {
        desc = truncate(desc, descW);
      }
      const path = shortenPath(r.path, homedir);
      const status = r.enabled ? "enabled" : "disabled";
      out.push(
        dataRow(
          [checkCell(r.enabled), name, desc, path, status],
          widths,
        ),
      );
    }

    out.push(borderLine(widths, "└┴┘"));
    const hasExtra = group.some((r) => r.notes || r.invocation?.disableModelInvocation);
    if (hasExtra) {
      out.push(
        "  （部分行含 notes / disable-model-invocation，请用 list --json 查看完整字段）",
      );
    }
    out.push("");
  }

  out.push("脚本/自动化: skills-manager list --json");
  out.push("交互式开关: skills-manager list --interactive");
  return `${out.join("\n")}\n`;
}
