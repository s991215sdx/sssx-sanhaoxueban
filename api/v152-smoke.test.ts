/* v152 冒烟：答题明细行 ans 限宽 60% 右对齐——修复 DISC 最像/最不像长文本挤爆题干列的问题 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v152 答题明细行布局修复", () => {
  const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");

  it("题干列 min-w-0 flex-1，ans 限宽 60% 右对齐", () => {
    if (!/min-w-0 flex-1">\{row\.text\}/.test(src)) throw new Error("缺：题干列 min-w-0 flex-1");
    if (!/max-w-\[60%\] shrink-0 text-right font-semibold/.test(src)) throw new Error("缺：ans 限宽右对齐");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!r.includes('const BUILD_TAG = "v152-2026-10-14";')) throw new Error("BUILD_TAG 未递增到 v152");
  });
});
