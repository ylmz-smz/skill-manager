import { homedir } from "node:os";
import { join } from "node:path";

export const CONFIG_DIR = "skill-manager";
export const STATE_FILENAME = "state.json";

export function defaultHomedir(): string {
  return homedir();
}

export function configRoot(h: string): string {
  return join(h, ".config", CONFIG_DIR);
}

export function statePath(h: string): string {
  return join(configRoot(h), STATE_FILENAME);
}

export function archiveRoot(h: string): string {
  return join(configRoot(h), "archive");
}

export function archiveDirFor(h: string, tool: string, id: string): string {
  return join(archiveRoot(h), tool, slugId(id));
}

export function archiveDirForKind(
  h: string,
  resourceKind: "skills" | "subagents",
  tool: string,
  id: string,
): string {
  return join(archiveRoot(h), resourceKind, tool, slugId(id));
}

export function slugId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 240) || "_empty";
}
