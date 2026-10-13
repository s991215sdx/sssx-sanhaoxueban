/* v107 冒烟：学员详情档案头卡改翡翠绿→深橄榄绿渐变 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v115 薄荷浅底头卡", () => {
  it("档案卡用参考图薄荷浅底实底", () => {
    const src = read("src/components/StudentDetailDrawer.tsx");
    if (!/rounded-2xl bg-\[#E9F3E6\]/.test(src)) throw new Error("缺：薄荷浅底");
    if (/linear-gradient/.test(src)) throw new Error("残留：渐变底");
  });

  it("首行姓名+年级学校，次行 ID+目标", () => {
    const src = read("src/components/StudentDetailDrawer.tsx");
    if (!/font-bold text-\[#1E3530\]/.test(src)) throw new Error("缺：姓名深色粗体");
    if (!/ID \{data\.user\.phone\}/.test(src)) throw new Error("缺：ID 行");
    if (!/目标：\{data\.profile\.targetSchool\}/.test(src)) throw new Error("缺：目标信息");
  });

  it("头像实心绿圆白字（#1D9E75）", () => {
    const src = read("src/components/StudentDetailDrawer.tsx");
    if (!/rounded-full bg-\[#0C7064\][\s\S]{0,80}text-white/.test(src))
      throw new Error("缺：头像实心绿");
  });
});
