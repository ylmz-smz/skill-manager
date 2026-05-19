import { readFile } from "node:fs/promises";
import { parseJsonObject, stableJsonStringify } from "../utils/json.js";
import { fromMcpServerResource } from "../domain/convert.js";
import {
  disableMcpServer as legacyDisableMcpServer,
  enableMcpServer as legacyEnableMcpServer,
} from "../core/mcp-control.js";
import { findMcpArchivedById, loadState } from "../core/state.js";
import type { McpServerRecord } from "../types.js";
import type { McpServerResource } from "../domain/types.js";
import { computeUnifiedDiff } from "./diff.js";
import { redact } from "./redact.js";
import type {
  ApplyOptions,
  DiffFile,
  DiffPreview,
  MutationPort,
  MutationResult,
  ResourceOp,
} from "./port.js";

export interface McpMutationPortConfig {
  homedir: string;
  readOnly?: boolean;
}

function buildPreview(files: DiffFile[], warnings: string[], envKeys: string[]): DiffPreview {
  const mergedKeys = new Set<string>();
  const redactedFiles: DiffFile[] = files.map((f) => {
    const beforeR = f.before != null ? redact(f.before, { envKeys }) : undefined;
    const afterR = f.after != null ? redact(f.after, { envKeys }) : undefined;
    if (beforeR) for (const k of beforeR.redactedKeys) mergedKeys.add(k);
    if (afterR) for (const k of afterR.redactedKeys) mergedKeys.add(k);
    return {
      ...f,
      before: beforeR?.redacted,
      after: afterR?.redacted,
    };
  });
  return {
    files: redactedFiles,
    unifiedDiff: computeUnifiedDiff(redactedFiles),
    redactedEnvKeys: [...mergedKeys].sort(),
    warnings,
  };
}

function getServersObject(j: Record<string, unknown>): Record<string, unknown> {
  const v = j.mcpServers;
  if (v && typeof v === "object" && !Array.isArray(v)) {
    return v as Record<string, unknown>;
  }
  return {};
}

async function readJsonFile(path: string): Promise<{
  raw: string;
  json: Record<string, unknown> | undefined;
}> {
  try {
    const raw = await readFile(path, "utf8");
    const json = parseJsonObject(raw) ?? undefined;
    return { raw, json };
  } catch {
    return { raw: "", json: undefined };
  }
}

async function previewDisable(
  homedir: string,
  target: McpServerResource,
): Promise<DiffPreview> {
  const { raw, json } = await readJsonFile(target.path);
  if (!json) {
    return buildPreview([], [`Cannot read MCP config: ${target.path}`], target.envKeys);
  }
  const servers = getServersObject(json);
  if (!(target.id in servers)) {
    return buildPreview([], [`Server '${target.id}' is not present in ${target.path} (already disabled).`], target.envKeys);
  }
  const next = { ...json, mcpServers: { ...servers } };
  delete (next.mcpServers as Record<string, unknown>)[target.id];
  const after = stableJsonStringify(next);
  const warnings: string[] = [];
  if (target.tool === "claude-code" && target.path.endsWith(".claude.json")) {
    warnings.push("Apply will create a timestamped .bak.<iso> backup of ~/.claude.json before writing.");
  }
  return buildPreview(
    [{ path: target.path, kind: "modify", before: raw, after }],
    warnings,
    target.envKeys,
  );
}

async function previewEnable(
  homedir: string,
  target: McpServerResource,
): Promise<DiffPreview> {
  const state = await loadState(homedir);
  const archived = findMcpArchivedById(state, target.tool, target.id, target.path);
  const { raw, json } = await readJsonFile(target.path);
  if (!json) {
    return buildPreview([], [`Cannot read MCP config: ${target.path}`], target.envKeys);
  }
  const servers = getServersObject(json);
  if (target.id in servers && !archived) {
    return buildPreview([], [`Server '${target.id}' is already present in ${target.path}.`], target.envKeys);
  }
  if (!archived) {
    return buildPreview([], [
      `No archived MCP server '${target.id}' for tool '${target.tool}' in state.json — apply() will fail.`,
    ], target.envKeys);
  }
  const next = {
    ...json,
    mcpServers: { ...servers, [target.id]: archived.server },
  };
  const after = stableJsonStringify(next);
  const warnings: string[] = [];
  if (target.tool === "claude-code" && target.path.endsWith(".claude.json")) {
    warnings.push("Apply will create a timestamped .bak.<iso> backup of ~/.claude.json before writing.");
  }
  return buildPreview(
    [{ path: target.path, kind: "modify", before: raw, after }],
    warnings,
    target.envKeys,
  );
}

export function createMcpMutationPort(
  cfg: McpMutationPortConfig,
): MutationPort<"mcp_server"> {
  return {
    kind: "mcp_server",
    async preview(target, op, _strategy) {
      return op === "disable"
        ? previewDisable(cfg.homedir, target)
        : previewEnable(cfg.homedir, target);
    },
    async apply(target, op, _strategy, opts) {
      if (opts.dryRun) {
        const p = await this.preview(target, op, _strategy);
        return { ok: true, applied: false, writtenPaths: [], warnings: p.warnings };
      }
      const record: McpServerRecord = fromMcpServerResource(target);
      try {
        if (op === "disable") {
          await legacyDisableMcpServer({
            homedir: cfg.homedir,
            record,
            readOnly: cfg.readOnly ?? false,
            apply: true,
            dryRun: false,
          });
        } else {
          await legacyEnableMcpServer({
            homedir: cfg.homedir,
            record,
            readOnly: cfg.readOnly ?? false,
            apply: true,
            dryRun: false,
          });
        }
        return {
          ok: true,
          applied: true,
          writtenPaths: [target.path],
          warnings: [],
        };
      } catch (e) {
        return {
          ok: false,
          applied: false,
          writtenPaths: [],
          warnings: [e instanceof Error ? e.message : String(e)],
        };
      }
    },
  };
}
