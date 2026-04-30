import { describe, expect, it, vi } from "vitest";
import { listMcpServers } from "../../core/mcp.js";

vi.mock("../../utils/fs.js", async () => {
  const actual = await vi.importActual<typeof import("../../utils/fs.js")>(
    "../../utils/fs.js",
  );
  return {
    ...actual,
    readTextIfExists: vi.fn(async (p: string) => {
      const norm = p.replace(/\\/g, "/");
      if (norm.includes("/.cursor/mcp.json") && norm.startsWith("/proj/")) {
        return JSON.stringify(
          {
            mcpServers: {
              github: { command: "node", args: ["local.js"] },
              db: { type: "http", url: "http://localhost:1234/mcp" },
            },
          },
          null,
          2,
        );
      }
      if (norm.includes("/.cursor/mcp.json")) {
        return JSON.stringify(
          {
            mcpServers: {
              github: {
                command: "npx",
                args: ["-y", "@modelcontextprotocol/server-github"],
                env: { GITHUB_TOKEN: "${env:GITHUB_TOKEN}" },
              },
            },
          },
          null,
          2,
        );
      }
      if (norm.endsWith("/.claude.json")) {
        return JSON.stringify(
          {
            oauth: { token: "SECRET" },
            mcpServers: {
              memory: { type: "stdio", command: "npx", args: ["-y", "mem"] },
            },
          },
          null,
          2,
        );
      }
      if (norm.endsWith("/proj/.mcp.json")) {
        return JSON.stringify(
          {
            mcpServers: {
              memory: { type: "http", url: "http://override/mcp" },
            },
          },
          null,
          2,
        );
      }
      return undefined;
    }),
  };
});

describe("mcp discovery", () => {
  it("merges cursor global + project with project override", async () => {
    const rows = await listMcpServers({
      homedir: "/h",
      projectDir: "/proj",
      tool: "cursor",
    });
    const gh = rows.find((r) => r.id === "github")!;
    expect(gh.command).toBe("node");
    expect(gh.sourceKind).toBe("project");
    expect(gh.envKeys).toEqual([]); // overridden entry has no env
  });

  it("reads claude user ~/.claude.json and project .mcp.json with override", async () => {
    const rows = await listMcpServers({
      homedir: "/h",
      projectDir: "/proj",
      tool: "claude-code",
    });
    const mem = rows.find((r) => r.id === "memory")!;
    expect(mem.transport).toBe("http");
    expect(mem.url).toBe("http://override/mcp");
    expect(mem.sourceKind).toBe("project");
  });

  it("does not expose env values, only keys", async () => {
    const rows = await listMcpServers({
      homedir: "/h",
      projectDir: undefined,
      tool: "cursor",
    });
    const gh = rows.find((r) => r.id === "github")!;
    expect(gh.envKeys).toEqual(["GITHUB_TOKEN"]);
  });
});

