import matter from "gray-matter";

export interface ParsedSkillFrontmatter {
  name?: string;
  description?: string;
  descriptionI18n?: {
    zh?: string;
    en?: string;
  };
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
  const descRaw = d.description;
  const descI18n =
    descRaw && typeof descRaw === "object" && !Array.isArray(descRaw)
      ? {
          zh:
            typeof (descRaw as any).zh === "string"
              ? (descRaw as any).zh
              : undefined,
          en:
            typeof (descRaw as any).en === "string"
              ? (descRaw as any).en
              : undefined,
        }
      : undefined;
  const descStr = typeof descRaw === "string" ? descRaw : undefined;
  const description =
    descStr ??
    descI18n?.zh ??
    descI18n?.en ??
    undefined;
  return {
    frontmatter: {
      name: typeof d.name === "string" ? d.name : undefined,
      description,
      descriptionI18n:
        descI18n && (descI18n.zh || descI18n.en) ? descI18n : undefined,
      disableModelInvocation: asBool(d["disable-model-invocation"]),
    },
    body: content,
  };
}
