/* v118 冒烟：框架图字体层级。v147 起整体缩小（标题13/副标10.5/能力名10.5/分数13/徽标10），断言随设计更新。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v118 框架图字体层级", () => {
  it("板块标题 14.5px、副说明 11.5px", () => {
    const src = read("src/components/reports/SystemFramework.tsx");
    if (!/text-\[13px\] font-bold" style=\{\{ color: box\.titleColor \}\}/.test(src)) throw new Error("缺：板块标题");
    if (!/mt-0\.5 text-\[10\.5px\] text-olive-mute/.test(src)) throw new Error("缺：副说明");
  });

  it("能力块名称 12px、分数 16px", () => {
    const src = read("src/components/reports/SystemFramework.tsx");
    if (!/text-\[10\.5px\] font-semibold" style=\{\{ color: band\.text \}\}/.test(src)) throw new Error("缺：能力名");
    if (!/mono mt-px text-\[13px\] font-bold/.test(src)) throw new Error("缺：分数");
  });

  it("徽标 11px、图例 11.5px、多元五项 11.5px", () => {
    const src = read("src/components/reports/SystemFramework.tsx");
    if (!/px-2 py-0\.5 text-\[10px\] font-semibold/.test(src)) throw new Error("缺：徽标");
    if (!/gap-x-4 gap-y-1 text-\[10\.5px\]/.test(src)) throw new Error("缺：图例");
    if (!/gap-x-3 gap-y-1 text-\[10\.5px\]/.test(src)) throw new Error("缺：多元五项");
  });
});
