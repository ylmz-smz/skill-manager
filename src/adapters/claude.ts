import { basename, dirname, join, relative } from "node:path";
import {
  isPluginEnabled,
  readMergedClaudeSettings,
  type ClaudeSettings,
} from "../claude-settings.js";
import { parseSkillMarkdown } from "../frontmatter.js";
import {
  findSkillMdUnder,
  listSkillDirsFlat,
  pathExists,
  readTextIfExists,
} from "../fsutil.js";
import type { SkillRecord, SourceKind, ToolId } from "../types.js";

const TOOL: ToolId = "claude-code";
const PLUGIN_SCAN_MAX_DEPTH = 12;

async function skillRecordFromDir(
  skillDir: string,
  sourceKind: SourceKind,
  settings: ClaudeSettings,
  pluginKey?: string,
): Promise<SkillRecord | undefined> {
  const skillPath = join(skillDir, "SKILL.md");
  const raw = await readTextIfExists(skillPath);
  if (!raw) return undefined;
  const { frontmatter } = parseSkillMarkdown(raw);
  const dirName = basename(skillDir);
  const id = frontmatter.name?.trim() || dirName;
  const disable = frontmatter.disableModelInvocation === true;
  let enabled = true;
  let enabledSemantic: "native" | "managed" = "native";
  if (pluginKey) {
    enabled = isPluginEnabled(settings, pluginKey);
  } else {
    enabled = !disable;
  }
  return {
    tool: TOOL,
    id,
    displayName: id,
    description: frontmatter.description ?? "",
    sourceKind,
    path: skillDir,
    invocation: { disableModelInvocation: disable },
    enabled,
    enabledSemantic,
    skillKind: "markdown",
    pluginKey,
  };
}

async function resolvePluginKey(skillMdPath: string): Promise<{
  pluginKey?: string;
  marketplace?: string;
  pluginName?: string;
}> {
  let dir = dirname(skillMdPath);
  for (let i = 0; i < 24; i++) {
    const pluginJson = join(dir, ".claude-plugin", "plugin.json");
    const text = await readTextIfExists(pluginJson);
    if (text) {
      try {
        const j = JSON.parse(text) as { name?: string };
        const pluginName = typeof j.name === "string" ? j.name : undefined;
        const marketplacesIdx = dir.split(/[/\\]/).indexOf("marketplaces");
        const parts = dir.split(/[/\\]/);
        const marketplace =
          marketplacesIdx >= 0 && parts[marketplacesIdx + 1]
            ? parts[marketplacesIdx + 1]
            : undefined;
        const pluginKey =
          pluginName && marketplace
            ? `${pluginName}@${marketplace}`
            : undefined;
        return { pluginKey, marketplace, pluginName };
      } catch {
        return {};
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return {};
}

export async function discoverClaudeSkills(
  homedir: string,
  projectDir?: string,
): Promise<SkillRecord[]> {
  const { merged } = await readMergedClaudeSettings(homedir, projectDir);
  const out: SkillRecord[] = [];

  const userSkillsRoot = join(homedir, ".claude", "skills");
  for (const dir of await listSkillDirsFlat(userSkillsRoot)) {
    const r = await skillRecordFromDir(dir, "user-global", merged);
    if (r) out.push(r);
  }

  if (projectDir) {
    const projRoot = join(projectDir, ".claude", "skills");
    for (const dir of await listSkillDirsFlat(projRoot)) {
      const r = await skillRecordFromDir(dir, "project", merged);
      if (r) out.push(r);
    }
  }

  const marketplacesRoot = join(homedir, ".claude", "plugins", "marketplaces");
  if (await pathExists(marketplacesRoot)) {
    const skillFiles = await findSkillMdUnder(
      marketplacesRoot,
      PLUGIN_SCAN_MAX_DEPTH,
    );
    for (const skillFile of skillFiles) {
      const skillDir = dirname(skillFile);
      const { pluginKey } = await resolvePluginKey(skillFile);
      const r = await skillRecordFromDir(skillDir, "plugin", merged, pluginKey);
      if (r) {
        if (!pluginKey) {
          r.notes =
            "Could not resolve plugin key (missing .claude-plugin/plugin.json path). enablePlugins may not apply.";
        }
        out.push(r);
      }
    }
  }

  return dedupeClaudePaths(out);
}

function dedupeClaudePaths(records: SkillRecord[]): SkillRecord[] {
  const seen = new Set<string>();
  const result: SkillRecord[] = [];
  for (const r of records) {
    const norm = r.path.replace(/\\/g, "/");
    if (seen.has(norm)) continue;
    seen.add(norm);
    result.push(r);
  }
  return result;
}

export function claudeRelativePath(
  homedir: string,
  projectDir: string | undefined,
  absPath: string,
): string {
  const relHome = relative(join(homedir, ".claude"), absPath);
  if (!relHome.startsWith("..")) return relHome;
  if (projectDir) {
    const relProj = relative(join(projectDir, ".claude"), absPath);
    if (!relProj.startsWith("..")) return relProj;
  }
  return absPath;
}
