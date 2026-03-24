import { mkdir, stat } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  claudeSettingsDir,
  withEnabledPlugin,
  writeClaudeSettingsFile,
} from "./claude-settings.js";
import { archiveDirFor } from "./paths.js";
import {
  atomicMove,
  findArchivedById,
  loadState,
  removeArchived,
  saveState,
  upsertArchived,
  type ArchivedEntry,
} from "./state.js";
import { setDisableModelInvocation } from "./skill-file.js";
import type { ControlStrategy, SkillRecord, ToolId } from "./types.js";

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
): "native" | "managed" {
  if (explicit === "native") return "native";
  if (explicit === "managed") return "managed";
  if (record.tool === "claude-code" && record.pluginKey) return "native";
  if (record.tool === "claude-code" && record.skillKind === "markdown")
    return "native";
  if (record.skillKind === "cursor-builtin") return "native";
  return "managed";
}

export async function disableSkill(opts: {
  homedir: string;
  projectDir?: string;
  record: SkillRecord;
  strategy: ControlStrategy;
  dryRun: boolean;
  globalSettings: boolean;
}): Promise<void> {
  const { homedir, projectDir, record, strategy, dryRun, globalSettings } =
    opts;
  const strat = inferStrategy(record, strategy);

  if (record.skillKind === "cursor-builtin") {
    throw new Error(
      "Cannot disable Cursor built-in skills from CLI. Use Cursor Settings → Rules / Skills.",
    );
  }

  if (
    strat === "native" &&
    (record.tool === "cursor" || record.tool === "agents") &&
    record.skillKind === "markdown"
  ) {
    await setDisableModelInvocation(
      join(record.path, "SKILL.md"),
      true,
      dryRun,
    );
    return;
  }

  if (strat === "native" && record.tool === "claude-code") {
    if (record.pluginKey) {
      const scope = globalSettings || !projectDir ? "user" : "project";
      const dir = claudeSettingsDir(homedir, scope, projectDir);
      const path = join(dir, "settings.local.json");
      await writeClaudeSettingsFile(
        path,
        (prev) => withEnabledPlugin(prev, record.pluginKey!, false),
        dryRun,
      );
      return;
    }
    const skillMd = join(record.path, "SKILL.md");
    await setDisableModelInvocation(skillMd, true, dryRun);
    return;
  }

  if (strat === "managed") {
    if (record.tool === "claude-code" && record.sourceKind === "plugin") {
      throw new Error(
        "Refusing managed archive for Claude plugin skills (use native: enabledPlugins or move plugins manually). Use --strategy native.",
      );
    }
    const state = await loadState(homedir);
    if (findArchivedById(state, record.tool, record.id)) {
      return;
    }
    const dest = archiveDirFor(homedir, record.tool, record.id);
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
    };
    await atomicMove(record.path, dest, dryRun);
    await saveState(homedir, upsertArchived(state, entry), dryRun);
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
}): Promise<void> {
  const { homedir, projectDir, record, strategy, dryRun, globalSettings } =
    opts;
  const state = await loadState(homedir);
  const archived = findArchivedById(state, record.tool, record.id);
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
      removeArchived(state, record.tool, record.id),
      dryRun,
    );
    return;
  }

  if (record.skillKind === "cursor-builtin") {
    throw new Error(
      "Built-in Cursor skills are not toggled by this CLI. Use Cursor Settings.",
    );
  }

  if (
    strat === "native" &&
    (record.tool === "cursor" || record.tool === "agents") &&
    record.skillKind === "markdown"
  ) {
    await setDisableModelInvocation(
      join(record.path, "SKILL.md"),
      false,
      dryRun,
    );
    return;
  }

  if (strat === "native" && record.tool === "claude-code") {
    if (record.pluginKey) {
      const scope = globalSettings || !projectDir ? "user" : "project";
      const dir = claudeSettingsDir(homedir, scope, projectDir);
      const path = join(dir, "settings.local.json");
      await writeClaudeSettingsFile(
        path,
        (prev) => withEnabledPlugin(prev, record.pluginKey!, true),
        dryRun,
      );
      return;
    }
    const skillMd = join(record.path, "SKILL.md");
    await setDisableModelInvocation(skillMd, false, dryRun);
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
