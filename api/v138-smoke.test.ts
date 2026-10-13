import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v138 学员详情统计格纯白底", () => {
  it("四个统计格白底 + 墨绿数值", () => {
    const src = readFileSync("src/components/StudentDetailDrawer.tsx", "utf-8");
    if (!/rounded-xl bg-white px-1 py-2\.5/.test(src)) throw new Error("缺：白底统计格");
    if (!/text-\[17px\] font-bold text-\[#0C7064\]/.test(src)) throw new Error("缺：墨绿数值");
    if (/bg-white\/15/.test(src)) throw new Error("残留：半透明统计格");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!r.includes('const BUILD_TAG = "v138-2026-10-13";')) throw new Error("BUILD_TAG 未递增到 v138");
  });
});
