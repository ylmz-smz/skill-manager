import { describe, expect, it, vi } from "vitest";
import { discoverSubagents } from "../../adapters/subagents.js";

vi.mock("node:fs/promises", async () => {
  const actual = await vi.importActual<typeof import("node:fs/promises")>(
    "node:fs/promises",
  );
  return {
    ...actual,
    readFile: vi.fn(async (p: string) => {
      if (p.endsWith("verifier.md")) {
        return `---\nname: verifier\ndescription: Validates completed work.\nmodel: fast\nreadonly: true\nis_background: true\n---\n\nBody\n`;
      }
      return `---\ndescription: No name provided\n---\n\nBody\n`;
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
      // Only enable one root for deterministic test
      return p.replace(/\\/g, "/").endsWith("/.cursor/agents");
    }),
    findMarkdownUnder: vi.fn(async () => [
      "/h/.cursor/agents/verifier.md",
      "/h/.cursor/agents/no-name.md",
    ]),
  };
});

describe("discoverSubagents", () => {
  it("parses frontmatter name/description and creates stable ids", async () => {
    const out = await discoverSubagents("/h");
    expect(out).toHaveLength(2);
    expect(out[0]?.tool).toBe("cursor");
    expect(out.map((x) => x.id)).toEqual(["verifier", "no-name"]);
    expect(out[0]?.notes).toMatch(/model=fast/);
    expect(out[0]?.notes).toMatch(/readonly=true/);
    expect(out[0]?.notes).toMatch(/is_background=true/);
  });
});

