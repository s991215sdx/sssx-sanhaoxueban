import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v131 报告栏目选择器：白卡 + 米白→墨绿渐变选中", () => {
  const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");

  it("两个选择器均为白卡未选中 + 渐变选中", () => {
    const sel = /bg-\[linear-gradient\(100deg,#FFFAEE,#0C7064_45%\)\] text-white shadow-sm/;
    const unsel = /bg-white text-olive shadow-sm/;
    const matches = (src.match(/bg-\[linear-gradient\(100deg,#FFFAEE,#0C7064_45%\)\] text-white shadow-sm/g) || []).length;
    if (matches < 2) throw new Error("缺：米白→墨绿渐变选中卡（应有两处）");
    if (!unsel.test(src)) throw new Error("缺：白色未选中卡");
    if (/bg-cream text-olive shadow-sm/.test(src)) throw new Error("残留：旧米色选中卡");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!r.includes('const BUILD_TAG = "v131-2026-10-13";')) throw new Error("BUILD_TAG 未递增到 v131");
  });
});
