import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v134 报告选择器轨道改淡淡浅绿", () => {
  const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");

  it("两处选择器轨道为浅绿 #E9F3E6", () => {
    const n = (src.match(/rounded-xl bg-\[#E9F3E6\] p-1/g) || []).length;
    if (n < 2) throw new Error("缺：浅绿轨道（应有两处）");
    if (/rounded-xl bg-cream-deep p-1/.test(src)) throw new Error("残留：米色轨道");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
