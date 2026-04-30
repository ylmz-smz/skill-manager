import type { Command } from "commander";
import { resolve } from "node:path";
import { loadConfig } from "../../core/config.js";

export function registerConfigCommands(program: Command): void {
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
      const { config, sources } = await loadConfig({ homedir, projectDir });
      process.stdout.write(
        `${sources.length ? `OK (${sources.length} file(s))` : "OK (defaults only)"}\n`,
      );
      process.stdout.write(
        `extraAgentRoots=${config.scan.extraAgentRoots.length} extraSkillRoots=${config.scan.extraSkillRoots.length} mcp.readOnly=${config.mcp.readOnly}\n`,
      );
    });
}

