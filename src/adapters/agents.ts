import { basename, dirname, join, relative } from "node:path";
import { parseSkillMarkdown } from "../utils/frontmatter.js";
import { findSkillMdUnder, readTextIfExists } from "../utils/fs.js";
import type { SkillRecord, ToolId } from "../types.js";
import type { DiscoveryPort, ScanContext } from "../discovery/port.js";
import { toSkillResource } from "../domain/convert.js";

const TOOL: ToolId = "agents";
const MAX_DEPTH = 8;

export async function discoverAgentsSkills(
  homedir: string,
  extraRoots?: string[],
): Promise<SkillRecord[]> {
  const roots = [join(homedir, ".agents", "skills"), ...(extraRoots ?? [])];
  const out: SkillRecord[] = [];
  for (const root of roots) {
    const files = await findSkillMdUnder(root, MAX_DEPTH);
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
        descriptionI18n: frontmatter.descriptionI18n,
        sourceKind: "user-global",
        path: dirNormalized,
        invocation: { disableModelInvocation: disable },
        enabled: !disable,
        enabledSemantic: "native",
        skillKind: "markdown",
      });
    }
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

/**
 * `~/.agents/skills` adapter exposed as a DiscoveryPort<"skill"> so the
 * unified scan loop can include it alongside the flat-dir adapters.
 *
 * Note: the recursive walk pattern (findSkillMdUnder) is distinct enough
 * from createFlatSkillAdapter to keep its own implementation rather than
 * forcing one factory to grow yet another mode.
 */
export const agentsSkillAdapter: DiscoveryPort<"skill"> = {
  tool: TOOL,
  kind: "skill",
  async scan(ctx: ScanContext) {
    const extraRootPaths = (ctx.extraSkillRoots ?? [])
      .filter((r) => r.root.includes("/.agents/skills"))
      .map((r) => r.root);
    const records = await discoverAgentsSkills(ctx.homedir, extraRootPaths);
    return records.map(toSkillResource);
  },
};
