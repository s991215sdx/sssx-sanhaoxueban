/* v103 冒烟：得分表判定颜色标识——小计行圆点 + 逐题行左侧色条 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v103 判定颜色标识", () => {
  it("小计行：判定圆点（红/琥珀/绿）", () => {
    const src = read("src/components/reports/AbilityScoreTable.tsx");
    if (!/rounded-full[\s\S]{0,80}e3v37LevelBarColor\(sub\.level\)/.test(src)) throw new Error("缺：小计行判定圆点");
  });

  it("逐题行：左侧短圆角色条（v113 替代通高 3px 边框）", () => {
    const src = read("src/components/reports/AbilityScoreTable.tsx");
    if (!/h-7 w-\[3\.5px\][\s\S]{0,80}rounded-full/.test(src)) throw new Error("缺：短圆角色条");
    if (!/background: e3v37LevelBarColor\(it\.level\)/.test(src)) throw new Error("缺：色条取判定色");
  });

  it("取色助手使用三档 bar 色", () => {
    needHelper();
  });
});

function needHelper() {
  const src = read("src/components/reports/e3v37Theme.ts");
  for (const [tok, label] of [
    ['卡点: { text: "#A82524", bar: "#DD3534"', "卡点红"],
    ['待提升: { text: "#8A6500", bar: "#FCCE45"', "待提升亮黄"],
    ['正常: { text: "#2F7A41", bar: "#52A965"', "正常绿"],
  ]) {
    if (!src.includes(tok)) throw new Error(`缺 ${label}：${tok}`);
  }
}
