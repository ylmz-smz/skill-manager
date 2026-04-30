import { basename, join } from "node:path";
import { parseSkillMarkdown } from "../utils/frontmatter.js";
import { listSkillDirsFlat, readTextIfExists } from "../utils/fs.js";
import type { SkillRecord, SourceKind, ToolId } from "../types.js";

const TOOL: ToolId = "codebuddy";

async function skillRecordFromDir(
  skillDir: string,
  sourceKind: SourceKind,
): Promise<SkillRecord | undefined> {
  const raw = await readTextIfExists(join(skillDir, "SKILL.md"));
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
    descriptionI18n: frontmatter.descriptionI18n,
    sourceKind,
    path: skillDir,
    invocation: { disableModelInvocation: disable },
    enabled: !disable,
    enabledSemantic: "native",
    skillKind: "markdown",
  };
}

export async function discoverCodebuddySkills(
  homedir: string,
  projectDir?: string,
  extraRoots?: Array<{ root: string; sourceKind: SourceKind }>,
): Promise<SkillRecord[]> {
  const out: SkillRecord[] = [];

  const userRoot = join(homedir, ".codebuddy", "skills");
  for (const dir of await listSkillDirsFlat(userRoot)) {
    const r = await skillRecordFromDir(dir, "user-global");
    if (r) out.push(r);
  }

  if (projectDir) {
    const projRoot = join(projectDir, ".codebuddy", "skills");
    for (const dir of await listSkillDirsFlat(projRoot)) {
      const r = await skillRecordFromDir(dir, "project");
      if (r) out.push(r);
    }
  }

  for (const ex of extraRoots ?? []) {
    for (const dir of await listSkillDirsFlat(ex.root)) {
      const r = await skillRecordFromDir(dir, ex.sourceKind);
      if (r) out.push(r);
    }
  }

  return out;
}
