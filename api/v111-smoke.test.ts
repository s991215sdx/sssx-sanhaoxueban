/* v111 冒烟：学员详情头卡统计格改白底绿字 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v136 统计格墨绿卡上半透明白（断言随设计更新）", () => {
  it("四个统计格白边半透明底 + 白色数值", () => {
    const src = read("src/components/StudentDetailDrawer.tsx");
    if (!/rounded-xl border border-white\/20 bg-white\/15 px-1 py-2\.5/.test(src)) throw new Error("缺：统计格半透明白");
    if (!/text-\[17px\] font-bold text-white/.test(src)) throw new Error("缺：数值白色");
  });
});
