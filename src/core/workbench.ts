import { createHash, randomUUID } from "node:crypto";
import { cp, lstat, mkdir, readdir, readFile, rename, stat, symlink } from "node:fs/promises";
import { basename, join, relative, resolve } from "node:path";
import { z } from "zod";
import { parseSkillMarkdown } from "../utils/frontmatter.js";

export interface AgentDefinition {
  id: string;
  label: string;
  globalRoots: string[];
  projectRoots: string[];
  signals: string[];
}

const A = (id: string, label: string, globalRoots: string[], projectRoots: string[], signals: string[] = []): AgentDefinition => ({ id, label, globalRoots, projectRoots, signals });

export const KNOWN_AGENTS: AgentDefinition[] = [
  A("amp", "AMP", [".config/agents/skills"], [".agents/skills"], [".config/agents"]),
  A("antigravity", "Antigravity", [".gemini/antigravity/skills"], [".agent/skills"], [".gemini/antigravity"]),
  A("augment", "Augment", [".augment/skills"], [".augment/skills"], [".augment"]),
  A("claude-code", "Claude Code", [".claude/skills"], [".claude/skills"], [".claude"]),
  A("cline", "Cline", [".cline/skills"], [".cline/skills"], [".cline"]),
  A("codebuddy", "CodeBuddy", [".codebuddy/skills"], [".codebuddy/skills"], [".codebuddy"]),
  A("codex", "Codex", [".codex/skills", ".agents/skills"], [".agents/skills"], [".codex"]),
  A("cursor", "Cursor", [".cursor/skills"], [".cursor/skills"], [".cursor"]),
  A("gemini-cli", "Gemini CLI", [".gemini/skills"], [".gemini/skills"], [".gemini"]),
  A("github-copilot", "GitHub Copilot", [".copilot/skills"], [".github/skills"], [".copilot"]),
  A("grok-cli", "Grok CLI", [".agents/skills"], [".agents/skills"], [".grok"]),
  A("hermes", "Hermes", [".hermes/skills"], [], [".hermes"]),
  A("junie", "Junie", [".junie/skills"], [".junie/skills"], [".junie"]),
  A("kilo-code", "Kilo Code", [".kilocode/skills"], [".kilocode/skills"], [".kilocode"]),
  A("kimi", "Kimi", [".kimi/skills"], [".kimi/skills"], [".kimi"]),
  A("kiro", "Kiro", [".kiro/skills"], [".kiro/skills"], [".kiro"]),
  A("openclaw", "OpenClaw", [".openclaw/skills"], ["skills", ".agents/skills"], [".openclaw"]),
  A("opencode", "OpenCode", [".config/opencode/skills"], [".opencode/skills"], [".config/opencode"]),
  A("pi", "Pi", [".pi/skills"], [".pi/skills"], [".pi"]),
  A("qoder", "Qoder", [".qoder/skills"], [".qoder/skills"], [".qoder"]),
  A("qwen-code", "Qwen Code", [".qwen/skills", ".qwen-code/skills"], [".qwen/skills", ".qwen-code/skills"], [".qwen", ".qwen-code"]),
  A("trae", "TRAE", [".trae/skills"], [".trae/skills"], [".trae"]),
  A("trae-cn", "TRAE CN", [".trae-cn/skills"], [".trae-cn/skills"], [".trae-cn"]),
  A("warp", "Warp", [".warp/skills"], [".warp/skills"], [".warp"]),
  A("windsurf", "Windsurf", [".codeium/windsurf/skills"], [".windsurf/skills"], [".codeium/windsurf"]),
  A("workbuddy", "WorkBuddy", [".workbuddy/skills"], [".workbuddy/skills"], [".workbuddy"]),
  A("zed", "Zed", [".agents/skills"], [".agents/skills"], [".config/zed"]),
];

export const WorkbenchPreviewSchema = z.object({
  mode: z.enum(["quick", "managed"]),
  method: z.enum(["copy", "symlink"]),
  libraryPath: z.string().min(1),
  sources: z.array(z.object({ slug: z.string().min(1), path: z.string().min(1) })).min(1),
  targets: z.array(z.object({ agentId: z.string().min(1), scope: z.enum(["global", "project"]), projectPath: z.string().optional() })).min(1),
});

