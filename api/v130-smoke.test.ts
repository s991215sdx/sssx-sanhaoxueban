import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v130 后台学员列表头像统一墨绿", () => {
  it("学员列表头像墨绿 #0C7064 底白字", () => {
    const src = readFileSync("src/pages/Admin.tsx", "utf-8");
    if (!/rounded-full bg-\[#0C7064\] text-\[14px\] font-bold text-white/.test(src)) throw new Error("缺：头像墨绿底");
    if (/rounded-full bg-\[#2F7A41\]/.test(src)) throw new Error("残留：旧草绿头像");
  });

  it("版本标记已递增", () => {
    const src = readFileSync("api/router.ts", "utf-8");
    if (!src.includes('const BUILD_TAG = "v130-2026-10-13";')) throw new Error("BUILD_TAG 未递增到 v130");
  });
});
