/* v101 冒烟：三阶九能得分表按判定三档着色（卡点红/待提升黄/正常绿），解决"点开了也没区分" */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v101 得分表三档着色", () => {
  it("主题助手：三档底色 + 三档文字色", () => {
    const src = read("src/components/reports/e3v37Theme.ts");
    need(src, "e3v37LevelBgClass", "判定底色助手");
    need(src, "#FBEAE8", "卡点淡红底");
    need(src, "#FBF3DC", "待提升淡琥珀底");
    need(src, "#F0FAF5", "正常淡绿底");
    need(src, '"#8f1313"', "卡点红字");
    need(src, '"#8a6d1a"', "待提升琥珀字");
    need(src, '"#2F8F60"', "正常绿字");
  });

  it("得分表小计行与逐题行都按判定着色", () => {
    const src = read("src/components/reports/AbilityScoreTable.tsx");
    need(src, "e3v37LevelBgClass(sub.level)", "小计行着色");
    need(src, "e3v37LevelBgClass(it.level)", "逐题行着色");
    /* 不再用"非正常即暖沙"的老逻辑 */
    if (/sub\.level !== "正常" \? "bg-\[#FAF3EB\]/.test(src)) throw new Error("小计行仍是老暖沙逻辑");
  });

  it("报告判定标签底色与得分表同族", () => {
    need(read("src/components/reports/e3v37Theme.ts"), 'bg: "#FBEAE8"', "LEVEL_STYLE 卡点底");
  });
});
