import type { Command } from "commander";
import { resolve } from "node:path";
import { loadConfig } from "../../core/config.js";
import { listSkills, sortSkills } from "../../core/list.js";
import { listSubagents } from "../../core/subagents.js";
import { listMcpServers } from "../../core/mcp.js";
import { loadState } from "../../core/state.js";
import { pickRecord } from "../../core/control.js";
import { pickSubagentRecord } from "../../core/subagents-control.js";
import { pickMcpRecord } from "../../core/mcp-control.js";
import {
  toMcpServerResource,
  toSkillResource,
  toSubagentResource,
} from "../../domain/convert.js";
import { createSkillMutationPort } from "../../mutation/skill-port.js";
import { createSubagentMutationPort } from "../../mutation/subagent-port.js";
import { createMcpMutationPort } from "../../mutation/mcp-port.js";
import type { DiffPreview, ResourceOp } from "../../mutation/port.js";
import { parseMcpTool, parseStrategy, parseSubagentTool, parseTool } from "../helpers.js";

const ANSI = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  dim: "\x1b[2m",
} as const;

function colorize(diff: string, enable: boolean): string {
  if (!enable) return diff;
  return diff
    .split("\n")
    .map((line) => {
      if (line.startsWith("--- ") || line.startsWith("+++ ")) {
        return ANSI.cyan + line + ANSI.reset;
      }
      if (line.startsWith("@@")) return ANSI.magenta + line + ANSI.reset;
      if (line.startsWith("+")) return ANSI.green + line + ANSI.reset;
      if (line.startsWith("-")) return ANSI.red + line + ANSI.reset;
      return line;
    })
    .join("\n");
}

function shouldUseColor(opt: boolean | undefined): boolean {
  if (opt === false) return false;
  if (process.env.NO_COLOR) return false;
  return process.stdout.isTTY === true;
}

function printPreview(p: DiffPreview, useColor: boolean): void {
  if (p.unifiedDiff) {
    process.stdout.write(colorize(p.unifiedDiff, useColor) + "\n");
  } else {
    process.stdout.write(`${ANSI.dim}(no file changes)${ANSI.reset}\n`);
  }
  if (p.redactedEnvKeys.length > 0) {
    const tag = useColor ? `${ANSI.yellow}redacted:${ANSI.reset}` : "redacted:";
    process.stdout.write(`${tag} ${p.redactedEnvKeys.join(", ")}\n`);
  }
  for (const w of p.warnings) {
    const tag = useColor ? `${ANSI.yellow}!${ANSI.reset}` : "!";
    process.stdout.write(`${tag} ${w}\n`);
  }
}

function homedir(): string {
  const h = process.env.HOME || process.env.USERPROFILE || "";
  if (!h) throw new Error("Could not resolve home directory");
  return h;
}

export function registerPreviewCommands(program: Command): void {
  const previewCmd = program
    .command("preview")
    .description(
      "Show what enable/disable would change, with secrets redacted. No disk writes.",
    );

  previewCmd
    .command("skill <tool> <id>")
    .description("Diff for a skill enable/disable")
    .option("--op <op>", "enable | disable", "disable")
    .option("--strategy <s>", "auto | native | managed | symlink", "auto")
    .option("--project <dir>", "Project root for project-scoped skills")
    .option("--path <p>", "Disambiguate by skill directory path")
    .option("--no-color", "Disable ANSI colors")
    .action(async (toolArg: string, id: string, opts) => {
      const home = homedir();
      const tool = parseTool(toolArg);
      if (tool === "all") throw new Error("--tool <id> cannot be 'all' for preview");
      const op: ResourceOp = opts.op === "enable" ? "enable" : "disable";
      const strategy = parseStrategy(opts.strategy);
      const projectDir = opts.project ? resolve(opts.project) : undefined;
      const { config } = await loadConfig({ homedir: home, projectDir });
      const state = await loadState(home);
      const rows = sortSkills(
        await listSkills({
          homedir: home,
          projectDir,
          tool,
          state,
          extraSkillRoots: config.scan.extraSkillRoots,
        }),
      );
      const record = pickRecord(rows, tool, id, opts.path);
      const port = createSkillMutationPort({
        homedir: home,
        projectDir,
        unifiedRoot: config.unified?.roots?.skills,
      });
      const p = await port.preview(toSkillResource(record), op, strategy);
      printPreview(p, shouldUseColor(opts.color));
    });

  previewCmd
    .command("subagent <tool> <id>")
    .description("Diff for a subagent enable/disable")
    .option("--op <op>", "enable | disable", "disable")
    .option("--strategy <s>", "auto | managed | symlink", "auto")
    .option("--path <p>", "Disambiguate by .md path")
    .option("--no-color", "Disable ANSI colors")
    .action(async (toolArg: string, id: string, opts) => {
      const home = homedir();
      const tool = parseSubagentTool(toolArg);
      if (tool === "all") throw new Error("--tool <id> cannot be 'all' for preview");
      const op: ResourceOp = opts.op === "enable" ? "enable" : "disable";
      const strategy = parseStrategy(opts.strategy);
      const { config } = await loadConfig({ homedir: home });
      const state = await loadState(home);
      const rows = await listSubagents({
        homedir: home,
        tool,
        state,
        extraRoots: { user: config.scan.extraAgentRoots },
      });
      const record = pickSubagentRecord(rows, tool, id, opts.path);
      const port = createSubagentMutationPort({
        homedir: home,
        unifiedRoot: config.unified?.roots?.agents,
      });
      const p = await port.preview(toSubagentResource(record), op, strategy);
      printPreview(p, shouldUseColor(opts.color));
    });

  previewCmd
    .command("mcp <tool> <id>")
    .description("Diff for an MCP server enable/disable")
    .option("--op <op>", "enable | disable", "disable")
    .option("--path <p>", "Disambiguate by config file path")
    .option("--no-color", "Disable ANSI colors")
    .action(async (toolArg: string, id: string, opts) => {
      const home = homedir();
      const tool = parseMcpTool(toolArg);
      if (tool === "all") throw new Error("--tool <id> cannot be 'all' for preview");
      const op: ResourceOp = opts.op === "enable" ? "enable" : "disable";
      const projectDir = opts.project ? resolve(opts.project) : undefined;
      const { config } = await loadConfig({ homedir: home, projectDir });
      const rows = await listMcpServers({
        homedir: home,
        projectDir,
        tool,
      });
      const record = pickMcpRecord(rows, tool, id, opts.path);
      const port = createMcpMutationPort({
        homedir: home,
        readOnly: config.mcp?.readOnly,
      });
      const p = await port.preview(toMcpServerResource(record), op, "auto");
      printPreview(p, shouldUseColor(opts.color));
    });
}
