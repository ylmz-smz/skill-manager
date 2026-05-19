import { join } from "node:path";
import { readTextIfExists } from "../utils/fs.js";
import { applyDisableFlagToSkillMd } from "../core/skill-file.js";
import { parseSkillMarkdown } from "../utils/frontmatter.js";
import { archiveDirForKind } from "../utils/paths.js";
import {
  disableSkill as legacyDisableSkill,
  enableSkill as legacyEnableSkill,
} from "../core/control.js";
import { fromSkillResource } from "../domain/convert.js";
import type { ControlStrategy, SkillRecord } from "../types.js";
import type { SkillResource, Strategy } from "../domain/types.js";
import { computeUnifiedDiff } from "./diff.js";
import { redact } from "./redact.js";
import type {
  ApplyOptions,
  DiffFile,
  DiffPreview,
  MutationPort,
  MutationResult,
  ResourceOp,
} from "./port.js";

export interface SkillMutationPortConfig {
  homedir: string;
  projectDir?: string;
  /** Required only when strategy resolves to "symlink". */
  unifiedRoot?: string;
}

/**
 * Mirror of core/control.ts:inferStrategy() but operating on the new
 * SkillResource shape. Kept here (rather than imported) because the old
 * helper takes a SkillRecord; we don't want to roundtrip through
 * fromSkillResource() inside hot paths.
 */
function inferStrategy(
  record: SkillResource,
  explicit: Strategy,
): "native" | "managed" | "symlink" {
  if (explicit === "native") return "native";
  if (explicit === "managed") return "managed";
  if (explicit === "symlink") return "symlink";
  if (record.skillKind === "cursor-builtin") return "native";
  if (record.tool === "agents" && record.skillKind === "markdown") return "managed";
  if (record.skillKind === "markdown") return "native";
  return "managed";
}

function buildPreview(files: DiffFile[], warnings: string[]): DiffPreview {
  let mergedKeys = new Set<string>();
  const redactedFiles: DiffFile[] = files.map((f) => {
    const beforeR = f.before != null ? redact(f.before) : undefined;
    const afterR = f.after != null ? redact(f.after) : undefined;
    if (beforeR) for (const k of beforeR.redactedKeys) mergedKeys.add(k);
    if (afterR) for (const k of afterR.redactedKeys) mergedKeys.add(k);
    return {
      ...f,
      before: beforeR?.redacted,
      after: afterR?.redacted,
    };
  });
  return {
    files: redactedFiles,
    unifiedDiff: computeUnifiedDiff(redactedFiles),
    redactedEnvKeys: [...mergedKeys].sort(),
    warnings,
  };
}

async function previewNativeMarkdown(
  target: SkillResource,
  op: ResourceOp,
): Promise<DiffPreview> {
  const mdPath = join(target.path, "SKILL.md");
  const before = (await readTextIfExists(mdPath)) ?? "";
  // Compare on data, not bytes: gray-matter's stringify normalises trailing
  // whitespace, so a string-equality check would surface phantom diffs even
  // when the user-visible frontmatter is unchanged.
  const { frontmatter } = parseSkillMarkdown(before);
  const isCurrentlyDisabled = frontmatter.disableModelInvocation === true;
  const wantsDisabled = op === "disable";
  if (isCurrentlyDisabled === wantsDisabled) {
    return buildPreview([], [
      wantsDisabled
        ? "Skill is already disabled (no SKILL.md change)."
        : "Skill is already enabled (no SKILL.md change).",
    ]);
  }
  const after = applyDisableFlagToSkillMd(before, wantsDisabled);
  return buildPreview(
    [{ path: mdPath, kind: "modify", before, after }],
    [],
  );
}

async function previewManaged(
  homedir: string,
  target: SkillResource,
  op: ResourceOp,
): Promise<DiffPreview> {
  if (op === "disable") {
    const dest = archiveDirForKind(homedir, "skills", target.tool, target.id);
    return buildPreview(
      [{ path: target.path, kind: "move", before: undefined, after: undefined }],
      [
        `Directory will be archived: ${target.path} -> ${dest}`,
        "Reversible via `skills-manager enable` or the UI restore button.",
      ],
    );
  }
  return buildPreview([], [
    "Enable via managed strategy requires an existing archive entry — apply() will fail if no archive exists.",
    `Restore target: ${target.path}`,
  ]);
}

async function previewSymlink(
  homedir: string,
  target: SkillResource,
  op: ResourceOp,
  unifiedRoot?: string,
): Promise<DiffPreview> {
  if (!unifiedRoot) {
    return buildPreview([], [
      "Strategy 'symlink' requires unified.roots.skills in config — apply() will fail.",
    ]);
  }
  const note = op === "disable"
    ? `Move ${target.path} to ${unifiedRoot}/${target.tool}/<id> (managed copy).`
    : `Restore symlink from managed copy back to ${target.path}.`;
  return buildPreview(
    [{ path: target.path, kind: "move", before: undefined, after: undefined }],
    [note],
  );
}

export function createSkillMutationPort(
  cfg: SkillMutationPortConfig,
): MutationPort<"skill"> {
  return {
    kind: "skill",
    async preview(target, op, strategy) {
      if (target.skillKind === "cursor-builtin") {
        return buildPreview([], [
          "Cursor built-in skills cannot be toggled by this CLI — use Cursor Settings.",
        ]);
      }
      const strat = inferStrategy(target, strategy);
      switch (strat) {
        case "native":
          return previewNativeMarkdown(target, op);
        case "managed":
          return previewManaged(cfg.homedir, target, op);
        case "symlink":
          return previewSymlink(cfg.homedir, target, op, cfg.unifiedRoot);
      }
    },
    async apply(target, op, strategy, opts) {
      if (opts.dryRun) {
        const p = await this.preview(target, op, strategy);
        return { ok: true, applied: false, writtenPaths: [], warnings: p.warnings };
      }
      const record: SkillRecord = fromSkillResource(target);
      const legacyStrat: ControlStrategy = strategy;
      try {
        if (op === "disable") {
          await legacyDisableSkill({
            homedir: cfg.homedir,
            projectDir: cfg.projectDir,
            record,
            strategy: legacyStrat,
            dryRun: false,
            globalSettings: opts.global ?? false,
            unifiedRoot: cfg.unifiedRoot,
          });
        } else {
          await legacyEnableSkill({
            homedir: cfg.homedir,
            projectDir: cfg.projectDir,
            record,
            strategy: legacyStrat,
            dryRun: false,
            globalSettings: opts.global ?? false,
            unifiedRoot: cfg.unifiedRoot,
          });
        }
        return {
          ok: true,
          applied: true,
          writtenPaths: [target.path],
          warnings: [],
        };
      } catch (e) {
        return {
          ok: false,
          applied: false,
          writtenPaths: [],
          warnings: [e instanceof Error ? e.message : String(e)],
        };
      }
    },
  };
}
