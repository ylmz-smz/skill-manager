import type { SubagentRecord, SubagentToolId } from "../types.js";
import { discoverSubagents } from "../adapters/subagents.js";
import type { ArchivedEntry, LinkedEntry, StateFile } from "./state.js";

export function sortSubagents(records: SubagentRecord[]): SubagentRecord[] {
  return [...records].sort((a, b) => {
    const t = a.tool.localeCompare(b.tool);
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
}

function archivedToSubagentRecord(entry: ArchivedEntry): SubagentRecord {
  return {
    tool: entry.tool as SubagentToolId,
    id: entry.id,
    displayName: entry.id,
    description: "Archived by skills-manager (managed disable).",
    sourceKind: "user-global",
    path: entry.archivePath,
    enabled: false,
    enabledSemantic: "managed",
    notes: `Original path: ${entry.originalPath}`,
  };
}

function linkedToSubagentRecord(entry: LinkedEntry): SubagentRecord {
  return {
    tool: entry.tool as SubagentToolId,
    id: entry.id,
    displayName: entry.id,
    description: "Managed by skills-manager (symlink toggle).",
    sourceKind: "user-global",
    path: entry.managedPath,
    enabled: false,
    enabledSemantic: "managed",
    notes: `Link path: ${entry.linkPath}`,
  };
}

export function mergeDiskAndArchivedSubagents(
  disk: SubagentRecord[],
  state: StateFile,
  tools: Set<SubagentToolId>,
): SubagentRecord[] {
  const archived = state.archived.filter(
    (a) =>
      a.resourceKind === "subagent" &&
      tools.has(a.tool as SubagentToolId),
  );
  const linked = (state.linked ?? []).filter(
    (e) =>
      e.resourceKind === "subagent" &&
      tools.has(e.tool as SubagentToolId),
  );
  const byKey = new Map<string, SubagentRecord>();
  for (const a of archived) {
    const r = archivedToSubagentRecord(a);
    byKey.set(`${r.tool}:${r.id}`, r);
  }
  for (const e of linked) {
    const r = linkedToSubagentRecord(e);
    byKey.set(`${r.tool}:${r.id}`, r);
  }
  for (const r of disk) {
    byKey.set(`${r.tool}:${r.id}`, r);
  }
  return [...byKey.values()];
}

export async function listSubagents(opts: {
  homedir: string;
  projectDir?: string;
  tool: SubagentToolId | "all";
  state: StateFile;
  extraRoots?: { user?: string[]; project?: string[] };
}): Promise<SubagentRecord[]> {
  const { homedir, projectDir, tool, state, extraRoots } = opts;
  const ALL_TOOLS: SubagentToolId[] = ["cursor", "claude-code", "codex"];
  const tools =
    tool === "all"
      ? new Set<SubagentToolId>(ALL_TOOLS)
      : new Set<SubagentToolId>([tool]);
  const disk = await discoverSubagents(homedir, projectDir, extraRoots);
  const merged = mergeDiskAndArchivedSubagents(disk, state, tools);
  if (tool === "all") return merged;
  return merged.filter((r) => r.tool === tool);
}