export interface SyncOperation {
  id: string;
  type: "copy" | "symlink" | "noop";
  sourcePath: string;
  targetPath: string;
  backupPath?: string;
  message: string;
}

export interface SyncPlan {
  planId: string;
  riskLevel: "low" | "medium";
  operations: SyncOperation[];
  blockedConflicts: string[];
  createdAt: string;
}

const plans = new Map<string, SyncPlan>();

async function exists(path: string): Promise<boolean> {
  return stat(path).then(() => true, () => false);
}

async function skillDirs(root: string): Promise<string[]> {
  let entries: import("node:fs").Dirent[];
  try { entries = await readdir(root, { withFileTypes: true }); } catch { return []; }
  const dirs: string[] = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if ((entry.isDirectory() || entry.isSymbolicLink()) && await exists(join(path, "SKILL.md"))) dirs.push(path);
  }
  return dirs;
}

async function hashDir(root: string): Promise<string> {
  const hash = createHash("sha256");
  async function walk(dir: string): Promise<void> {
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const path = join(dir, entry.name);
      const rel = relative(root, path).replace(/\\/g, "/");
      if (entry.isDirectory()) await walk(path);
      else if (entry.isFile()) hash.update(rel).update("\0").update(await readFile(path)).update("\xff");
    }
  }
  await walk(root);
  return hash.digest("hex");
}

export async function scanWorkbench(opts: { homedir: string; projectDir?: string; libraryPath: string }) {
  const agents = await Promise.all(KNOWN_AGENTS.map(async (agent) => {
    const roots = [
      ...agent.globalRoots.map((root) => ({ scope: "global" as const, path: join(opts.homedir, root) })),
      ...(opts.projectDir ? agent.projectRoots.map((root) => ({ scope: "project" as const, path: join(opts.projectDir!, root) })) : []),
    ];
    const installed = (await Promise.all([...roots.map((r) => exists(r.path)), ...agent.signals.map((p) => exists(join(opts.homedir, p)))])).some(Boolean);
    return { ...agent, installed, roots };
  }));

  const installations: Array<Record<string, unknown> & { slug: string; hash: string }> = [];
  for (const agent of agents) {
    for (const root of agent.roots) {
      for (const path of await skillDirs(root.path)) {
        const raw = await readFile(join(path, "SKILL.md"), "utf8");
        const { frontmatter } = parseSkillMarkdown(raw);
        const slug = basename(path);
        const link = await lstat(path).catch(() => null);
        installations.push({
          id: `${agent.id}:${root.scope}:${slug}`,
          slug,
          agentId: agent.id,
          agentLabel: agent.label,
          scope: root.scope,
          path,
          displayName: frontmatter.name?.trim() || slug,
          description: frontmatter.description ?? "",
          isSymlink: Boolean(link?.isSymbolicLink()),
          hash: await hashDir(path),
        });
      }
    }
  }

  const canonical = new Map<string, { path: string; hash: string }>();
  for (const path of await skillDirs(opts.libraryPath)) canonical.set(basename(path), { path, hash: await hashDir(path) });
  const slugs = new Set([...installations.map((item) => item.slug), ...canonical.keys()]);
  const skills = [...slugs].sort().map((slug) => {
    const rows = installations.filter((item) => item.slug === slug);
    const library = canonical.get(slug);
    const hashes = new Set([...rows.map((item) => item.hash), ...(library ? [library.hash] : [])]);
    return {
      id: slug,
      slug,
      displayName: String(rows[0]?.displayName ?? slug),
      description: String(rows[0]?.description ?? ""),
      canonicalPath: library?.path,
      canonicalStatus: library ? "managed" : "external",
      installations: rows,
      conflict: hashes.size > 1,
      issues: hashes.size > 1 ? [{ code: "content-conflict", severity: "warning", message: "同名 Skill 存在不同内容" }] : [],
    };
  });
  return { agents, skills, libraryPath: opts.libraryPath, scannedAt: new Date().toISOString() };
}

