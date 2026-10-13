import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v143 报告选择器：白轨道 + 白底选中墨绿字框", () => {
  const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");

  it("两处轨道白色", () => {
    const n = (src.match(/rounded-xl border border-\[#1E3530\]\/10 bg-white p-1/g) || []).length;
    if (n < 2) throw new Error("缺：白色轨道（应有两处）");
  });

  it("选中态白底+墨绿字+墨绿框，未选中白底", () => {
    const sel = (src.match(/border-\[#0C7064\] bg-white text-\[#0C7064\] shadow-sm/g) || []).length;
    if (sel < 1) throw new Error("缺：选中态（栏目宫格）");
    if (/linear-gradient/.test(src)) throw new Error("残留：渐变选中");
  });

  it("版本标记存在（具体版本号由最新版测试锁定）", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
