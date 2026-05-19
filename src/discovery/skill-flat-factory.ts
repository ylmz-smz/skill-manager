import { basename, join } from "node:path";
import { parseSkillMarkdown } from "../utils/frontmatter.js";
import { listSkillDirsFlat, readTextIfExists } from "../utils/fs.js";
import type { SkillRecord, SourceKind, ToolId } from "../types.js";

/**
 * Shared factory for "flat skill directory" adapters.
 *
 * Cursor / Claude / VSCode / CodeBuddy all follow the same pattern:
 *   1. Scan immediate subdirectories of <userRoot> looking for SKILL.md.
 *   2. (Optional) Scan immediate subdirectories of <projectRoot>.
 *   3. (Optional) Scan extra user-supplied roots from config.yaml.
 *   4. (Optional) Run an extra adapter-specific scan (e.g. Cursor's
 *      built-in manifest JSON).
 *   5. (Optional) Post-process the records (e.g. Claude path dedup).
 *
 * Each adapter previously hand-rolled steps 1-3 with only `TOOL` and the
 * path templates differing. This factory makes those differences explicit
 * configuration parameters.
 */
export interface FlatSkillAdapterConfig {
  tool: ToolId;
  /** Resolve the user-global skills root (e.g. ~/.cursor/skills). */
  userRoot: (homedir: string) => string;
  /** Resolve the project skills root, or undefined if N/A. */
  projectRoot?: (projectDir: string) => string;
  /** Adapter-specific extra scan (e.g. Cursor built-in manifest). */
  extraScan?: (homedir: string) => Promise<SkillRecord[]>;
  /** Post-process hook (e.g. Claude path dedup). Defaults to identity. */
  postProcess?: (records: SkillRecord[]) => SkillRecord[];
}

export interface FlatSkillAdapter {
  tool: ToolId;
  discover(
    homedir: string,
    projectDir?: string,
    extraRoots?: Array<{ root: string; sourceKind: SourceKind }>,
  ): Promise<SkillRecord[]>;
}

/** Read a SKILL.md from a directory and project it onto SkillRecord. */
export async function skillRecordFromDir(
  skillDir: string,
  tool: ToolId,
  sourceKind: SourceKind,
): Promise<SkillRecord | undefined> {
  const raw = await readTextIfExists(join(skillDir, "SKILL.md"));
  if (!raw) return undefined;
  const { frontmatter } = parseSkillMarkdown(raw);
  const dirName = basename(skillDir);
  const id = frontmatter.name?.trim() || dirName;
  const disable = frontmatter.disableModelInvocation === true;
  return {
    tool,
    id,
    displayName: id,
    description: frontmatter.description ?? "",
    descriptionI18n: frontmatter.descriptionI18n,
    sourceKind,
    path: skillDir,
    invocation: { disableModelInvocation: disable },
    enabled: !disable,
    enabledSemantic: "native",
    skillKind: "markdown",
  };
}

export function createFlatSkillAdapter(cfg: FlatSkillAdapterConfig): FlatSkillAdapter {
  return {
    tool: cfg.tool,
    async discover(homedir, projectDir, extraRoots) {
      const out: SkillRecord[] = [];

      for (const dir of await listSkillDirsFlat(cfg.userRoot(homedir))) {
        const r = await skillRecordFromDir(dir, cfg.tool, "user-global");
        if (r) out.push(r);
      }

      if (projectDir && cfg.projectRoot) {
        for (const dir of await listSkillDirsFlat(cfg.projectRoot(projectDir))) {
          const r = await skillRecordFromDir(dir, cfg.tool, "project");
          if (r) out.push(r);
        }
      }

      for (const ex of extraRoots ?? []) {
        for (const dir of await listSkillDirsFlat(ex.root)) {
          const r = await skillRecordFromDir(dir, cfg.tool, ex.sourceKind);
          if (r) out.push(r);
        }
      }

      if (cfg.extraScan) {
        out.push(...(await cfg.extraScan(homedir)));
      }

      return cfg.postProcess ? cfg.postProcess(out) : out;
    },
  };
}

/** Shared dedup-by-normalized-path used by Claude (and now reusable). */
export function dedupeByPath(records: SkillRecord[]): SkillRecord[] {
  const seen = new Set<string>();
  const out: SkillRecord[] = [];
  for (const r of records) {
    const k = r.path.replace(/\\/g, "/");
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}
