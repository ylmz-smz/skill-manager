import { describe, expect, it, vi } from "vitest";
import { loadState } from "../../core/state.js";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>(
    "node:fs/promises",
  );
  return {
    ...actual,
    readFile: vi.fn(async () => {
      // v1 state file shape
      return JSON.stringify(
        {
          version: 1,
          archived: [
            {
              tool: "cursor",
              id: "a",
              originalPath: "/o",
              archivePath: "/a",
              archivedAt: "t",
            },
          ],
        },
        null,
        2,
      );
    }),
  };
});

describe("state migration", () => {
  it("loads v1 state and upgrades archived entries to resourceKind=skill", async () => {
    const st = await loadState("/home");
    expect(st.version).toBe(3);
    expect(st.archived[0]?.resourceKind).toBe("skill");
    expect(st.mcpArchived).toEqual([]);
  });
});

