import { join } from "node:path";
import type { McpServerRecord, McpToolId } from "../types.js";
import { parseMcpServersFromJson } from "../utils/mcp.js";
import { readTextIfExists } from "../utils/fs.js";

/**
 * Shared factory for MCP server adapters.
 *
 * Cursor and Claude both follow the same pattern:
 *   - User-global JSON file (different paths) declaring `mcpServers`.
 *   - Project-level JSON override.
 *   - Project entries override user entries with the same id.
 * The only differences are the file paths and an optional `notes` hint
 * (Claude flags its sensitive ~/.claude.json).
 */
export interface McpAdapterConfig {
  tool: McpToolId;
  userPath: (homedir: string) => string;
  projectPath: (projectDir: string) => string;
  /** Optional record-level notes derived from the source. */
  notes?: (sourceKind: "user-global" | "project") => string | undefined;
}

export interface McpAdapter {
  tool: McpToolId;
  discover(homedir: string, projectDir?: string): Promise<McpServerRecord[]>;
}

function recordsFromFile(
  tool: McpToolId,
  toolPath: string,
  sourceKind: "user-global" | "project",
  raw: string,
  notesFn?: McpAdapterConfig["notes"],
): McpServerRecord[] {
  const parsed = parseMcpServersFromJson(raw);
  return parsed.map((s) => ({
    tool,
    id: s.id,
    displayName: s.id,
    description: "",
    sourceKind,
    path: toolPath,
    transport: s.transport,
    command: s.command,
    args: s.args,
    url: s.url,
    envKeys: s.envKeys,
    enabled: true,
    enabledSemantic: "native" as const,
    notes: notesFn ? notesFn(sourceKind) : undefined,
  }));
}

export function createMcpAdapter(cfg: McpAdapterConfig): McpAdapter {
  return {
    tool: cfg.tool,
    async discover(homedir, projectDir) {
      const byId = new Map<string, McpServerRecord>();

      const userRaw = await readTextIfExists(cfg.userPath(homedir));
      if (userRaw) {
        for (const r of recordsFromFile(
          cfg.tool,
          cfg.userPath(homedir),
          "user-global",
          userRaw,
          cfg.notes,
        )) {
          byId.set(r.id, r);
        }
      }

      if (projectDir) {
        const projPath = cfg.projectPath(projectDir);
        const projRaw = await readTextIfExists(projPath);
        if (projRaw) {
          for (const r of recordsFromFile(
            cfg.tool,
            projPath,
            "project",
            projRaw,
            cfg.notes,
          )) {
            byId.set(r.id, r);
          }
        }
      }

      return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
    },
  };
}
