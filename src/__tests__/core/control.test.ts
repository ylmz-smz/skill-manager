import { describe, expect, it } from "vitest";
import { pickRecord } from "../../core/control.js";
import type { SkillRecord, ToolId } from "../../types.js";

function r(partial: Partial<SkillRecord> & Pick<SkillRecord, "tool" | "id" | "path">): SkillRecord {
  return {
    displayName: partial.id,
    description: "",
    sourceKind: "user-global",
    enabled: true,
    enabledSemantic: "native",
    skillKind: "markdown",
    ...partial,
  };
}

describe("pickRecord", () => {
  const tool: ToolId = "cursor";
  const rows: SkillRecord[] = [
    r({ tool, id: "a", path: "/p/a" }),
    r({ tool, id: "b", path: "/p/b" }),
  ];

  it("returns unique id match", () => {
    expect(pickRecord(rows, tool, "a")).toMatchObject({ path: "/p/a" });
  });

  it("throws when ambiguous", () => {
    const dup: SkillRecord[] = [
      r({ tool, id: "x", path: "/1/x" }),
      r({ tool, id: "x", path: "/2/x" }),
    ];
    expect(() => pickRecord(dup, tool, "x")).toThrow(/Ambiguous/);
  });

  it("disambiguates with --path", () => {
    const dup: SkillRecord[] = [
      r({ tool, id: "x", path: "/1/x" }),
      r({ tool, id: "x", path: "/2/x" }),
    ];
    expect(pickRecord(dup, tool, "x", "/2/x")).toMatchObject({ path: "/2/x" });
  });
});
