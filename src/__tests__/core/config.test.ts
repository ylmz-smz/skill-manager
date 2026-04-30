import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../../core/config.js";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>(
    "node:fs/promises",
  );
  return {
    ...actual,
    readFile: vi.fn(async (p: string) => {
      const norm = p.replace(/\\/g, "/");
      if (norm.endsWith("/.config/skill-manager/config.yaml")) {
        return `version: 1\nscan:\n  extraAgentRoots:\n    - ~/x/agents\nmcp:\n  readOnly: true\n`;
      }
      if (norm.endsWith("/proj/skill-manager.yaml")) {
        return `version: 1\nscan:\n  extraAgentRoots:\n    - /abs/agents\nmcp:\n  readOnly: false\n`;
      }
      throw new Error("ENOENT");
    }),
  };
});

vi.mock("../../utils/fs.js", async () => {
  const actual = await vi.importActual<typeof import("../../utils/fs.js")>(
    "../../utils/fs.js",
  );
  return {
    ...actual,
    pathExists: vi.fn(async (p: string) => {
      const norm = p.replace(/\\/g, "/");
      return (
        norm.endsWith("/.config/skill-manager/config.yaml") ||
        norm.endsWith("/proj/skill-manager.yaml")
      );
    }),
  };
});

describe("loadConfig", () => {
  it("merges global + project and expands ~", async () => {
    const { config, sources } = await loadConfig({ homedir: "/home", projectDir: "/proj" });
    expect(sources).toHaveLength(2);
    expect(config.scan.extraAgentRoots).toContain("/home/x/agents");
    expect(config.scan.extraAgentRoots).toContain("/abs/agents");
    expect(config.mcp.readOnly).toBe(false); // project overrides
  });
});

