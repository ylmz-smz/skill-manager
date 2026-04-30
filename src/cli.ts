#!/usr/bin/env node
import { basename, resolve } from "node:path";
import { Command } from "commander";
import { loadState } from "./core/state.js";
import { listSkills, sortSkills } from "./core/list.js";
import { disableSkill, enableSkill, pickRecord } from "./core/control.js";
import { runDoctor } from "./core/doctor.js";
import { formatSkillListTable, formatSubagentListTable } from "./ui/format.js";
import { formatMcpListTable } from "./ui/format.js";
import { runInteractiveList } from "./ui/interactive.js";
import { resolveListToolFilter } from "./ui/tool-filter.js";
import type { ControlStrategy, ToolId } from "./types.js";
import type { SubagentToolId } from "./types.js";
import { listSubagents, sortSubagents } from "./core/subagents.js";
import type { McpToolId } from "./types.js";
import { listMcpServers, sortMcpServers } from "./core/mcp.js";
import { loadConfig } from "./core/config.js";
import {
  disableSubagent,
  enableSubagent,
  pickSubagentRecord,
} from "./core/subagents-control.js";

const TOOLS = ["claude-code", "cursor", "vscode", "codebuddy", "agents", "codex", "all"] as const;
const SUBAGENT_TOOLS = ["cursor", "claude-code", "codex", "all"] as const;
const MCP_TOOLS = ["cursor", "claude-code", "all"] as const;

function parseTool(v: string): ToolId | "all" {
  if (v === "all") return "all";
  if (v === "claude-code" || v === "cursor" || v === "vscode" || v === "codebuddy" || v === "agents" || v === "codex") return v;
  throw new Error(
    `--tool must be one of: ${TOOLS.join(", ")} (got ${JSON.stringify(v)})`,
  );
}

function parseStrategy(v: string): ControlStrategy {
  if (v === "auto" || v === "native" || v === "managed") return v;
  throw new Error(`--strategy must be auto|native|managed (got ${JSON.stringify(v)})`);
}

function parseSubagentTool(v: string): SubagentToolId | "all" {
  if (v === "all") return "all";
  if (v === "cursor" || v === "claude-code" || v === "codex") return v;
  throw new Error(
    `--tool must be one of: ${SUBAGENT_TOOLS.join(", ")} (got ${JSON.stringify(v)})`,
  );
}

function parseMcpTool(v: string): McpToolId | "all" {
  if (v === "all") return "all";
  if (v === "cursor" || v === "claude-code") return v;
  throw new Error(
    `--tool must be one of: ${MCP_TOOLS.join(", ")} (got ${JSON.stringify(v)})`,
  );
}

function requireForceForDisable(): void {
  if (process.env.SKILLS_MANAGER_YES === "1") return;
  throw new Error(
    "Refusing to disable without --force (or set SKILLS_MANAGER_YES=1 for CI).",
  );
}

