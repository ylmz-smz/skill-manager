import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import yaml from "js-yaml";
import { configRoot } from "../utils/paths.js";
import { pathExists } from "../utils/fs.js";
import type { ControlStrategy } from "../types.js";

type YamlApi = {
  load: (raw: string) => unknown;
  dump: (v: unknown, opts?: Record<string, unknown>) => string;
};

const yamlApi = yaml as unknown as YamlApi;

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
  unified?: {
    mode?: "symlink";
    roots?: {
      skills?: string;
      agents?: string;
      mcp?: string;
    };
    select?: {
      /** one per line in UI, stored as array: "<tool>:<id>" */
      skills?: string[];
      agents?: string[];
      mcp?: string[];
    };
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

export function globalConfigJsonPath(homedir: string): string {
  return join(configRoot(homedir), "config.json");
}

export function projectConfigPath(projectDir: string): string {
  return join(resolve(projectDir), "skill-manager.yaml");
}

export function projectConfigJsonPath(projectDir: string): string {
  return join(resolve(projectDir), "skill-manager.json");
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

function normalizeOptionalRoot(p: string | undefined, homedir: string): string | undefined {
  if (!p || !p.trim()) return undefined;
  return resolve(expandHome(p, homedir));
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
  const unified = (o.unified ?? {}) as Record<string, unknown>;

  const extraSkillRoots = isStringArray(scan.extraSkillRoots)
    ? scan.extraSkillRoots
    : [];
  const extraAgentRoots = isStringArray(scan.extraAgentRoots)
    ? scan.extraAgentRoots
    : [];

  const strategy =
    defaults.strategy === "auto" ||
    defaults.strategy === "native" ||
    defaults.strategy === "managed" ||
    defaults.strategy === "symlink"
      ? defaults.strategy
      : "auto";

  const readOnly =
    typeof mcp.readOnly === "boolean" ? mcp.readOnly : DEFAULT_CONFIG.mcp.readOnly;

  const unifiedMode =
    unified.mode === "symlink" ? "symlink" : undefined;
  const roots = (unified.roots ?? {}) as Record<string, unknown>;
  const select = (unified.select ?? {}) as Record<string, unknown>;
  const unifiedRoots = {
    skills: typeof roots.skills === "string" ? roots.skills : undefined,
    agents: typeof roots.agents === "string" ? roots.agents : undefined,
    mcp: typeof roots.mcp === "string" ? roots.mcp : undefined,
  };
  const unifiedSelect = {
    skills: isStringArray(select.skills) ? select.skills : undefined,
    agents: isStringArray(select.agents) ? select.agents : undefined,
    mcp: isStringArray(select.mcp) ? select.mcp : undefined,
  };
  const hasUnified =
    unifiedMode ||
    unifiedRoots.skills ||
    unifiedRoots.agents ||
    unifiedRoots.mcp ||
    (unifiedSelect.skills && unifiedSelect.skills.length) ||
    (unifiedSelect.agents && unifiedSelect.agents.length) ||
    (unifiedSelect.mcp && unifiedSelect.mcp.length);

  return {
    version: 1,
    scan: { extraSkillRoots, extraAgentRoots },
    defaults: { strategy },
    mcp: { readOnly },
    unified: hasUnified
      ? {
          mode: unifiedMode,
          roots: unifiedRoots,
          select: unifiedSelect,
        }
      : undefined,
  };
}

async function readYamlIfExists(path: string): Promise<unknown | undefined> {
  if (!(await pathExists(path))) return undefined;
  const raw = await readFile(path, "utf8");
  return yamlApi.load(raw);
}

async function readJsonIfExists(path: string): Promise<unknown | undefined> {
  if (!(await pathExists(path))) return undefined;
  const raw = await readFile(path, "utf8");
  return JSON.parse(raw) as unknown;
}

export async function loadConfig(opts: {
  homedir: string;
  projectDir?: string;
}): Promise<{ config: SkillManagerConfig; sources: string[] }> {
  const { homedir, projectDir } = opts;
  const sources: string[] = [];

  let merged: SkillManagerConfig = { ...DEFAULT_CONFIG };

  const gYamlPath = globalConfigPath(homedir);
  const gJsonPath = globalConfigJsonPath(homedir);
  const gYaml = await readYamlIfExists(gYamlPath);
  if (gYaml !== undefined) {
    sources.push(gYamlPath);
    const c = validateConfigShape(gYaml);
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
  const gJson = await readJsonIfExists(gJsonPath);
  if (gJson !== undefined) {
    sources.push(gJsonPath);
    const c = validateConfigShape(gJson);
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
    const pYamlPath = projectConfigPath(projectDir);
    const pJsonPath = projectConfigJsonPath(projectDir);
    const pYaml = await readYamlIfExists(pYamlPath);
    if (pYaml !== undefined) {
      sources.push(pYamlPath);
      const c = validateConfigShape(pYaml);
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
    const pJson = await readJsonIfExists(pJsonPath);
    if (pJson !== undefined) {
      sources.push(pJsonPath);
      const c = validateConfigShape(pJson);
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
    unified: merged.unified
      ? {
          ...merged.unified,
          roots: {
            skills: normalizeOptionalRoot(merged.unified.roots?.skills, homedir),
            agents: normalizeOptionalRoot(merged.unified.roots?.agents, homedir),
            mcp: normalizeOptionalRoot(merged.unified.roots?.mcp, homedir),
          },
        }
      : undefined,
  };

  return { config: merged, sources };
}

export type ConfigFileFormat = "yaml" | "json";

export async function detectConfigFiles(opts: {
  homedir: string;
  projectDir?: string;
}): Promise<{
  global: { yamlPath: string; jsonPath: string; exists: boolean; format: ConfigFileFormat | null };
  project: { yamlPath: string; jsonPath: string; exists: boolean; format: ConfigFileFormat | null } | null;
}> {
  const gYamlPath = globalConfigPath(opts.homedir);
  const gJsonPath = globalConfigJsonPath(opts.homedir);
  const gYamlExists = await pathExists(gYamlPath);
  const gJsonExists = await pathExists(gJsonPath);
  const gFormat: ConfigFileFormat | null = gYamlExists ? "yaml" : gJsonExists ? "json" : null;

  if (!opts.projectDir) {
    return {
      global: {
        yamlPath: gYamlPath,
        jsonPath: gJsonPath,
        exists: gYamlExists || gJsonExists,
        format: gFormat,
      },
      project: null,
    };
  }

  const pYamlPath = projectConfigPath(opts.projectDir);
  const pJsonPath = projectConfigJsonPath(opts.projectDir);
  const pYamlExists = await pathExists(pYamlPath);
  const pJsonExists = await pathExists(pJsonPath);
  const pFormat: ConfigFileFormat | null = pYamlExists ? "yaml" : pJsonExists ? "json" : null;

  return {
    global: {
      yamlPath: gYamlPath,
      jsonPath: gJsonPath,
      exists: gYamlExists || gJsonExists,
      format: gFormat,
    },
    project: {
      yamlPath: pYamlPath,
      jsonPath: pJsonPath,
      exists: pYamlExists || pJsonExists,
      format: pFormat,
    },
  };
}

function configToYamlString(c: SkillManagerConfig): string {
  // Keep output minimal and stable enough for humans.
  return yamlApi.dump(c, {
    lineWidth: 120,
    noRefs: true,
    sortKeys: false,
  }).trimEnd() + "\n";
}

export async function saveConfigFile(opts: {
  homedir: string;
  projectDir?: string;
  scope: "global" | "project";
  config: SkillManagerConfig;
  format?: ConfigFileFormat;
}): Promise<{ path: string; format: ConfigFileFormat }> {
  const detected = await detectConfigFiles({ homedir: opts.homedir, projectDir: opts.projectDir });
  const preferExisting = (scope: "global" | "project"): ConfigFileFormat => {
    if (scope === "global") return detected.global.format ?? "yaml";
    if (!detected.project) return "yaml";
    return detected.project.format ?? "yaml";
  };
  const format = opts.format ?? preferExisting(opts.scope);
  const projectDir = opts.projectDir;
  if (opts.scope === "project" && !projectDir) throw new Error("projectDir is required when saving project config");
  const path =
    opts.scope === "global"
      ? format === "json"
        ? detected.global.jsonPath
        : detected.global.yamlPath
      : format === "json"
        ? projectConfigJsonPath(projectDir!)
        : projectConfigPath(projectDir!);

  const body = format === "json" ? JSON.stringify(opts.config, null, 2).trimEnd() + "\n" : configToYamlString(opts.config);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, body, "utf8");
  return { path, format };
}

