import { mkdir, stat } from "node:fs/promises";
import { dirname } from "node:path";
import { archiveDirForKind } from "../utils/paths.js";
import type { SubagentRecord, SubagentToolId } from "../types.js";
import {
  atomicMove,
  findArchivedById,
  loadState,
  removeArchived,
  saveState,
  upsertArchived,
  type ArchivedEntry,
} from "./state.js";

export function pickSubagentRecord(
  records: SubagentRecord[],
  tool: SubagentToolId,
  id: string,
  pathFilter?: string,
): SubagentRecord {
  let m = records.filter((r) => r.tool === tool && r.id === id);
  if (pathFilter) {
    const norm = pathFilter.replace(/\\/g, "/");
    m = m.filter((r) => r.path.replace(/\\/g, "/") === norm);
  }
  if (m.length === 1) return m[0]!;
  if (m.length === 0) {
    throw new Error(
      `No subagent with id '${id}' for tool '${tool}'. Run: skills-manager agents --tool ${tool}`,
    );
  }
  throw new Error(
    `Ambiguous id '${id}'. Pass --path with the exact markdown file. Candidates:\n${m
      .map((r) => `  ${r.path}`)
      .join("\n")}`,
  );
}

export async function disableSubagent(opts: {
  homedir: string;
  record: SubagentRecord;
  dryRun: boolean;
}): Promise<void> {
  const { homedir, record, dryRun } = opts;
  const tool = record.tool;

  const state = await loadState(homedir);
  if (findArchivedById(state, tool, record.id, "subagent")) return;

  const st = await stat(record.path).catch(() => null);
  if (!st) return;

  const dest = archiveDirForKind(homedir, "subagents", tool, record.id);
  await mkdir(dirname(dest), { recursive: true });
  if (!dryRun) {
    try {
      await stat(dest);
      throw new Error(`Archive path already exists: ${dest}`);
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && e.code === "ENOENT") {
        /* ok */
      } else throw e;
    }
  }

  const entry: ArchivedEntry = {
    tool,
    id: record.id,
    originalPath: record.path,
    archivePath: dest,
    archivedAt: new Date().toISOString(),
    resourceKind: "subagent",
  };
  await atomicMove(record.path, dest, dryRun);
  await saveState(homedir, upsertArchived(state, entry), dryRun);
}

export async function enableSubagent(opts: {
  homedir: string;
  record: SubagentRecord;
  dryRun: boolean;
}): Promise<void> {
  const { homedir, record, dryRun } = opts;
  const tool = record.tool;

  const state = await loadState(homedir);
  const archived = findArchivedById(state, tool, record.id, "subagent");
  if (!archived) return;

  if (!dryRun) {
    await mkdir(dirname(archived.originalPath), { recursive: true });
    try {
      await stat(archived.originalPath);
      throw new Error(
        `Restore target already exists: ${archived.originalPath}. Remove it or fix state (skills-manager doctor).`,
      );
    } catch (e: unknown) {
      if (e && typeof e === "object" && "code" in e && e.code === "ENOENT") {
        /* ok */
      } else throw e;
    }
  }

  await atomicMove(archived.archivePath, archived.originalPath, dryRun);
  await saveState(homedir, removeArchived(state, tool, record.id, "subagent"), dryRun);
}

