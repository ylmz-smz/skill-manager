import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { buildSyncPlan } from "../../core/workbench.js";

describe("workbench sync plan", () => {
  it("imports once, then syncs from the central library", async () => {
    const home = await mkdtemp(join(tmpdir(), "skill-manager-workbench-"));
    const source = join(home, "source", "demo");
    const library = join(home, "library");
    await mkdir(source, { recursive: true });
    await writeFile(join(source, "SKILL.md"), "---\nname: demo\n---\n");
    const existing = join(home, ".cursor", "skills", "demo");
    await mkdir(existing, { recursive: true });
    await writeFile(join(existing, "SKILL.md"), "---\nname: demo\n---\n");

    const plan = await buildSyncPlan({
      mode: "managed",
      method: "copy",
      libraryPath: library,
      sources: [{ slug: "demo", path: source }],
      targets: [{ agentId: "cursor", scope: "global" }],
    }, home);

    expect(plan.blockedConflicts).toEqual([]);
    expect(plan.operations.map((operation) => operation.targetPath)).toEqual([
      join(library, "demo"),
      join(home, ".cursor", "skills", "demo"),
    ]);
    expect(plan.operations[1]?.sourcePath).toBe(join(library, "demo"));
    expect(plan.operations[1]?.type).toBe("noop");
  });
});
