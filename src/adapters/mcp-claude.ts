import { join } from "node:path";
import type { McpServerRecord } from "../types.js";
import { parseMcpServersFromJson } from "../utils/mcp.js";
import { readTextIfExists } from "../utils/fs.js";

function recordsFromFile(
  toolPath: string,
  sourceKind: "user-global" | "project",
  raw: string,
): McpServerRecord[] {
  const parsed = parseMcpServersFromJson(raw);
  return parsed.map((s) => ({
    tool: "claude-code",
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
    enabledSemantic: "native",
    notes:
      sourceKind === "user-global"
        ? "From ~/.claude.json (contains sensitive auth/state). Read-only."
        : undefined,
  }));
}

/**
 * Claude Code MCP config:
 * - user: ~/.claude.json (mcpServers key)
 * - project: <project>/.mcp.json (mcpServers key)
 * Project overrides when same server id exists.
 */
export async function discoverClaudeMcp(
  homedir: string,
  projectDir?: string,
): Promise<McpServerRecord[]> {
  const byId = new Map<string, McpServerRecord>();

  const userPath = join(homedir, ".claude.json");
  const userRaw = await readTextIfExists(userPath);
  if (userRaw) {
    for (const r of recordsFromFile(userPath, "user-global", userRaw)) {
      byId.set(r.id, r);
    }
  }

  if (projectDir) {
    const projPath = join(projectDir, ".mcp.json");
    const projRaw = await readTextIfExists(projPath);
    if (projRaw) {
      for (const r of recordsFromFile(projPath, "project", projRaw)) {
        byId.set(r.id, r);
      }
    }
  }

  return [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));
}

