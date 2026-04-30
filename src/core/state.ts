import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ToolId } from "../types.js";
import { statePath } from "../utils/paths.js";

export const STATE_VERSION = 2 as const;

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
}

export function emptyState(): StateFile {
  return { version: STATE_VERSION, archived: [] };
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
      };
    }

    if (version !== STATE_VERSION) return emptyState();

    const v2 = j as StateFile;
    const normalized: ArchivedEntry[] = [];
    for (const a of v2.archived) {
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
    return { version: STATE_VERSION, archived: normalized };
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

export async function atomicMove(
  from: string,
  to: string,
  dryRun: boolean,
): Promise<void> {
  if (dryRun) return;
  await mkdir(dirname(to), { recursive: true });
  await rename(from, to);
}
