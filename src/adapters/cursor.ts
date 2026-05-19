import { join } from "node:path";
import { readTextIfExists } from "../utils/fs.js";
import {
  createFlatSkillAdapter,
  type FlatSkillAdapter,
} from "../discovery/skill-flat-factory.js";
import type { SkillRecord, SourceKind } from "../types.js";

interface CursorManifest {
  builtinSkillIds?: string[];
  managedSkillIds?: string[];
}

function builtinManifestPath(homedir: string): string {
  return join(
    homedir,
    ".cursor",
    "skills-cursor",
    ".cursor-managed-skills-manifest.json",
  );
}

function builtinRecords(
  manifestPath: string,
  data: CursorManifest,
): SkillRecord[] {
  const ids = [
    ...(data.builtinSkillIds ?? []),
    ...(data.managedSkillIds ?? []),
  ];
  const uniq = [...new Set(ids)];
  return uniq.map((id) => ({
    tool: "cursor" as const,
    id,
    displayName: id,
    description: "",
    sourceKind: "cursor-builtin" as const,
    path: manifestPath,
    enabled: true,
    enabledSemantic: "native" as const,
    skillKind: "cursor-builtin" as const,
    notes:
      "Built-in or Cursor-managed skill. Toggle in Cursor: Settings → Rules / Skills (not modified by this CLI).",
  }));
}

async function scanBuiltinManifest(homedir: string): Promise<SkillRecord[]> {
  const manifestPath = builtinManifestPath(homedir);
  const raw = await readTextIfExists(manifestPath);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw) as CursorManifest;
    return builtinRecords(manifestPath, data);
  } catch {
    return [];
  }
}

export const cursorSkillAdapter: FlatSkillAdapter = createFlatSkillAdapter({
  tool: "cursor",
  userRoot: (h) => join(h, ".cursor", "skills"),
  projectRoot: (p) => join(p, ".cursor", "skills"),
  extraScan: scanBuiltinManifest,
});

/** @deprecated Use `cursorSkillAdapter.discover(...)` instead. */
export async function discoverCursorSkills(
  homedir: string,
  projectDir?: string,
  extraRoots?: Array<{ root: string; sourceKind: SourceKind }>,
): Promise<SkillRecord[]> {
  return cursorSkillAdapter.discover(homedir, projectDir, extraRoots);
}
