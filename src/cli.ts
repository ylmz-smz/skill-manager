#!/usr/bin/env node
import { Command } from "commander";
import { userFacingArgv } from "./cli/helpers.js";
import { registerSkillsCommands } from "./cli/commands/skills.js";
import { registerAgentsCommands } from "./cli/commands/agents.js";
import { registerMcpCommands } from "./cli/commands/mcp.js";
import { registerConfigCommands } from "./cli/commands/config.js";
import { registerDoctorCommand } from "./cli/commands/doctor.js";
import { registerLegacySkillsCommands } from "./cli/commands/legacy-skills.js";
import { registerUiCommand } from "./cli/commands/ui.js";

async function main(): Promise<void> {
  const program = new Command();
  program
    .name("skills-manager")
    .description("Discover and enable/disable skills across Claude Code, Cursor, and ~/.agents/skills")
    .version("0.2.0");

  registerSkillsCommands(program);
  registerAgentsCommands(program);
  registerMcpCommands(program);
  registerConfigCommands(program);
  registerDoctorCommand(program);
  registerUiCommand(program);
  // Legacy (v1) skills entrypoints
  registerLegacySkillsCommands(program);

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
