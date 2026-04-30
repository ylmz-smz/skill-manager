import type { Command } from "commander";
import { resolve } from "node:path";
import { loadConfig } from "../../core/config.js";
import { disableSkill, enableSkill, pickRecord } from "../../core/control.js";
import { listSkills, sortSkills } from "../../core/list.js";
import { loadState } from "../../core/state.js";
import { runInteractiveList } from "../../ui/interactive.js";
import { formatSkillListTable } from "../../ui/format.js";
import { resolveListToolFilter } from "../../ui/tool-filter.js";
import { parseStrategy, parseTool, requireForceForDisable } from "../helpers.js";

export function registerSkillsCommands(program: Command): void {
  const skillsCmd = program
    .command("skills")
    .description("Manage skills (recommended; legacy top-level commands are still available)");

  skillsCmd
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
    .option("--strategy <s>", "With --interactive: auto | native | managed | symlink", "auto")
    .option("--global", "With --interactive + Claude: write user ~/.claude/settings.local.json")
    .option("--dry-run", "With --interactive: do not write files")
    .action(async (toolArg: string | undefined, opts: any) => {
      const homedir = process.env.HOME || process.env.USERPROFILE || "";
      if (!homedir) throw new Error("Could not resolve home directory");
      if (opts.json && opts.interactive) {
        throw new Error("不能同时使用 --json 与 --interactive");
      }
      const tool = resolveListToolFilter(toolArg, opts.tool);
      const projectDir = opts.project ? resolve(opts.project) : undefined;
      const { config } = await loadConfig({ homedir, projectDir });
      const state = await loadState(homedir);
      let rows = await listSkills({
        homedir,
        projectDir,
        tool,
        state,
        extraSkillRoots: config.scan.extraSkillRoots,
      });
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
          unifiedRoot: config.unified?.roots?.skills,
          termWidth,
        });
        return;
      }
      process.stdout.write(formatSkillListTable(rows, homedir, termWidth));
    });

  skillsCmd
    .command("disable")
    .description("Disable a skill (see --strategy / README for semantics)")
    .requiredOption("--tool <id>", "claude-code | cursor | agents")
    .argument("<skill-id>", "Skill id from list")
    .option("--project <dir>", "Project root")
    .option("--global", "Use user-level Claude settings (default: project when --project set)")
    .option("--strategy <s>", "auto | native | managed | symlink", "auto")
    .option("--path <dir>", "Exact skill directory if id is ambiguous")
    .option("--dry-run", "Print actions without writing")
    .option("--force", "Confirm disable")
    .action(async (skillId: string, opts: any) => {
      if (!opts.force) requireForceForDisable();
      const homedir = process.env.HOME || process.env.USERPROFILE || "";
      if (!homedir) throw new Error("Could not resolve home directory");
      const parsedTool = parseTool(opts.tool);
      if (parsedTool === "all") {
        throw new Error("--tool cannot be 'all' for disable");
      }
      const tool = parsedTool;
      const projectDir = opts.project ? resolve(opts.project) : undefined;
      const { config } = await loadConfig({ homedir, projectDir });
      const state = await loadState(homedir);
      const rows = await listSkills({
        homedir,
        projectDir,
        tool,
        state,
        extraSkillRoots: config.scan.extraSkillRoots,
      });
      const record = pickRecord(rows, tool, skillId, opts.path);
      await disableSkill({
        homedir,
        projectDir,
        record,
        strategy: parseStrategy(opts.strategy),
        dryRun: Boolean(opts.dryRun),
        globalSettings: Boolean(opts.global),
        unifiedRoot: config.unified?.roots?.skills,
      });
      process.stdout.write(opts.dryRun ? "[dry-run] disable complete\n" : "disabled\n");
    });

  skillsCmd
    .command("enable")
    .description("Enable a skill")
    .requiredOption("--tool <id>", "claude-code | cursor | agents")
    .argument("<skill-id>", "Skill id from list")
    .option("--project <dir>", "Project root")
    .option("--global", "Use user-level Claude settings")
    .option("--strategy <s>", "auto | native | managed | symlink", "auto")
    .option("--path <dir>", "Exact skill directory if id is ambiguous")
    .option("--dry-run", "Print actions without writing")
    .action(async (skillId: string, opts: any) => {
      const homedir = process.env.HOME || process.env.USERPROFILE || "";
      if (!homedir) throw new Error("Could not resolve home directory");
      const parsedTool = parseTool(opts.tool);
      if (parsedTool === "all") {
        throw new Error("--tool cannot be 'all' for enable");
      }
      const tool = parsedTool;
      const projectDir = opts.project ? resolve(opts.project) : undefined;
      const { config } = await loadConfig({ homedir, projectDir });
      const state = await loadState(homedir);
      const rows = await listSkills({
        homedir,
        projectDir,
        tool,
        state,
        extraSkillRoots: config.scan.extraSkillRoots,
      });
      const record = pickRecord(rows, tool, skillId, opts.path);
      await enableSkill({
        homedir,
        projectDir,
        record,
        strategy: parseStrategy(opts.strategy),
        dryRun: Boolean(opts.dryRun),
        globalSettings: Boolean(opts.global),
        unifiedRoot: config.unified?.roots?.skills,
      });
      process.stdout.write(opts.dryRun ? "[dry-run] enable complete\n" : "enabled\n");
    });
}

