import { readTextIfExists } from "../utils/fs.js";
import { archiveDirForKind } from "../utils/paths.js";
import {
  disableSubagent as legacyDisableSubagent,
  enableSubagent as legacyEnableSubagent,
} from "../core/subagents-control.js";
import { fromSubagentResource } from "../domain/convert.js";
import { findArchivedById, loadState } from "../core/state.js";
import type { SubagentRecord, SubagentToolId } from "../types.js";
import type { Strategy, SubagentResource } from "../domain/types.js";
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

export interface SubagentMutationPortConfig {
  homedir: string;
  /** Required only when strategy resolves to "symlink". */
  unifiedRoot?: string;
}

function buildPreview(files: DiffFile[], warnings: string[]): DiffPreview {
  const mergedKeys = new Set<string>();
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

async function previewDisable(
  homedir: string,
  target: SubagentResource,
  strategy: Strategy,
): Promise<DiffPreview> {
  const before = await readTextIfExists(target.path);
  if (!before) {
    return buildPreview([], [`Subagent file not found: ${target.path}`]);
  }
  if (strategy === "symlink") {
    return buildPreview(
      [{ path: target.path, kind: "move", before, after: undefined }],
      [
        `File will be moved under unified.roots.agents and re-attached via symlink.`,
        `Apply requires unified.roots.agents in config.`,
      ],
    );
  }
  // default: managed (archive)
  const dest = archiveDirForKind(homedir, "subagents", target.tool, target.id);
  return buildPreview(
    [{ path: target.path, kind: "delete", before, after: undefined }],
    [`File will be archived: ${target.path} -> ${dest}`, "Reversible via enable / UI restore."],
  );
}

async function previewEnable(
  homedir: string,
  target: SubagentResource,
  strategy: Strategy,
): Promise<DiffPreview> {
  const state = await loadState(homedir);
  const archived = findArchivedById(state, target.tool, target.id, "subagent");
  if (strategy === "symlink") {
    return buildPreview([], [
      "Symlink-restore re-points the link from managed copy back to the original path; no file content changes.",
    ]);
  }
  if (!archived) {
    return buildPreview([], [
      `No archived subagent '${target.id}' for tool '${target.tool}' in state.json — apply() will fail.`,
    ]);
  }
  const content = await readTextIfExists(archived.archivePath);
  return buildPreview(
    [{
      path: archived.originalPath,
      kind: "create",
      after: content ?? "",
    }],
    [`Subagent will be restored from archive: ${archived.archivePath} -> ${archived.originalPath}`],
  );
}

export function createSubagentMutationPort(
  cfg: SubagentMutationPortConfig,
): MutationPort<"subagent"> {
  return {
    kind: "subagent",
    async preview(target, op, strategy) {
      return op === "disable"
        ? previewDisable(cfg.homedir, target, strategy)
        : previewEnable(cfg.homedir, target, strategy);
    },
    async apply(target, op, strategy, opts) {
      if (opts.dryRun) {
        const p = await this.preview(target, op, strategy);
        return { ok: true, applied: false, writtenPaths: [], warnings: p.warnings };
      }
      const record: SubagentRecord = fromSubagentResource(target);
      const legacyStrat: "managed" | "symlink" =
        strategy === "symlink" ? "symlink" : "managed";
      try {
        if (op === "disable") {
          await legacyDisableSubagent({
            homedir: cfg.homedir,
            record,
            dryRun: false,
            strategy: legacyStrat,
            unifiedRoot: cfg.unifiedRoot,
          });
        } else {
          await legacyEnableSubagent({
            homedir: cfg.homedir,
            record,
            dryRun: false,
            strategy: legacyStrat,
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
