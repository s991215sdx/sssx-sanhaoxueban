/* v119 冒烟：冰山模型区域字体与芯片样式调整 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v119 冰山模型区域样式", () => {
  it("表格基准字号回调到 12/12.5px", () => {
    const src = read("src/components/reports/ReportView.tsx");
    // v120 回调到 12/12.5px（原 11.5/12.5 → v119 12.5/13 → v120 12/12.5）
    if (!/border-collapse text-\[12px\] sm:text-\[12\.5px\]/.test(src))
      throw new Error("缺：表格基准字号 12/12.5px");
  });

  it("芯片加大：Chip 12px / SolidChip 12.5px / FocusChip 11.5px", () => {
    const src = read("src/components/reports/ReportView.tsx");
    // v120 已把字号回调到 11 / 11.5 / 11px（层级协调优先），此处随设计更新
    if (!/px-2 py-0\.5 text-\[11px\] leading-tight/.test(src)) throw new Error("缺：Chip 字号");
    if (!/px-2 py-0\.5 text-\[11\.5px\] font-bold/.test(src)) throw new Error("缺：SolidChip 字号");
    if (!/px-2 py-px text-\[11px\] leading-tight/.test(src)) throw new Error("缺：FocusChip 字号");
  });

  it("芯片新色系：浅红 #FDECEC/#B42323、新琥珀 #FCF3DC/#B07800，旧暗黄清除", () => {
    const src = read("src/components/reports/ReportView.tsx");
    if (!/border-\[#D84E4E\]\/60 bg-\[#FDECEC\] font-bold text-\[#B42323\]/.test(src))
      throw new Error("缺：红芯新色系");
    if (!/border-\[#E3A008\]\/70 bg-\[#FCF3DC\] font-bold text-\[#B07800\]/.test(src))
      throw new Error("缺：琥珀芯新色系");
    // 旧暗黄只要求从 Chip 组件定义内清除；心理量表/框架图等独立配色不在本次范围
    const chipBlock = src.slice(src.indexOf("const Chip ="), src.indexOf("const Chip =") + 800);
    if (/#c7a23a|#8a6d1a|#f5e7c1/.test(chipBlock)) throw new Error("残留：Chip 内旧暗黄");
  });
});
