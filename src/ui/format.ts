import type { SkillRecord, SourceKind, ToolId } from "../types.js";
import type { SubagentRecord, SubagentToolId } from "../types.js";
import type { McpServerRecord, McpToolId } from "../types.js";

const TOOL_ORDER: ToolId[] = [
  "claude-code",
  "cursor",
  "vscode",
  "codebuddy",
  "agents",
  "codex",
];

const TOOL_TITLE: Record<ToolId, string> = {
  "claude-code": "Claude Code",
  cursor: "Cursor",
  vscode: "VSCode（GitHub Copilot）",
  codebuddy: "CodeBuddy（腾讯）",
  agents: "Agents（~/.agents/skills）",
  codex: "Codex",
};

const SOURCE_LABEL: Record<SourceKind, string> = {
  "user-global": "用户目录",
  project: "项目",
  plugin: "插件",
  "cursor-builtin": "内置（IDE）",
};

export const LIST_TABLE_HEADERS = [
  "[ ]",
  "skill-name",
  "skill-desc",
  "skill-path",
  "skill-status",
] as const;

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

const SUBAGENT_TOOL_ORDER: SubagentToolId[] = ["cursor", "claude-code", "codex"];

const SUBAGENT_TOOL_TITLE: Record<SubagentToolId, string> = {
  cursor: "Cursor",
  "claude-code": "Claude Code",
  codex: "Codex（.codex/agents）",
};

export const SUBAGENT_LIST_TABLE_HEADERS = [
  "[ ]",
  "agent-name",
  "agent-desc",
  "agent-path",
  "agent-status",
] as const;

