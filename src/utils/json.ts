export function parseJsonObject(raw: string): Record<string, unknown> | undefined {
  let j: unknown;
  try {
    j = JSON.parse(raw);
  } catch {
    return undefined;
  }
  if (!j || typeof j !== "object" || Array.isArray(j)) return undefined;
  return j as Record<string, unknown>;
}

export function stableJsonStringify(obj: unknown): string {
  return `${JSON.stringify(obj, null, 2)}\n`;
}

