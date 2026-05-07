import { randomBytes } from "node:crypto";
import { chmod, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { setDisableModelInvocation } from "../../core/skill-file.js";

describe("setDisableModelInvocation", () => {
  it("writes and clears frontmatter flag", async () => {
    const dir = join(
      process.cwd(),
      "node_modules",
      ".sm-vitest-homes",
      `sf-${randomBytes(6).toString("hex")}`,
    );
    await mkdir(dir, { recursive: true });
    const md = join(dir, "SKILL.md");
    await writeFile(
      md,
      `---
name: t
---

Hi
`,
      "utf8",
    );
    await setDisableModelInvocation(md, true, false);
    let raw = await readFile(md, "utf8");
    expect(raw).toContain("disable-model-invocation");
    await setDisableModelInvocation(md, false, false);
    raw = await readFile(md, "utf8");
    expect(raw).not.toContain("disable-model-invocation");
    await rm(dir, { recursive: true, force: true });
  });

  it("translates EACCES into actionable error mentioning managed strategy", async () => {
    if (process.platform === "win32" || process.getuid?.() === 0) return; // skip when chmod won't enforce
    const dir = join(
      process.cwd(),
      "node_modules",
      ".sm-vitest-homes",
      `sf-${randomBytes(6).toString("hex")}`,
    );
    await mkdir(dir, { recursive: true });
    const md = join(dir, "SKILL.md");
    await writeFile(md, `---\nname: t\n---\n\nHi\n`, "utf8");
    await chmod(md, 0o444); // read-only
    try {
      await expect(setDisableModelInvocation(md, true, false)).rejects.toThrow(/not writable/i);
      await expect(setDisableModelInvocation(md, true, false)).rejects.toThrow(/managed/i);
    } finally {
      await chmod(md, 0o644).catch(() => {});
      await rm(dir, { recursive: true, force: true });
    }
  });
});
