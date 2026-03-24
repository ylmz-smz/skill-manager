import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { ToolId } from "./types.js";
import { statePath } from "./paths.js";

export const STATE_VERSION = 1 as const;

export interface ArchivedEntry {
  tool: ToolId;
  id: string;
  originalPath: string;
  archivePath: string;
  archivedAt: string;
}

export interface StateFile {
  version: typeof STATE_VERSION;
  archived: ArchivedEntry[];
}

export function emptyState(): StateFile {
  return { version: STATE_VERSION, archived: [] };
}

export async function loadState(homedir: string): Promise<StateFile> {
  const p = statePath(homedir);
  try {
    const raw = await readFile(p, "utf8");
    const j = JSON.parse(raw) as StateFile;
    if (j?.version !== STATE_VERSION || !Array.isArray(j.archived)) {
      return emptyState();
    }
    return j;
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
  await writeFile(p, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function findArchivedById(
  state: StateFile,
  tool: ToolId,
  id: string,
): ArchivedEntry | undefined {
  return state.archived.find((a) => a.tool === tool && a.id === id);
}

export function upsertArchived(
  state: StateFile,
  entry: ArchivedEntry,
): StateFile {
  const rest = state.archived.filter(
    (a) => !(a.tool === entry.tool && a.id === entry.id),
  );
  return { ...state, archived: [...rest, entry] };
}

export function removeArchived(
  state: StateFile,
  tool: ToolId,
  id: string,
): StateFile {
  return {
    ...state,
    archived: state.archived.filter((a) => !(a.tool === tool && a.id === id)),
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