/** Args after node / tsx / script path(s), so bare `tsx src/cli.ts` yields []. */
function userFacingArgv(argv: string[]): string[] {
  const tail = argv.slice(2);
  let i = 0;
  while (i < tail.length) {
    const a = tail[i]!;
    if (a === "--") {
      i++;
      continue;
    }
    if (a.startsWith("-")) break;
    const base = basename(a);
    const looksLikeScript =
      /\.(m?[jt]s|tsx?|cjs)$/i.test(a) || base === "tsx";
    if (!looksLikeScript) break;
    i++;
  }
  return tail.slice(i);
}

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("skills-manager")
    .description("Discover and enable/disable skills across Claude Code, Cursor, and ~/.agents/skills")
    .version("0.2.0");

  program
    .command("list [toolArg]")
    .description(
      "List discovered skills; optional toolArg = cursor | claude-code | agents（简写 c/cc/a）或 all",
    )
    .option(
      "-t, --tool <id>",
      "Same as positional toolArg: claude-code | cursor | agents | all",
      "all",
    )
    .option("--project <dir>", "Project root for project-scoped skills")
    .option("--json", "Print JSON (machine-readable)")
    .option(
      "-i, --interactive",
      "Terminal UI: pick a skill then confirm enable/disable (requires TTY)",
    )
    .option(
      "--strategy <s>",
      "With --interactive: auto | native | managed",
      "auto",
    )
    .option(
      "--global",
      "With --interactive + Claude: write user ~/.claude/settings.local.json",
    )
    .option("--dry-run", "With --interactive: do not write files")
    .action(
      async (
        toolArg: string | undefined,
        opts: {
          tool: string;
          project?: string;
          json?: boolean;
          interactive?: boolean;
          strategy: string;
          global?: boolean;
          dryRun?: boolean;
        },
      ) => {
        const homedir = process.env.HOME || process.env.USERPROFILE || "";
        if (!homedir) throw new Error("Could not resolve home directory");
        if (opts.json && opts.interactive) {
          throw new Error("不能同时使用 --json 与 --interactive");
        }
        const tool = resolveListToolFilter(toolArg, opts.tool);
        const projectDir = opts.project ? resolve(opts.project) : undefined;
        const state = await loadState(homedir);
        let rows = await listSkills({ homedir, projectDir, tool, state });
        rows = sortSkills(rows);
        if (opts.json) {
          process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
          return;
        }
        const termWidth = process.stdout.columns ?? 96;
        if (opts.interactive) {
          await runInteractiveList({
            homedir,
            projectDir,
            rows,
            strategy: parseStrategy(opts.strategy),
            dryRun: Boolean(opts.dryRun),
            globalSettings: Boolean(opts.global),
            termWidth,
          });
          return;
        }
        process.stdout.write(formatSkillListTable(rows, homedir, termWidth));
      },
    );

  const agentsCmd = program
    .command("agents [toolArg]")
    .alias("subagents")
    .description("List discovered subagents (.cursor/.claude/.codex agents/*.md)")
    .option(
      "-t, --tool <id>",
      "cursor | claude-code | codex | all",
      "all",
    )
    .option("--project <dir>", "Project root for project-scoped subagents")
    .option("--json", "Print JSON (machine-readable)")
    .action(
      async (
        toolArg: string | undefined,
        opts: {
          tool: string;
          project?: string;
          json?: boolean;
        },
      ) => {
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
      },
    );

  agentsCmd
    .command("disable")
    .description("Disable a subagent (managed archive). Requires --force.")
    .requiredOption("--tool <id>", "cursor | claude-code | codex")
    .argument("<agent-id>", "Agent id from agents list")
    .option("--project <dir>", "Project root")
    .option("--path <file>", "Exact markdown file if id is ambiguous")
    .option("--dry-run", "Print actions without writing")
    .option("--force", "Confirm disable")
    .action(
      async (
        agentId: string,
        opts: {
          tool: string;
          project?: string;
          path?: string;
          dryRun?: boolean;
          force?: boolean;
        },
      ) => {
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
        await disableSubagent({
          homedir,
          record,
          dryRun: Boolean(opts.dryRun),
        });
        process.stdout.write(opts.dryRun ? "[dry-run] disable complete\n" : "disabled\n");
      },
    );

  agentsCmd
    .command("enable")
    .description("Enable a subagent (restore from managed archive)")
    .requiredOption("--tool <id>", "cursor | claude-code | codex")
    .argument("<agent-id>", "Agent id from agents list")
    .option("--project <dir>", "Project root")
    .option("--path <file>", "Exact markdown file if id is ambiguous")
    .option("--dry-run", "Print actions without writing")
    .action(
      async (
        agentId: string,
        opts: {
          tool: string;
          project?: string;
          path?: string;
          dryRun?: boolean;
        },
      ) => {
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
        await enableSubagent({
          homedir,
          record,
          dryRun: Boolean(opts.dryRun),
        });
        process.stdout.write(opts.dryRun ? "[dry-run] enable complete\n" : "enabled\n");
      },
    );

  // NOTE: `subagents` kept as an alias for backwards compatibility.

  const configCmd = program
    .command("config")
    .description("Inspect and validate skill-manager config");

  configCmd
    .command("path")
    .description("Print config file paths used")
    .option("--project <dir>", "Project root")
    .action(async (opts: { project?: string }) => {
      const homedir = process.env.HOME || process.env.USERPROFILE || "";
      if (!homedir) throw new Error("Could not resolve home directory");
      const projectDir = opts.project ? resolve(opts.project) : undefined;
      const { sources } = await loadConfig({ homedir, projectDir });
      if (sources.length === 0) {
        process.stdout.write("No config files found.\n");
        return;
      }
      for (const s of sources) process.stdout.write(`${s}\n`);
    });

  configCmd
    .command("validate")
    .description("Validate config files (exit code 1 on error)")
    .option("--project <dir>", "Project root")
    .action(async (opts: { project?: string }) => {
      const homedir = process.env.HOME || process.env.USERPROFILE || "";
      if (!homedir) throw new Error("Could not resolve home directory");
      const projectDir = opts.project ? resolve(opts.project) : undefined;
      // loadConfig validates on read; this command exists for CI ergonomics.
      const { config, sources } = await loadConfig({ homedir, projectDir });
      process.stdout.write(
        `${sources.length ? `OK (${sources.length} file(s))` : "OK (defaults only)"}\n`,
      );
      // Print a tiny summary for debugging
      process.stdout.write(
        `extraAgentRoots=${config.scan.extraAgentRoots.length} extraSkillRoots=${config.scan.extraSkillRoots.length} mcp.readOnly=${config.mcp.readOnly}\n`,
      );
    });

  program
    .command("mcp [toolArg]")
    .description("List discovered MCP servers (read-only)")
    .option("-t, --tool <id>", "cursor | claude-code | all", "all")
    .option("--project <dir>", "Project root for project-scoped MCP (.cursor/mcp.json, .mcp.json)")
    .option("--json", "Print JSON (machine-readable)")
    .action(
      async (
        toolArg: string | undefined,
        opts: {
          tool: string;
          project?: string;
          json?: boolean;
        },
      ) => {
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
      },
    );

  program
    .command("disable")
    .description("Disable a skill (see --strategy / README for semantics)")
    .requiredOption("--tool <id>", "claude-code | cursor | agents")
    .argument("<skill-id>", "Skill id from list")
    .option("--project <dir>", "Project root")
    .option("--global", "Use user-level Claude settings (default: project when --project set)")
    .option("--strategy <s>", "auto | native | managed", "auto")
    .option("--path <dir>", "Exact skill directory if id is ambiguous")
    .option("--dry-run", "Print actions without writing")
    .option("--force", "Confirm disable")
    .action(
      async (
        skillId: string,
        opts: {
          tool: string;
          project?: string;
          global?: boolean;
          strategy: string;
          path?: string;
          dryRun?: boolean;
          force?: boolean;
        },
      ) => {
        if (!opts.force) requireForceForDisable();
        const homedir = process.env.HOME || process.env.USERPROFILE || "";
        if (!homedir) throw new Error("Could not resolve home directory");
        const parsedTool = parseTool(opts.tool);
        if (parsedTool === "all") {
          throw new Error("--tool cannot be 'all' for disable");
        }
        const tool = parsedTool;
        const projectDir = opts.project ? resolve(opts.project) : undefined;
        const state = await loadState(homedir);
        const rows = await listSkills({
          homedir,
          projectDir,
          tool,
          state,
        });
        const record = pickRecord(rows, tool, skillId, opts.path);
        await disableSkill({
          homedir,
          projectDir,
          record,
          strategy: parseStrategy(opts.strategy),
          dryRun: Boolean(opts.dryRun),
          globalSettings: Boolean(opts.global),
        });
        process.stdout.write(
          opts.dryRun ? "[dry-run] disable complete\n" : "disabled\n",
        );
      },
    );

  program
    .command("enable")
    .description("Enable a skill")
    .requiredOption("--tool <id>", "claude-code | cursor | agents")
    .argument("<skill-id>", "Skill id from list")
    .option("--project <dir>", "Project root")
    .option("--global", "Use user-level Claude settings")
    .option("--strategy <s>", "auto | native | managed", "auto")
    .option("--path <dir>", "Exact skill directory if id is ambiguous")
    .option("--dry-run", "Print actions without writing")
    .action(
      async (
        skillId: string,
        opts: {
          tool: string;
          project?: string;
          global?: boolean;
          strategy: string;
          path?: string;
          dryRun?: boolean;
        },
      ) => {
        const homedir = process.env.HOME || process.env.USERPROFILE || "";
        if (!homedir) throw new Error("Could not resolve home directory");
        const parsedTool = parseTool(opts.tool);
        if (parsedTool === "all") {
          throw new Error("--tool cannot be 'all' for enable");
        }
        const tool = parsedTool;
        const projectDir = opts.project ? resolve(opts.project) : undefined;
        const state = await loadState(homedir);
        const rows = await listSkills({
          homedir,
          projectDir,
          tool,
          state,
        });
        const record = pickRecord(rows, tool, skillId, opts.path);
        await enableSkill({
          homedir,
          projectDir,
          record,
          strategy: parseStrategy(opts.strategy),
          dryRun: Boolean(opts.dryRun),
          globalSettings: Boolean(opts.global),
        });
        process.stdout.write(
          opts.dryRun ? "[dry-run] enable complete\n" : "enabled\n",
        );
      },
    );

  program
    .command("doctor")
    .description("Check state file, archives, and Claude settings readability")
    .option("--project <dir>", "Project root for Claude settings merge")
    .action(async (opts: { project?: string }) => {
      const homedir = process.env.HOME || process.env.USERPROFILE || "";
      if (!homedir) throw new Error("Could not resolve home directory");
      const projectDir = opts.project ? resolve(opts.project) : undefined;
      const { issues, info } = await runDoctor({ homedir, projectDir });
      for (const line of info) process.stdout.write(`${line}\n`);
      for (const i of issues) {
        process.stderr.write(`[${i.level}] ${i.message}\n`);
      }
      if (issues.some((x) => x.level === "error")) process.exitCode = 1;
    });

  const userArgs = userFacingArgv(process.argv);
  if (userArgs.length === 0) {
    program.outputHelp();
    process.exit(0);
  }

  await program.parseAsync(["node", "skills-manager", ...userArgs], {
    from: "node",
  });
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
  process.exitCode = 1;
});
