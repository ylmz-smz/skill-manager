import type { Command } from "commander";
import { resolve } from "node:path";
import { loadConfig } from "../../core/config.js";
import { listSubagents, sortSubagents } from "../../core/subagents.js";
import { disableSubagent, enableSubagent, pickSubagentRecord } from "../../core/subagents-control.js";
import { loadState } from "../../core/state.js";
import { formatSubagentListTable } from "../../ui/format.js";
import { parseSubagentTool, requireForceForDisable } from "../helpers.js";

export function registerAgentsCommands(program: Command): void {
  const agentsCmd = program
    .command("agents [toolArg]")
    .alias("subagents")
    .description("List discovered subagents (.cursor/.claude/.codex agents/*.md)")
    .option("-t, --tool <id>", "cursor | claude-code | codex | all", "all")
    .option("--project <dir>", "Project root for project-scoped subagents")
    .option("--json", "Print JSON (machine-readable)")
    .action(async (toolArg: string | undefined, opts: any) => {
      const homedir = process.env.HOME || process.env.USERPROFILE || "";
      if (!homedir) throw new Error("Could not resolve home directory");
      const projectDir = opts.project ? resolve(opts.project) : undefined;
      const { config } = await loadConfig({ homedir, projectDir });

      const rawTool = toolArg ?? opts.tool;
      const tool = parseSubagentTool(rawTool);

      const state = await loadState(homedir);
      let rows = await listSubagents({
        homedir,
        projectDir,
        tool,
        state,
        extraRoots: { user: config.scan.extraAgentRoots },
      });
      rows = sortSubagents(rows);
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
        return;
      }
      const termWidth = process.stdout.columns ?? 96;
      process.stdout.write(formatSubagentListTable(rows, homedir, termWidth));
    });

  agentsCmd
    .command("disable")
    .description("Disable a subagent (managed archive). Requires --force.")
    .requiredOption("--tool <id>", "cursor | claude-code | codex")
    .argument("<agent-id>", "Agent id from agents list")
    .option("--project <dir>", "Project root")
    .option("--path <file>", "Exact markdown file if id is ambiguous")
    .option("--dry-run", "Print actions without writing")
    .option("--force", "Confirm disable")
    .action(async (agentId: string, opts: any) => {
      if (!opts.force) requireForceForDisable();
      const homedir = process.env.HOME || process.env.USERPROFILE || "";
      if (!homedir) throw new Error("Could not resolve home directory");
      const tool = parseSubagentTool(opts.tool);
      if (tool === "all") throw new Error("--tool cannot be 'all' for agents disable");
      const projectDir = opts.project ? resolve(opts.project) : undefined;
      const { config } = await loadConfig({ homedir, projectDir });
      const state = await loadState(homedir);
      const rows = await listSubagents({
        homedir,
        projectDir,
        tool,
        state,
        extraRoots: { user: config.scan.extraAgentRoots },
      });
      const record = pickSubagentRecord(rows, tool, agentId, opts.path);
      await disableSubagent({ homedir, record, dryRun: Boolean(opts.dryRun) });
      process.stdout.write(opts.dryRun ? "[dry-run] disable complete\n" : "disabled\n");
    });

  agentsCmd
    .command("enable")
    .description("Enable a subagent (restore from managed archive)")
    .requiredOption("--tool <id>", "cursor | claude-code | codex")
    .argument("<agent-id>", "Agent id from agents list")
    .option("--project <dir>", "Project root")
    .option("--path <file>", "Exact markdown file if id is ambiguous")
    .option("--dry-run", "Print actions without writing")
    .action(async (agentId: string, opts: any) => {
      const homedir = process.env.HOME || process.env.USERPROFILE || "";
      if (!homedir) throw new Error("Could not resolve home directory");
      const tool = parseSubagentTool(opts.tool);
      if (tool === "all") throw new Error("--tool cannot be 'all' for agents enable");
      const projectDir = opts.project ? resolve(opts.project) : undefined;
      const { config } = await loadConfig({ homedir, projectDir });
      const state = await loadState(homedir);
      const rows = await listSubagents({
        homedir,
        projectDir,
        tool,
        state,
        extraRoots: { user: config.scan.extraAgentRoots },
      });
      const record = pickSubagentRecord(rows, tool, agentId, opts.path);
      await enableSubagent({ homedir, record, dryRun: Boolean(opts.dryRun) });
      process.stdout.write(opts.dryRun ? "[dry-run] enable complete\n" : "enabled\n");
    });
}

