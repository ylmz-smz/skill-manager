import { styleText } from "node:util";

/**
 * 让 @inquirer/select 当前行更易辨认：反色加粗高亮、固定光标符、底部说明行加粗。
 */
export const skillSelectTheme = {
  icon: {
    /** 比默认 › 更宽，便于对齐表格行左侧 */
    cursor: "❯",
  },
  indexMode: "hidden" as const,
  style: {
    highlight: (text: string) => styleText(["bold", "inverse"], text),
    description: (text: string) => styleText(["bold", "cyan"], text),
    keysHelpTip: (_keys: [string, string][]) =>
      styleText("dim", "↑↓ 移动选中行  ·  Enter 确认  ·  Ctrl+C 取消"),
  },
};
