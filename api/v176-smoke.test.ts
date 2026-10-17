import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v176 伴学师查看完整报告直达学员报告页", () => {
  it("抽屉主按钮展开完整报告视图（所有测评报告栏目页）", () => {
    const src = readFileSync("src/components/StudentDetailDrawer.tsx", "utf-8");
    if (!/查看完整报告（与学生端一致）/.test(src)) throw new Error("缺：查看完整报告主按钮");
    if (!/bg-\[#0C7064\][\s\S]{0,600}查看完整报告/.test(src)) throw new Error("缺：查看完整报告实心主按钮");
    if (!/setReportOpen\(true\); setWide\(true\);/.test(src)) throw new Error("主按钮未恢复展开报告视图");
    // 不得残留「新标签页直达」旧实现
    if (/window\.open\(`\/zhihui-report\?studentId=\$\{userId\}`/.test(src))
      throw new Error("残留：抽屉主按钮新标签页直达");
  });

  it("ReportView 切 tab 保留 URL 已有参数（不冲掉 ?student=）", () => {
    const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");
    if (!/const next = new URLSearchParams\(prev\);[\s\S]{0,80}next\.set\("tab", t\);/.test(src))
      throw new Error("缺：setTab 保留已有参数");
    if (/setParams\(\{ tab: t \}/.test(src)) throw new Error("残留：setParams 整体替换参数");
  });

  it("选科报告栏目：v181 起改为 ReportView 内嵌渲染（旧「宫格 window.open 直达」方案已由 v181 选科报告内嵌取代）", () => {
    const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");
    if (!/tab === "zhihui" && \(/.test(src)) throw new Error("缺：ReportView 内嵌选科及升学规划栏目");
  });

  it("打印白板修复：zhihui 报告页挂到 report-print-root", () => {
    const src = readFileSync("src/pages/ZhihuiReport.tsx", "utf-8");
    if (!/id=\{printId\}/.test(src) || !/printId="report-print-root"/.test(src))
      throw new Error("缺：zh-root 挂 report-print-root，打印将白板");
  });

  it("BUILD_TAG 已递增到 v176", () => {
    const router = readFileSync("api/router.ts", "utf-8");
    if (Number(router.match(/const BUILD_TAG = "v(\d+)-/)?.[1] ?? 0) < 176) throw new Error("BUILD_TAG 未递增到 v176");
  });
});
