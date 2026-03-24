import { describe, expect, it } from "vitest";
import { mergeDiskAndArchived, sortSkills } from "../../core/list.js";
import type { SkillRecord } from "../../types.js";
import type { StateFile } from "../../core/state.js";

describe("mergeDiskAndArchived", () => {
  it("prefers disk record over archived when same id", () => {
    const disk: SkillRecord[] = [
      {
        tool: "cursor",
        id: "a",
        displayName: "a",
        description: "",
        sourceKind: "user-global",
        path: "/home/.cursor/skills/a",
        enabled: true,
        enabledSemantic: "native",
        skillKind: "markdown",
      },
    ];
    const state: StateFile = {
      version: 1,
      archived: [
        {
          tool: "cursor",
          id: "a",
          originalPath: "/home/.cursor/skills/a",
          archivePath: "/cfg/archive/cursor/a",
          archivedAt: "t",
        },
      ],
    };
    const out = mergeDiskAndArchived(disk, state, new Set(["cursor"]));
    expect(out.find((r) => r.id === "a")?.path).toBe("/home/.cursor/skills/a");
  });

  it("keeps archived-only skills when missing on disk", () => {
    const state: StateFile = {
      version: 1,
      archived: [
        {
          tool: "agents",
          id: "gone",
          originalPath: "/h/.agents/skills/gone",
          archivePath: "/cfg/archive/agents/gone",
          archivedAt: "t",
        },
      ],
    };
    const out = mergeDiskAndArchived([], state, new Set(["agents"]));
    expect(out).toHaveLength(1);
    expect(out[0].enabled).toBe(false);
    expect(out[0].enabledSemantic).toBe("managed");
  });
});

describe("sortSkills", () => {
  it("sorts by tool then id", () => {
    const rows: SkillRecord[] = [
      {
        tool: "cursor",
        id: "b",
        displayName: "b",
        description: "",
        sourceKind: "user-global",
        path: "/",
        enabled: true,
        enabledSemantic: "native",
        skillKind: "markdown",
      },
      {
        tool: "agents",
        id: "a",
        displayName: "a",
        description: "",
        sourceKind: "user-global",
        path: "/",
        enabled: true,
        enabledSemantic: "native",
        skillKind: "markdown",
      },
    ];
    const s = sortSkills(rows);
    expect(s[0].tool).toBe("agents");
    expect(s[1].tool).toBe("cursor");
  });
});
