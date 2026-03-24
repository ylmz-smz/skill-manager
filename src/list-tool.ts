import type { ToolId } from "./types.js";

const TOOL_IDS = new Set<ToolId>(["claude-code", "cursor", "agents"]);

export function parseListToolToken(raw: string): ToolId {
  const t = raw.trim().toLowerCase();
  if (t === "claude" || t === "cc") return "claude-code";
  if (t === "cursor" || t === "c") return "cursor";
  if (t === "agents" || t === "a" || t === "agent") return "agents";
  if (TOOL_IDS.has(t as ToolId)) return t as ToolId;
  throw new Error(
    `未知的工具「${raw}」。请使用: cursor | claude-code | agents（简写: c | cc | a）`,
  );
}

/**
 * 合并「位置参数 toolArg」与「--tool / -t」：不能互相矛盾。位置参数写 all 表示全部。
 */
export function resolveListToolFilter(
  toolArg: string | undefined,
  optionTool: string,
): ToolId | "all" {
  const optTrim = optionTool.trim().toLowerCase();
  const fromOption: ToolId | "all" =
    optTrim === "all" ? "all" : parseListToolToken(optionTool);

  if (toolArg === undefined || toolArg === "") {
    return fromOption;
  }

  const posTrim = toolArg.trim().toLowerCase();
  if (posTrim === "all") {
    if (fromOption !== "all") {
      throw new Error(
        `筛选冲突：位置参数为 all，但 --tool 为「${optionTool}」。`,
      );
    }
    return "all";
  }

  const fromPos = parseListToolToken(toolArg);
  if (fromOption !== "all" && fromOption !== fromPos) {
    throw new Error(
      `筛选冲突：位置参数为「${toolArg}」而 --tool 为「${optionTool}」，请只保留其一。`,
    );
  }
  return fromPos;
}
