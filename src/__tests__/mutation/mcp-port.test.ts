import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createMcpMutationPort } from "../../mutation/mcp-port.js";
import { REDACTED } from "../../mutation/redact.js";
import type { McpServerResource } from "../../domain/types.js";

function resource(home: string, id: string, envKeys: string[] = []): McpServerResource {
  return {
    kind: "mcp_server",
    tool: "cursor",
    id,
    displayName: id,
    description: "",
    sourceKind: "user-global",
    path: join(home, ".cursor", "mcp.json"),
    enabled: true,
    enabledSemantic: "native",
    transport: "stdio",
    command: "node",
    args: ["server.js"],
    envKeys,
  };
}

async function writeMcpConfig(home: string, servers: Record<string, unknown>): Promise<string> {
  const dir = join(home, ".cursor");
  await mkdir(dir, { recursive: true });
  const path = join(dir, "mcp.json");
  await writeFile(path, JSON.stringify({ mcpServers: servers }, null, 2), "utf8");
  return path;
}

describe("McpMutationPort: preview disable", () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "skm-mcp-"));
  });
  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  it("removes the target server in the after-state JSON", async () => {
    await writeMcpConfig(home, {
      github: { command: "node", args: ["s.js"] },
      kept: { command: "echo" },
    });
    const port = createMcpMutationPort({ homedir: home });
    const p = await port.preview(resource(home, "github"), "disable", "auto");
    expect(p.files).toHaveLength(1);
    expect(p.files[0].kind).toBe("modify");
    expect(p.files[0].after).not.toContain('"github"');
    expect(p.files[0].after).toContain('"kept"');
    expect(p.unifiedDiff).toMatch(/^-\s+"github"/m);
  });

  it("no-ops when server is not present in the config", async () => {
    await writeMcpConfig(home, { other: { command: "echo" } });
    const port = createMcpMutationPort({ homedir: home });
    const p = await port.preview(resource(home, "github"), "disable", "auto");
    expect(p.files).toEqual([]);
    expect(p.warnings[0]).toMatch(/not present/);
  });

  it("redacts sensitive env values in the diff", async () => {
    await writeMcpConfig(home, {
      github: {
        command: "node",
        args: ["s.js"],
        env: { GITHUB_TOKEN: "ghp_secretvalue", DEBUG: "1" },
      },
    });
    const port = createMcpMutationPort({ homedir: home });
    const p = await port.preview(
      resource(home, "github", ["GITHUB_TOKEN"]),
      "disable",
      "auto",
    );
    expect(p.redactedEnvKeys).toContain("GITHUB_TOKEN");
    expect(p.unifiedDiff).not.toContain("ghp_secretvalue");
    expect(p.unifiedDiff).toContain(REDACTED);
  });
});

describe("McpMutationPort: apply (real disk)", () => {
  let home: string;

  beforeEach(async () => {
    home = await mkdtemp(join(tmpdir(), "skm-mcp-apply-"));
  });
  afterEach(async () => {
    await rm(home, { recursive: true, force: true });
  });

  it("apply disable actually removes the server from mcp.json", async () => {
    const path = await writeMcpConfig(home, {
      github: { command: "node", args: ["s.js"] },
      kept: { command: "echo" },
    });
    const port = createMcpMutationPort({ homedir: home });
    const res = await port.apply(resource(home, "github"), "disable", "auto", {});
    expect(res.ok).toBe(true);
    expect(res.applied).toBe(true);
    const after = JSON.parse(await readFile(path, "utf8"));
    expect(after.mcpServers).not.toHaveProperty("github");
    expect(after.mcpServers).toHaveProperty("kept");
  });

  it("apply with dryRun: true does not write", async () => {
    const path = await writeMcpConfig(home, {
      github: { command: "node", args: ["s.js"] },
    });
    const port = createMcpMutationPort({ homedir: home });
    const res = await port.apply(resource(home, "github"), "disable", "auto", { dryRun: true });
    expect(res.ok).toBe(true);
    expect(res.applied).toBe(false);
    const after = JSON.parse(await readFile(path, "utf8"));
    expect(after.mcpServers).toHaveProperty("github");
  });

  it("readOnly mode refuses to write and returns ok:false", async () => {
    await writeMcpConfig(home, { github: { command: "node" } });
    const port = createMcpMutationPort({ homedir: home, readOnly: true });
    const res = await port.apply(resource(home, "github"), "disable", "auto", {});
    expect(res.ok).toBe(false);
    expect(res.warnings.join(" ")).toMatch(/readOnly/i);
  });
});
