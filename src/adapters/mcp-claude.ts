import { join } from "node:path";
import type { McpServerRecord } from "../types.js";
import { createMcpAdapter, type McpAdapter } from "../discovery/mcp-factory.js";

export const claudeMcpAdapter: McpAdapter = createMcpAdapter({
  tool: "claude-code",
  userPath: (h) => join(h, ".claude.json"),
  projectPath: (p) => join(p, ".mcp.json"),
  notes: (sourceKind) =>
    sourceKind === "user-global"
      ? "From ~/.claude.json (contains sensitive auth/state). Read-only."
      : undefined,
});

/**
 * Claude Code MCP config:
 * - user: ~/.claude.json (mcpServers key)
 * - project: <project>/.mcp.json (mcpServers key)
 * Project overrides when same server id exists.
 *
 * @deprecated Use `claudeMcpAdapter.discover(...)` instead.
 */
export async function discoverClaudeMcp(
  homedir: string,
  projectDir?: string,
): Promise<McpServerRecord[]> {
  return claudeMcpAdapter.discover(homedir, projectDir);
}
