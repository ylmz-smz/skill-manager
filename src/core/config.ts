import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { load as yamlLoad } from "js-yaml";
import { configRoot } from "../utils/paths.js";
import { pathExists } from "../utils/fs.js";
import type { ControlStrategy } from "../types.js";

export interface SkillManagerConfig {
  version: 1;
  scan: {
    extraSkillRoots: string[];
    extraAgentRoots: string[];
  };
  defaults: {
    strategy: ControlStrategy;
  };
  mcp: {
    readOnly: boolean;
  };
}

export const DEFAULT_CONFIG: SkillManagerConfig = {
  version: 1,
  scan: {
    extraSkillRoots: [],
    extraAgentRoots: [],
  },
  defaults: {
    strategy: "auto",
  },
  mcp: {
    readOnly: true,
  },
};

export function globalConfigPath(homedir: string): string {
  return join(configRoot(homedir), "config.yaml");
}

export function projectConfigPath(projectDir: string): string {
  return join(resolve(projectDir), "skill-manager.yaml");
}

function isStringArray(v: unknown): v is string[] {
  return Array.isArray(v) && v.every((x) => typeof x === "string");
}

function expandHome(p: string, homedir: string): string {
  const t = p.trim();
  if (t === "~") return homedir;
  if (t.startsWith("~/")) return join(homedir, t.slice(2));
  return t;
}

function normalizeRoots(roots: string[], homedir: string): string[] {
  const out: string[] = [];
  for (const r of roots) {
    const e = expandHome(r, homedir);
    out.push(resolve(e));
  }
  return [...new Set(out)];
}

export function validateConfigShape(raw: unknown): SkillManagerConfig {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("config must be an object");
  }
  const o = raw as Record<string, unknown>;
  const version = o.version;
  if (version !== 1) throw new Error("config.version must be 1");

  const scan = (o.scan ?? {}) as Record<string, unknown>;
  const defaults = (o.defaults ?? {}) as Record<string, unknown>;
  const mcp = (o.mcp ?? {}) as Record<string, unknown>;

  const extraSkillRoots = isStringArray(scan.extraSkillRoots)
    ? scan.extraSkillRoots
    : [];
  const extraAgentRoots = isStringArray(scan.extraAgentRoots)
    ? scan.extraAgentRoots
    : [];

  const strategy =
    defaults.strategy === "auto" ||
    defaults.strategy === "native" ||
    defaults.strategy === "managed"
      ? defaults.strategy
      : "auto";

  const readOnly =
    typeof mcp.readOnly === "boolean" ? mcp.readOnly : DEFAULT_CONFIG.mcp.readOnly;

  return {
    version: 1,
    scan: { extraSkillRoots, extraAgentRoots },
    defaults: { strategy },
    mcp: { readOnly },
  };
}

async function readYamlIfExists(path: string): Promise<unknown | undefined> {
  if (!(await pathExists(path))) return undefined;
  const raw = await readFile(path, "utf8");
  return yamlLoad(raw);
}

export async function loadConfig(opts: {
  homedir: string;
  projectDir?: string;
}): Promise<{ config: SkillManagerConfig; sources: string[] }> {
  const { homedir, projectDir } = opts;
  const sources: string[] = [];

  let merged: SkillManagerConfig = { ...DEFAULT_CONFIG };

  const gPath = globalConfigPath(homedir);
  const g = await readYamlIfExists(gPath);
  if (g !== undefined) {
    sources.push(gPath);
    const c = validateConfigShape(g);
    merged = {
      ...merged,
      defaults: { ...merged.defaults, ...c.defaults },
      mcp: { ...merged.mcp, ...c.mcp },
      scan: {
        extraSkillRoots: [...merged.scan.extraSkillRoots, ...c.scan.extraSkillRoots],
        extraAgentRoots: [...merged.scan.extraAgentRoots, ...c.scan.extraAgentRoots],
      },
    };
  }

  if (projectDir) {
    const pPath = projectConfigPath(projectDir);
    const p = await readYamlIfExists(pPath);
    if (p !== undefined) {
      sources.push(pPath);
      const c = validateConfigShape(p);
      merged = {
        ...merged,
        defaults: { ...merged.defaults, ...c.defaults },
        mcp: { ...merged.mcp, ...c.mcp },
        scan: {
          extraSkillRoots: [...merged.scan.extraSkillRoots, ...c.scan.extraSkillRoots],
          extraAgentRoots: [...merged.scan.extraAgentRoots, ...c.scan.extraAgentRoots],
        },
      };
    }
  }

  merged = {
    ...merged,
    scan: {
      extraSkillRoots: normalizeRoots(merged.scan.extraSkillRoots, homedir),
      extraAgentRoots: normalizeRoots(merged.scan.extraAgentRoots, homedir),
    },
  };

  return { config: merged, sources };
}

