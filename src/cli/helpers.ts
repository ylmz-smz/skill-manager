import { basename } from "node:path";
import { z } from "zod";
import type { ControlStrategy, McpToolId, SubagentToolId, ToolId } from "../types.js";
import {
  McpToolIdOrAllSchema,
  StrategySchema,
  SubagentToolIdOrAllSchema,
  ToolIdOrAllSchema,
} from "../domain/schema.js";

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

function parseWithSchema<T>(
  schema: z.ZodType<T>,
  v: unknown,
  flag: string,
  allowed: readonly string[],
): T {
  const r = schema.safeParse(v);
  if (r.success) return r.data;
  throw new Error(`${flag} must be one of: ${allowed.join(", ")} (got ${JSON.stringify(v)})`);
}

export function parseTool(v: string): ToolId | "all" {
  return parseWithSchema(ToolIdOrAllSchema, v, "--tool", TOOLS);
}

export function parseStrategy(v: string): ControlStrategy {
  return parseWithSchema(
    StrategySchema,
    v,
    "--strategy",
    ["auto", "native", "managed", "symlink"],
  );
}

export function parseSubagentTool(v: string): SubagentToolId | "all" {
  return parseWithSchema(SubagentToolIdOrAllSchema, v, "--tool", SUBAGENT_TOOLS);
}

export function parseMcpTool(v: string): McpToolId | "all" {
  return parseWithSchema(McpToolIdOrAllSchema, v, "--tool", MCP_TOOLS);
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

