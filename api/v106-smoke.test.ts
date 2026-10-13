/* v106 冒烟：三阶板块配色对齐产品阶梯图（乐学青绿 / 会学亮黄 / 善学橙） */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v106 三阶板块色", () => {
  it("主题定义：乐学青绿 / 会学亮黄 / 善学橙（solid + text）", () => {
    const src = read("src/components/reports/e3v37Theme.ts");
    for (const tok of [
      '乐学: { solid: "#3991A5", text: "#2A6E7E", tint: "#E3F0F3" }',
      '会学: { solid: "#FCCE45", text: "#8A6500", tint: "#FFF7D8" }',
      '善学: { solid: "#FA872A", text: "#B05E14", tint: "#FDEBD9" }',
    ]) {
      if (!src.includes(tok)) throw new Error(`缺：${tok}`);
    }
  });

  it("得分表分组标题用板块色（色块+文字）", () => {
    const src = read("src/components/reports/AbilityScoreTable.tsx");
    if (!src.includes("E3V37_SYSTEM_COLOR")) throw new Error("缺：得分表引用板块色");
    if (!/rounded-\[4px\]/.test(src)) throw new Error("缺：分组标题色块");
  });

  it("训练方案库三阶样式同色系", () => {
    const src = read("src/data/training/threeTierPlans.ts");
    for (const tok of ['color: "#2A6E7E"', 'color: "#8A6500"', 'color: "#B05E14"']) {
      if (!src.includes(tok)) throw new Error(`缺：${tok}`);
    }
    if (src.includes("#3d8ec4") || src.includes("#c7a23a")) throw new Error("残留：旧蓝/旧暗黄");
  });
});
