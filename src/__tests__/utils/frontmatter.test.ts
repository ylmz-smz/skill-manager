import { describe, expect, it } from "vitest";
import { parseSkillMarkdown } from "../../utils/frontmatter.js";

describe("parseSkillMarkdown", () => {
  it("reads name, description, disable-model-invocation", () => {
    const raw = `---
name: my-skill
description: Hello
disable-model-invocation: true
---

Body here
`;
    const { frontmatter, body } = parseSkillMarkdown(raw);
    expect(frontmatter.name).toBe("my-skill");
    expect(frontmatter.description).toBe("Hello");
    expect(frontmatter.disableModelInvocation).toBe(true);
    expect(body.trim()).toBe("Body here");
  });

  it("supports i18n description map", () => {
    const raw = `---
name: my-skill
description:
  zh: 你好
  en: Hello
---
`;
    const { frontmatter } = parseSkillMarkdown(raw);
    expect(frontmatter.description).toBe("你好");
    expect(frontmatter.descriptionI18n).toEqual({ zh: "你好", en: "Hello" });
  });
});
