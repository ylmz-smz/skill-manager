import { structuredPatch } from "diff";
import type { DiffFile } from "./port.js";

/**
 * Compute a git-style unified diff from a sequence of DiffFile entries.
 *
 * Why we don't use `createPatch` directly: that helper treats the
 * `oldHeader` / `newHeader` arguments as tab-separated *suffixes* to
 * the filename, so its output looks like `--- path\t/dev/null` instead
 * of the git convention `--- /dev/null`. UIs and CLI tools downstream
 * (incl. our own colorizer) expect the git convention, so we go one
 * level lower with `structuredPatch` and emit the headers ourselves.
 *
 * Pure function; no I/O.
 */
function gitStylePatch(
  oldFile: string,
  newFile: string,
  oldStr: string,
  newStr: string,
): string {
  const sp = structuredPatch("", "", oldStr, newStr, "", "", { context: 3 });
  if (sp.hunks.length === 0) return "";
  const lines: string[] = [`--- ${oldFile}`, `+++ ${newFile}`];
  for (const h of sp.hunks) {
    lines.push(
      `@@ -${h.oldStart},${h.oldLines} +${h.newStart},${h.newLines} @@`,
    );
    for (const l of h.lines) lines.push(l);
  }
  lines.push("");
  return lines.join("\n");
}

export function computeUnifiedDiff(files: DiffFile[]): string {
  const parts: string[] = [];
  for (const f of files) {
    switch (f.kind) {
      case "create":
        parts.push(gitStylePatch("/dev/null", f.path, "", f.after ?? ""));
        break;
      case "delete":
        parts.push(gitStylePatch(f.path, "/dev/null", f.before ?? "", ""));
        break;
      case "modify":
      case "move":
        parts.push(gitStylePatch(f.path, f.path, f.before ?? "", f.after ?? ""));
        break;
    }
  }
  return parts.filter(Boolean).join("\n");
}

/**
 * Count added / removed lines from a unified diff. Used by UI to render
 * `+12 -3` badges next to each file in a preview. Header lines starting
 * with `+++ ` / `--- ` are excluded.
 */
export interface DiffLineStats {
  added: number;
  removed: number;
}

export function countDiffLines(unified: string): DiffLineStats {
  let added = 0;
  let removed = 0;
  for (const line of unified.split("\n")) {
    if (line.startsWith("+++ ") || line.startsWith("--- ")) continue;
    if (line.startsWith("+")) added++;
    else if (line.startsWith("-")) removed++;
  }
  return { added, removed };
}
