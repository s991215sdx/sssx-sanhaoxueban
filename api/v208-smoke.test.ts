/* v208 冒烟：综合学习力报告（三阶九能版）打印分页——封面独占整页、冰山图独立第 2 页一图看全
   （2026-10-19 唐先生反馈：正式环境打印封面只占半页、冰山图被挤在左列且顶部截断）。
   口径：
   - 封面 paper-card 打印态 min-h-[246mm]（与 book 式样 .ob-page 同规则满版，v217 与可印高度对齐）+ break-after-page；
   - PART 1 冰山图紧随封面分页后整页呈现：打印静态版（print:block 流式、无 transform/绝对定位）
     内部全部记分卡/底排卡片带 print: 紧凑类，保证整页高度 ≤ A4 内容高（约 1032px）；
   - 计分行（KRow/TotalRow）、卡头（CardHead）、多元智能五项、深层特质行均带 print: 压缩类。
   版本注记：与孙冬晓粤华封面增强（v207）同日撞号，本特性顺延为 v208。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v208 综合学习力报告打印分页", () => {
  const rpt = read("src/components/reports/CombinedV39.tsx");
  const router = read("api/router.ts");

  it("封面打印独占整页", () => {
    need(rpt, "print:min-h-[246mm]", "封面打印满版高度");
    need(rpt, "print:break-after-page", "封面打印后强制分页");
  });

  it("冰山图打印静态版带紧凑类（整页一图看全）", () => {
    need(rpt, "hidden print:block", "打印静态版容器");
    need(rpt, "print:space-y-2", "记分卡列打印紧凑间距");
    need(rpt, "print:px-3 print:py-2", "记分卡打印内边距压缩");
    need(rpt, "print:break-after-page", "封面分页（冰山自第 2 页起）");
  });

  it("计分行与卡头打印压缩", () => {
    need(rpt, "print:py-px", "KRow 行距打印压缩");
    need(rpt, "print:my-[1px] print:py-1", "TotalRow 打印压缩");
    need(rpt, "print:text-[13px]", "CardHead 打印字号");
  });

  /* v209：与粤华页脚品牌（v209）合并发版，版本断言改为数值 >= 208，避免同日撞号后互相卡死 */
  it("BUILD_TAG 不低于 v208", () => {
    const v = Number(router.match(/const BUILD_TAG = "v(\d+)-/)?.[1] ?? 0);
    if (v < 208) throw new Error(`BUILD_TAG 低于 v208（当前 v${v}）`);
  });
});
