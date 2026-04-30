import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { URL } from "node:url";
import { resolve } from "node:path";
import { lstat } from "node:fs/promises";
import { detectConfigFiles, loadConfig, saveConfigFile, validateConfigShape } from "../core/config.js";
import { listSkills, sortSkills } from "../core/list.js";
import { listSubagents, sortSubagents } from "../core/subagents.js";
import { listMcpServers, sortMcpServers } from "../core/mcp.js";
import { loadState } from "../core/state.js";
import { pickRecord, disableSkill, enableSkill } from "../core/control.js";
import { pickSubagentRecord, disableSubagent, enableSubagent } from "../core/subagents-control.js";
import { pickMcpRecord, disableMcpServer, disableMcpServerSymlink, enableMcpServer, enableMcpServerSymlink } from "../core/mcp-control.js";
import { WEBAPP_HTML } from "./webapp.js";
import { lookupDescriptionI18n } from "./description-catalog.js";
import type { McpToolId, SubagentToolId, ToolId } from "../types.js";

function isSelected(select: string[] | undefined, tool: string, id: string): boolean {
  if (!select || select.length === 0) return false;
  return select.includes(`${tool}:${id}`);
}

function selectedIdsForTool(select: string[] | undefined, tool: string): string[] {
  if (!select || select.length === 0) return [];
  const out: string[] = [];
  for (const s of select) {
    const i = s.indexOf(":");
    if (i <= 0) continue;
    const t = s.slice(0, i);
    const id = s.slice(i + 1);
    if (t === tool && id) out.push(id);
  }
  return out;
}

function mcpEnabledSymlinkPath(unifiedRoot: string, tool: string, id: string): string {
  const safe = `${(id || "_empty").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 240) || "_empty"}.json`;
  return resolve(unifiedRoot, "enabled", tool, safe);
}

async function isSymlink(p: string): Promise<boolean> {
  const st = await lstat(p).catch(() => null);
  return Boolean(st && st.isSymbolicLink());
}

function json(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data, null, 2);
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(body);
}

function text(res: ServerResponse, status: number, body: string, contentType = "text/plain; charset=utf-8"): void {
  res.statusCode = status;
  res.setHeader("content-type", contentType);
  res.setHeader("cache-control", "no-store");
  res.end(body);
}

function notFound(res: ServerResponse): void {
  text(res, 404, "Not found");
}

function asToolId(v: unknown): ToolId {
  if (v === "claude-code" || v === "cursor" || v === "vscode" || v === "codebuddy" || v === "agents" || v === "codex") {
    return v;
  }
  throw new Error("Invalid tool");
}

function asSubagentToolId(v: unknown): SubagentToolId {
  if (v === "cursor" || v === "claude-code" || v === "codex") return v;
  throw new Error("Invalid subagent tool");
}

function asMcpToolId(v: unknown): McpToolId {
  if (v === "cursor" || v === "claude-code") return v;
  throw new Error("Invalid mcp tool");
}

async function readJsonBody(req: IncomingMessage, limitBytes = 1024 * 64): Promise<unknown> {
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of req) {
    const b = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += b.length;
    if (total > limitBytes) throw new Error("Request body too large");
    chunks.push(b);
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw) as unknown;
}

function methodNotAllowed(res: ServerResponse): void {
  res.statusCode = 405;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.end(JSON.stringify({ error: "Method not allowed" }));
}

