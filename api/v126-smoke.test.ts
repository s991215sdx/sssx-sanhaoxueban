import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v126 页签条接线（v127 反色后断言随设计更新）", () => {
  it("Admin.tsx 后台页签条：白底轨道 + 草绿选中卡", () => {
    const src = readFileSync("src/pages/Admin.tsx", "utf-8");
    if (!/bg-white p-1/.test(src)) throw new Error("Admin 页签条非白底轨道");
    if (!/bg-\[#52A965\] text-white shadow/.test(src)) throw new Error("Admin 选中态非草绿色卡");
  });

  it("Tutor.tsx 伴学工作台切换条：同款样式", () => {
    const src = readFileSync("src/pages/Tutor.tsx", "utf-8");
    if (!/bg-white p-1/.test(src)) throw new Error("Tutor 切换条非白底轨道");
    if (!/bg-\[#52A965\] text-white shadow/.test(src)) throw new Error("Tutor 选中态非草绿色卡");
  });
});
