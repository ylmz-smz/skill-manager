import { describe, expect, it } from "vitest";
import {
  fromMcpServerResource,
  fromResource,
  fromSkillResource,
  fromSubagentResource,
  toMcpServerResource,
  toSkillResource,
  toSubagentResource,
} from "../../domain/convert.js";
import type {
  McpServerRecord,
  SkillRecord,
  SubagentRecord,
} from "../../types.js";

const skill: SkillRecord = {
  tool: "cursor",
  id: "my-skill",
  displayName: "My Skill",
  description: "Hello",
  sourceKind: "user-global",
  path: "/home/u/.cursor/skills/my-skill",
  enabled: true,
  enabledSemantic: "native",
  skillKind: "markdown",
};

const subagent: SubagentRecord = {
  tool: "claude-code",
  id: "reviewer",
  displayName: "reviewer",
  description: "—",
  sourceKind: "project",
  path: "/proj/.claude/agents/reviewer.md",
  enabled: true,
  enabledSemantic: "native",
};

const mcp: McpServerRecord = {
  tool: "cursor",
  id: "github",
  displayName: "github",
  description: "",
  sourceKind: "user-global",
  path: "/home/u/.cursor/mcp.json",
  enabled: true,
  enabledSemantic: "native",
  transport: "stdio",
  command: "node",
  args: ["server.js"],
  envKeys: ["GITHUB_TOKEN"],
};

describe("Record ⇄ Resource conversion is lossless", () => {
  it("skill: roundtrips identically", () => {
    expect(fromSkillResource(toSkillResource(skill))).toEqual(skill);
  });
  it("subagent: roundtrips identically", () => {
    expect(fromSubagentResource(toSubagentResource(subagent))).toEqual(subagent);
  });
  it("mcp_server: roundtrips identically", () => {
    expect(fromMcpServerResource(toMcpServerResource(mcp))).toEqual(mcp);
  });
});

describe("toXxxResource attaches the right discriminator", () => {
  it("skill kind === 'skill'", () => {
    expect(toSkillResource(skill).kind).toBe("skill");
  });
  it("subagent kind === 'subagent'", () => {
    expect(toSubagentResource(subagent).kind).toBe("subagent");
  });
  it("mcp_server kind === 'mcp_server'", () => {
    expect(toMcpServerResource(mcp).kind).toBe("mcp_server");
  });
});

describe("fromResource dispatches on kind", () => {
  it("returns skill record from skill resource", () => {
    const got = fromResource(toSkillResource(skill));
    expect(got).toEqual(skill);
  });
  it("returns subagent record from subagent resource", () => {
    const got = fromResource(toSubagentResource(subagent));
    expect(got).toEqual(subagent);
  });
  it("returns mcp record from mcp resource", () => {
    const got = fromResource(toMcpServerResource(mcp));
    expect(got).toEqual(mcp);
  });
});
