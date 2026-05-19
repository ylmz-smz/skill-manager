import type {
  McpServerRecord,
  SkillRecord,
  SubagentRecord,
} from "../types.js";
import type {
  McpServerResource,
  Resource,
  SkillResource,
  SubagentResource,
} from "./types.js";

/**
 * Bidirectional bridge between v0.3 *Record types and v0.4 *Resource types.
 *
 * Lossless: the only structural difference is the discriminator field
 * `kind`. These helpers exist so old call-sites can incrementally migrate
 * to the new Port-based pipeline without big-bang rewrites.
 */

export function toSkillResource(r: SkillRecord): SkillResource {
  return { kind: "skill", ...r };
}

export function fromSkillResource(r: SkillResource): SkillRecord {
  const { kind: _kind, ...rest } = r;
  return rest;
}

export function toSubagentResource(r: SubagentRecord): SubagentResource {
  return { kind: "subagent", ...r };
}

export function fromSubagentResource(r: SubagentResource): SubagentRecord {
  const { kind: _kind, ...rest } = r;
  return rest;
}

export function toMcpServerResource(r: McpServerRecord): McpServerResource {
  return { kind: "mcp_server", ...r };
}

export function fromMcpServerResource(
  r: McpServerResource,
): McpServerRecord {
  const { kind: _kind, ...rest } = r;
  return rest;
}

/** Type-safe split of a Resource union into its specific record type. */
export function fromResource(r: Resource): SkillRecord | SubagentRecord | McpServerRecord {
  switch (r.kind) {
    case "skill":
      return fromSkillResource(r);
    case "subagent":
      return fromSubagentResource(r);
    case "mcp_server":
      return fromMcpServerResource(r);
  }
}
