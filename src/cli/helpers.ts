import { basename } from "node:path";
import type { ControlStrategy, McpToolId, SubagentToolId, ToolId } from "../types.js";

export const TOOLS = [
  "claude-code",
  "cursor",
  "vscode",
  "codebuddy",
  "agents",
  "codex",
  "all",
] as const;

export const SUBAGENT_TOOLS = ["cursor", "claude-code", "codex", "all"] as const;

export const MCP_TOOLS = ["cursor", "claude-code", "all"] as const;

export function parseTool(v: string): ToolId | "all" {
  if (v === "all") return "all";
  if (
    v === "claude-code" ||
    v === "cursor" ||
    v === "vscode" ||
    v === "codebuddy" ||
    v === "agents" ||
    v === "codex"
  )
    return v;
  throw new Error(`--tool must be one of: ${TOOLS.join(", ")} (got ${JSON.stringify(v)})`);
}

export function parseStrategy(v: string): ControlStrategy {
  if (v === "auto" || v === "native" || v === "managed" || v === "symlink") return v;
  throw new Error(`--strategy must be auto|native|managed|symlink (got ${JSON.stringify(v)})`);
}

export function parseSubagentTool(v: string): SubagentToolId | "all" {
  if (v === "all") return "all";
  if (v === "cursor" || v === "claude-code" || v === "codex") return v;
  throw new Error(`--tool must be one of: ${SUBAGENT_TOOLS.join(", ")} (got ${JSON.stringify(v)})`);
}

export function parseMcpTool(v: string): McpToolId | "all" {
  if (v === "all") return "all";
  if (v === "cursor" || v === "claude-code") return v;
  throw new Error(`--tool must be one of: ${MCP_TOOLS.join(", ")} (got ${JSON.stringify(v)})`);
}

export function requireForceForDisable(): void {
  if (process.env.SKILLS_MANAGER_YES === "1") return;
  throw new Error("Refusing to disable without --force (or set SKILLS_MANAGER_YES=1 for CI).");
}

/** Args after node / tsx / script path(s), so bare `tsx src/cli.ts` yields []. */
export function userFacingArgv(argv: string[]): string[] {
  const tail = argv.slice(2);
  let i = 0;
  while (i < tail.length) {
    const a = tail[i]!;
    if (a === "--") {
      i++;
      continue;
    }
    if (a.startsWith("-")) break;
    const base = basename(a);
    const looksLikeScript = /\.(m?[jt]s|tsx?|cjs)$/i.test(a) || base === "tsx";
    if (!looksLikeScript) break;
    i++;
  }
  return tail.slice(i);
}

