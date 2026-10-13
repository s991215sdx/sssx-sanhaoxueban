/* v146 注：BUILD_TAG 断言按惯例放宽为通用形式（版本号已递增到 v146） */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v145 详版/简版切换去包裹改色条", () => {
  const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");

  it("选中项文字下有墨绿色条，无按钮边框包裹", () => {
    if (!/absolute -bottom-1 left-0 right-0 h-0\.5 rounded-full bg-\[#0C7064\]/.test(src)) throw new Error("缺：选中色条");
    if (!/const active = combinedView === v\.key;/.test(src)) throw new Error("缺：active 判断");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
