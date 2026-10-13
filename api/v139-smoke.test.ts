import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v139 报告选择器选中按钮改竖向渐变", () => {
  it("两处选中态为从上到下渐变（180deg）", () => {
    const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");
    const n = (src.match(/bg-\[linear-gradient\(180deg,#FFFAEE,#0C7064_45%\)\] text-white shadow-sm/g) || []).length;
    if (n < 2) throw new Error("缺：竖向渐变选中（应有两处）");
    if (/linear-gradient\(100deg/.test(src)) throw new Error("残留：横向渐变");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!r.includes('const BUILD_TAG = "v139-2026-10-13";')) throw new Error("BUILD_TAG 未递增到 v139");
  });
});
