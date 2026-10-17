/* v180 冒烟：霍兰德图表标准统一 ——
   1) 分值统一百分制：六型卡片得分 = 原始 1-5 分 ×20，与雷达图一致；
   2) 优势高亮统一按「前三含并列」现算（contracts/holland.ts 的 hollandTopWithTies），
      雷达图优势标注与六型学科地图同一标准，并列一并突出；
   3) 六型卡片两排改为：常规型·现实型·研究型 / 艺术型·社会型·企业型。
   要求：BUILD_TAG 递增到 v179。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v180 霍兰德图表标准统一", () => {
  const holland = readFileSync("contracts/holland.ts", "utf-8");
  const hex = readFileSync("src/components/reports/HollandHexMap.tsx", "utf-8");
  const zhihui = readFileSync("src/pages/ZhihuiReport.tsx", "utf-8");
  const router = readFileSync("api/router.ts", "utf-8");

  it("共享前三含并列算法", () => {
    if (!/export function hollandTopWithTies/.test(holland)) throw new Error("缺：hollandTopWithTies");
    if (!/cutoff/.test(holland)) throw new Error("缺：并列 cutoff 逻辑");
  });

  it("六型卡片：百分制 + 新两排顺序 + 并列高亮", () => {
    if (!/Math\.round\(sc \* 20\)/.test(hex)) throw new Error("缺：百分制得分（×20）");
    if (/\{sc\} 分/.test(hex)) throw new Error("残留：原始 1-5 分显示");
    if (!/\["C", "R", "I"\]/.test(hex) || !/\["A", "S", "E"\]/.test(hex))
      throw new Error("缺：常规/现实/研究 + 艺术/社会/企业 两排");
    if (!/hollandTopWithTies\(dims, 3\)/.test(hex)) throw new Error("缺：卡片内并列高亮现算");
  });

  it("三好生涯报告雷达页优势标注走同一算法", () => {
    if (!/hollandTopWithTies\(holland\.dims, 3\)/.test(zhihui)) throw new Error("缺：雷达页并列高亮");
  });

  it("BUILD_TAG 已递增", () => {
    if (Number(router.match(/const BUILD_TAG = "v(\d+)-/)?.[1] ?? 0) < 180) throw new Error("BUILD_TAG 未递增到 v180");
  });
});