export function subagentToolTitle(tool: SubagentToolId): string {
  return SUBAGENT_TOOL_TITLE[tool];
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

export function formatTableDataRow(cells: string[], widths: number[]): string {
  const parts = cells.map((cell, i) => ` ${padCell(cell, widths[i]!)} `);
  return `│${parts.join("│")}│`;
}

function checkCell(enabled: boolean): string {
  return enabled ? "[x]" : "[ ]";
}

/** 与 formatSkillListTable 使用相同列宽算法。 */
export function computeListTableWidths(termWidth: number): number[] {
  const innerBudget = Math.max(64, Math.min(termWidth, 128) - 2);
  const checkW = 5;
  const statusW = 12;
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
  return [checkW, nameW, descW, pathW, statusW];
}

function skillToCells(
  r: SkillRecord,
  homedir: string,
  descW: number,
): string[] {
  const name = r.id;
  let desc = r.description?.trim() || "—";
  if (r.pluginKey) {
    desc = truncate(`${desc} · ${r.pluginKey}`, descW);
  } else {
    desc = truncate(desc, descW);
  }
  const path = shortenPath(r.path, homedir);
  const status = r.enabled ? "enabled" : "disabled";
  return [checkCell(r.enabled), name, desc, path, status];
}

function subagentToCells(
  r: SubagentRecord,
  homedir: string,
  descW: number,
): string[] {
  const name = r.id;
  const desc = truncate(r.description?.trim() || "—", descW);
  const path = shortenPath(r.path, homedir);
  const status = r.enabled ? "enabled" : "disabled";
  return [checkCell(r.enabled), name, desc, path, status];
}

/** 单行技能表格线（与总表列对齐）。 */
export function formatSkillTableRow(
  r: SkillRecord,
  homedir: string,
  widths: number[],
): string {
  const descW = widths[2]!;
  return formatTableDataRow(skillToCells(r, homedir, descW), widths);
}

export function formatSubagentTableRow(
  r: SubagentRecord,
  homedir: string,
  widths: number[],
): string {
  const descW = widths[2]!;
  return formatTableDataRow(subagentToCells(r, homedir, descW), widths);
}

export function formatSubagentListTable(
  rows: SubagentRecord[],
  homedir: string,
  termWidth: number,
): string {
  const widths = computeListTableWidths(termWidth);
  const header = formatTableDataRow([...SUBAGENT_LIST_TABLE_HEADERS], widths);
  const top = borderLine(widths, "┌┬┐");
  const mid = borderLine(widths, "├┼┤");
  const bot = borderLine(widths, "└┴┘");

  const byTool = new Map<SubagentToolId, SubagentRecord[]>();
  for (const t of SUBAGENT_TOOL_ORDER) byTool.set(t, []);
  for (const r of rows) {
    const arr = byTool.get(r.tool) ?? [];
    arr.push(r);
    byTool.set(r.tool, arr);
  }

  const out: string[] = [];
  for (const t of SUBAGENT_TOOL_ORDER) {
    const items = byTool.get(t) ?? [];
    if (items.length === 0) continue;
    out.push(`${subagentToolTitle(t)} (${items.length})`);
    out.push(top);
    out.push(header);
    out.push(mid);
    for (const r of items) out.push(formatSubagentTableRow(r, homedir, widths));
    out.push(bot);
    out.push("");
  }
  return `${out.join("\n")}\n`;
}

// ---- MCP tables ----

const MCP_TOOL_ORDER: McpToolId[] = ["cursor", "claude-code"];
const MCP_TOOL_TITLE: Record<McpToolId, string> = {
  cursor: "Cursor",
  "claude-code": "Claude Code",
};

export const MCP_LIST_TABLE_HEADERS = [
  "id",
  "transport",
  "command/url",
  "config-path",
  "env-keys",
] as const;

function mcpToolTitle(t: McpToolId): string {
  return MCP_TOOL_TITLE[t];
}

function computeMcpTableWidths(termWidth: number): number[] {
  const innerBudget = Math.max(72, Math.min(termWidth, 160) - 2);
  const idW = Math.max(10, Math.min(28, Math.floor(innerBudget * 0.18)));
  const transportW = 10;
  const cmdW = Math.max(18, Math.min(52, Math.floor(innerBudget * 0.34)));
  const pathW = Math.max(18, Math.min(52, Math.floor(innerBudget * 0.28)));
  const envW = Math.max(10, innerBudget - idW - transportW - cmdW - pathW - 12);
  return [idW, transportW, cmdW, pathW, envW];
}

function mcpToCells(r: McpServerRecord, homedir: string, envW: number): string[] {
  const cmdOrUrl =
    r.transport === "http"
      ? r.url ?? "—"
      : r.command
        ? [r.command, ...(r.args ?? [])].join(" ")
        : "—";
  const env = r.envKeys.length ? r.envKeys.join(", ") : "—";
  return [
    r.id,
    r.transport,
    cmdOrUrl,
    shortenPath(r.path, homedir),
    truncate(env, envW),
  ];
}

export function formatMcpListTable(
  rows: McpServerRecord[],
  homedir: string,
  termWidth: number,
): string {
  const widths = computeMcpTableWidths(termWidth);
  const header = formatTableDataRow([...MCP_LIST_TABLE_HEADERS], widths);
  const top = borderLine(widths, "┌┬┐");
  const mid = borderLine(widths, "├┼┤");
  const bot = borderLine(widths, "└┴┘");

  const byTool = new Map<McpToolId, McpServerRecord[]>();
  for (const t of MCP_TOOL_ORDER) byTool.set(t, []);
  for (const r of rows) {
    const arr = byTool.get(r.tool) ?? [];
    arr.push(r);
    byTool.set(r.tool, arr);
  }

  const out: string[] = [];
  for (const t of MCP_TOOL_ORDER) {
    const items = byTool.get(t) ?? [];
    if (items.length === 0) continue;
    out.push(`${mcpToolTitle(t)} (${items.length})`);
    out.push(top);
    out.push(header);
    out.push(mid);
    const envW = widths[4]!;
    for (const r of items) {
      out.push(formatTableDataRow(mcpToCells(r, homedir, envW), widths));
    }
    out.push(bot);
    out.push("");
  }

  return `${out.join("\n")}\n`;
}

/** 交互选择前打印的表头区（顶框 + 表头 + 中缝）。 */
export function formatInteractiveTablePreamble(widths: number[]): string {
  return [
    "",
    "──────── 请选择一行（列与上方总表一致）────────",
    borderLine(widths, "┌┬┐"),
    formatTableDataRow([...LIST_TABLE_HEADERS], widths),
    borderLine(widths, "├┼┤"),
  ].join("\n");
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
  const widths = computeListTableWidths(termWidth);
  const headers = [...LIST_TABLE_HEADERS];

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
    out.push(formatTableDataRow(headers, widths));
    out.push(borderLine(widths, "├┼┤"));

    const descW = widths[2]!;
    for (const r of group) {
      out.push(formatTableDataRow(skillToCells(r, homedir, descW), widths));
    }

    out.push(borderLine(widths, "└┴┘"));
    const hasExtra = group.some(
      (r) => r.notes || r.invocation?.disableModelInvocation,
    );
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
