import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { McpServerRecord, McpToolId } from "../types.js";
import { parseJsonObject, stableJsonStringify } from "../utils/json.js";
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

