/* v107 冒烟：学员详情档案头卡改翡翠绿→深橄榄绿渐变 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v107 渐变绿头卡", () => {
  it("档案卡用绿色渐变背景（v109 调浅：浅翠绿 → brand → deep）", () => {
    const src = read("src/components/StudentDetailDrawer.tsx");
    if (!/linear-gradient\(135deg, #[0-9A-Fa-f]{6} 0%, #0EA875 \d+%, #[0-9A-Fa-f]{6} 100%\)/.test(src))
      throw new Error("缺：绿色渐变");
    if (src.includes("#0B3D2E")) throw new Error("残留：深橄榄色");
  });

  it("头卡文字与统计格为白色系", () => {
    const src = read("src/components/StudentDetailDrawer.tsx");
    if (!/text-white\/75/.test(src)) throw new Error("缺：副信息白色75%");
    if (!/bg-white\/15/.test(src)) throw new Error("缺：统计格半透明白");
  });

  it("头像反白（白底绿字）", () => {
    const src = read("src/components/StudentDetailDrawer.tsx");
    if (!/rounded-full bg-white\/95[\s\S]{0,80}text-brand/.test(src))
      throw new Error("缺：头像白底绿字");
  });
});
