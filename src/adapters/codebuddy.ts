import { join } from "node:path";
import {
  createFlatSkillAdapter,
  type FlatSkillAdapter,
} from "../discovery/skill-flat-factory.js";
import type { SkillRecord, SourceKind } from "../types.js";

export const codebuddySkillAdapter: FlatSkillAdapter = createFlatSkillAdapter({
  tool: "codebuddy",
  userRoot: (h) => join(h, ".codebuddy", "skills"),
  projectRoot: (p) => join(p, ".codebuddy", "skills"),
});

/** @deprecated Use `codebuddySkillAdapter.discover(...)` instead. */
export async function discoverCodebuddySkills(
  homedir: string,
  projectDir?: string,
  extraRoots?: Array<{ root: string; sourceKind: SourceKind }>,
): Promise<SkillRecord[]> {
  return codebuddySkillAdapter.discover(homedir, projectDir, extraRoots);
}
