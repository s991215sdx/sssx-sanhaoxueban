/* v118 冒烟：框架图字体层级微调（标题/副说明/能力块/徽标/图例/多元五项） */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v118 框架图字体层级", () => {
  it("板块标题 14.5px、副说明 11.5px", () => {
    const src = read("src/components/reports/SystemFramework.tsx");
    if (!/text-\[14\.5px\] font-bold/.test(src)) throw new Error("缺：板块标题加大");
    if (!/mt-0\.5 text-\[11\.5px\] text-olive-mute/.test(src)) throw new Error("缺：副说明加大");
  });

  it("能力块名称 12px、分数 16px", () => {
    const src = read("src/components/reports/SystemFramework.tsx");
    if (!/text-\[12px\] font-semibold text-olive/.test(src)) throw new Error("缺：能力名加大");
    if (!/mt-0\.5 text-\[16px\] font-bold/.test(src)) throw new Error("缺：分数加大");
  });

  it("徽标 11px、图例 11.5px、多元五项 11.5px", () => {
    const src = read("src/components/reports/SystemFramework.tsx");
    if (!/px-2\.5 py-1 text-\[11px\] font-semibold/.test(src)) throw new Error("缺：徽标加大");
    if (!/gap-x-4 gap-y-1 text-\[11\.5px\]/.test(src)) throw new Error("缺：图例加大");
    if (!/gap-x-3 gap-y-1 text-\[11\.5px\]/.test(src)) throw new Error("缺：多元五项加大");
  });
});
