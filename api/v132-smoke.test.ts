import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v132 后台学员列表姓名改黑色", () => {
  it("学员姓名为墨黑 #1E3530", () => {
    const src = readFileSync("src/pages/Admin.tsx", "utf-8") + readFileSync("src/components/admin/StudentsTab.tsx", "utf-8") + readFileSync("src/components/admin/TutorsTab.tsx", "utf-8");
    if (!/font-semibold text-\[#1E3530\]">\{s\.name\}/.test(src)) throw new Error("缺：姓名黑色");
  });

  it("版本标记存在（具体版本号由最新版测试锁定）", () => {
    const src = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(src)) throw new Error("BUILD_TAG 缺失");
  });
});
