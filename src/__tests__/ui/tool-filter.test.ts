import { describe, expect, it } from "vitest";
import {
  parseListToolToken,
  resolveListToolFilter,
} from "../../ui/tool-filter.js";

describe("parseListToolToken", () => {
  it("parses names and aliases", () => {
    expect(parseListToolToken("cursor")).toBe("cursor");
    expect(parseListToolToken("C")).toBe("cursor");
    expect(parseListToolToken("cc")).toBe("claude-code");
    expect(parseListToolToken("a")).toBe("agents");
  });
});

describe("resolveListToolFilter", () => {
  it("uses positional when --tool is all", () => {
    expect(resolveListToolFilter("cursor", "all")).toBe("cursor");
  });

  it("uses --tool when no positional", () => {
    expect(resolveListToolFilter(undefined, "agents")).toBe("agents");
  });

  it("throws on conflict", () => {
    expect(() => resolveListToolFilter("cursor", "agents")).toThrow(/冲突/);
  });
});
