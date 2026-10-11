/* v107 冒烟：学员详情档案头卡改翡翠绿→深橄榄绿渐变 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v107 渐变绿头卡", () => {
  it("档案卡用绿色渐变背景（v112：约50%透明，淡绿清新）", () => {
    const src = read("src/components/StudentDetailDrawer.tsx");
    if (!/linear-gradient\(135deg, #[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})? 0%, #0EA875(?:[0-9A-Fa-f]{2})? \d+%, #[0-9A-Fa-f]{6}(?:[0-9A-Fa-f]{2})? 100%\)/.test(src))
      throw new Error("缺：绿色渐变");
    if (src.includes("#0B3D2E")) throw new Error("残留：深橄榄色");
  });

  it("头卡统计格为白底（v111：绿字数值）", () => {
    const src = read("src/components/StudentDetailDrawer.tsx");
    if (!/rounded-lg bg-white px-1 py-2/.test(src)) throw new Error("缺：统计格白底");
  });

  it("头像绿底白字（v112 淡底上恢复品牌绿头像）", () => {
    const src = read("src/components/StudentDetailDrawer.tsx");
    if (!/rounded-full bg-brand[\s\S]{0,80}text-cream/.test(src))
      throw new Error("缺：头像绿底白字");
  });
});
