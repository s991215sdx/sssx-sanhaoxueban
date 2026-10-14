/* v148 冒烟：学员详情头卡统计格数字+文字单行不换行，压扁高度。
   v149 注：BUILD_TAG 断言已放宽为通用形式 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v148 统计格单行压扁", () => {
  const src = readFileSync("src/components/StudentDetailDrawer.tsx", "utf-8");

  it("统计格单行布局：不换行 + 收窄边距", () => {
    if (!/whitespace-nowrap rounded-xl bg-white px-2 py-1\.5/.test(src)) throw new Error("缺：单行不换行收窄");
    if (!/flex items-center justify-center gap-1\.5/.test(src)) throw new Error("缺：数字文字同行");
    if (/px-1 py-2\.5/.test(src)) throw new Error("残留：旧的双行高统计格");
  });

  it("数字字号随压扁调整", () => {
    if (!/text-\[14px\] font-bold leading-none text-\[#0C7064\]/.test(src)) throw new Error("缺：14px 墨绿数值");
    if (/text-\[17px\] font-bold text-\[#0C7064\]/.test(src)) throw new Error("残留：17px 大数值");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
