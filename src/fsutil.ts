import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";

const SKIP = new Set(["node_modules", ".git", "dist"]);

export async function pathExists(p: string): Promise<boolean> {
  try {
    await stat(p);
    return true;
  } catch {
    return false;
  }
}

export async function readTextIfExists(p: string): Promise<string | undefined> {
  try {
    return await readFile(p, "utf8");
  } catch {
    return undefined;
  }
}

async function isEntryDir(entry: import("node:fs").Dirent, full: string): Promise<boolean> {
  if (entry.isDirectory()) return true;
  if (entry.isSymbolicLink()) {
    try { return (await stat(full)).isDirectory(); } catch { return false; }
  }
  return false;
}

/** Immediate subdirs of root that contain SKILL.md */
export async function listSkillDirsFlat(root: string): Promise<string[]> {
  if (!(await pathExists(root))) return [];
  const out: string[] = [];
  const entries = await readdir(root, { withFileTypes: true });
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const dir = join(root, e.name);
    if (!(await isEntryDir(e, dir))) continue;
    if (await pathExists(join(dir, "SKILL.md"))) out.push(dir);
  }
  return out;
}

/** Recursive SKILL.md discovery under root, max depth from root */
export async function findSkillMdUnder(
  root: string,
  maxDepth: number,
  depth = 0,
): Promise<string[]> {
  if (depth > maxDepth || !(await pathExists(root))) return [];
  const out: string[] = [];
  let entries: import("node:fs").Dirent[];
  try {
    entries = await readdir(root, { withFileTypes: true });
  } catch {
    return [];
  }
  for (const e of entries) {
    if (SKIP.has(e.name)) continue;
    const full = join(root, e.name);
    if ((e.isFile() || e.isSymbolicLink()) && e.name === "SKILL.md") {
      out.push(full);
    } else if (await isEntryDir(e, full)) {
      out.push(...(await findSkillMdUnder(full, maxDepth, depth + 1)));
    }
  }
  return out;
}
