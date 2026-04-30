import type { Command } from "commander";
import { resolve } from "node:path";
import { runDoctor } from "../../core/doctor.js";

export function registerDoctorCommand(program: Command): void {
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
}

