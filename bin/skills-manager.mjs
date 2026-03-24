#!/usr/bin/env node
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { pathToFileURL } from "node:url";

const root = dirname(fileURLToPath(new URL(import.meta.url)));
const distCli = join(root, "..", "dist", "cli.js");

if (!existsSync(distCli)) {
  console.error(
    "skills-manager: dist/cli.js missing in package. Reinstall skill-manager-cli or report at https://github.com/ylmz-smz/skill-manager/issues",
  );
  process.exit(1);
}

await import(pathToFileURL(distCli).href);
