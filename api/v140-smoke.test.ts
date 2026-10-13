import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v140 收起按钮去底 + 未选中卡简化", () => {
  it("收起按钮无背景无边框，黑字+图标", () => {
    const src = readFileSync("src/components/StudentDetailDrawer.tsx", "utf-8");
    if (!/text-\[12px\] font-medium text-\[#1E3530\] hover:text-\[#0C7064\]/.test(src)) throw new Error("缺：简版收起按钮");
    if (/rounded-lg border border-lime\/60 bg-lime-pale px-2\.5 py-1 text-\[11\.5px\] font-semibold text-olive hover:bg-butter\/25"[\s\S]{0,40}收起/.test(src)) throw new Error("残留：带底收起按钮");
  });

  it("两处选择器未选中卡为纯白无阴影", () => {
    const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");
    const n = (src.match(/: "bg-white text-olive"/g) || []).length;
    if (n < 2) throw new Error("缺：简化白卡（应有两处）");
  });

  it("版本标记存在（具体版本号由最新版测试锁定）", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
