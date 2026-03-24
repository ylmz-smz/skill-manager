import { readFile } from "node:fs/promises";
import { stat } from "node:fs/promises";
import { join } from "node:path";
import { pathExists } from "../utils/fs.js";
import { statePath } from "../utils/paths.js";
import { loadState } from "./state.js";

interface ClaudeSettings {
  enabledPlugins?: Record<string, boolean>;
  [key: string]: unknown;
}

const SETTINGS_FILES = ["settings.json", "settings.local.json"] as const;

async function readMergedClaudeSettings(
  homedir: string,
  projectDir?: string,
): Promise<{ merged: ClaudeSettings; sources: string[] }> {
  const sources: string[] = [];
  const merged: ClaudeSettings = {};

  const dirs: string[] = [join(homedir, ".claude")];
  if (projectDir) dirs.push(join(projectDir, ".claude"));

  for (const dir of dirs) {
    for (const name of SETTINGS_FILES) {
      const p = join(dir, name);
      try {
        const raw = await readFile(p, "utf8");
        const j = JSON.parse(raw) as ClaudeSettings;
        sources.push(p);
        Object.assign(merged, j);
      } catch {
        /* missing */
      }
    }
  }
  return { merged, sources };
}

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
