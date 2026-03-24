import { stat } from "node:fs/promises";
import { readMergedClaudeSettings } from "./claude-settings.js";
import { pathExists } from "./fsutil.js";
import { statePath } from "./paths.js";
import { loadState } from "./state.js";

export interface DoctorIssue {
  level: "error" | "warn";
  message: string;
}

export async function runDoctor(opts: {
  homedir: string;
  projectDir?: string;
}): Promise<{ issues: DoctorIssue[]; info: string[] }> {
  const { homedir, projectDir } = opts;
  const issues: DoctorIssue[] = [];
  const info: string[] = [];

  const stPath = statePath(homedir);
  info.push(`State file: ${stPath}`);
  if (!(await pathExists(stPath))) {
    issues.push({
      level: "warn",
      message: `State file missing (expected after first managed disable): ${stPath}`,
    });
  }

  const state = await loadState(homedir);
  for (const e of state.archived) {
    const archOk = await pathExists(e.archivePath);
    const origOk = await pathExists(e.originalPath);
    if (!archOk) {
      issues.push({
        level: "error",
        message: `Archived path missing for ${e.tool} id=${e.id}: ${e.archivePath}`,
      });
    }
    if (origOk && archOk) {
      issues.push({
        level: "warn",
        message: `Both original and archive exist for ${e.tool} id=${e.id}. Original: ${e.originalPath}`,
      });
    }
    if (archOk) {
      try {
        const s = await stat(e.archivePath);
        if (!s.isDirectory()) {
          issues.push({
            level: "error",
            message: `Archive path is not a directory: ${e.archivePath}`,
          });
        }
      } catch {
        /* handled above */
      }
    }
  }

  try {
    const { merged, sources } = await readMergedClaudeSettings(
      homedir,
      projectDir,
    );
    info.push(`Claude settings sources read: ${sources.length} file(s)`);
    const ep = merged.enabledPlugins;
    if (ep && typeof ep === "object" && !Array.isArray(ep)) {
      const keys = Object.keys(ep as Record<string, unknown>);
      info.push(
        `Claude enabledPlugins keys (${keys.length}): ${keys.slice(0, 12).join(", ")}${keys.length > 12 ? ", …" : ""}`,
      );
    }
  } catch (err) {
    issues.push({
      level: "warn",
      message: `Could not read Claude settings: ${String(err)}`,
    });
  }

  return { issues, info };
}
