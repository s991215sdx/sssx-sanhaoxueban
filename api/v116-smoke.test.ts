/* v116 冒烟：系统框架图按新设计稿重设计——三档(重点关注<2.0/预警2.0-2.9/正常≥3.0)+白卡能力块+图例 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v116 框架图三档新设计", () => {
  it("BAND 三档：红=重点关注/黄橙=预警/绿=正常", () => {
    const src = read("src/components/reports/SystemFramework.tsx");
    for (const tok of [
      '卡点: { label: "重点关注", border: "#D84E4E", bg: "#FDECEC", text: "#B42323" }',
      '待提升: { label: "预警", border: "#E3A008", bg: "#FCF3DC", text: "#B07800" }',
      '正常: { label: "正常", border: "#3CC078", bg: "#E4F7EC", text: "#2F8F60" }',
    ]) {
      if (!src.includes(tok)) throw new Error(`缺：${tok}`);
    }
  });

  it("框架图专用阈值：<2.0 / 2.0-2.9 / ≥3.0", () => {
    const src = read("src/components/reports/SystemFramework.tsx");
    if (!/if \(score < 2\.0\) return "卡点";/.test(src)) throw new Error("缺：<2.0 重点关注");
    if (!/if \(score < 3\.0\) return "待提升";/.test(src)) throw new Error("缺：<3.0 预警");
  });

  it("能力块白色小卡（名上分数下）+ 顶部图例", () => {
    const src = read("src/components/reports/SystemFramework.tsx");
    if (!/rounded-xl bg-white px-1 py-2 text-center shadow-sm/.test(src)) throw new Error("缺：白卡能力块");
    if (!/v116 三档图例/.test(src)) throw new Error("缺：三档图例");
    if (/border-l-\[5px\]/.test(src)) throw new Error("残留：v108 左色条");
  });
});
