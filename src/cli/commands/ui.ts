import type { Command } from "commander";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { startUiServer } from "../../ui/server.js";

const MAX_PORT_TRIES = 10;

function isAddrInUse(err: unknown): boolean {
  return Boolean(
    err && typeof err === "object" && "code" in err && (err as { code: unknown }).code === "EADDRINUSE",
  );
}

function openInBrowser(url: string): void {
  const platform = process.platform;
  const cmd = platform === "darwin" ? "open" : platform === "win32" ? "cmd" : "xdg-open";
  const args = platform === "win32" ? ["/c", "start", "", url] : [url];
  try {
    const child = spawn(cmd, args, { stdio: "ignore", detached: true });
    child.on("error", () => {
      /* swallow: just print URL */
    });
    child.unref();
  } catch {
    /* swallow */
  }
}

export function registerUiCommand(program: Command): void {
  program
    .command("ui")
    .description("Start local web dashboard (read-only by default; opens in browser)")
    .option("--port <n>", "Port to listen on (default: 8787, auto +1 if busy)", "8787")
    .option("--project <dir>", "Project root")
    .option("--no-open", "Do not auto-open the browser")
    .action(async (opts: { port: string; project?: string; open: boolean }) => {
      const homedir = process.env.HOME || process.env.USERPROFILE || "";
      if (!homedir) throw new Error("Could not resolve home directory");
      const startPort = Number(opts.port);
      if (!Number.isFinite(startPort) || startPort <= 0 || startPort > 65535) {
        throw new Error(`Invalid --port: ${opts.port}`);
      }
      const projectDir = opts.project ? resolve(opts.project) : undefined;

      let lastErr: unknown = null;
      let bound: { close: () => Promise<void>; port: number } | null = null;
      for (let i = 0; i < MAX_PORT_TRIES; i += 1) {
        const port = startPort + i;
        try {
          const inst = await startUiServer({ homedir, projectDir, port });
          bound = { ...inst, port };
          if (i > 0) {
            process.stdout.write(
              `Port ${startPort} busy, fell back to ${port} (tried ${i} alternative${i === 1 ? "" : "s"}).\n`,
            );
          }
          break;
        } catch (e) {
          lastErr = e;
          if (!isAddrInUse(e)) throw e;
        }
      }
      if (!bound) {
        const detail = lastErr instanceof Error ? lastErr.message : String(lastErr);
        throw new Error(
          `No free port in range ${startPort}..${startPort + MAX_PORT_TRIES - 1}. Last error: ${detail}`,
        );
      }

      const url = `http://127.0.0.1:${bound.port}`;
      process.stdout.write(`UI running at ${url}\n`);
      process.stdout.write(`Press Ctrl+C to stop.\n`);
      if (opts.open) openInBrowser(url);

      let shuttingDown = false;
      const shutdown = async (sig: string): Promise<void> => {
        if (shuttingDown) return;
        shuttingDown = true;
        process.stdout.write(`\nReceived ${sig}, shutting down...\n`);
        try {
          await bound!.close();
        } catch {
          /* ignore */
        }
        process.exit(0);
      };
      process.on("SIGINT", () => void shutdown("SIGINT"));
      process.on("SIGTERM", () => void shutdown("SIGTERM"));
      // Keep process alive
      await new Promise(() => {});
    });
}

