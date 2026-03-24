import { readFile, writeFile } from "node:fs/promises";
import matter from "gray-matter";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

export async function setDisableModelInvocation(
  skillMdPath: string,
  disabled: boolean,
  dryRun: boolean,
): Promise<void> {
  const raw = await readFile(skillMdPath, "utf8");
  const parsed = matter(raw);
  const data = { ...(parsed.data as Record<string, unknown>) };
  if (disabled) data["disable-model-invocation"] = true;
  else delete data["disable-model-invocation"];
  const next = matter.stringify(parsed.content, data);
  if (!dryRun) {
    await mkdir(dirname(skillMdPath), { recursive: true });
    await writeFile(skillMdPath, next, "utf8");
  }
}
