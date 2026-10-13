import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v132 后台学员列表姓名改黑色", () => {
  it("学员姓名为墨黑 #1E3530", () => {
    const src = readFileSync("src/pages/Admin.tsx", "utf-8");
    if (!/font-semibold text-\[#1E3530\]">\{s\.name\}/.test(src)) throw new Error("缺：姓名黑色");
  });

  it("版本标记已递增", () => {
    const src = readFileSync("api/router.ts", "utf-8");
    if (!src.includes('const BUILD_TAG = "v132-2026-10-13";')) throw new Error("BUILD_TAG 未递增到 v132");
  });
});
