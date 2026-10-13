import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v129 学员详情头卡：米白→墨绿渐变 + 内部色彩重搭", () => {
  it("头卡为米白到墨绿渐变底", () => {
    const src = readFileSync("src/components/StudentDetailDrawer.tsx", "utf-8");
    if (!/rounded-2xl bg-gradient-to-br from-\[#FFFAEE\]/.test(src)) throw new Error("缺：米白→墨绿渐变底");
    if (!/to-\[#0C7064\]/.test(src)) throw new Error("缺：渐变墨绿端");
  });

  it("统计格半透明白 + 墨绿数值 + 深色标签", () => {
    const src = readFileSync("src/components/StudentDetailDrawer.tsx", "utf-8");
    if (!/rounded-xl bg-white\/85/.test(src)) throw new Error("缺：统计格半透明白");
    if (!/font-bold text-\[#0C7064\]/.test(src)) throw new Error("缺：数值墨绿");
  });

  it("头像墨绿底白字 + 白色描边", () => {
    const src = readFileSync("src/components/StudentDetailDrawer.tsx", "utf-8");
    if (!/rounded-full bg-\[#0C7064\] text-\[16px\] font-bold text-white/.test(src)) throw new Error("缺：头像墨绿白字");
  });

  it("版本标记已递增", () => {
    const src = readFileSync("api/router.ts", "utf-8");
    if (!src.includes('const BUILD_TAG = "v129-2026-10-13";')) throw new Error("BUILD_TAG 未递增到 v129");
  });
});
