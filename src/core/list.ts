import type { SkillRecord, ToolId } from "../types.js";
import type { StateFile, ArchivedEntry } from "./state.js";
import { discoverClaudeSkills } from "../adapters/claude.js";
import { discoverCursorSkills } from "../adapters/cursor.js";
import { discoverVscodeSkills } from "../adapters/vscode.js";
import { discoverCodebuddySkills } from "../adapters/codebuddy.js";
import { discoverAgentsSkills } from "../adapters/agents.js";

function archivedToRecords(entry: ArchivedEntry): SkillRecord {
  return {
    tool: entry.tool,
    id: entry.id,
    displayName: entry.id,
    description: "Archived by skills-manager (managed disable).",
    sourceKind: "user-global",
    path: entry.archivePath,
    enabled: false,
    enabledSemantic: "managed",
    skillKind: "markdown",
    notes: `Original path: ${entry.originalPath}`,
  };
}

/** Exported for tests — merges disk scan with archived-only entries from state. */
export function mergeDiskAndArchived(
  disk: SkillRecord[],
  state: StateFile,
  tools: Set<ToolId>,
): SkillRecord[] {
  const archived = state.archived.filter(
    (a) => a.resourceKind === "skill" && tools.has(a.tool),
  );
  const byKey = new Map<string, SkillRecord>();
  for (const a of archived) {
    const r = archivedToRecords(a);
    byKey.set(`${r.tool}:${r.id}`, r);
  }
  for (const r of disk) {
    byKey.set(`${r.tool}:${r.id}`, r);
  }
  return [...byKey.values()];
}

export async function listSkills(opts: {
  homedir: string;
  projectDir?: string;
  tool: ToolId | "all";
  state: StateFile;
}): Promise<SkillRecord[]> {
  const { homedir, projectDir, tool, state } = opts;
  const ALL_TOOLS: ToolId[] = ["claude-code", "cursor", "vscode", "codebuddy", "agents", "codex"];
  const tools =
    tool === "all"
      ? new Set<ToolId>(ALL_TOOLS)
      : new Set<ToolId>([tool]);

  const disk: SkillRecord[] = [];
  if (tools.has("claude-code")) {
    disk.push(...(await discoverClaudeSkills(homedir, projectDir)));
  }
  if (tools.has("cursor")) {
    disk.push(...(await discoverCursorSkills(homedir, projectDir)));
  }
  if (tools.has("vscode")) {
    disk.push(...(await discoverVscodeSkills(homedir, projectDir)));
  }
  if (tools.has("codebuddy")) {
    disk.push(...(await discoverCodebuddySkills(homedir, projectDir)));
  }
  if (tools.has("agents")) {
    disk.push(...(await discoverAgentsSkills(homedir)));
  }

  if (tool === "all") {
    return mergeDiskAndArchived(disk, state, tools);
  }
  return mergeDiskAndArchived(disk, state, tools);
}

export function sortSkills(records: SkillRecord[]): SkillRecord[] {
  return [...records].sort((a, b) => {
    const t = a.tool.localeCompare(b.tool);
    if (t !== 0) return t;
    return a.id.localeCompare(b.id);
  });
}
