import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import type { SubagentRecord, SubagentToolId } from "../types.js";
import { findMarkdownUnder, pathExists } from "../utils/fs.js";
import { parseSubagentMarkdown } from "../utils/subagent-frontmatter.js";

function inferToolFromRoot(root: string): SubagentToolId {
  const p = root.replace(/\\/g, "/");
  if (p.includes("/.claude/agents")) return "claude-code";
  if (p.includes("/.codex/agents")) return "codex";
  if (p.includes("/.cursor/agents")) return "cursor";
  return "cursor";
}

function toolRoots(homedir: string, projectDir?: string): Array<{
  tool: SubagentToolId;
  sourceKind: "user-global" | "project";
  root: string;
}> {
  const out: Array<{
    tool: SubagentToolId;
    sourceKind: "user-global" | "project";
    root: string;
  }> = [];

  const user: Array<{ tool: SubagentToolId; root: string }> = [
    { tool: "cursor", root: join(homedir, ".cursor", "agents") },
    { tool: "claude-code", root: join(homedir, ".claude", "agents") },
    { tool: "codex", root: join(homedir, ".codex", "agents") },
  ];
  for (const r of user) out.push({ ...r, sourceKind: "user-global" });

  if (projectDir) {
    const proj: Array<{ tool: SubagentToolId; root: string }> = [
      { tool: "cursor", root: join(projectDir, ".cursor", "agents") },
      { tool: "claude-code", root: join(projectDir, ".claude", "agents") },
      { tool: "codex", root: join(projectDir, ".codex", "agents") },
    ];
    for (const r of proj) out.push({ ...r, sourceKind: "project" });
  }

  return out;
}

function stableIdFromPath(p: string, fmName?: string): string {
  if (fmName && fmName.trim()) return fmName.trim();
  const base = basename(p).replace(/\.md$/i, "");
  return base || "_unknown";
}

export async function discoverSubagents(
  homedir: string,
  projectDir?: string,
  extraRoots?: { user?: string[]; project?: string[] },
): Promise<SubagentRecord[]> {
  const out: SubagentRecord[] = [];
  const roots = toolRoots(homedir, projectDir);

  for (const r of extraRoots?.user ?? []) {
    roots.push({ tool: inferToolFromRoot(r), sourceKind: "user-global", root: r });
  }
  for (const r of extraRoots?.project ?? []) {
    if (!projectDir) break;
    roots.push({ tool: inferToolFromRoot(r), sourceKind: "project", root: r });
  }

  for (const { tool, sourceKind, root } of roots) {
    if (!(await pathExists(root))) continue;
    // Depth 3 is enough for common patterns like `.cursor/agents/*.md`
    // and `.cursor/agents/team/*.md` without traversing huge trees.
    const files = await findMarkdownUnder(root, 3);
    for (const filePath of files) {
      let raw: string;
      try {
        raw = await readFile(filePath, "utf8");
      } catch {
        continue;
      }
      const parsed = parseSubagentMarkdown(raw);
      const id = stableIdFromPath(filePath, parsed.frontmatter.name);
      const description = parsed.frontmatter.description?.trim() || "—";
      out.push({
        tool,
        id,
        displayName: id,
        description,
        sourceKind,
        path: filePath,
        enabled: true,
        enabledSemantic: "native",
        notes:
          parsed.frontmatter.model || parsed.frontmatter.readonly || parsed.frontmatter.isBackground
            ? [
                parsed.frontmatter.model ? `model=${parsed.frontmatter.model}` : undefined,
                parsed.frontmatter.readonly ? "readonly=true" : undefined,
                parsed.frontmatter.isBackground ? "is_background=true" : undefined,
              ]
                .filter(Boolean)
                .join(" · ")
            : undefined,
      });
    }
  }

  return out;
}

