import { describe, expect, it } from "vitest";
import { computeUnifiedDiff, countDiffLines } from "../../mutation/diff.js";
import type { DiffFile } from "../../mutation/port.js";

describe("computeUnifiedDiff", () => {
  it("emits a create patch with /dev/null as old header", () => {
    const out = computeUnifiedDiff([
      { path: "a.md", kind: "create", after: "hello\nworld\n" },
    ]);
    expect(out).toContain("--- /dev/null");
    expect(out).toContain("+++ a.md");
    expect(out).toContain("+hello");
    expect(out).toContain("+world");
  });

  it("emits a delete patch with /dev/null as new header", () => {
    const out = computeUnifiedDiff([
      { path: "a.md", kind: "delete", before: "gone\n" },
    ]);
    expect(out).toContain("--- a.md");
    expect(out).toContain("+++ /dev/null");
    expect(out).toContain("-gone");
  });

  it("emits a modify patch with both headers as the path", () => {
    const out = computeUnifiedDiff([
      {
        path: "config.json",
        kind: "modify",
        before: '{"a":1}\n',
        after: '{"a":2}\n',
      },
    ]);
    expect(out).toContain("--- config.json");
    expect(out).toContain("+++ config.json");
    expect(out).toContain("-{\"a\":1}");
    expect(out).toContain("+{\"a\":2}");
  });

  it("concatenates multiple file diffs in order", () => {
    const out = computeUnifiedDiff([
      { path: "x", kind: "create", after: "x\n" },
      { path: "y", kind: "delete", before: "y\n" },
    ]);
    const xIdx = out.indexOf("+++ x");
    const yIdx = out.indexOf("--- y");
    expect(xIdx).toBeGreaterThan(-1);
    expect(yIdx).toBeGreaterThan(xIdx);
  });

  it("returns empty string for empty input (no special-case branch needed)", () => {
    expect(computeUnifiedDiff([])).toBe("");
  });
});

describe("countDiffLines", () => {
  it("counts added/removed and skips +++/--- headers", () => {
    const patch = computeUnifiedDiff([
      {
        path: "x",
        kind: "modify",
        before: "a\nb\n",
        after: "a\nc\nd\n",
      },
    ]);
    const stats = countDiffLines(patch);
    expect(stats.added).toBe(2); // c, d
    expect(stats.removed).toBe(1); // b
  });

  it("returns zeros for empty diff", () => {
    expect(countDiffLines("")).toEqual({ added: 0, removed: 0 });
  });
});
