/* v111 冒烟：学员详情头卡统计格改白底绿字 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v111 统计格白底", () => {
  it("四个统计格白底 + 深绿数值", () => {
    const src = read("src/components/StudentDetailDrawer.tsx");
    if (!/rounded-lg bg-white px-1 py-2/.test(src)) throw new Error("缺：统计格白底");
    if (!/font-bold text-\[#0B8A63\]/.test(src)) throw new Error("缺：数值深绿");
    if (/bg-white\/15/.test(src)) throw new Error("残留：半透明白统计格");
  });
});
