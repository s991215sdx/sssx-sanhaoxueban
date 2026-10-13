import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v131 报告栏目选择器：白卡 + 米白→墨绿渐变选中", () => {
  const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");

  it("两个选择器均为白底选中（墨绿字框）+ 白底未选中（v143 断言随设计更新）", () => {
    const matches = (src.match(/border-\[#0C7064\] bg-white text-\[#0C7064\] shadow-sm/g) || []).length;
    if (matches < 2) throw new Error("缺：白底墨绿字框选中（应有两处）");
    if (!/: "border-transparent bg-white text-olive/.test(src)) throw new Error("缺：白底未选中");
  });

  it("版本标记存在（具体版本号由最新版测试锁定）", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
