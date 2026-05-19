import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { startUiServer } from "../../ui/server.js";

interface Harness {
  home: string;
  port: number;
  close: () => Promise<void>;
  url: (path: string) => string;
}

async function startHarness(): Promise<Harness> {
  const home = await mkdtemp(join(tmpdir(), "skm-v2-"));
  // 0 -> let the OS pick a free port. We then read it back from the server.
  // startUiServer doesn't expose .address(), so we use a port chosen from a
  // private high range and accept rare collisions in CI by picking randomly
  // between 49152-65535. (vitest sandboxing makes this fine in practice.)
  const port = 49152 + Math.floor(Math.random() * 10000);
  const { close } = await startUiServer({ homedir: home, port });
  return {
    home,
    port,
    close,
    url: (p) => `http://127.0.0.1:${port}${p}`,
  };
}

async function makeSkill(home: string, id: string): Promise<string> {
  const dir = join(home, ".cursor", "skills", id);
  await mkdir(dir, { recursive: true });
  await writeFile(
    join(dir, "SKILL.md"),
    `---\nname: ${id}\ndescription: x\n---\n\nbody\n`,
    "utf8",
  );
  return dir;
}

describe("HTTP /api/v2/resources/preview", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await startHarness();
  });
  afterEach(async () => {
    await h.close();
    await rm(h.home, { recursive: true, force: true });
  });

  it("returns a DiffPreview for a skill disable request", async () => {
    const dir = await makeSkill(h.home, "alpha");
    const res = await fetch(h.url("/api/v2/resources/preview"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resource: {
          kind: "skill",
          tool: "cursor",
          id: "alpha",
          displayName: "alpha",
          description: "x",
          sourceKind: "user-global",
          path: dir,
          enabled: true,
          enabledSemantic: "native",
          skillKind: "markdown",
        },
        op: "disable",
        strategy: "auto",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.files).toHaveLength(1);
    expect(body.files[0].kind).toBe("modify");
    expect(body.unifiedDiff).toContain("+disable-model-invocation");
  });

  it("rejects an invalid request body with 400 + zod issues", async () => {
    const res = await fetch(h.url("/api/v2/resources/preview"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ resource: { kind: "bogus" }, op: "disable" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid request");
    expect(Array.isArray(body.issues)).toBe(true);
  });
});

describe("HTTP /api/v2/resources/apply", () => {
  let h: Harness;

  beforeEach(async () => {
    h = await startHarness();
  });
  afterEach(async () => {
    await h.close();
    await rm(h.home, { recursive: true, force: true });
  });

  it("applies a skill disable on real disk", async () => {
    const dir = await makeSkill(h.home, "beta");
    const res = await fetch(h.url("/api/v2/resources/apply"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resource: {
          kind: "skill",
          tool: "cursor",
          id: "beta",
          displayName: "beta",
          description: "x",
          sourceKind: "user-global",
          path: dir,
          enabled: true,
          enabledSemantic: "native",
          skillKind: "markdown",
        },
        op: "disable",
        strategy: "auto",
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.applied).toBe(true);
    const md = await readFile(join(dir, "SKILL.md"), "utf8");
    expect(md).toContain("disable-model-invocation: true");
  });

  it("dry-run does not write", async () => {
    const dir = await makeSkill(h.home, "gamma");
    const res = await fetch(h.url("/api/v2/resources/apply"), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        resource: {
          kind: "skill",
          tool: "cursor",
          id: "gamma",
          displayName: "gamma",
          description: "x",
          sourceKind: "user-global",
          path: dir,
          enabled: true,
          enabledSemantic: "native",
          skillKind: "markdown",
        },
        op: "disable",
        strategy: "auto",
        opts: { dryRun: true },
      }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.applied).toBe(false);
    const md = await readFile(join(dir, "SKILL.md"), "utf8");
    expect(md).not.toContain("disable-model-invocation: true");
  });
});
