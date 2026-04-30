import matter from "gray-matter";

export interface ParsedSubagentFrontmatter {
  name?: string;
  description?: string;
  model?: string;
  readonly?: boolean;
  isBackground?: boolean;
}

function asBool(v: unknown): boolean | undefined {
  if (typeof v === "boolean") return v;
  if (v === "true") return true;
  if (v === "false") return false;
  return undefined;
}

export function parseSubagentMarkdown(raw: string): {
  frontmatter: ParsedSubagentFrontmatter;
  body: string;
} {
  const { data, content } = matter(raw);
  const d = data as Record<string, unknown>;
  return {
    frontmatter: {
      name: typeof d.name === "string" ? d.name : undefined,
      description: typeof d.description === "string" ? d.description : undefined,
      model: typeof d.model === "string" ? d.model : undefined,
      readonly: asBool(d.readonly),
      isBackground: asBool(d.is_background),
    },
    body: content,
  };
}