async function handleApi(req: IncomingMessage, res: ServerResponse, homedir: string, projectDir?: string): Promise<boolean> {
  if (!req.url) return false;
  const u = new URL(req.url, "http://127.0.0.1");
  if (!u.pathname.startsWith("/api/")) return false;

  const { config, sources } = await loadConfig({ homedir, projectDir });
  const state = await loadState(homedir);

  // --- Mutations (POST) ---
  if (req.method === "POST") {
    const body = (await readJsonBody(req)) as any;

    if (u.pathname === "/api/v1/skills/disable" || u.pathname === "/api/v1/skills/enable") {
      const action = u.pathname.endsWith("/disable") ? "disable" : "enable";
      if (!body || typeof body !== "object") throw new Error("Invalid body");
      const tool = asToolId(body.tool);
      const id = body.id;
      const path = body.path;
      let strategy = typeof body.strategy === "string" ? body.strategy : config.defaults.strategy;
      const globalSettings = Boolean(body.globalSettings);
      const force = Boolean(body.force);
      if (typeof id !== "string") throw new Error("id required");
      if (action === "disable" && !force) throw new Error("Refusing to disable without force confirmation");

      const rows = await listSkills({
        homedir,
        projectDir,
        tool,
        state,
        extraSkillRoots: config.scan.extraSkillRoots,
      });
      const record = pickRecord(rows, tool, id, typeof path === "string" ? path : undefined);
      const unifiedSkillsRoot = config.unified?.roots?.skills;
      if (isSelected(config.unified?.select?.skills, tool, id) && unifiedSkillsRoot) {
        strategy = "symlink";
      }
      if (action === "disable") {
        await disableSkill({
          homedir,
          projectDir,
          record,
          strategy,
          dryRun: false,
          globalSettings,
          unifiedRoot: unifiedSkillsRoot,
        });
      } else {
        await enableSkill({
          homedir,
          projectDir,
          record,
          strategy,
          dryRun: false,
          globalSettings,
          unifiedRoot: unifiedSkillsRoot,
        });
      }
      return json(res, 200, { ok: true }), true;
    }

    if (u.pathname === "/api/v1/agents/disable" || u.pathname === "/api/v1/agents/enable") {
      const action = u.pathname.endsWith("/disable") ? "disable" : "enable";
      const tool = asSubagentToolId(body.tool);
      const id = body.id;
      const path = body.path;
      const force = Boolean(body.force);
      if (typeof id !== "string") throw new Error("id required");
      if (action === "disable" && !force) throw new Error("Refusing to disable without force confirmation");

      let rows = await listSubagents({
        homedir,
        projectDir,
        tool,
        state,
        extraRoots: { user: config.scan.extraAgentRoots },
      });
      rows = sortSubagents(rows);
      const record = pickSubagentRecord(rows, tool, id, typeof path === "string" ? path : undefined);
      const unifiedAgentsRoot = config.unified?.roots?.agents;
      const agentStrategy =
        isSelected(config.unified?.select?.agents, tool, id) && unifiedAgentsRoot ? "symlink" : "managed";
      if (action === "disable") {
        await disableSubagent({ homedir, record, dryRun: false, strategy: agentStrategy, unifiedRoot: unifiedAgentsRoot });
      } else {
        await enableSubagent({ homedir, record, dryRun: false, strategy: agentStrategy });
      }
      return json(res, 200, { ok: true }), true;
    }

    if (u.pathname === "/api/v1/mcp/disable" || u.pathname === "/api/v1/mcp/enable") {
      const action = u.pathname.endsWith("/disable") ? "disable" : "enable";
      const tool = asMcpToolId(body.tool);
      const id = body.id;
      const path = body.path;
      const force = Boolean(body.force);
      if (typeof id !== "string") throw new Error("id required");

      const unifiedRoot = config.unified?.roots?.mcp;
      const selectedIds = selectedIdsForTool(config.unified?.select?.mcp, tool);
      const useSymlink = Boolean(unifiedRoot && isSelected(config.unified?.select?.mcp, tool, id));

      const rows = await listMcpServers({ homedir, projectDir, tool });
      let record: any;
      try {
        record = pickMcpRecord(rows, tool, id, typeof path === "string" ? path : undefined);
      } catch (e) {
        // For symlink-managed enable, the server may not exist in config anymore; allow a synthetic record.
        if (useSymlink && action === "enable") {
          const configPath =
            typeof path === "string" && path.trim()
              ? path.trim()
              : tool === "cursor"
                ? resolve(homedir, ".cursor", "mcp.json")
                : projectDir
                  ? resolve(projectDir, ".mcp.json")
                  : resolve(homedir, ".claude.json");
          record = {
            tool,
            id,
            displayName: id,
            description: "",
            sourceKind: "user-global",
            path: configPath,
            transport: "unknown",
            envKeys: [],
            enabled: false,
            enabledSemantic: "managed",
            notes: "Synthetic record for symlink-managed enable.",
          };
        } else {
          throw e;
        }
      }

      if (record.tool === "claude-code" && record.path.endsWith(".claude.json") && !force) {
        throw new Error("Refusing to edit ~/.claude.json without force confirmation");
      }

      if (useSymlink) {
        if (action === "disable") {
          await disableMcpServerSymlink({
            homedir,
            record,
            readOnly: config.mcp.readOnly,
            apply: true,
            dryRun: false,
            unifiedRoot: unifiedRoot!,
            selectedIds,
          });
        } else {
          await enableMcpServerSymlink({
            homedir,
            record,
            readOnly: config.mcp.readOnly,
            apply: true,
            dryRun: false,
            unifiedRoot: unifiedRoot!,
            selectedIds,
          });
        }
      } else {
        if (action === "disable") {
          await disableMcpServer({
            homedir,
            record,
            readOnly: config.mcp.readOnly,
            apply: true,
            dryRun: false,
          });
        } else {
          await enableMcpServer({
            homedir,
            record,
            readOnly: config.mcp.readOnly,
            apply: true,
            dryRun: false,
          });
        }
      }
      return json(res, 200, { ok: true }), true;
    }

    if (u.pathname === "/api/v1/config/save") {
      if (!body || typeof body !== "object") throw new Error("Invalid body");
      const scope = body.scope === "project" ? "project" : body.scope === "global" ? "global" : null;
      if (!scope) throw new Error("scope must be 'global' or 'project'");
      const format = body.format === "json" ? "json" : body.format === "yaml" ? "yaml" : undefined;
      const rawConfig = body.config;
      const parsed =
        typeof rawConfig === "string"
          ? (JSON.parse(rawConfig) as unknown)
          : (rawConfig as unknown);
      const validated = validateConfigShape(parsed);
      const saved = await saveConfigFile({
        homedir,
        projectDir,
        scope,
        config: validated,
        format,
      });
      return json(res, 200, { ok: true, saved }), true;
    }

    return notFound(res), true;
  }

  if (req.method !== "GET" && req.method !== "HEAD") {
    return methodNotAllowed(res), true;
  }

  if (u.pathname === "/api/v1/skills") {
    const tool = "all";
    let rows = await listSkills({
      homedir,
      projectDir,
      tool,
      state,
      extraSkillRoots: config.scan.extraSkillRoots,
    });
    rows = sortSkills(rows);
    // Enrich missing zh/en descriptions via local catalog (non-breaking, optional).
    rows = rows.map((r) => {
      if (r.skillKind !== "markdown") return r;
      const existingZh = r.descriptionI18n?.zh?.trim();
      const existingEn = r.descriptionI18n?.en?.trim();
      if (existingZh && existingEn) return r;
      const cat = lookupDescriptionI18n(r.tool, r.id);
      if (!cat) return r;
      const merged = {
        ...(r.descriptionI18n ?? {}),
        zh: existingZh || cat.zh,
        en: existingEn || cat.en,
      };
      return { ...r, descriptionI18n: merged };
    });
    return json(res, 200, rows), true;
  }

  if (u.pathname === "/api/v1/agents") {
    const tool = "all";
    let rows = await listSubagents({
      homedir,
      projectDir,
      tool,
      state,
      extraRoots: { user: config.scan.extraAgentRoots },
    });
    rows = sortSubagents(rows);
    return json(res, 200, rows), true;
  }

  if (u.pathname === "/api/v1/mcp") {
    const tool = "all";
    let rows = await listMcpServers({ homedir, projectDir, tool });
    rows = sortMcpServers(rows);
    // Surface symlink-managed disabled servers (so users can re-enable in UI).
    const unifiedRoot = config.unified?.roots?.mcp;
    const select = config.unified?.select?.mcp;
    if (unifiedRoot && select && select.length) {
      const byKey = new Set(rows.map((r) => `${r.tool}:${r.id}`));
      for (const toolId of ["cursor", "claude-code"] as const) {
        const ids = selectedIdsForTool(select, toolId);
        for (const id of ids) {
          const key = `${toolId}:${id}`;
          if (byKey.has(key)) continue;
          const enabled = await isSymlink(mcpEnabledSymlinkPath(unifiedRoot, toolId, id));
          rows.push({
            tool: toolId,
            id,
            displayName: id,
            description: "",
            sourceKind: "user-global",
            path:
              toolId === "cursor"
                ? resolve(homedir, ".cursor", "mcp.json")
                : projectDir
                  ? resolve(projectDir, ".mcp.json")
                  : resolve(homedir, ".claude.json"),
            transport: "unknown",
            envKeys: [],
            enabled,
            enabledSemantic: "managed",
            notes: "Managed by skills-manager (symlink toggle).",
          });
        }
      }
      rows = sortMcpServers(rows);
    }
    return json(res, 200, rows), true;
  }

  if (u.pathname === "/api/v1/config") {
    const files = await detectConfigFiles({ homedir, projectDir });
    return json(res, 200, { config, projectDir: projectDir ?? null, sources, files }), true;
  }

  return notFound(res), true;
}

export async function startUiServer(opts: {
  homedir: string;
  projectDir?: string;
  port: number;
}): Promise<{ close: () => Promise<void> }> {
  const { homedir } = opts;
  const projectDir = opts.projectDir ? resolve(opts.projectDir) : undefined;
  const port = opts.port;

  const server = createServer(async (req, res) => {
    try {
      if (await handleApi(req, res, homedir, projectDir)) return;
      if (!req.url) return notFound(res);
      const u = new URL(req.url, "http://127.0.0.1");
      if (u.pathname === "/" || u.pathname === "/index.html") {
        return text(res, 200, WEBAPP_HTML, "text/html; charset=utf-8");
      }
      return notFound(res);
    } catch (err) {
      return json(res, 500, { error: err instanceof Error ? err.message : String(err) });
    }
  });

  await new Promise<void>((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, "127.0.0.1", () => resolveListen());
  });

  return {
    close: async () => {
      await new Promise<void>((resolveClose, rejectClose) => {
        server.close((e) => (e ? rejectClose(e) : resolveClose()));
      });
    },
  };
}

