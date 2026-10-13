import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v139 报告选择器选中按钮改竖向渐变", () => {
  it("选中态断言随 v143 更新：白底墨绿字框", () => {
    const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");
    const n = (src.match(/border-\[#0C7064\] bg-white text-\[#0C7064\] shadow-sm/g) || []).length;
    if (n < 2) throw new Error("缺：白底墨绿字框选中（应有两处）");
    if (/linear-gradient/.test(src)) throw new Error("残留：渐变选中");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
