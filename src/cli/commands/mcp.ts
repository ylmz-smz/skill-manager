import type { Command } from "commander";
import { resolve } from "node:path";
import { loadConfig } from "../../core/config.js";
import { listMcpServers, sortMcpServers } from "../../core/mcp.js";
import { disableMcpServer, disableMcpServerSymlink, enableMcpServer, enableMcpServerSymlink, pickMcpRecord } from "../../core/mcp-control.js";
import { formatMcpListTable } from "../../ui/format.js";
import { parseMcpTool } from "../helpers.js";
import { lstat } from "node:fs/promises";

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

async function isSymlink(p: string): Promise<boolean> {
  const st = await lstat(p).catch(() => null);
  return Boolean(st && st.isSymbolicLink());
}

function mcpEnabledSymlinkPath(unifiedRoot: string, tool: string, id: string): string {
  const safe = `${(id || "_empty").replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 240) || "_empty"}.json`;
  return resolve(unifiedRoot, "enabled", tool, safe);
}

function inferMcpConfigPath(tool: "cursor" | "claude-code", homedir: string, projectDir?: string): string {
  if (tool === "cursor") {
    return projectDir ? resolve(projectDir, ".cursor", "mcp.json") : resolve(homedir, ".cursor", "mcp.json");
  }
  return projectDir ? resolve(projectDir, ".mcp.json") : resolve(homedir, ".claude.json");
}

