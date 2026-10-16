/* v178 冒烟：报告图表升级 ——
   1) 三好生涯 / 升学指导 / 霍兰德报告的霍兰德雷达轴带类型名（R·现实型）；
   2) 三好生涯报告新增「霍兰德六型 · 学科专业地图」页（HollandHexMap，蜂窝六型→学科专业大类+核心能力）；
   3) 三好生涯报告新增「多元智能五项参考」页（Multi5TalentMaps），zhihuiRouter.reportData 返回最近一次 multi5；
   4) 多元智能报告 / 学习力综合报告（学能模块 + 详版）嵌入学科/职业/提升参考；
   5) 升学指导报告（GuidanceTab）与霍兰德报告（HollandDetail）同样附六型学科地图；
   要求：BUILD_TAG 递增到 v177。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v178 报告图表：霍兰德类型轴 + 六型学科地图 + 多元智能参考", () => {
  const riasec = readFileSync("contracts/riasecMap.ts", "utf-8");
  const multi5map = readFileSync("contracts/multi5Map.ts", "utf-8");
  const zhihui = readFileSync("src/pages/ZhihuiReport.tsx", "utf-8");
  const zhihuiRouter = readFileSync("api/zhihuiRouter.ts", "utf-8");
  const guidance = readFileSync("src/components/reports/GuidanceTab.tsx", "utf-8");
  const hollandDetail = readFileSync("src/components/reports/HollandDetail.tsx", "utf-8");
  const reportView = readFileSync("src/components/reports/ReportView.tsx", "utf-8");
  const router = readFileSync("api/router.ts", "utf-8");

  it("共享映射数据存在且结构完整", () => {
    if (!/HOLLAND_FIELD_MAP/.test(riasec)) throw new Error("缺：霍兰德六型学科映射");
    for (const k of ["R", "I", "A", "S", "E", "C"]) {
      if (!new RegExp(`^\\s*${k}:`, "m").test(riasec)) throw new Error(`缺：霍兰德映射 ${k} 型`);
    }
    if (!/HOLLAND_MAP_ORDER/.test(riasec)) throw new Error("缺：六型顺序常量");
    if (!/MULTI5_TALENT_MAP/.test(multi5map)) throw new Error("缺：多元智能映射");
    for (const k of ["reasoning", "verbal", "number", "detail", "spatial"]) {
      if (!new RegExp(`^\\s*${k}:`, "m").test(multi5map)) throw new Error(`缺：多元映射 ${k}`);
    }
  });

  it("三好生涯报告：雷达类型轴 + 六型学科地图页（v179 起地图并入雷达页、多元页移除，见 v179 测试）", () => {
    if (!/HOLLAND_LABEL/.test(zhihui)) throw new Error("缺：雷达轴类型名（HOLLAND_LABEL）");
    if (!/HollandHexMap/.test(zhihui)) throw new Error("缺：六型学科地图");
    if (!/\{5 \+ idx\}/.test(zhihui)) throw new Error("缺：学科循环页码重编为 5+idx（v179）");
  });

  it("zhihuiRouter.reportData 返回最近一次 multi5", () => {
    if (!/kind,\s*"multi5"/.test(zhihuiRouter)) throw new Error("缺：multi5 查询");
    if (!/multi5:\s*m5/.test(zhihuiRouter)) throw new Error("缺：返回 multi5 字段");
  });

  it("升学指导报告与霍兰德报告附六型学科地图", () => {
    if (!/HollandHexMap/.test(guidance)) throw new Error("缺：GuidanceTab 六型学科地图");
    if (!/HollandHexMap/.test(hollandDetail)) throw new Error("缺：HollandDetail 六型学科地图");
  });

  it("多元/学习力报告嵌入学科·职业·提升参考", () => {
    const hits = (reportView.match(/Multi5TalentMaps/g) ?? []).length;
    if (hits < 4) throw new Error(`缺：ReportView 中 Multi5TalentMaps 应≥4 处（详版/学能模块/综合详版/import），现 ${hits}`);
  });

  it("BUILD_TAG 已递增", () => {
    if (!router.includes('const BUILD_TAG = "v179-2026-10-16"')) throw new Error("BUILD_TAG 未递增");
  });
});
