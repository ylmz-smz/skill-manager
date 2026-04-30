import { copyFile, lstat, mkdir, readFile, symlink, unlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import type { McpServerRecord, McpToolId } from "../types.js";
import { parseJsonObject, stableJsonStringify } from "../utils/json.js";
import { slugId } from "../utils/paths.js";
import {
  findMcpArchivedById,
  loadState,
  removeMcpArchived,
  saveState,
  upsertMcpArchived,
  type McpArchivedEntry,
} from "./state.js";

function ensureWritable(opts: { readOnly: boolean; apply: boolean }): void {
  if (opts.readOnly) {
    throw new Error(
      "MCP writes are disabled by config (mcp.readOnly=true). Set it to false to allow writes.",
    );
  }
  if (!opts.apply) {
    throw new Error("Refusing to write MCP config without --apply.");
  }
}

function getMcpServersRoot(j: Record<string, unknown>): Record<string, unknown> {
  const v = j.mcpServers;
  if (v && typeof v === "object" && !Array.isArray(v)) return v as Record<string, unknown>;
  const next: Record<string, unknown> = {};
  j.mcpServers = next;
  return next;
}

function managedPaths(unifiedRoot: string, tool: McpToolId, id: string): {
  serverPath: string;
  enabledPath: string;
} {
  const safe = `${slugId(id)}.json`;
  return {
    serverPath: join(unifiedRoot, "servers", tool, safe),
    enabledPath: join(unifiedRoot, "enabled", tool, safe),
  };
}

async function fileExists(p: string): Promise<boolean> {
  try {
    await lstat(p);
    return true;
  } catch {
    return false;
  }
}

async function unlinkIfSymlink(p: string): Promise<void> {
  const st = await lstat(p).catch(() => null);
  if (!st) return;
  if (!st.isSymbolicLink()) return;
  await unlink(p);
}

async function loadServerFile(serverPath: string): Promise<unknown> {
  const raw = await readFile(serverPath, "utf8");
  const j = parseJsonObject(raw);
  if (!j) throw new Error(`Invalid MCP server JSON: ${serverPath}`);
  return j;
}

async function writeServerFile(serverPath: string, server: unknown): Promise<void> {
  if (!server || typeof server !== "object" || Array.isArray(server)) {
    throw new Error("MCP server must be an object");
  }
  await mkdir(dirname(serverPath), { recursive: true });
  await writeFile(serverPath, stableJsonStringify(server), "utf8");
}

async function rewriteConfigByEnabledSymlinks(opts: {
  configPath: string;
  tool: McpToolId;
  unifiedRoot: string;
  selectedIds: string[];
  apply: boolean;
  dryRun: boolean;
}): Promise<void> {
  const { configPath, tool, unifiedRoot, selectedIds, apply, dryRun } = opts;
  if (!apply) throw new Error("Refusing to write MCP config without --apply.");

  const raw = await readFile(configPath, "utf8");
  const j = parseJsonObject(raw);
  if (!j) throw new Error(`Invalid JSON: ${configPath}`);
  const servers = getMcpServersRoot(j);

  const selected = new Set(selectedIds);
  const unmanaged: Record<string, unknown> = {};
  for (const [id, v] of Object.entries(servers)) {
    if (!selected.has(id)) unmanaged[id] = v;
  }

  const managedEnabled: Record<string, unknown> = {};
  for (const id of selectedIds) {
    const { serverPath, enabledPath } = managedPaths(unifiedRoot, tool, id);
    const enabled = await fileExists(enabledPath);
    if (!enabled) continue;
    if (!(await fileExists(serverPath))) {
      throw new Error(`Enabled symlink exists but server file missing: ${serverPath}`);
    }
    managedEnabled[id] = await loadServerFile(serverPath);
  }

  j.mcpServers = { ...unmanaged, ...managedEnabled };

  if (!dryRun) {
    await backupIfSensitive(tool, configPath, apply);
    await mkdir(dirname(configPath), { recursive: true });
    await writeFile(configPath, stableJsonStringify(j), "utf8");
  }
}

async function backupIfSensitive(tool: McpToolId, configPath: string, apply: boolean): Promise<void> {
  // Claude ~/.claude.json contains auth/state. Always backup before write.
  if (!apply) return;
  if (tool !== "claude-code") return;
  if (!configPath.endsWith(".claude.json")) return;
  const bak = `${configPath}.bak.${new Date().toISOString().replace(/[:.]/g, "-")}`;
  await copyFile(configPath, bak);
}

export function pickMcpRecord(
  records: McpServerRecord[],
  tool: McpToolId,
  id: string,
  pathFilter?: string,
): McpServerRecord {
  let m = records.filter((r) => r.tool === tool && r.id === id);
  if (pathFilter) {
    const norm = pathFilter.replace(/\\/g, "/");
    m = m.filter((r) => r.path.replace(/\\/g, "/") === norm);
  }
  if (m.length === 1) return m[0]!;
  if (m.length === 0) {
    throw new Error(`No MCP server '${id}' for tool '${tool}'. Run: skills-manager mcp ${tool}`);
  }
  throw new Error(
    `Ambiguous id '${id}'. Pass --path with the exact config file. Candidates:\n${m
      .map((r) => `  ${r.path}`)
      .join("\n")}`,
  );
}

export async function disableMcpServer(opts: {
  homedir: string;
  record: McpServerRecord;
  readOnly: boolean;
  apply: boolean;
  dryRun: boolean;
}): Promise<void> {
  const { homedir, record, readOnly, apply, dryRun } = opts;
  ensureWritable({ readOnly, apply });

  const state = await loadState(homedir);
  const existing = findMcpArchivedById(state, record.tool, record.id, record.path);
  if (existing) return;

  const raw = await readFile(record.path, "utf8");
  const j = parseJsonObject(raw);
  if (!j) throw new Error(`Invalid JSON: ${record.path}`);
  const servers = getMcpServersRoot(j);
  if (!(record.id in servers)) {
    // already absent; nothing to do
    return;
  }

  const entry: McpArchivedEntry = {
    tool: record.tool,
    id: record.id,
    configPath: record.path,
    sourceKind: record.sourceKind,
    archivedAt: new Date().toISOString(),
    server: servers[record.id],
  };

  delete servers[record.id];

  if (!dryRun) {
    await backupIfSensitive(record.tool, record.path, apply);
    await mkdir(dirname(record.path), { recursive: true });
    await writeFile(record.path, stableJsonStringify(j), "utf8");
    await saveState(homedir, upsertMcpArchived(state, entry), false);
  }
}

export async function enableMcpServer(opts: {
  homedir: string;
  record: McpServerRecord;
  readOnly: boolean;
  apply: boolean;
  dryRun: boolean;
}): Promise<void> {
  const { homedir, record, readOnly, apply, dryRun } = opts;
  ensureWritable({ readOnly, apply });

  const state = await loadState(homedir);
  const archived = findMcpArchivedById(state, record.tool, record.id, record.path);
  if (!archived) {
    throw new Error(
      "No archived MCP server found in state. Disable it via skills-manager first, then enable to restore.",
    );
  }

  const raw = await readFile(record.path, "utf8");
  const j = parseJsonObject(raw);
  if (!j) throw new Error(`Invalid JSON: ${record.path}`);
  const servers = getMcpServersRoot(j);
  if (record.id in servers) {
    // already present; clean state entry
    if (!dryRun) {
      await saveState(homedir, removeMcpArchived(state, record.tool, record.id, record.path), false);
    }
    return;
  }

  servers[record.id] = archived.server;

  if (!dryRun) {
    await backupIfSensitive(record.tool, record.path, apply);
    await mkdir(dirname(record.path), { recursive: true });
    await writeFile(record.path, stableJsonStringify(j), "utf8");
    await saveState(homedir, removeMcpArchived(state, record.tool, record.id, record.path), false);
  }
}

export async function disableMcpServerSymlink(opts: {
  homedir: string;
  record: McpServerRecord;
  readOnly: boolean;
  apply: boolean;
  dryRun: boolean;
  unifiedRoot: string;
  selectedIds: string[];
}): Promise<void> {
  const { homedir, record, readOnly, apply, dryRun, unifiedRoot, selectedIds } = opts;
  ensureWritable({ readOnly, apply });

  // Snapshot server object into unified store (servers/<tool>/<id>.json)
  const raw = await readFile(record.path, "utf8");
  const j = parseJsonObject(raw);
  if (!j) throw new Error(`Invalid JSON: ${record.path}`);
  const servers = getMcpServersRoot(j);
  if (!(record.id in servers)) {
    // already absent; still make sure config is consistent with enabled symlinks
    await rewriteConfigByEnabledSymlinks({
      configPath: record.path,
      tool: record.tool,
      unifiedRoot,
      selectedIds,
      apply,
      dryRun,
    });
    return;
  }

  const { serverPath, enabledPath } = managedPaths(unifiedRoot, record.tool, record.id);
  if (!dryRun) {
    await writeServerFile(serverPath, servers[record.id]);
    await unlinkIfSymlink(enabledPath);
  }

  // Remove from config and then rewrite based on enabled symlinks.
  delete servers[record.id];
  if (!dryRun) {
    await backupIfSensitive(record.tool, record.path, apply);
    await mkdir(dirname(record.path), { recursive: true });
    await writeFile(record.path, stableJsonStringify(j), "utf8");
  }

  await rewriteConfigByEnabledSymlinks({
    configPath: record.path,
    tool: record.tool,
    unifiedRoot,
    selectedIds,
    apply,
    dryRun,
  });

  // Keep legacy state stash untouched; symlink strategy does not use mcpArchived.
  // (We intentionally don't write to state to avoid mixing semantics.)
  await loadState(homedir); // ensure state file is readable (no-op)
}

export async function enableMcpServerSymlink(opts: {
  homedir: string;
  record: McpServerRecord;
  readOnly: boolean;
  apply: boolean;
  dryRun: boolean;
  unifiedRoot: string;
  selectedIds: string[];
}): Promise<void> {
  const { record, readOnly, apply, dryRun, unifiedRoot, selectedIds } = opts;
  ensureWritable({ readOnly, apply });

  const { serverPath, enabledPath } = managedPaths(unifiedRoot, record.tool, record.id);
  if (!(await fileExists(serverPath))) {
    throw new Error(`Managed MCP server file missing: ${serverPath}. Disable first to capture it.`);
  }

  if (!dryRun) {
    await mkdir(dirname(enabledPath), { recursive: true });
    // enabledPath is a symlink to serverPath
    const st = await lstat(enabledPath).catch(() => null);
    if (st) {
      if (st.isSymbolicLink()) await unlink(enabledPath);
      else throw new Error(`Enabled path exists and is not a symlink: ${enabledPath}`);
    }
    await symlink(serverPath, enabledPath, "file");
  }

  await rewriteConfigByEnabledSymlinks({
    configPath: record.path,
    tool: record.tool,
    unifiedRoot,
    selectedIds,
    apply,
    dryRun,
  });
}

