import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v126 页签条改色卡草绿底 + 白色选中卡", () => {
  it("Admin.tsx 后台页签条：草绿轨道 + 白色选中卡", () => {
    const src = readFileSync("src/pages/Admin.tsx", "utf-8");
    if (!/bg-\[#52A965\] p-1/.test(src)) throw new Error("Admin 页签条非草绿轨道");
    if (!/bg-white text-\[#0C7064\] shadow/.test(src)) throw new Error("Admin 选中态非白色卡");
  });

  it("Tutor.tsx 伴学工作台切换条：同款样式", () => {
    const src = readFileSync("src/pages/Tutor.tsx", "utf-8");
    if (!/bg-\[#52A965\] p-1/.test(src)) throw new Error("Tutor 切换条非草绿轨道");
    if (!/bg-white text-\[#0C7064\] shadow/.test(src)) throw new Error("Tutor 选中态非白色卡");
  });

  it("版本标记已递增", () => {
    const src = readFileSync("api/router.ts", "utf-8");
    if (!src.includes('const BUILD_TAG = "v126-2026-10-13";')) throw new Error("BUILD_TAG 未递增到 v126");
  });
});
