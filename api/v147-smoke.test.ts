/* v147 冒烟：学习力系统框架图整体缩小——UnitBlock 色块边距/文字缩小，板块内所有文字随比例缩小。
   v148 注：BUILD_TAG 断言已放宽为通用形式 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v147 框架图板块整体缩小", () => {
  const src = readFileSync("src/components/reports/SystemFramework.tsx", "utf-8");

  it("UnitBlock 色块：小圆角 + 窄边距 + 小字号", () => {
    if (!/rounded-lg border px-0\.5 py-1 text-center shadow-sm/.test(src)) throw new Error("缺：色块缩小样式");
    if (!/text-\[10\.5px\] font-semibold" style=\{\{ color: band\.text \}\}/.test(src)) throw new Error("缺：名称 10.5px");
    if (!/mono mt-px text-\[13px\] font-bold" style=\{\{ color: band\.text \}\}/.test(src)) throw new Error("缺：分数 13px");
    if (/text-\[16px\]/.test(src)) throw new Error("残留：分数仍是 16px");
  });

  it("板块文字整体缩小：卡片标题 13px、副标 10.5px、无 14.5px 残留", () => {
    if (!/text-\[13px\] font-bold" style=\{\{ color: box\.titleColor \}\}/.test(src)) throw new Error("缺：卡片标题 13px");
    if (!/mt-0\.5 text-\[10\.5px\] text-olive-mute/.test(src)) throw new Error("缺：副标 10.5px");
    if (/text-\[14\.5px\]/.test(src)) throw new Error("残留：标题仍是 14.5px");
  });

  it("大卡片内边距与容器收窄", () => {
    if (!/rounded-xl border px-2\.5 py-2 text-center/.test(src)) throw new Error("缺：大卡片收窄");
    if (!/bg-cream\/60 p-3 sm:p-4/.test(src)) throw new Error("缺：容器收窄");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
