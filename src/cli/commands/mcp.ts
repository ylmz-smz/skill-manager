import type { Command } from "commander";
import { resolve } from "node:path";
import { loadConfig } from "../../core/config.js";
import { listMcpServers, sortMcpServers } from "../../core/mcp.js";
import { disableMcpServer, enableMcpServer, pickMcpRecord } from "../../core/mcp-control.js";
import { formatMcpListTable } from "../../ui/format.js";
import { parseMcpTool } from "../helpers.js";

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
      const rawTool = toolArg ?? opts.tool;
      const tool = parseMcpTool(rawTool);

      let rows = await listMcpServers({ homedir, projectDir, tool });
      rows = sortMcpServers(rows);
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
      const record = pickMcpRecord(rows, tool, serverId, opts.path);

      if (record.tool === "claude-code" && record.path.endsWith(".claude.json") && !opts.force) {
        throw new Error("Refusing to edit ~/.claude.json without --force.");
      }

      await disableMcpServer({
        homedir,
        record,
        readOnly: config.mcp.readOnly,
        apply: Boolean(opts.apply),
        dryRun: Boolean(opts.dryRun),
      });
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
      const record = pickMcpRecord(rows, tool, serverId, opts.path);

      if (record.tool === "claude-code" && record.path.endsWith(".claude.json") && !opts.force) {
        throw new Error("Refusing to edit ~/.claude.json without --force.");
      }

      await enableMcpServer({
        homedir,
        record,
        readOnly: config.mcp.readOnly,
        apply: Boolean(opts.apply),
        dryRun: Boolean(opts.dryRun),
      });
      process.stdout.write(opts.dryRun ? "[dry-run] enable complete\n" : "enabled\n");
    });
}

