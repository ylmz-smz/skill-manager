import { confirm, select } from "@inquirer/prompts";
import {
  disableSkill,
  enableSkill,
  isSkillControllable,
} from "./control.js";
import { formatSkillListTable, shortenPath, toolTitle } from "./list-format.js";
import type { ControlStrategy, SkillRecord } from "./types.js";

function choiceLabel(r: SkillRecord, homedir: string): string {
  const on = r.enabled ? "启用" : "停用";
  const t = toolTitle(r.tool);
  const p = shortenPath(r.path, homedir);
  return `[${on}] ${t} · ${r.id}  ${p}`;
}

function assertTTY(): void {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      "--interactive 需要在真实终端（TTY）中运行。脚本请使用 list --json 配合 enable/disable。",
    );
  }
}

export async function runInteractiveList(opts: {
  homedir: string;
  projectDir?: string;
  rows: SkillRecord[];
  strategy: ControlStrategy;
  dryRun: boolean;
  globalSettings: boolean;
  termWidth: number;
}): Promise<void> {
  assertTTY();
  const {
    homedir,
    projectDir,
    rows,
    strategy,
    dryRun,
    globalSettings,
    termWidth,
  } = opts;

  if (rows.length === 0) {
    process.stdout.write("当前条件下未发现任何技能。\n");
    return;
  }

  process.stdout.write(formatSkillListTable(rows, homedir, termWidth));
  process.stdout.write("\n");

  let record: SkillRecord;
  try {
    record = await select<SkillRecord>({
      message: "选择一条技能（方向键移动，回车确认）",
      choices: rows.map((r) => ({
        name: choiceLabel(r, homedir),
        value: r,
        disabled: isSkillControllable(r)
          ? false
          : "Cursor 内置项：请在 Cursor「设置 → Rules / Skills」中切换",
      })),
      pageSize: Math.min(15, Math.max(5, rows.length)),
    });
  } catch {
    process.stdout.write("已取消选择。\n");
    return;
  }

  if (!isSkillControllable(record)) {
    process.stdout.write("该项不可通过本 CLI 开关。\n");
    return;
  }

  const toolCn = toolTitle(record.tool);
  const pathShort = shortenPath(record.path, homedir);

  let ok: boolean;
  try {
    if (record.enabled) {
      ok = await confirm({
        message: `确认关闭技能「${record.id}」？\n  (${toolCn} · ${pathShort})`,
        default: false,
      });
    } else {
      ok = await confirm({
        message: `确认开启技能「${record.id}」？\n  (${toolCn} · ${pathShort})`,
        default: false,
      });
    }
  } catch {
    process.stdout.write("已取消。\n");
    return;
  }

  if (!ok) {
    process.stdout.write("已取消。\n");
    return;
  }

  if (record.enabled) {
    await disableSkill({
      homedir,
      projectDir,
      record,
      strategy,
      dryRun,
      globalSettings,
    });
    process.stdout.write(
      dryRun ? "[dry-run] 已模拟关闭。\n" : "已关闭。\n",
    );
  } else {
    await enableSkill({
      homedir,
      projectDir,
      record,
      strategy,
      dryRun,
      globalSettings,
    });
    process.stdout.write(
      dryRun ? "[dry-run] 已模拟开启。\n" : "已开启。\n",
    );
  }
}
