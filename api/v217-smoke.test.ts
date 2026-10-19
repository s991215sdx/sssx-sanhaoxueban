/* v217 冒烟：专业推荐修复 + 分数段矩阵改版 + 打印空白页修复 + 冰山图手机端拉伸。
   背景（2026-10-19 唐先生反馈，全机构适用）：
   1. 刘芷茵（粤华，霍兰德 RIA、学科四维文史全 4.0、选科历史+生物+政治）的选科及升学规划报告
      「适合学习的专业详情」推荐安全科学与工程类/兵器类——系统性错误：门类权重为 0 的专业类
      按拼音序凑满 Top5，霍兰德偏 R/I 即被拼音序硬核工科刷屏，且首选历史未过滤要求物理+化学的理工农医。
   2. 「你的分数能走哪些路」只显示学生自己的冲/稳/保三档，改为「不同分数能走哪些路」列出全部分数段院校。
   3. 打印/另存 PDF 每页拖尾空白页：256mm min-height + padding 未声明 box-sizing，≈281mm > 273mm 可印高度。
   4. 综合学习力报告冰山图手机端 stretch 固定 1，下方留白过多。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v217 推荐/矩阵/打印/冰山修复", () => {
  const api = read("api/zhihuiRouter.ts");
  const page = read("src/pages/ZhihuiReport.tsx");
  const olive = read("src/components/reports/olive/OliveBook.tsx");
  const v39 = read("src/components/reports/CombinedV39.tsx");

  it("专业推荐：权重0不入推荐 + 选科过滤 + 四维加权", () => {
    need(api, "HIST_HARD_EXCLUDE", "首选历史过滤理工农医");
    need(api, "menleiFit", "学科四维门类匹配度");
    need(api, ".filter((c) => c.w > 0)", "权重0专业类不进推荐");
    need(api, "firstTrack: z.enum", "前端回传首选科目");
    need(api, "histPot > physPot", "首屏兜底判定");
  });

  it("分数段矩阵：不同分数能走哪些路（全分段）", () => {
    need(page, "不同分数能走哪些路", "新版标题");
    need(page, "MX_PER_PAGE = 8", "每页8段自动分页");
    if (page.includes("matrixActive")) throw new Error("残留：matrixActive 应已移除");
  });

  it("打印空白页：box-sizing + 246mm", () => {
    need(page, "box-sizing: border-box", "ZH 打印盒模型");
    need(page, "min-height: 246mm", "ZH 页高收紧");
    need(olive, "box-sizing: border-box", "book 式样盒模型");
    need(olive, "min-height: 246mm", "book 页高收紧");
    need(v39, "print:min-h-[246mm]", "v39 封面打印高度");
  });

  it("冰山图手机端拉伸", () => {
    need(v39, "v217", "手机端拉伸说明");
    need(v39, "Math.min(MAX_STRETCH_MOBILE, cardsH / Math.max(1, natH))", "堆叠模式拉伸系数");
  });

  it("BUILD_TAG 已递增到 v217", () => {
    const router = read("api/router.ts");
    const v = Number(router.match(/const BUILD_TAG = "v(\d+)-/)?.[1] ?? 0);
    if (v < 217) throw new Error(`BUILD_TAG 未递增到 v217（当前 v${v}）`);
  });
});
