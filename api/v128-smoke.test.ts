import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v128 后台标题改黑色 + 选中态全局统一墨绿 #0C7064", () => {
  it("后台大标题为墨黑字体", () => {
    const src = readFileSync("src/pages/Admin.tsx", "utf-8");
    if (!/总系统 · 后台管理" : "后台管理"\}<\/h1>/.test(src)) throw new Error("标题结构变了");
    if (!/tracking-tight text-\[#1E3530\]/.test(src)) throw new Error("后台大标题非墨黑");
  });

  it("两条页签条选中态=墨绿 #0C7064", () => {
    for (const f of ["src/pages/Admin.tsx", "src/pages/Tutor.tsx"]) {
      const src = readFileSync(f, "utf-8");
      if (!/bg-\[#0C7064\] text-white shadow/.test(src)) throw new Error(f + " 选中态非墨绿");
      if (/bg-\[#52A965\] text-white shadow/.test(src)) throw new Error(f + " 仍有草绿选中态");
    }
  });

  it("开关开启态统一为 bg-brand（#0C7064）", () => {
    const src = readFileSync("src/components/admin/InviteChannelsTab.tsx", "utf-8");
    if (src.includes('${on ? "bg-lime"')) throw new Error("开关开启态仍是草绿");
  });

  it("版本标记存在（具体版本号由最新版测试锁定）", () => {
    const src = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(src)) throw new Error("BUILD_TAG 缺失");
  });
});
