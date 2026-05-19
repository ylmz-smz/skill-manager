import { join, relative } from "node:path";
import {
  createFlatSkillAdapter,
  dedupeByPath,
  type FlatSkillAdapter,
} from "../discovery/skill-flat-factory.js";
import type { SkillRecord, SourceKind } from "../types.js";

export const claudeSkillAdapter: FlatSkillAdapter = createFlatSkillAdapter({
  tool: "claude-code",
  userRoot: (h) => join(h, ".claude", "skills"),
  projectRoot: (p) => join(p, ".claude", "skills"),
  postProcess: dedupeByPath,
});

/** @deprecated Use `claudeSkillAdapter.discover(...)` instead. */
export async function discoverClaudeSkills(
  homedir: string,
  projectDir?: string,
  extraRoots?: Array<{ root: string; sourceKind: SourceKind }>,
): Promise<SkillRecord[]> {
  return claudeSkillAdapter.discover(homedir, projectDir, extraRoots);
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
