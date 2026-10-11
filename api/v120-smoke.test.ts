/* v120 冒烟：冰山模型区域字号整体回调，恢复层级（芯片 < 行标签 < 冰山上/下标签） */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = readFileSync(join(root, "src/components/reports/ReportView.tsx"), "utf8");

describe("v120 字号层级回调", () => {
  it("芯片回落：Chip 11px / SolidChip 11.5px / FocusChip 11px", () => {
    if (!/px-2 py-0\.5 text-\[11px\] leading-tight/.test(src)) throw new Error("缺：Chip 11px");
    if (!/px-2 py-0\.5 text-\[11\.5px\] font-bold leading-tight/.test(src)) throw new Error("缺：SolidChip 11.5px");
    if (!/px-2 py-px text-\[11px\] leading-tight/.test(src)) throw new Error("缺：FocusChip 11px");
  });

  it("表格与行标签回落到 12/12.5px，层级低于冰山上/下 13px", () => {
    if (/border-collapse text-\[12\.5px\] sm:text-\[13px\]/.test(src))
      throw new Error("残留：表格基准仍是 12.5/13");
    if (!/border-collapse text-\[12px\] sm:text-\[12\.5px\]/.test(src))
      throw new Error("缺：表格基准 12/12.5px");
    const labelCount = (src.match(/text-\[12px\] font-semibold text-olive sm:text-\[12\.5px\]/g) ?? []).length;
    if (labelCount < 3) throw new Error(`缺：行标签 12/12.5px（仅 ${labelCount} 处）`);
    if (!/text-center text-\[13px\] font-bold text-olive">冰山上</.test(src)) throw new Error("缺：冰山上 13px");
    if (!/text-center text-\[13px\] font-bold text-olive">冰山下</.test(src)) throw new Error("缺：冰山下 13px");
  });
});
