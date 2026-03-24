import { randomBytes } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { setDisableModelInvocation } from "./skill-file.js";

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
});
