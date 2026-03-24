import { basename, join } from "node:path";
import { parseSkillMarkdown } from "../utils/frontmatter.js";
import { listSkillDirsFlat, readTextIfExists } from "../utils/fs.js";
import type { SkillRecord, SourceKind, ToolId } from "../types.js";

const TOOL: ToolId = "cursor";

interface CursorManifest {
  builtinSkillIds?: string[];
  managedSkillIds?: string[];
}

async function skillRecordFromDir(
  skillDir: string,
  sourceKind: SourceKind,
): Promise<SkillRecord | undefined> {
  const skillPath = join(skillDir, "SKILL.md");
  const raw = await readTextIfExists(skillPath);
  if (!raw) return undefined;
  const { frontmatter } = parseSkillMarkdown(raw);
  const dirName = basename(skillDir);
  const id = frontmatter.name?.trim() || dirName;
  const disable = frontmatter.disableModelInvocation === true;
  return {
    tool: TOOL,
    id,
    displayName: id,
    description: frontmatter.description ?? "",
    sourceKind,
    path: skillDir,
    invocation: { disableModelInvocation: disable },
    enabled: !disable,
    enabledSemantic: "native",
    skillKind: "markdown",
  };
}

function builtinRecords(
  manifestPath: string,
  data: CursorManifest,
): SkillRecord[] {
  const ids = [
    ...(data.builtinSkillIds ?? []),
    ...(data.managedSkillIds ?? []),
  ];
  const uniq = [...new Set(ids)];
  return uniq.map((id) => ({
    tool: TOOL,
    id,
    displayName: id,
    description: "",
    sourceKind: "cursor-builtin" as const,
    path: manifestPath,
    enabled: true,
    enabledSemantic: "native" as const,
    skillKind: "cursor-builtin" as const,
    notes:
      "Built-in or Cursor-managed skill. Toggle in Cursor: Settings → Rules / Skills (not modified by this CLI).",
  }));
}

export async function discoverCursorSkills(
  homedir: string,
  projectDir?: string,
): Promise<SkillRecord[]> {
  const out: SkillRecord[] = [];

  const userRoot = join(homedir, ".cursor", "skills");
  for (const dir of await listSkillDirsFlat(userRoot)) {
    const r = await skillRecordFromDir(dir, "user-global");
    if (r) out.push(r);
  }

  if (projectDir) {
    const projRoot = join(projectDir, ".cursor", "skills");
    for (const dir of await listSkillDirsFlat(projRoot)) {
      const r = await skillRecordFromDir(dir, "project");
      if (r) out.push(r);
    }
  }

  const manifestPath = join(
    homedir,
    ".cursor",
    "skills-cursor",
    ".cursor-managed-skills-manifest.json",
  );
  const manifestRaw = await readTextIfExists(manifestPath);
  if (manifestRaw) {
    try {
      const data = JSON.parse(manifestRaw) as CursorManifest;
      out.push(...builtinRecords(manifestPath, data));
    } catch {
      /* ignore malformed manifest */
    }
  }

  return out;
}