function targetRoot(agent: AgentDefinition, target: z.infer<typeof WorkbenchPreviewSchema>["targets"][number], homedir: string): string | undefined {
  const root = target.scope === "global" ? agent.globalRoots[0] : agent.projectRoots[0];
  if (!root) return undefined;
  return join(target.scope === "global" ? homedir : resolve(target.projectPath ?? ""), root);
}

export async function buildSyncPlan(input: z.infer<typeof WorkbenchPreviewSchema>, homedir: string): Promise<SyncPlan> {
  const data = WorkbenchPreviewSchema.parse(input);
  const planId = randomUUID();
  const backupRoot = join(homedir, ".config", "skill-manager", "backups", planId);
  const operations: SyncOperation[] = [];
  const blockedConflicts: string[] = [];

  for (const source of data.sources) {
    if (!await exists(join(source.path, "SKILL.md"))) {
      blockedConflicts.push(`${source.slug}: source SKILL.md does not exist`);
      continue;
    }
    let sourcePath = resolve(source.path);
    const sourceHash = await hashDir(sourcePath);
    if (data.mode === "managed") {
      const libraryTarget = resolve(data.libraryPath, source.slug);
      if (sourcePath !== libraryTarget) {
        const same = await exists(libraryTarget) && sourceHash === await hashDir(libraryTarget);
        if (!same && await exists(libraryTarget)) {
          blockedConflicts.push(`${source.slug}: central library contains different content`);
          continue;
        }
        if (!same) operations.push({ id: randomUUID(), type: "copy", sourcePath, targetPath: libraryTarget, message: `导入 ${source.slug} 到中心库` });
        sourcePath = libraryTarget;
      }
    }
    for (const target of data.targets) {
      const agent = KNOWN_AGENTS.find((item) => item.id === target.agentId);
      if (!agent) { blockedConflicts.push(`Unknown agent: ${target.agentId}`); continue; }
      if (target.scope === "project" && !target.projectPath) { blockedConflicts.push(`${agent.label}: project path is required`); continue; }
      const root = targetRoot(agent, target, homedir);
      if (!root) { blockedConflicts.push(`${agent.label}: no ${target.scope} skill root`); continue; }
      const targetPath = resolve(root, source.slug);
      if (targetPath === sourcePath) {
        operations.push({ id: randomUUID(), type: "noop", sourcePath, targetPath, message: `${source.slug} 已在 ${agent.label}` });
        continue;
      }
      const targetExists = await exists(targetPath) || Boolean(await lstat(targetPath).catch(() => null));
      if (targetExists && await exists(targetPath) && sourceHash === await hashDir(targetPath)) {
        operations.push({ id: randomUUID(), type: "noop", sourcePath, targetPath, message: `${agent.label} 已是相同内容` });
        continue;
      }
      operations.push({
        id: randomUUID(),
        type: data.method,
        sourcePath,
        targetPath,
        backupPath: targetExists ? join(backupRoot, agent.id, source.slug) : undefined,
        message: `${data.method === "copy" ? "复制" : "链接"} ${source.slug} 到 ${agent.label}`,
      });
    }
  }
  const plan: SyncPlan = { planId, riskLevel: operations.some((op) => op.backupPath) ? "medium" : "low", operations, blockedConflicts, createdAt: new Date().toISOString() };
  plans.set(planId, plan);
  return plan;
}

export async function applySyncPlan(planId: string) {
  const plan = plans.get(planId);
  if (!plan) throw new Error("Sync plan expired or does not exist");
  if (plan.blockedConflicts.length) throw new Error("Blocked sync plan cannot be applied");
  const applied: string[] = [];
  for (const op of plan.operations) {
    if (op.type === "noop") continue;
    if (op.backupPath) {
      await mkdir(resolve(op.backupPath, ".."), { recursive: true });
      await rename(op.targetPath, op.backupPath);
    }
    await mkdir(resolve(op.targetPath, ".."), { recursive: true });
    if (op.type === "copy") await cp(op.sourcePath, op.targetPath, { recursive: true, errorOnExist: true });
    else await symlink(op.sourcePath, op.targetPath, "dir");
    applied.push(op.id);
  }
  plans.delete(planId);
  return { planId, appliedOperations: applied, errors: [], inventoryRefreshRecommended: true };
}
