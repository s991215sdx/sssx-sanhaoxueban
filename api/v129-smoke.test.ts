import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v129 学员详情头卡：米白→墨绿渐变 + 内部色彩重搭", () => {
  it("头卡墨绿实底 + 顶部小字标签（v136 断言随设计更新）", () => {
    const src = readFileSync("src/components/StudentDetailDrawer.tsx", "utf-8");
    if (!/rounded-2xl bg-\[#0C7064\] p-4/.test(src)) throw new Error("缺：墨绿头卡");
    if (!/uppercase tracking-\[0\.18em\]/.test(src)) throw new Error("缺：顶部小字标签");
  });

  it("版本标记存在（具体版本号由最新版测试锁定）", () => {
    const src = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(src)) throw new Error("BUILD_TAG 缺失");
  });
});
