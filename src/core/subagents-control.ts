import { lstat, mkdir, stat, symlink, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { archiveDirForKind, slugId } from "../utils/paths.js";
import type { SubagentRecord, SubagentToolId } from "../types.js";
import {
  atomicMove,
  findArchivedById,
  findLinkedById,
  loadState,
  removeArchived,
  removeLinked,
  saveState,
  upsertArchived,
  upsertLinked,
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
  strategy?: "managed" | "symlink";
  unifiedRoot?: string;
}): Promise<void> {
  const { homedir, record, dryRun } = opts;
  const tool = record.tool;
  const strategy = opts.strategy ?? "managed";

  if (strategy === "symlink") {
    const root = opts.unifiedRoot;
    if (!root) throw new Error("unified.roots.agents is required for symlink strategy");
    const state = await loadState(homedir);
    if (findLinkedById(state, tool, record.id, "subagent")) return;

    const managedPath = join(root, tool, `${slugId(record.id)}.md`);
    await mkdir(dirname(managedPath), { recursive: true });

    if (!dryRun) {
      const ls = await lstat(record.path).catch(() => null);
      if (ls && ls.isSymbolicLink()) {
        await unlink(record.path);
      }
    }

    const st = await stat(record.path).catch(() => null);
    if (st) {
      await atomicMove(record.path, managedPath, dryRun);
    } else {
      const managedExists = await stat(managedPath).catch(() => null);
      if (!managedExists) throw new Error(`Cannot manage missing agent path: ${record.path}`);
    }

    if (!dryRun) {
      await saveState(
        homedir,
        upsertLinked(state, {
          tool,
          id: record.id,
          resourceKind: "subagent",
          linkPath: record.path,
          managedPath,
          linkedAt: new Date().toISOString(),
        }),
        false,
      );
    }
    return;
  }

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
  strategy?: "managed" | "symlink";
}): Promise<void> {
  const { homedir, record, dryRun } = opts;
  const tool = record.tool;
  const strategy = opts.strategy ?? "managed";

  const state = await loadState(homedir);
  const linked = findLinkedById(state, tool, record.id, "subagent");
  const archived = findArchivedById(state, tool, record.id, "subagent");
  if (strategy === "symlink") {
    if (!linked) return;
    if (!dryRun) {
      await mkdir(dirname(linked.linkPath), { recursive: true });
      const existing = await lstat(linked.linkPath).catch(() => null);
      if (existing) {
        if (existing.isSymbolicLink()) {
          await unlink(linked.linkPath);
        } else {
          throw new Error(`Link target already exists: ${linked.linkPath}`);
        }
      }
      await symlink(linked.managedPath, linked.linkPath, "file");
      await saveState(homedir, removeLinked(state, tool, record.id, "subagent"), false);
    }
    return;
  }
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

