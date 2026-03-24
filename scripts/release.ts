#!/usr/bin/env tsx
import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { select, confirm } from "@inquirer/prompts";

const ROOT = resolve(import.meta.dirname, "..");
const PKG_PATH = resolve(ROOT, "package.json");
const CLI_PATH = resolve(ROOT, "src", "cli.ts");

type BumpType = "patch" | "minor" | "major";

function readVersion(): string {
  const pkg = JSON.parse(readFileSync(PKG_PATH, "utf-8"));
  return pkg.version;
}

function bumpVersion(current: string, type: BumpType): string {
  const [major, minor, patch] = current.split(".").map(Number) as [number, number, number];
  switch (type) {
    case "major":
      return `${major + 1}.0.0`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
  }
}

function run(cmd: string): void {
  console.log(`\n  → ${cmd}`);
  execSync(cmd, { cwd: ROOT, stdio: "inherit" });
}

function updatePackageJson(next: string): void {
  const raw = readFileSync(PKG_PATH, "utf-8");
  const pkg = JSON.parse(raw);
  pkg.version = next;
  writeFileSync(PKG_PATH, JSON.stringify(pkg, null, 2) + "\n");
  console.log(`  ✓ package.json → ${next}`);
}

function updateCliVersion(current: string, next: string): void {
  const raw = readFileSync(CLI_PATH, "utf-8");
  const updated = raw.replace(`.version("${current}")`, `.version("${next}")`);
  if (updated === raw) {
    console.warn(`  ⚠ cli.ts: .version("${current}") not found — skipping`);
    return;
  }
  writeFileSync(CLI_PATH, updated);
  console.log(`  ✓ src/cli.ts → ${next}`);
}

function hasUncommittedChanges(): boolean {
  try {
    execSync("git diff --quiet && git diff --cached --quiet", { cwd: ROOT });
    return false;
  } catch {
    return true;
  }
}

async function main(): Promise<void> {
  const current = readVersion();
  console.log(`\n  Current version: ${current}\n`);

  if (hasUncommittedChanges()) {
    console.error("  ✖ Working tree has uncommitted changes. Commit or stash first.\n");
    process.exit(1);
  }

  const type = await select<BumpType>({
    message: "Select version bump type",
    choices: [
      { name: `patch  (${bumpVersion(current, "patch")})  — bug fixes`, value: "patch" as BumpType },
      { name: `minor  (${bumpVersion(current, "minor")})  — new features, backward-compatible`, value: "minor" as BumpType },
      { name: `major  (${bumpVersion(current, "major")})  — breaking changes`, value: "major" as BumpType },
    ],
  });

  const next = bumpVersion(current, type);

  const ok = await confirm({
    message: `Bump ${current} → ${next}, build, tag, and publish?`,
    default: true,
  });

  if (!ok) {
    console.log("  Aborted.\n");
    process.exit(0);
  }

  console.log("\n⏳ Bumping version…");
  updatePackageJson(next);
  updateCliVersion(current, next);

  console.log("\n⏳ Building…");
  run("pnpm run build");

  console.log("\n⏳ Running tests…");
  run("pnpm test");

  console.log("\n⏳ Committing & tagging…");
  run(`git add -A`);
  run(`git commit -m "release: v${next}"`);
  run(`git tag v${next}`);

  const shouldPublish = await confirm({
    message: `Publish v${next} to npm now?`,
    default: true,
  });

  if (shouldPublish) {
    console.log("\n⏳ Publishing to npm…");
    run("npm publish");
    console.log("\n⏳ Pushing to remote…");
    run("git push && git push --tags");
    console.log(`\n  🎉 v${next} published!\n`);
  } else {
    console.log(`\n  Version bumped to v${next}. Run manually when ready:`);
    console.log("    npm publish");
    console.log("    git push && git push --tags\n");
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
