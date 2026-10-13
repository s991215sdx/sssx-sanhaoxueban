import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v127 页签条反色：白底轨道 + 草绿选中卡", () => {
  it("Admin.tsx 后台页签条：白底，选中=草绿色卡白字", () => {
    const src = readFileSync("src/pages/Admin.tsx", "utf-8");
    if (!/bg-white p-1/.test(src)) throw new Error("Admin 页签条非白底");
    if (!/bg-\[#52A965\] text-white shadow/.test(src)) throw new Error("Admin 选中态非草绿色卡");
  });

  it("Tutor.tsx 伴学工作台切换条：同款样式", () => {
    const src = readFileSync("src/pages/Tutor.tsx", "utf-8");
    if (!/bg-white p-1/.test(src)) throw new Error("Tutor 切换条非白底");
    if (!/bg-\[#52A965\] text-white shadow/.test(src)) throw new Error("Tutor 选中态非草绿色卡");
  });

  it("版本标记已递增", () => {
    const src = readFileSync("api/router.ts", "utf-8");
    if (!src.includes('const BUILD_TAG = "v127-2026-10-13";')) throw new Error("BUILD_TAG 未递增到 v127");
  });
});
