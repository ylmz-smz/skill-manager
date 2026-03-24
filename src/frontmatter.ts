import matter from "gray-matter";

export interface ParsedSkillFrontmatter {
  name?: string;
  description?: string;
  disableModelInvocation?: boolean;
}

function asBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

export function parseSkillMarkdown(raw: string): {
  frontmatter: ParsedSkillFrontmatter;
  body: string;
} {
  const { data, content } = matter(raw);
  const d = data as Record<string, unknown>;
  return {
    frontmatter: {
      name: typeof d.name === "string" ? d.name : undefined,
      description:
        typeof d.description === "string" ? d.description : undefined,
      disableModelInvocation: asBool(d["disable-model-invocation"]),
    },
    body: content,
  };
}
