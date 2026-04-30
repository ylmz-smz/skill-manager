import { lstat, mkdir, stat, symlink, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { archiveDirForKind, slugId } from "../utils/paths.js";
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
import { setDisableModelInvocation } from "./skill-file.js";
import type { ControlStrategy, SkillRecord, ToolId } from "../types.js";

export function pickRecord(
  records: SkillRecord[],
  tool: ToolId,
  id: string,
  pathFilter?: string,
): SkillRecord {
  let m = records.filter((r) => r.tool === tool && r.id === id);
  if (pathFilter) {
    const norm = pathFilter.replace(/\\/g, "/");
    m = m.filter((r) => r.path.replace(/\\/g, "/") === norm);
  }
  if (m.length === 1) return m[0];
  if (m.length === 0) {
    throw new Error(
      `No skill with id '${id}' for tool '${tool}'. Run: skills-manager list --tool ${tool}`,
    );
  }
  throw new Error(
    `Ambiguous id '${id}'. Pass --path with the exact directory. Candidates:\n${m.map((r) => `  ${r.path}`).join("\n")}`,
  );
}

function inferStrategy(
  record: SkillRecord,
  explicit: ControlStrategy,
): "native" | "managed" | "symlink" {
  if (explicit === "native") return "native";
  if (explicit === "managed") return "managed";
  if (explicit === "symlink") return "symlink";
  if (record.skillKind === "cursor-builtin") return "native";
  if (record.skillKind === "markdown") return "native";
  return "managed";
}

async function unlinkIfSymlink(p: string): Promise<void> {
  const st = await lstat(p).catch(() => null);
  if (!st) return;
  if (!st.isSymbolicLink()) return;
  await unlink(p);
}

export async function disableSkill(opts: {
  homedir: string;
  projectDir?: string;
  record: SkillRecord;
  strategy: ControlStrategy;
  dryRun: boolean;
  globalSettings: boolean;
  unifiedRoot?: string;
}): Promise<void> {
  const { homedir, projectDir, record, strategy, dryRun, globalSettings } =
    opts;
  const strat = inferStrategy(record, strategy);

  if (record.skillKind === "cursor-builtin") {
    throw new Error(
      "Cannot disable Cursor built-in skills from CLI. Use Cursor Settings → Rules / Skills.",
    );
  }

  if (strat === "native" && record.skillKind === "markdown") {
    await setDisableModelInvocation(
      join(record.path, "SKILL.md"),
      true,
      dryRun,
    );
    return;
  }

  if (strat === "managed") {
    if (record.tool === "claude-code" && record.sourceKind === "plugin") {
      throw new Error(
        "Refusing managed archive for Claude plugin skills (use native: enabledPlugins or move plugins manually). Use --strategy native.",
      );
    }
    const state = await loadState(homedir);
    if (findArchivedById(state, record.tool, record.id, "skill")) {
      return;
    }
    const dest = archiveDirForKind(homedir, "skills", record.tool, record.id);
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
      tool: record.tool,
      id: record.id,
      originalPath: record.path,
      archivePath: dest,
      archivedAt: new Date().toISOString(),
      resourceKind: "skill",
    };
    await atomicMove(record.path, dest, dryRun);
    await saveState(homedir, upsertArchived(state, entry), dryRun);
    return;
  }

  if (strat === "symlink") {
    const root = opts.unifiedRoot;
    if (!root) {
      throw new Error("unified.roots.skills is required for symlink strategy");
    }
    const state = await loadState(homedir);
    if (findLinkedById(state, record.tool, record.id, "skill")) return;

    const managedPath = join(root, record.tool, slugId(record.id));
    await mkdir(dirname(managedPath), { recursive: true });

    // If it's currently enabled as a symlink, unlink it and keep managed copy.
    if (!dryRun) {
      await unlinkIfSymlink(record.path);
    }

    // If linkPath still exists as a real dir, move it into managedPath.
    const st = await stat(record.path).catch(() => null);
    if (st) {
      await atomicMove(record.path, managedPath, dryRun);
    } else {
      // If it doesn't exist, we still allow recording state if managedPath already exists.
      const managedExists = await stat(managedPath).catch(() => null);
      if (!managedExists) {
        throw new Error(`Cannot manage missing skill path: ${record.path}`);
      }
    }

    if (!dryRun) {
      await saveState(
        homedir,
        upsertLinked(state, {
          tool: record.tool,
          id: record.id,
          resourceKind: "skill",
          linkPath: record.path,
          managedPath,
          linkedAt: new Date().toISOString(),
        }),
        false,
      );
    }
    return;
  }

  throw new Error(`Unsupported native disable for tool ${record.tool}`);
}

export async function enableSkill(opts: {
  homedir: string;
  projectDir?: string;
  record: SkillRecord;
  strategy: ControlStrategy;
  dryRun: boolean;
  globalSettings: boolean;
  unifiedRoot?: string;
}): Promise<void> {
  const { homedir, projectDir, record, strategy, dryRun, globalSettings } =
    opts;
  const state = await loadState(homedir);
  const archived = findArchivedById(state, record.tool, record.id, "skill");
  const linked = findLinkedById(state, record.tool, record.id, "skill");
  const strat = inferStrategy(record, strategy);

  if (archived) {
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
    await saveState(
      homedir,
      removeArchived(state, record.tool, record.id, "skill"),
      dryRun,
    );
    return;
  }

  if (strat === "symlink") {
    if (!linked) {
      throw new Error("No symlink-managed entry found in state. Disable with --strategy symlink first.");
    }
    if (!dryRun) {
      await mkdir(dirname(linked.linkPath), { recursive: true });
      // Refuse to overwrite an existing real path
      const existing = await lstat(linked.linkPath).catch(() => null);
      if (existing) {
        if (existing.isSymbolicLink()) {
          await unlink(linked.linkPath);
        } else {
          throw new Error(`Link target already exists: ${linked.linkPath}`);
        }
      }
      await symlink(linked.managedPath, linked.linkPath, "dir");
      await saveState(homedir, removeLinked(state, record.tool, record.id, "skill"), false);
    }
    return;
  }

  if (record.skillKind === "cursor-builtin") {
    throw new Error(
      "Built-in Cursor skills are not toggled by this CLI. Use Cursor Settings.",
    );
  }

  if (strat === "native" && record.skillKind === "markdown") {
    await setDisableModelInvocation(
      join(record.path, "SKILL.md"),
      false,
      dryRun,
    );
    return;
  }

  if (strat === "managed" && !archived) {
    throw new Error(
      "Skill is not archived by skills-manager; nothing to restore. If disabled via frontmatter or Claude plugins, use enable with --strategy native.",
    );
  }
}

/** False for Cursor built-in entries (must toggle in IDE). */
export function isSkillControllable(record: SkillRecord): boolean {
  return record.skillKind !== "cursor-builtin";
}
