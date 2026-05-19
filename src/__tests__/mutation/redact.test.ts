import { describe, expect, it } from "vitest";
import { redact, REDACTED } from "../../mutation/redact.js";

describe("redact: JSON-style", () => {
  it("masks values for explicit envKeys", () => {
    const src = '{"env":{"GITHUB_TOKEN":"ghp_abc"}}';
    const r = redact(src, { envKeys: ["GITHUB_TOKEN"] });
    expect(r.redacted).toContain(`"${REDACTED}"`);
    expect(r.redacted).not.toContain("ghp_abc");
    expect(r.redactedKeys).toEqual(["GITHUB_TOKEN"]);
  });

  it("masks by built-in suffix pattern even without explicit list", () => {
    const src = '{"env":{"OPENAI_API_KEY":"sk-xyz","SOME_PASSWORD":"hunter2"}}';
    const r = redact(src);
    expect(r.redacted).not.toContain("sk-xyz");
    expect(r.redacted).not.toContain("hunter2");
    expect(r.redactedKeys).toEqual(["OPENAI_API_KEY", "SOME_PASSWORD"]);
  });

  it("leaves non-sensitive keys untouched", () => {
    const src = '{"env":{"NODE_ENV":"production","DEBUG":"1"}}';
    const r = redact(src);
    expect(r.redacted).toBe(src);
    expect(r.redactedKeys).toEqual([]);
  });
});

describe("redact: shell-style KEY=value", () => {
  it("masks token-like assignments in args arrays", () => {
    const src = 'args: ["-e", "GITHUB_TOKEN=ghp_xxx", "-v", "."]';
    const r = redact(src);
    expect(r.redacted).toContain(`GITHUB_TOKEN=${REDACTED}`);
    expect(r.redacted).not.toContain("ghp_xxx");
    expect(r.redactedKeys).toEqual(["GITHUB_TOKEN"]);
  });
});

describe("redact: YAML-style KEY: value", () => {
  it("masks single-line assignments in frontmatter blocks", () => {
    const src = "GITHUB_TOKEN: ghp_yaml\nNORMAL_VAR: ok";
    const r = redact(src);
    expect(r.redacted).toContain(`GITHUB_TOKEN: ${REDACTED}`);
    expect(r.redacted).toContain("NORMAL_VAR: ok");
    expect(r.redactedKeys).toEqual(["GITHUB_TOKEN"]);
  });

  it("preserves indentation", () => {
    const src = "  env:\n    SECRET_KEY: top_secret";
    const r = redact(src);
    expect(r.redacted).toContain(`    SECRET_KEY: ${REDACTED}`);
  });
});

describe("redact: edge cases", () => {
  it("no-op on empty input", () => {
    const r = redact("");
    expect(r.redacted).toBe("");
    expect(r.redactedKeys).toEqual([]);
  });

  it("returns sorted, deduplicated key list", () => {
    const src =
      '{"GITHUB_TOKEN":"a"} GITHUB_TOKEN=b\nGITHUB_TOKEN: c\nAPI_KEY: d';
    const r = redact(src);
    expect(r.redactedKeys).toEqual(["API_KEY", "GITHUB_TOKEN"]);
  });

  it("does not partially mask values that share a prefix (e.g. PUBLIC_KEY)", () => {
    const src = '{"PUBLIC_KEY":"this is also masked by suffix _KEY"}';
    const r = redact(src);
    expect(r.redactedKeys).toEqual(["PUBLIC_KEY"]);
  });

  it("does not mask values for unrelated keys that contain SECRET as a substring", () => {
    const src = '{"NOT_SECRET_FIELD_NAME":"ok"}';
    // _FIELD_NAME doesn't match the suffix list, so we leave it alone.
    const r = redact(src);
    expect(r.redactedKeys).toEqual([]);
    expect(r.redacted).toBe(src);
  });
});
