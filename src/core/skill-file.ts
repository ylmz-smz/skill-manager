import { readFile, writeFile } from "node:fs/promises";
import matter from "gray-matter";
import { mkdir } from "node:fs/promises";
import { dirname } from "node:path";

function isErrnoCode(err: unknown, ...codes: string[]): boolean {
  return Boolean(
    err && typeof err === "object" && "code" in err && codes.includes(String((err as { code: unknown }).code)),
  );
}

/**
 * Wrap an EACCES/EPERM/EROFS error with an actionable message hinting users
 * to fall back to the `managed` strategy (which archives the directory
 * instead of writing the original file).
 */
function explainWriteFailure(filePath: string, err: unknown): Error {
  if (isErrnoCode(err, "EACCES", "EPERM", "EROFS")) {
    return new Error(
      `SKILL.md is not writable: ${filePath}. ` +
        `Re-run with --strategy managed (or pick "managed" in the UI drawer) ` +
        `to disable by archiving the directory instead of editing the file in place.`,
    );
  }
  return err instanceof Error ? err : new Error(String(err));
}

export async function setDisableModelInvocation(
  skillMdPath: string,
  disabled: boolean,
  dryRun: boolean,
): Promise<void> {
  let raw: string;
  try {
    raw = await readFile(skillMdPath, "utf8");
  } catch (e) {
    throw explainWriteFailure(skillMdPath, e);
  }
  const parsed = matter(raw);
  const data = { ...(parsed.data as Record<string, unknown>) };
  if (disabled) data["disable-model-invocation"] = true;
  else delete data["disable-model-invocation"];
  const next = matter.stringify(parsed.content, data);
  if (!dryRun) {
    try {
      await mkdir(dirname(skillMdPath), { recursive: true });
      await writeFile(skillMdPath, next, "utf8");
    } catch (e) {
      throw explainWriteFailure(skillMdPath, e);
    }
  }
}
