import { join } from "node:path";
import type { McpServerRecord } from "../types.js";
import { createMcpAdapter, type McpAdapter } from "../discovery/mcp-factory.js";

export const cursorMcpAdapter: McpAdapter = createMcpAdapter({
  tool: "cursor",
  userPath: (h) => join(h, ".cursor", "mcp.json"),
  projectPath: (p) => join(p, ".cursor", "mcp.json"),
});

/** @deprecated Use `cursorMcpAdapter.discover(...)` instead. */
export async function discoverCursorMcp(
  homedir: string,
  projectDir?: string,
): Promise<McpServerRecord[]> {
  return cursorMcpAdapter.discover(homedir, projectDir);
}
