import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSubagentMutationPort } from "../../mutation/subagent-port.js";
import type { SubagentResource } from "../../domain/types.js";

async function makeSubagent(home: string, name: string, body = "agent"): Promise<{
  resource: SubagentResource;
  path: string;
}> {
  const dir = join(home, ".claude", "agents");
  await mkdir(dir, { recursive: true });
  const path = join(dir, `${name}.md`);
  await writeFile(path, `---\nname: ${name}\ndescription: test\n---\n\n${body}\n`, "utf8");
  return {
    resource: {
      kind: "subagent",
      tool: "claude-code",
      id: name,
      displayName: name,
      description: "test",
      sourceKind: "user-global",
      path,
      enabled: true,
      enabledSemantic: "native",
    },
    path,
  };
}

describe("SubagentMutationPort: preview", () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "skm-sa-"));
  });
  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  it("preview disable (managed default) emits a delete-file plus archive warning", async () => {
    const { resource } = await makeSubagent(home, "reviewer");
    const port = createSubagentMutationPort({ homedir: home });
    const p = await port.preview(resource, "disable", "auto");
    expect(p.files).toHaveLength(1);
    expect(p.files[0].kind).toBe("delete");
    expect(p.warnings.join(" ")).toMatch(/archived/i);
  });

  it("preview disable (symlink) emits a move-file plus unifiedRoot warning", async () => {
    const { resource } = await makeSubagent(home, "linter");
    const port = createSubagentMutationPort({ homedir: home });
    const p = await port.preview(resource, "disable", "symlink");
    expect(p.files[0].kind).toBe("move");
    expect(p.warnings.join(" ")).toMatch(/unified/);
  });

  it("preview enable without an archive entry yields a warning, not a diff", async () => {
    const { resource } = await makeSubagent(home, "ghost");
    const port = createSubagentMutationPort({ homedir: home });
    const p = await port.preview(resource, "enable", "auto");
    expect(p.files).toEqual([]);
    expect(p.warnings.join(" ")).toMatch(/No archived subagent/);
  });

  it("preview includes secret redaction for tokens inside the subagent body", async () => {
    const { resource } = await makeSubagent(
      home,
      "leaky",
      "Use GITHUB_TOKEN=ghp_dontleakme for auth.",
    );
    const port = createSubagentMutationPort({ homedir: home });
    const p = await port.preview(resource, "disable", "auto");
    expect(p.redactedEnvKeys).toContain("GITHUB_TOKEN");
    expect(p.unifiedDiff).not.toContain("ghp_dontleakme");
  });
});

describe("SubagentMutationPort: apply (real disk)", () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "skm-sa-apply-"));
  });
  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  it("apply disable archives the file (managed)", async () => {
    const { resource, path } = await makeSubagent(home, "reviewer");
    const port = createSubagentMutationPort({ homedir: home });
    const res = await port.apply(resource, "disable", "auto", {});
    expect(res.ok).toBe(true);
    expect(res.applied).toBe(true);
    // Original path should no longer exist.
    await expect(readFile(path, "utf8")).rejects.toThrow();
  });

  it("apply with dryRun: true does not move the file", async () => {
    const { resource, path } = await makeSubagent(home, "reviewer");
    const port = createSubagentMutationPort({ homedir: home });
    const res = await port.apply(resource, "disable", "auto", { dryRun: true });
    expect(res.applied).toBe(false);
    const after = await readFile(path, "utf8");
    expect(after).toContain("name: reviewer");
  });
});
