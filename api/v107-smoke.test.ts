/* v107 冒烟：学员详情档案头卡改翡翠绿→深橄榄绿渐变 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v136 墨绿整卡头卡（断言随设计更新）", () => {
  it("档案卡为墨绿实底（v136 改）", () => {
    const src = read("src/components/StudentDetailDrawer.tsx");
    if (!/rounded-2xl bg-\[#0C7064\] p-4/.test(src)) throw new Error("缺：墨绿头卡");
    if (/bg-gradient-to-br from-\[#FFFAEE\]/.test(src)) throw new Error("残留：渐变底");
  });

  it("首行姓名+年级学校，次行 ID+目标", () => {
    const src = read("src/components/StudentDetailDrawer.tsx");
    if (!/font-bold text-\[#1E3530\]/.test(src)) throw new Error("缺：姓名深色粗体");
    if (!/ID \{data\.user\.phone\}/.test(src)) throw new Error("缺：ID 行");
    if (!/目标：\{data\.profile\.targetSchool\}/.test(src)) throw new Error("缺：目标信息");
  });

  it("头像白圆绿字（v136 改）", () => {
    const src = read("src/components/StudentDetailDrawer.tsx");
    if (!/rounded-full bg-white text-\[16px\] font-bold text-\[#0C7064\]/.test(src))
      throw new Error("缺：白圆绿字头像");
  });
});
