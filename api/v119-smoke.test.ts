/* v119 冒烟：冰山模型区域字体与芯片样式调整 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v119 冰山模型区域样式", () => {
  it("表格基准字号加大到 12.5/13px", () => {
    const src = read("src/components/reports/ReportView.tsx");
    if (!/border-collapse text-\[12\.5px\] sm:text-\[13px\]/.test(src))
      throw new Error("缺：表格基准字号");
  });

  it("芯片加大：Chip 12px / SolidChip 12.5px / FocusChip 11.5px", () => {
    const src = read("src/components/reports/ReportView.tsx");
    if (!/px-2 py-0\.5 text-\[12px\] leading-tight/.test(src)) throw new Error("缺：Chip 加大");
    if (!/px-2 py-0\.5 text-\[12\.5px\] font-bold/.test(src)) throw new Error("缺：SolidChip 加大");
    if (!/px-2 py-px text-\[11\.5px\] leading-tight/.test(src)) throw new Error("缺：FocusChip 加大");
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
