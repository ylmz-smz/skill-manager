import { basename, join, relative } from "node:path";
import { parseSkillMarkdown } from "../utils/frontmatter.js";
import { listSkillDirsFlat, readTextIfExists } from "../utils/fs.js";
import type { SkillRecord, SourceKind, ToolId } from "../types.js";

const TOOL: ToolId = "claude-code";

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

export async function discoverClaudeSkills(
  homedir: string,
  projectDir?: string,
  extraRoots?: Array<{ root: string; sourceKind: SourceKind }>,
): Promise<SkillRecord[]> {
  const out: SkillRecord[] = [];

  const userSkillsRoot = join(homedir, ".claude", "skills");
  for (const dir of await listSkillDirsFlat(userSkillsRoot)) {
    const r = await skillRecordFromDir(dir, "user-global");
    if (r) out.push(r);
  }

  if (projectDir) {
    const projRoot = join(projectDir, ".claude", "skills");
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
