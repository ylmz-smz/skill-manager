import { mkdir, readFile, writeFile } from "node:fs/promises";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createSkillMutationPort } from "../../mutation/skill-port.js";
import type { SkillResource } from "../../domain/types.js";

async function makeSkill(root: string, name: string, body = ""): Promise<string> {
  const dir = join(root, name);
  await mkdir(dir, { recursive: true });
  const md = `---\nname: ${name}\ndescription: Test skill\n---\n\n${body}\n`;
  await writeFile(join(dir, "SKILL.md"), md, "utf8");
  return dir;
}

function asResource(dir: string, name: string): SkillResource {
  return {
    kind: "skill",
    tool: "cursor",
    id: name,
    displayName: name,
    description: "Test skill",
    sourceKind: "user-global",
    path: dir,
    enabled: true,
    enabledSemantic: "native",
    skillKind: "markdown",
  };
}

describe("SkillMutationPort: native markdown preview", () => {
  let home: string;
  let skillsRoot: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "skm-port-"));
    skillsRoot = join(home, ".cursor", "skills");
    await mkdir(skillsRoot, { recursive: true });
  });

  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  it("preview disable produces a modify-diff that adds disable-model-invocation", async () => {
    const dir = await makeSkill(skillsRoot, "alpha");
    const port = createSkillMutationPort({ homedir: home });
    const r = asResource(dir, "alpha");
    const p = await port.preview(r, "disable", "auto");
    expect(p.files).toHaveLength(1);
    expect(p.files[0].kind).toBe("modify");
    expect(p.files[0].after).toContain("disable-model-invocation: true");
    expect(p.unifiedDiff).toContain("+disable-model-invocation");
    expect(p.warnings).toEqual([]);
  });

  it("preview disable on an already-disabled skill yields no file changes", async () => {
    const dir = await makeSkill(skillsRoot, "beta");
    await writeFile(
      join(dir, "SKILL.md"),
      "---\nname: beta\ndescription: x\ndisable-model-invocation: true\n---\n",
      "utf8",
    );
    const port = createSkillMutationPort({ homedir: home });
    const p = await port.preview(asResource(dir, "beta"), "disable", "auto");
    expect(p.files).toEqual([]);
    expect(p.unifiedDiff).toBe("");
    expect(p.warnings[0]).toMatch(/already disabled/);
  });

  it("preview enable removes the disable-model-invocation field", async () => {
    const dir = await makeSkill(skillsRoot, "gamma");
    await writeFile(
      join(dir, "SKILL.md"),
      "---\nname: gamma\ndescription: x\ndisable-model-invocation: true\n---\n",
      "utf8",
    );
    const port = createSkillMutationPort({ homedir: home });
    const p = await port.preview(asResource(dir, "gamma"), "enable", "auto");
    expect(p.files).toHaveLength(1);
    expect(p.files[0].after).not.toContain("disable-model-invocation");
    expect(p.unifiedDiff).toContain("-disable-model-invocation");
  });

  it("preview redacts sensitive frontmatter values", async () => {
    const dir = await makeSkill(skillsRoot, "delta");
    await writeFile(
      join(dir, "SKILL.md"),
      "---\nname: delta\ndescription: secrets\nGITHUB_TOKEN: ghp_xyz\n---\n",
      "utf8",
    );
    const port = createSkillMutationPort({ homedir: home });
    const p = await port.preview(asResource(dir, "delta"), "disable", "auto");
    expect(p.redactedEnvKeys).toContain("GITHUB_TOKEN");
    expect(p.unifiedDiff).not.toContain("ghp_xyz");
  });
});

describe("SkillMutationPort: managed strategy preview", () => {
  let home: string;
  let dir: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "skm-mgr-"));
    dir = await makeSkill(join(home, ".cursor", "skills"), "epsilon");
  });
  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  it("preview disable emits a move-file entry plus warnings", async () => {
    const port = createSkillMutationPort({ homedir: home });
    const p = await port.preview(asResource(dir, "epsilon"), "disable", "managed");
    expect(p.files).toHaveLength(1);
    expect(p.files[0].kind).toBe("move");
    expect(p.warnings.join(" ")).toMatch(/archived/i);
  });
});

describe("SkillMutationPort: apply (real disk)", () => {
  let home: string;
  let dir: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "skm-apply-"));
    dir = await makeSkill(join(home, ".cursor", "skills"), "zeta");
  });
  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  it("apply native+disable actually writes the SKILL.md flag", async () => {
    const port = createSkillMutationPort({ homedir: home });
    const r = asResource(dir, "zeta");
    const res = await port.apply(r, "disable", "auto", {});
    expect(res.ok).toBe(true);
    expect(res.applied).toBe(true);
    expect(res.writtenPaths).toContain(dir);
    const md = await readFile(join(dir, "SKILL.md"), "utf8");
    expect(md).toContain("disable-model-invocation: true");
  });

  it("apply with dryRun: true does not write", async () => {
    const port = createSkillMutationPort({ homedir: home });
    const r = asResource(dir, "zeta");
    const res = await port.apply(r, "disable", "auto", { dryRun: true });
    expect(res.ok).toBe(true);
    expect(res.applied).toBe(false);
    const md = await readFile(join(dir, "SKILL.md"), "utf8");
    expect(md).not.toContain("disable-model-invocation: true");
  });

  it("cursor-builtin resources are refused with a warning", async () => {
    const port = createSkillMutationPort({ homedir: home });
    const builtin: SkillResource = {
      ...asResource(dir, "zeta"),
      skillKind: "cursor-builtin",
      sourceKind: "cursor-builtin",
    };
    const p = await port.preview(builtin, "disable", "auto");
    expect(p.files).toEqual([]);
    expect(p.warnings[0]).toMatch(/built-in/i);
  });
});
