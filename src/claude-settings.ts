import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";

export interface ClaudeSettings {
  enabledPlugins?: Record<string, boolean>;
  [key: string]: unknown;
}

const SETTINGS_FILES = ["settings.json", "settings.local.json"] as const;

export type SettingsScope = "user" | "project";

export function claudeSettingsDir(
  homedir: string,
  scope: SettingsScope,
  projectDir?: string,
): string {
  if (scope === "user") return join(homedir, ".claude");
  if (!projectDir) {
    throw new Error("projectDir required for project-scoped Claude settings");
  }
  return join(projectDir, ".claude");
}

export async function readMergedClaudeSettings(
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

export function isPluginEnabled(
  settings: ClaudeSettings,
  pluginKey: string,
): boolean {
  const ep = settings.enabledPlugins;
  if (!ep || typeof ep !== "object") return true;
  const v = (ep as Record<string, unknown>)[pluginKey];
  if (v === false) return false;
  if (v === true) return true;
  return true;
}

export function withEnabledPlugin(
  settings: ClaudeSettings,
  pluginKey: string,
  enabled: boolean,
): ClaudeSettings {
  const prev =
    settings.enabledPlugins &&
    typeof settings.enabledPlugins === "object" &&
    !Array.isArray(settings.enabledPlugins)
      ? { ...(settings.enabledPlugins as Record<string, boolean>) }
      : {};
  prev[pluginKey] = enabled;
  return { ...settings, enabledPlugins: prev };
}

export async function writeClaudeSettingsFile(
  path: string,
  mutator: (prev: ClaudeSettings) => ClaudeSettings,
  dryRun: boolean,
): Promise<ClaudeSettings> {
  let prev: ClaudeSettings = {};
  try {
    prev = JSON.parse(await readFile(path, "utf8")) as ClaudeSettings;
  } catch {
    /* new file */
  }
  const next = mutator({ ...prev });
  if (!dryRun) {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  }
  return next;
}
