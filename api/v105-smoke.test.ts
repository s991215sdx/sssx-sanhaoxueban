/* v105 冒烟：待提升判定用亮黄色系（v122 起 bar=#FCCE45 色卡黄，text=#C79400 保证可读） */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v105 待提升亮黄", () => {
  it("LEVEL_STYLE 待提升：bar 亮黄 #FCCE45，text 可读金黄", () => {
    const src = read("src/components/reports/e3v37Theme.ts");
    if (!/待提升: \{ text: "#8A6500", bar: "#(FFC600|FCCE45)"/.test(src))
      throw new Error("缺：待提升亮黄定义");
  });

  it("文字色助手与条款卡同步用新色", () => {
    const src = read("src/components/reports/e3v37Theme.ts");
    if (!/待提升" \? "text-\[#8A6500\]"/.test(src)) throw new Error("缺：文字色助手新色");
    if (!src.includes("border-[#8A6500]/50 bg-[#FAF0CC] text-[#8A6500]"))
      throw new Error("缺：条款卡新色");
  });

  it("旧暗淡琥珀色已清除", () => {
    const src = read("src/components/reports/e3v37Theme.ts");
    if (src.includes("#8a6d1a") || src.includes("#c7a23a"))
      throw new Error("残留：旧琥珀色");
  });
});
