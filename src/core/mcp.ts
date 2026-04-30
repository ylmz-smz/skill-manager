import type { McpServerRecord, McpToolId } from "../types.js";
import { discoverCursorMcp } from "../adapters/mcp-cursor.js";
import { discoverClaudeMcp } from "../adapters/mcp-claude.js";

export function sortMcpServers(records: McpServerRecord[]): McpServerRecord[] {
  return [...records].sort((a, b) => {
    const t = a.tool.localeCompare(b.tool);
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
}

export async function listMcpServers(opts: {
  homedir: string;
  projectDir?: string;
  tool: McpToolId | "all";
}): Promise<McpServerRecord[]> {
  const { homedir, projectDir, tool } = opts;
  const out: McpServerRecord[] = [];
  if (tool === "all" || tool === "cursor") {
    out.push(...(await discoverCursorMcp(homedir, projectDir)));
  }
  if (tool === "all" || tool === "claude-code") {
    out.push(...(await discoverClaudeMcp(homedir, projectDir)));
  }
  return out;
}

