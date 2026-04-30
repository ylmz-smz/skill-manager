import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ToolId } from "../types.js";
import { statePath } from "../utils/paths.js";

export const STATE_VERSION = 3 as const;

export type ResourceKind = "skill" | "subagent";

export interface ArchivedEntry {
  tool: ToolId;
  id: string;
  originalPath: string;
  archivePath: string;
  archivedAt: string;
  resourceKind: ResourceKind;
}

export interface StateFile {
  version: typeof STATE_VERSION;
  archived: ArchivedEntry[];
  mcpArchived: McpArchivedEntry[];
}

export function emptyState(): StateFile {
  return { version: STATE_VERSION, archived: [], mcpArchived: [] };
}

type StateV1 = {
  version: 1;
  archived: Array<{
    tool: ToolId;
    id: string;
    originalPath: string;
    archivePath: string;
    archivedAt: string;
  }>;
};

type StateV2 = {
  version: 2;
  archived: ArchivedEntry[];
};

export interface McpArchivedEntry {
  tool: ToolId;
  id: string;
  /** Config file that was edited (e.g. ~/.cursor/mcp.json, <project>/.mcp.json, ~/.claude.json) */
  configPath: string;
  sourceKind: "user-global" | "project";
  archivedAt: string;
  /** Raw server object under mcpServers[id] */
  server: unknown;
}

export async function loadState(homedir: string): Promise<StateFile> {
  const p = statePath(homedir);
  try {
    const raw = await readFile(p, "utf8");
    const j = JSON.parse(raw) as unknown;
    if (!j || typeof j !== "object") return emptyState();

    const version = (j as { version?: unknown }).version;
    const archived = (j as { archived?: unknown }).archived;
    if (!Array.isArray(archived)) return emptyState();

    if (version === 1) {
      const v1 = j as StateV1;
      return {
        version: STATE_VERSION,
        archived: v1.archived.map((a) => ({
          ...a,
          resourceKind: "skill",
        })),
        mcpArchived: [],
      };
    }

    if (version === 2) {
      const v2 = j as StateV2;
      const normalizedArchived: ArchivedEntry[] = [];
      for (const a of v2.archived ?? []) {
        if (!a || typeof a !== "object") continue;
        if (
          typeof a.tool !== "string" ||
          typeof a.id !== "string" ||
          typeof a.originalPath !== "string" ||
          typeof a.archivePath !== "string" ||
          typeof a.archivedAt !== "string"
        ) {
          continue;
        }
        const rk = (a as { resourceKind?: unknown }).resourceKind;
        normalizedArchived.push({
          tool: a.tool as ToolId,
          id: a.id,
          originalPath: a.originalPath,
          archivePath: a.archivePath,
          archivedAt: a.archivedAt,
          resourceKind: rk === "subagent" ? "subagent" : "skill",
        });
      }
      return { version: STATE_VERSION, archived: normalizedArchived, mcpArchived: [] };
    }

    if (version !== STATE_VERSION) return emptyState();

    const v3 = j as StateFile;
    const normalized: ArchivedEntry[] = [];
    for (const a of v3.archived) {
      if (!a || typeof a !== "object") continue;
      if (
        typeof a.tool !== "string" ||
        typeof a.id !== "string" ||
        typeof a.originalPath !== "string" ||
        typeof a.archivePath !== "string" ||
        typeof a.archivedAt !== "string"
      ) {
        continue;
      }
      const rk = (a as { resourceKind?: unknown }).resourceKind;
      normalized.push({
        tool: a.tool as ToolId,
        id: a.id,
        originalPath: a.originalPath,
        archivePath: a.archivePath,
        archivedAt: a.archivedAt,
        resourceKind: rk === "subagent" ? "subagent" : "skill",
      });
    }
    const mcpArchivedRaw = (v3 as { mcpArchived?: unknown }).mcpArchived;
    const mcpArchived: McpArchivedEntry[] = [];
    if (Array.isArray(mcpArchivedRaw)) {
      for (const e of mcpArchivedRaw) {
        if (!e || typeof e !== "object") continue;
        const tool = (e as { tool?: unknown }).tool;
        const id = (e as { id?: unknown }).id;
        const configPath = (e as { configPath?: unknown }).configPath;
        const sourceKind = (e as { sourceKind?: unknown }).sourceKind;
        const archivedAt = (e as { archivedAt?: unknown }).archivedAt;
        const server = (e as { server?: unknown }).server;
        if (
          typeof tool !== "string" ||
          typeof id !== "string" ||
          typeof configPath !== "string" ||
          (sourceKind !== "user-global" && sourceKind !== "project") ||
          typeof archivedAt !== "string"
        ) {
          continue;
        }
        mcpArchived.push({
          tool: tool as ToolId,
          id,
          configPath,
          sourceKind,
          archivedAt,
          server,
        });
      }
    }
    return { version: STATE_VERSION, archived: normalized, mcpArchived };
  } catch {
    return emptyState();
  }
}

export async function saveState(
  homedir: string,
  state: StateFile,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return;
  const p = statePath(homedir);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, `${JSON.stringify({ ...state, version: STATE_VERSION }, null, 2)}\n`, "utf8");
}

export function findArchivedById(
  state: StateFile,
  tool: ToolId,
  id: string,
  resourceKind: ResourceKind = "skill",
): ArchivedEntry | undefined {
  return state.archived.find(
    (a) => a.tool === tool && a.id === id && a.resourceKind === resourceKind,
  );
}

export function upsertArchived(
  state: StateFile,
  entry: ArchivedEntry,
): StateFile {
  const rest = state.archived.filter(
    (a) =>
      !(
        a.tool === entry.tool &&
        a.id === entry.id &&
        a.resourceKind === entry.resourceKind
      ),
  );
  return { ...state, archived: [...rest, entry] };
}

export function removeArchived(
  state: StateFile,
  tool: ToolId,
  id: string,
  resourceKind: ResourceKind = "skill",
): StateFile {
  return {
    ...state,
    archived: state.archived.filter(
      (a) =>
        !(
          a.tool === tool &&
          a.id === id &&
          a.resourceKind === resourceKind
        ),
    ),
  };
}

export function findMcpArchivedById(
  state: StateFile,
  tool: ToolId,
  id: string,
  configPath?: string,
): McpArchivedEntry | undefined {
  return state.mcpArchived.find(
    (e) =>
      e.tool === tool &&
      e.id === id &&
      (configPath ? e.configPath === configPath : true),
  );
}

export function upsertMcpArchived(
  state: StateFile,
  entry: McpArchivedEntry,
): StateFile {
  const rest = state.mcpArchived.filter(
    (e) =>
      !(
        e.tool === entry.tool &&
        e.id === entry.id &&
        e.configPath === entry.configPath
      ),
  );
  return { ...state, mcpArchived: [...rest, entry] };
}

export function removeMcpArchived(
  state: StateFile,
  tool: ToolId,
  id: string,
  configPath: string,
): StateFile {
  return {
    ...state,
    mcpArchived: state.mcpArchived.filter(
      (e) => !(e.tool === tool && e.id === id && e.configPath === configPath),
    ),
  };
}

export async function atomicMove(
  from: string,
  to: string,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return;
  await mkdir(dirname(to), { recursive: true });
  await rename(from, to);
}
