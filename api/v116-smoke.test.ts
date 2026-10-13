/* v116 冒烟：系统框架图三档视觉（白卡能力块+图例）——v121 起档位名与阈值已并入全局统一口径，本文件随设计更新 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v116 框架图三档视觉", () => {
  it("BAND 三档配色保留（档位名 v121 起与全局统一：卡点/待提升/正常）", () => {
    const src = read("src/components/reports/SystemFramework.tsx");
    for (const tok of [
      '卡点: { label: "卡点", border: "#D84E4E", bg: "#FDECEC", text: "#B42323" }',
      '待提升: { label: "待提升", border: "#E3A008", bg: "#FCF3DC", text: "#B07800" }',
      '正常: { label: "正常", border: "#3CC078", bg: "#E4F7EC", text: "#2F8F60" }',
    ]) {
      if (!src.includes(tok)) throw new Error(`缺：${tok}`);
    }
  });

  it("阈值与全局统一（v121）：<3.0 卡点 / <3.8 待提升", () => {
    const src = read("src/components/reports/SystemFramework.tsx");
    if (!/if \(score < 3\.0\) return "卡点";/.test(src)) throw new Error("缺：<3.0 卡点");
    if (!/if \(score < 3\.8\) return "待提升";/.test(src)) throw new Error("缺：<3.8 待提升");
  });

  it("能力块白色小卡（名上分数下）+ 顶部图例", () => {
    const src = read("src/components/reports/SystemFramework.tsx");
    if (!/rounded-xl bg-white px-1 py-2 text-center shadow-sm/.test(src)) throw new Error("缺：白卡能力块");
    if (!/三档图例/.test(src)) throw new Error("缺：三档图例");
    if (/border-l-\[5px\]/.test(src)) throw new Error("残留：v108 左色条");
  });
});
