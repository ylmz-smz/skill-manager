import type { Command } from "commander";
import { resolve } from "node:path";
import { startUiServer } from "../../ui/server.js";

export function registerUiCommand(program: Command): void {
  program
    .command("ui")
    .description("Start local web dashboard (read-only)")
    .option("--port <n>", "Port to listen on (default: 8787)", "8787")
    .option("--project <dir>", "Project root")
    .action(async (opts: { port: string; project?: string }) => {
      const homedir = process.env.HOME || process.env.USERPROFILE || "";
      if (!homedir) throw new Error("Could not resolve home directory");
      const port = Number(opts.port);
      if (!Number.isFinite(port) || port <= 0 || port > 65535) {
        throw new Error(`Invalid --port: ${opts.port}`);
      }
      const projectDir = opts.project ? resolve(opts.project) : undefined;
      await startUiServer({ homedir, projectDir, port });
      process.stdout.write(`UI running at http://127.0.0.1:${port}\n`);
      process.stdout.write(`Press Ctrl+C to stop.\n`);
      // Keep process alive
      await new Promise(() => {});
    });
}

