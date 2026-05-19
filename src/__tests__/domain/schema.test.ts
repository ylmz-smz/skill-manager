import { describe, expect, it } from "vitest";
import {
  McpServerResourceSchema,
  ResourceSchema,
  SkillResourceSchema,
  SubagentResourceSchema,
  ToolIdSchema,
} from "../../domain/schema.js";

const validSkill = {
  kind: "skill" as const,
  tool: "cursor" as const,
  id: "my-skill",
  displayName: "My Skill",
  description: "Hello",
  sourceKind: "user-global" as const,
  path: "/home/u/.cursor/skills/my-skill",
  enabled: true,
  enabledSemantic: "native" as const,
  skillKind: "markdown" as const,
};

const validSubagent = {
  kind: "subagent" as const,
  tool: "claude-code" as const,
  id: "reviewer",
  displayName: "reviewer",
  description: "—",
  sourceKind: "project" as const,
  path: "/proj/.claude/agents/reviewer.md",
  enabled: true,
  enabledSemantic: "native" as const,
};

const validMcp = {
  kind: "mcp_server" as const,
  tool: "cursor" as const,
  id: "github",
  displayName: "github",
  description: "",
  sourceKind: "user-global" as const,
  path: "/home/u/.cursor/mcp.json",
  enabled: true,
  enabledSemantic: "native" as const,
  transport: "stdio" as const,
  command: "node",
  args: ["server.js"],
  envKeys: ["GITHUB_TOKEN"],
};

describe("ToolIdSchema", () => {
  it("accepts every documented tool id", () => {
    for (const v of ["cursor", "claude-code", "codex", "agents", "vscode", "codebuddy"]) {
      expect(ToolIdSchema.safeParse(v).success).toBe(true);
    }
  });
  it("rejects bogus ids", () => {
    expect(ToolIdSchema.safeParse("xyz").success).toBe(false);
    expect(ToolIdSchema.safeParse(42).success).toBe(false);
  });
});

describe("SkillResourceSchema", () => {
  it("accepts a minimal valid skill", () => {
    expect(SkillResourceSchema.safeParse(validSkill).success).toBe(true);
  });
  it("rejects wrong discriminator", () => {
    const bad = { ...validSkill, kind: "subagent" } as unknown;
    expect(SkillResourceSchema.safeParse(bad).success).toBe(false);
  });
  it("rejects missing required fields", () => {
    const { id: _id, ...noId } = validSkill;
    expect(SkillResourceSchema.safeParse(noId).success).toBe(false);
  });
  it("accepts optional invocation + i18n", () => {
    expect(
      SkillResourceSchema.safeParse({
        ...validSkill,
        invocation: { disableModelInvocation: true },
        descriptionI18n: { zh: "你好", en: "Hello" },
      }).success,
    ).toBe(true);
  });
});

describe("SubagentResourceSchema", () => {
  it("accepts cursor/claude-code/codex tools", () => {
    for (const tool of ["cursor", "claude-code", "codex"] as const) {
      expect(SubagentResourceSchema.safeParse({ ...validSubagent, tool }).success).toBe(true);
    }
  });
  it("rejects ToolId='agents' (no subagent under ~/.agents/agents)", () => {
    expect(SubagentResourceSchema.safeParse({ ...validSubagent, tool: "agents" }).success).toBe(
      false,
    );
  });
});

describe("McpServerResourceSchema", () => {
  it("accepts a stdio server", () => {
    expect(McpServerResourceSchema.safeParse(validMcp).success).toBe(true);
  });
  it("accepts an http server with url", () => {
    expect(
      McpServerResourceSchema.safeParse({
        ...validMcp,
        transport: "http",
        url: "https://example.com/mcp",
        command: undefined,
        args: undefined,
      }).success,
    ).toBe(true);
  });
  it("rejects ToolId='codex' (codex has no MCP yet)", () => {
    expect(McpServerResourceSchema.safeParse({ ...validMcp, tool: "codex" }).success).toBe(false);
  });
});

describe("ResourceSchema (discriminated union)", () => {
  it("routes by kind", () => {
    expect(ResourceSchema.safeParse(validSkill).success).toBe(true);
    expect(ResourceSchema.safeParse(validSubagent).success).toBe(true);
    expect(ResourceSchema.safeParse(validMcp).success).toBe(true);
  });
  it("rejects an unknown kind", () => {
    expect(ResourceSchema.safeParse({ ...validSkill, kind: "weapon" } as unknown).success).toBe(
      false,
    );
  });
});
