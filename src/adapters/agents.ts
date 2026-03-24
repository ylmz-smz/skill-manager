import { basename, dirname, join, relative } from "node:path";
import { parseSkillMarkdown } from "../utils/frontmatter.js";
import { findSkillMdUnder, readTextIfExists } from "../utils/fs.js";
import type { SkillRecord, ToolId } from "../types.js";

const TOOL: ToolId = "agents";
const MAX_DEPTH = 8;

export async function discoverAgentsSkills(homedir: string): Promise<SkillRecord[]> {
  const root = join(homedir, ".agents", "skills");
  const files = await findSkillMdUnder(root, MAX_DEPTH);
  const out: SkillRecord[] = [];
  for (const skillFile of files) {
    const dirNormalized = dirname(skillFile);
    const raw = await readTextIfExists(join(dirNormalized, "SKILL.md"));
    if (!raw) continue;
    const { frontmatter } = parseSkillMarkdown(raw);
    const rel = relative(root, dirNormalized).replace(/\\/g, "/");
    const dirName = basename(dirNormalized);
    const id =
      frontmatter.name?.trim() ||
      (rel && rel !== "." ? rel.replace(/\//g, "__") : dirName);
    const disable = frontmatter.disableModelInvocation === true;
    out.push({
      tool: TOOL,
      id,
      displayName: frontmatter.name?.trim() || dirName,
      description: frontmatter.description ?? "",
      sourceKind: "user-global",
      path: dirNormalized,
      invocation: { disableModelInvocation: disable },
      enabled: !disable,
      enabledSemantic: "native",
      skillKind: "markdown",
    });
  }
  return dedupeByPath(out);
}

function dedupeByPath(records: SkillRecord[]): SkillRecord[] {
  const seen = new Set<string>();
  const result: SkillRecord[] = [];
  for (const r of records) {
    const k = r.path.replace(/\\/g, "/");
    if (seen.has(k)) continue;
    seen.add(k);
    result.push(r);
  }
  return result;
}
