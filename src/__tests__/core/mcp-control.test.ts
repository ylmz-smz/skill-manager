import { describe, expect, it, vi } from "vitest";
import { disableMcpServer, enableMcpServer } from "../../core/mcp-control.js";

const mocks = vi.hoisted(() => {
  const writeFileMock = vi.fn(async () => {});
  const readFileMock = vi.fn(async () =>
    JSON.stringify(
      {
        mcpServers: {
          github: { command: "npx", args: ["-y", "x"], env: { TOKEN: "secret" } },
        },
        other: { keep: true },
      },
      null,
      2,
    ),
  );
  return { writeFileMock, readFileMock };
});

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>(
    "node:fs/promises",
  );
  return {
    ...actual,
    readFile: mocks.readFileMock,
    writeFile: mocks.writeFileMock,
    mkdir: vi.fn(async () => {}),
    copyFile: vi.fn(async () => {}),
  };
});

vi.mock("../../core/state.js", async () => {
  const actual = await vi.importActual<typeof import("../../core/state.js")>(
    "../../core/state.js",
  );
  return {
    ...actual,
    loadState: vi.fn(async () => ({ version: 4, archived: [], mcpArchived: [], linked: [] })),
    saveState: vi.fn(async () => {}),
  };
});

describe("mcp-control", () => {
  it("refuses to write when readOnly", async () => {
    await expect(
      disableMcpServer({
        homedir: "/h",
        record: {
          tool: "cursor",
          id: "github",
          displayName: "github",
          description: "",
          sourceKind: "user-global",
          path: "/h/.cursor/mcp.json",
          transport: "stdio",
          command: "npx",
          args: [],
          envKeys: ["TOKEN"],
          enabled: true,
          enabledSemantic: "native",
        },
        readOnly: true,
        apply: true,
        dryRun: false,
      }),
    ).rejects.toThrow(/readOnly/);
  });

  it("refuses to write without --apply", async () => {
    await expect(
      disableMcpServer({
        homedir: "/h",
        record: {
          tool: "cursor",
          id: "github",
          displayName: "github",
          description: "",
          sourceKind: "user-global",
          path: "/h/.cursor/mcp.json",
          transport: "stdio",
          command: "npx",
          args: [],
          envKeys: ["TOKEN"],
          enabled: true,
          enabledSemantic: "native",
        },
        readOnly: false,
        apply: false,
        dryRun: false,
      }),
    ).rejects.toThrow(/--apply/);
  });

  it("dry-run does not write file", async () => {
    mocks.writeFileMock.mockClear();
    await disableMcpServer({
      homedir: "/h",
      record: {
        tool: "cursor",
        id: "github",
        displayName: "github",
        description: "",
        sourceKind: "user-global",
        path: "/h/.cursor/mcp.json",
        transport: "stdio",
        command: "npx",
        args: [],
        envKeys: ["TOKEN"],
        enabled: true,
        enabledSemantic: "native",
      },
      readOnly: false,
      apply: true,
      dryRun: true,
    });
    expect(mocks.writeFileMock).toHaveBeenCalledTimes(0);
  });

  it("enable refuses if nothing archived", async () => {
    await expect(
      enableMcpServer({
        homedir: "/h",
        record: {
          tool: "cursor",
          id: "github",
          displayName: "github",
          description: "",
          sourceKind: "user-global",
          path: "/h/.cursor/mcp.json",
          transport: "stdio",
          command: "npx",
          args: [],
          envKeys: ["TOKEN"],
          enabled: false,
          enabledSemantic: "managed",
        },
        readOnly: false,
        apply: true,
        dryRun: true,
      }),
    ).rejects.toThrow(/No archived MCP server/);
  });
});

