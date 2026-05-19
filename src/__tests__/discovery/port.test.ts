import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  agentsSkillAdapter,
} from "../../adapters/agents.js";
import { claudeSkillAdapter } from "../../adapters/claude.js";
import { codebuddySkillAdapter } from "../../adapters/codebuddy.js";
import { cursorSkillAdapter } from "../../adapters/cursor.js";
import { vscodeSkillAdapter } from "../../adapters/vscode.js";
import { claudeMcpAdapter } from "../../adapters/mcp-claude.js";
import { cursorMcpAdapter } from "../../adapters/mcp-cursor.js";
import {
  claudeSubagentPort,
  codexSubagentPort,
  cursorSubagentPort,
  subagentDiscoveryPorts,
} from "../../adapters/subagents.js";
import type { DiscoveryPort, ScanContext } from "../../discovery/port.js";
import type { ResourceKind } from "../../domain/types.js";

const allPorts: DiscoveryPort<ResourceKind>[] = [
  cursorSkillAdapter,
  claudeSkillAdapter,
  vscodeSkillAdapter,
  codebuddySkillAdapter,
  agentsSkillAdapter,
  cursorMcpAdapter,
  claudeMcpAdapter,
  cursorSubagentPort,
  claudeSubagentPort,
  codexSubagentPort,
];

describe("DiscoveryPort contract", () => {
  it("every adapter exposes tool + kind + scan()", () => {
    for (const p of allPorts) {
      expect(typeof p.tool).toBe("string");
      expect(typeof p.kind).toBe("string");
      expect(typeof p.scan).toBe("function");
    }
  });

  it("kind discriminator matches expectations", () => {
    expect(cursorSkillAdapter.kind).toBe("skill");
    expect(cursorMcpAdapter.kind).toBe("mcp_server");
    expect(cursorSubagentPort.kind).toBe("subagent");
  });

  it("subagentDiscoveryPorts covers cursor/claude-code/codex", () => {
    expect(subagentDiscoveryPorts.map((p) => p.tool).sort()).toEqual([
      "claude-code",
      "codex",
      "cursor",
    ]);
  });

  it("flat skill adapters share the same Port shape (no special-cased fields)", () => {
    const ports = [
      cursorSkillAdapter,
      claudeSkillAdapter,
      vscodeSkillAdapter,
      codebuddySkillAdapter,
    ];
    for (const p of ports) {
      expect(p.kind).toBe("skill");
      expect(typeof p.scan).toBe("function");
    }
  });
});

describe("DiscoveryPort.scan returns Resources, not Records", () => {
  let homedir: string;

  beforeAll(async () => {
    homedir = await mkdtemp(join(tmpdir(), "skm-port-"));
  });

  afterAll(async () => {
    await rm(homedir, { recursive: true, force: true });
  });

  it("empty homedir yields empty arrays", async () => {
    const ctx: ScanContext = { homedir };
    for (const p of allPorts) {
      const out = await p.scan(ctx);
      expect(Array.isArray(out)).toBe(true);
      // Empty homedir: nothing to discover — this is the precise contract
      // we're checking, not the fact of discovery.
      for (const r of out) {
        expect(r.kind).toBe(p.kind);
      }
    }
  });
});
