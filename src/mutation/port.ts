import type { ResourceKind, ResourceOf, Strategy } from "../domain/types.js";

/**
 * v0.4 unified mutation port (interface only — implementations land in
 * Phase 2). Every enable/disable path goes through `preview` first so
 * callers can show a diff (with secrets redacted) before any disk write.
 *
 * Killing feature for v0.4: every competitor we surveyed treats writes
 * as fire-and-forget. We make Diff Preview the default contract.
 */

export type ResourceOp = "enable" | "disable";

export interface DiffFile {
  path: string;
  kind: "create" | "modify" | "delete" | "move";
  /** Pre-state file contents, redacted. Absent for "create". */
  before?: string;
  /** Post-state file contents, redacted. Absent for "delete". */
  after?: string;
}

export interface DiffPreview {
  files: DiffFile[];
  /** Combined unified diff string for UI rendering, already redacted. */
  unifiedDiff: string;
  /** env-key names that were masked in `before`/`after` (for UI badges). */
  redactedEnvKeys: string[];
  /** Non-fatal hints for the user (e.g. "this strategy will move files"). */
  warnings: string[];
}

export interface ApplyOptions {
  /** Compute changes but write nothing. Default false. */
  dryRun?: boolean;
  /** Edit user-global config instead of project. */
  global?: boolean;
  /** Required gate for sensitive writes (e.g. ~/.claude.json). */
  force?: boolean;
}

export interface MutationResult {
  ok: boolean;
  /** True when files were written; false when aborted, dry-run, or no-op. */
  applied: boolean;
  /** Absolute paths actually written/moved/deleted. */
  writtenPaths: string[];
  warnings: string[];
}

export interface MutationPort<K extends ResourceKind> {
  kind: K;
  /** Compute diff without writing anything. */
  preview(
    target: ResourceOf<K>,
    op: ResourceOp,
    strategy: Strategy,
  ): Promise<DiffPreview>;
  /** Execute the change. Should call preview internally for parity. */
  apply(
    target: ResourceOf<K>,
    op: ResourceOp,
    strategy: Strategy,
    opts: ApplyOptions,
  ): Promise<MutationResult>;
}
