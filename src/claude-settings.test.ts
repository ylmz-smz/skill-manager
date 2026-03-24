import { describe, expect, it } from "vitest";
import { withEnabledPlugin, type ClaudeSettings } from "./claude-settings.js";

describe("withEnabledPlugin", () => {
  it("merges enabledPlugins", () => {
    const prev: ClaudeSettings = {
      enabledPlugins: { "a@mp": true },
    };
    const next = withEnabledPlugin(prev, "b@mp", false);
    expect(next.enabledPlugins).toEqual({ "a@mp": true, "b@mp": false });
  });

  it("creates enabledPlugins when missing", () => {
    const next = withEnabledPlugin({}, "x@y", true);
    expect(next.enabledPlugins).toEqual({ "x@y": true });
  });
});
