import { describe, expect, it } from "vitest";
import {
  formatSkillListTable,
  shortenPath,
  sourceKindLabel,
} from "../../ui/format.js";
import type { SkillRecord } from "../../types.js";

describe("shortenPath", () => {
  it("replaces home prefix with ~", () => {
    expect(shortenPath("/Users/x/.cursor/skills/a", "/Users/x")).toBe(
      "~/.cursor/skills/a",
    );
  });
});

describe("sourceKindLabel", () => {
  it("returns Chinese label", () => {
    expect(sourceKindLabel("plugin")).toBe("插件");
  });
});

describe("formatSkillListTable", () => {
  it("includes header columns and checkbox column", () => {
    const rows: SkillRecord[] = [
      {
        tool: "cursor",
        id: "demo-skill",
        displayName: "demo-skill",
        description: "A demo skill",
        sourceKind: "user-global",
        path: "/Users/h/.cursor/skills/demo",
        enabled: true,
        enabledSemantic: "native",
        skillKind: "markdown",
      },
      {
        tool: "cursor",
        id: "off-skill",
        displayName: "off-skill",
        description: "",
        sourceKind: "user-global",
        path: "/Users/h/.cursor/skills/off",
        enabled: false,
        enabledSemantic: "native",
        skillKind: "markdown",
      },
    ];
    const text = formatSkillListTable(rows, "/Users/h", 100);
    expect(text).toContain("skill-name");
    expect(text).toContain("skill-desc");
    expect(text).toContain("skill-path");
    expect(text).toContain("skill-status");
    expect(text).toContain("demo-skill");
    expect(text).toContain("[x]");
    expect(text).toContain("[ ]");
    expect(text).toContain("enabled");
    expect(text).toContain("disabled");
    expect(text).toContain("~/.cursor/skills/demo");
  });
});
