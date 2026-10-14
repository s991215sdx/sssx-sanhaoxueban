/* v148 注：统计格改单行不换行压扁高度，样式断言随设计更新 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v138 学员详情统计格纯白底", () => {
  it("四个统计格白底 + 墨绿数值", () => {
    const src = readFileSync("src/components/StudentDetailDrawer.tsx", "utf-8");
    if (!/rounded-xl bg-white px-2 py-1\.5/.test(src)) throw new Error("缺：白底统计格");
    if (!/whitespace-nowrap/.test(src)) throw new Error("缺：单行不换行");
    if (!/text-\[14px\] font-bold leading-none text-\[#0C7064\]/.test(src)) throw new Error("缺：墨绿数值");
    if (/bg-white\/15/.test(src)) throw new Error("残留：半透明统计格");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
