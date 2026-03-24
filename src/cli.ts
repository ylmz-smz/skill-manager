#!/usr/bin/env node
import { basename, resolve } from "node:path";
import { Command } from "commander";
import { loadState } from "./state.js";
import { listSkills, sortSkills } from "./list.js";
import { disableSkill, enableSkill, pickRecord } from "./control.js";
import { runDoctor } from "./doctor.js";
import type { ControlStrategy, ToolId } from "./types.js";

const TOOLS = ["claude-code", "cursor", "agents", "all"] as const;

function parseTool(v: string): ToolId | "all" {
  if (v === "all") return "all";
  if (v === "claude-code" || v === "cursor" || v === "agents") return v;
  throw new Error(
    `--tool must be one of: ${TOOLS.join(", ")} (got ${JSON.stringify(v)})`,
  );
}

function parseStrategy(v: string): ControlStrategy {
  if (v === "auto" || v === "native" || v === "managed") return v;
  throw new Error(`--strategy must be auto|native|managed (got ${JSON.stringify(v)})`);
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
    .version("0.1.0");

  program
    .command("list")
    .description("List discovered skills")
    .option("--tool <id>", "claude-code | cursor | agents | all", "all")
    .option("--project <dir>", "Project root for project-scoped skills")
    .option("--json", "Print JSON lines")
    .action(async (opts: { tool: string; project?: string; json?: boolean }) => {
      const homedir = process.env.HOME || process.env.USERPROFILE || "";
      if (!homedir) throw new Error("Could not resolve home directory");
      const tool = parseTool(opts.tool);
      const projectDir = opts.project ? resolve(opts.project) : undefined;
      const state = await loadState(homedir);
      let rows = await listSkills({ homedir, projectDir, tool, state });
      rows = sortSkills(rows);
      if (opts.json) {
        process.stdout.write(`${JSON.stringify(rows, null, 2)}\n`);
        return;
      }
      for (const r of rows) {
        const on = r.enabled ? "on" : "off";
        const sem = r.enabledSemantic;
        const pk = r.pluginKey ? ` pluginKey=${r.pluginKey}` : "";
        const note = r.notes ? ` | ${r.notes}` : "";
        process.stdout.write(
          `[${r.tool}] ${r.id} (${r.sourceKind}) ${on} [${sem}] path=${r.path}${pk}${note}\n`,
        );
      }
    });

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
