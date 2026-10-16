import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v176 伴学师查看完整报告直达学员报告页", () => {
  it("抽屉主按钮新标签页打开 /zhihui-report?studentId=", () => {
    const src = readFileSync("src/components/StudentDetailDrawer.tsx", "utf-8");
    if (!/window\.open\(`\/zhihui-report\?studentId=\$\{userId\}`/.test(src))
      throw new Error("缺：查看完整报告新标签页直达学员报告页");
    if (!/bg-\[#0C7064\][\s\S]{0,220}查看完整报告/.test(src)) throw new Error("缺：查看完整报告实心主按钮");
    // 不得残留「旧版纯文字入口冒充主按钮」
    if (/px-1 py-1 text-\[12px\] font-medium[\s\S]{0,60}查看完整报告/.test(src))
      throw new Error("残留：旧版纯文字查看完整报告入口");
  });

  it("ReportView 切 tab 保留 URL 已有参数（不冲掉 ?student=）", () => {
    const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");
    if (!/const next = new URLSearchParams\(prev\);[\s\S]{0,80}next\.set\("tab", t\);/.test(src))
      throw new Error("缺：setTab 保留已有参数");
    if (/setParams\(\{ tab: t \}/.test(src)) throw new Error("残留：setParams 整体替换参数");
  });

  it("BUILD_TAG 已递增到 v176", () => {
    const router = readFileSync("api/router.ts", "utf-8");
    if (!router.includes('const BUILD_TAG = "v176-2026-10-16";')) throw new Error("BUILD_TAG 未递增到 v176");
  });
});
