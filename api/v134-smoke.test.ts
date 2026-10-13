import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v134 报告选择器轨道改淡淡浅绿", () => {
  const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");

  it("两处选择器轨道为白色（v143 断言随设计更新）", () => {
    const n = (src.match(/rounded-xl border border-\[#1E3530\]\/10 bg-white p-1/g) || []).length;
    if (n < 2) throw new Error("缺：白色轨道（应有两处）");
    if (/rounded-xl bg-\[#E9F3E6\] p-1/.test(src)) throw new Error("残留：浅绿轨道");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
