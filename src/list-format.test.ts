import { describe, expect, it } from "vitest";
import {
  formatSkillListText,
  shortenPath,
  sourceKindLabel,
} from "./list-format.js";
import type { SkillRecord } from "./types.js";

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

describe("formatSkillListText", () => {
  it("groups by tool and includes summary line", () => {
    const rows: SkillRecord[] = [
      {
        tool: "cursor",
        id: "demo",
        displayName: "demo",
        description: "Hello world",
        sourceKind: "user-global",
        path: "/Users/h/.cursor/skills/demo",
        enabled: true,
        enabledSemantic: "native",
        skillKind: "markdown",
      },
    ];
    const text = formatSkillListText(rows, "/Users/h", 80);
    expect(text).toContain("共 1 条技能");
    expect(text).toContain("Cursor");
    expect(text).toContain("demo");
    expect(text).toContain("~/.cursor/skills/demo");
  });
});
