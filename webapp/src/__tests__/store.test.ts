import { describe, expect, it } from "vitest";
import { filterResources, resourceKey } from "../store";
import type { Resource } from "../api/types";
import type { ResourceKind, ToolId } from "@domain/types.js";

function skill(id: string, tool: ToolId, name = id, desc = ""): Resource {
  return {
    kind: "skill",
    tool,
    id,
    displayName: name,
    description: desc,
    sourceKind: "user-global",
    path: `/tmp/${id}`,
    enabled: true,
    enabledSemantic: "native",
    skillKind: "markdown",
  };
}

describe("resourceKey", () => {
  it("builds a deterministic kind:tool:id key", () => {
    expect(resourceKey(skill("alpha", "cursor"))).toBe("skill:cursor:alpha");
  });
});

describe("filterResources", () => {
  const rows: Resource[] = [
    skill("alpha", "cursor", "Alpha"),
    skill("beta", "claude-code", "Beta", "shared description"),
    skill("gamma", "cursor", "Gamma", "shared description"),
  ];
  const allKinds: ReadonlySet<ResourceKind> = new Set(["skill", "subagent", "mcp_server"]);

  it("returns everything with default filters", () => {
    expect(filterResources(rows, allKinds, new Set(), "")).toHaveLength(3);
  });

  it("filters by kind", () => {
    expect(filterResources(rows, new Set(["mcp_server"]), new Set(), "")).toEqual([]);
  });

  it("filters by tool (empty set = no filter)", () => {
    const filtered = filterResources(rows, allKinds, new Set(["cursor"]), "");
    expect(filtered.map((r) => r.id).sort()).toEqual(["alpha", "gamma"]);
  });

  it("search matches against both id and displayName (case-insensitive)", () => {
    const byId = filterResources(rows, allKinds, new Set(), "ALPHA");
    expect(byId).toHaveLength(1);
    expect(byId[0].id).toBe("alpha");
    const byName = filterResources(rows, allKinds, new Set(), "beta");
    expect(byName).toHaveLength(1);
    expect(byName[0].id).toBe("beta");
  });

  it("combines kind + tool + search filters", () => {
    const filtered = filterResources(
      rows,
      new Set(["skill"]),
      new Set(["cursor"]),
      "gamma",
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].id).toBe("gamma");
  });
});
