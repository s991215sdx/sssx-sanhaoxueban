import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v140 收起按钮去底 + 未选中卡简化", () => {
  it("v176c 更新：查看完整报告为实心墨绿主按钮，点击展开/收起报告视图", () => {
    const src = readFileSync("src/components/StudentDetailDrawer.tsx", "utf-8");
    if (!/bg-\[#0C7064\][\s\S]{0,600}查看完整报告（与学生端一致）/.test(src)) throw new Error("缺：实心主按钮");
    if (!/收起报告 <ChevronUp/.test(src)) throw new Error("缺：展开态收起文案");
    // 不再有第二个纯文字展开入口（v176c 起主按钮即开关）
    if (/text-\[11\.5px\] font-medium text-\[#1E3530\]\/70/.test(src)) throw new Error("残留：v140 简版次要按钮");
  });

  it("未选中卡断言随 v143 更新：白底无边框", () => {
    const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");
    const n = (src.match(/: "border-transparent bg-white text-olive hover:border-\[#1E3530\]\/15"/g) || []).length;
    if (n < 1) throw new Error("缺：白底未选中（栏目宫格）");
  });

  it("版本标记存在（具体版本号由最新版测试锁定）", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
