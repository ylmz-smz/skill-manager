import type {
  ResourceKind,
  ResourceOf,
  SourceKind,
  ToolId,
} from "../domain/types.js";

/**
 * v0.4 unified discovery port.
 *
 * Every adapter — Skills, Subagents, MCP — should expose `scan(ctx)`
 * returning the new `Resource` model, so callers can iterate adapters
 * uniformly:
 *
 *   const adapters: DiscoveryPort<any>[] = [...];
 *   const all = (await Promise.all(adapters.map(a => a.scan(ctx)))).flat();
 *
 * This collapses the chains of `if (tools.has("cursor")) ...` that
 * littered list.ts / mcp.ts / subagents.ts in v0.3.
 *
 * NOTE: ScanContext intentionally carries adapter-specific extra roots
 * with explicit names (extraSkillRoots, extraSubagentRoots). A single
 * Record<string, unknown> bag was rejected for being unsearchable.
 */
export interface ScanContext {
  homedir: string;
  projectDir?: string;
  /** Extra roots from config.scan.extraSkillRoots. */
  extraSkillRoots?: Array<{ root: string; sourceKind: SourceKind }>;
  /** Extra roots from config.scan.extraAgentRoots, split by scope. */
  extraSubagentRoots?: { user?: string[]; project?: string[] };
}

export interface DiscoveryPort<K extends ResourceKind> {
  /** Stable tool identifier (e.g. "cursor", "claude-code"). */
  tool: ToolId;
  /** What kind of resource this adapter discovers. */
  kind: K;
  /** Scan the filesystem and return discovered resources. */
  scan(ctx: ScanContext): Promise<ResourceOf<K>[]>;
}