export function registerMcpCommands(program: Command): void {
  const mcpCmd = program
    .command("mcp [toolArg]")
    .description("List discovered MCP servers (read-only by default)")
    .option("-t, --tool <id>", "cursor | claude-code | all", "all")
    .option("--project <dir>", "Project root for project-scoped MCP (.cursor/mcp.json, .mcp.json)")
    .option("--json", "Print JSON (machine-readable)")
    .action(async (toolArg: string | undefined, opts: any) => {
      const homedir = process.env.HOME || process.env.USERPROFILE || "";
      if (!homedir) throw new Error("Could not resolve home directory");
      const projectDir = opts.project ? resolve(opts.project) : undefined;
      const { config } = await loadConfig({ homedir, projectDir });
      const rawTool = toolArg ?? opts.tool;
      const tool = parseMcpTool(rawTool);

      let rows = await listMcpServers({ homedir, projectDir, tool });
      rows = sortMcpServers(rows);
      // Surface symlink-managed disabled servers.
      const unifiedRoot = config.unified?.roots?.mcp;
      const select = config.unified?.select?.mcp;
      if (unifiedRoot && select && select.length) {
        const byKey = new Set(rows.map((r) => `${r.tool}:${r.id}`));
        const toolIds = tool === "all" ? (["cursor", "claude-code"] as const) : ([tool] as const);
        for (const toolId of toolIds) {
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
              path: toolId === "cursor"
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
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
        return;
      }
      const termWidth = process.stdout.columns ?? 96;
      process.stdout.write(formatMcpListTable(rows, homedir, termWidth));
    });

  mcpCmd
    .command("disable")
    .description("Disable an MCP server (remove from config + stash into state). Requires --apply.")
    .requiredOption("--tool <id>", "cursor | claude-code")
    .argument("<server-id>", "Server id from mcp list")
    .option("--project <dir>", "Project root")
    .option("--path <file>", "Exact config file if id is ambiguous")
    .option("--dry-run", "Print actions without writing")
    .option("--apply", "Actually write files")
    .option("--force", "Confirm risky edits (required for some locations)")
    .action(async (serverId: string, opts: any) => {
      const homedir = process.env.HOME || process.env.USERPROFILE || "";
      if (!homedir) throw new Error("Could not resolve home directory");
      const tool = parseMcpTool(opts.tool);
      if (tool === "all") throw new Error("--tool cannot be 'all' for mcp disable");
      const projectDir = opts.project ? resolve(opts.project) : undefined;
      const { config } = await loadConfig({ homedir, projectDir });
      const rows = await listMcpServers({ homedir, projectDir, tool });
      const unifiedRoot = config.unified?.roots?.mcp;
      const selectedIds = selectedIdsForTool(config.unified?.select?.mcp, tool);
      const useSymlink = Boolean(unifiedRoot && (config.unified?.select?.mcp ?? []).includes(`${tool}:${serverId}`));
      let record: any;
      try {
        record = pickMcpRecord(rows, tool, serverId, opts.path);
      } catch (e) {
        if (useSymlink) {
          // For symlink-managed disable we MUST read server object from config, so we cannot proceed.
          throw e;
        }
        throw e;
      }

      if (record.tool === "claude-code" && record.path.endsWith(".claude.json") && !opts.force) {
        throw new Error("Refusing to edit ~/.claude.json without --force.");
      }

      if (useSymlink) {
        await disableMcpServerSymlink({
          homedir,
          record,
          readOnly: config.mcp.readOnly,
          apply: Boolean(opts.apply),
          dryRun: Boolean(opts.dryRun),
          unifiedRoot: unifiedRoot!,
          selectedIds,
        });
      } else {
        await disableMcpServer({
          homedir,
          record,
          readOnly: config.mcp.readOnly,
          apply: Boolean(opts.apply),
          dryRun: Boolean(opts.dryRun),
        });
      }
      process.stdout.write(opts.dryRun ? "[dry-run] disable complete\n" : "disabled\n");
    });

  mcpCmd
    .command("enable")
    .description("Enable an MCP server (restore from state stash). Requires --apply.")
    .requiredOption("--tool <id>", "cursor | claude-code")
    .argument("<server-id>", "Server id from mcp list")
    .option("--project <dir>", "Project root")
    .option("--path <file>", "Exact config file if id is ambiguous")
    .option("--dry-run", "Print actions without writing")
    .option("--apply", "Actually write files")
    .option("--force", "Confirm risky edits (required for some locations)")
    .action(async (serverId: string, opts: any) => {
      const homedir = process.env.HOME || process.env.USERPROFILE || "";
      if (!homedir) throw new Error("Could not resolve home directory");
      const tool = parseMcpTool(opts.tool);
      if (tool === "all") throw new Error("--tool cannot be 'all' for mcp enable");
      const projectDir = opts.project ? resolve(opts.project) : undefined;
      const { config } = await loadConfig({ homedir, projectDir });
      const rows = await listMcpServers({ homedir, projectDir, tool });
      const unifiedRoot = config.unified?.roots?.mcp;
      const selectedIds = selectedIdsForTool(config.unified?.select?.mcp, tool);
      const useSymlink = Boolean(unifiedRoot && (config.unified?.select?.mcp ?? []).includes(`${tool}:${serverId}`));
      let record: any;
      try {
        record = pickMcpRecord(rows, tool, serverId, opts.path);
      } catch (e) {
        if (useSymlink) {
          const configPath = opts.path ? String(opts.path) : inferMcpConfigPath(tool, homedir, projectDir);
          record = {
            tool,
            id: serverId,
            displayName: serverId,
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

      if (record.tool === "claude-code" && record.path.endsWith(".claude.json") && !opts.force) {
        throw new Error("Refusing to edit ~/.claude.json without --force.");
      }

      if (useSymlink) {
        await enableMcpServerSymlink({
          homedir,
          record,
          readOnly: config.mcp.readOnly,
          apply: Boolean(opts.apply),
          dryRun: Boolean(opts.dryRun),
          unifiedRoot: unifiedRoot!,
          selectedIds,
        });
      } else {
        await enableMcpServer({
          homedir,
          record,
          readOnly: config.mcp.readOnly,
          apply: Boolean(opts.apply),
          dryRun: Boolean(opts.dryRun),
        });
      }
      process.stdout.write(opts.dryRun ? "[dry-run] enable complete\n" : "enabled\n");
    });
}

