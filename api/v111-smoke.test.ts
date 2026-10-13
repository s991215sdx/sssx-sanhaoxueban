/* v111 冒烟：学员详情头卡统计格改白底绿字 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v129 统计格半透明白 + 墨绿数值", () => {
  it("四个统计格白底 + 墨绿数值（v129：随渐变底改半透明+backdrop）", () => {
    const src = read("src/components/StudentDetailDrawer.tsx");
    if (!/rounded-xl bg-white\/85 px-1 py-2\.5/.test(src)) throw new Error("缺：统计格半透明白");
    if (!/font-bold text-\[#0C7064\]/.test(src)) throw new Error("缺：数值墨绿");
  });
});
