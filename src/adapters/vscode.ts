import { join } from "node:path";
import {
  createFlatSkillAdapter,
  type FlatSkillAdapter,
} from "../discovery/skill-flat-factory.js";
import type { SkillRecord, SourceKind } from "../types.js";

export const vscodeSkillAdapter: FlatSkillAdapter = createFlatSkillAdapter({
  tool: "vscode",
  userRoot: (h) => join(h, ".copilot", "skills"),
  projectRoot: (p) => join(p, ".github", "skills"),
});

/** @deprecated Use `vscodeSkillAdapter.discover(...)` instead. */
export async function discoverVscodeSkills(
  homedir: string,
  projectDir?: string,
  extraRoots?: Array<{ root: string; sourceKind: SourceKind }>,
): Promise<SkillRecord[]> {
  return vscodeSkillAdapter.discover(homedir, projectDir, extraRoots);
}
