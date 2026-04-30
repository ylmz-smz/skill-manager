import { describe, expect, it, vi } from "vitest";
import { disableSubagent, enableSubagent } from "../../core/subagents-control.js";

const mocks = vi.hoisted(() => {
  const renameMock = vi.fn(async () => {});
  const writeFileMock = vi.fn(async () => {});
  const mkdirMock = vi.fn(async () => {});
  const statMock = vi.fn(async (p: string) => {
    // simulate archive target missing and restore target missing
    if (p.includes("/archive/") || p.endsWith("/.cursor/agents/verifier-restored.md")) {
      const err: any = new Error("ENOENT");
      err.code = "ENOENT";
      throw err;
    }
    return { isFile: () => true };
  });
  const readFileMock = vi.fn(async () =>
    JSON.stringify({ version: 2, archived: [] }, null, 2),
  );
  return { renameMock, writeFileMock, mkdirMock, statMock, readFileMock };
});

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>(
    "node:fs/promises",
  );
  return {
    ...actual,
    rename: mocks.renameMock,
    writeFile: mocks.writeFileMock,
    readFile: mocks.readFileMock,
    mkdir: mocks.mkdirMock,
    stat: mocks.statMock,
  };
});

describe("subagents enable/disable (managed archive)", () => {
  it("disables by archiving and writing state", async () => {
    await disableSubagent({
      homedir: "/h",
      record: {
        tool: "cursor",
        id: "verifier",
        displayName: "verifier",
        description: "d",
        sourceKind: "user-global",
        path: "/h/.cursor/agents/verifier.md",
        enabled: true,
        enabledSemantic: "native",
      },
      dryRun: false,
    });
    expect(mocks.renameMock).toHaveBeenCalledTimes(1);
    expect(mocks.writeFileMock).toHaveBeenCalledTimes(1);
  });

  it("enables by restoring from archive and updating state", async () => {
    mocks.readFileMock.mockImplementationOnce(async () =>
      JSON.stringify(
        {
          version: 2,
          archived: [
            {
              tool: "cursor",
              id: "verifier",
              originalPath: "/h/.cursor/agents/verifier-restored.md",
              archivePath: "/h/.config/skill-manager/archive/subagents/cursor/verifier",
              archivedAt: "t",
              resourceKind: "subagent",
            },
          ],
        },
        null,
        2,
      ),
    );
    await enableSubagent({
      homedir: "/h",
      record: {
        tool: "cursor",
        id: "verifier",
        displayName: "verifier",
        description: "d",
        sourceKind: "user-global",
        path: "/h/.config/skill-manager/archive/subagents/cursor/verifier",
        enabled: false,
        enabledSemantic: "managed",
      },
      dryRun: false,
    });
    expect(mocks.renameMock).toHaveBeenCalledTimes(2);
    expect(mocks.writeFileMock).toHaveBeenCalledTimes(2);
  });
});

