import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v142 简要方案条白底 + 三阶主题色边框", () => {
  const src = readFileSync("src/components/training/AbilityPlanCard.tsx", "utf-8");

  it("简要方案条断言随 v144 更新：左竖条+10px 边距", () => {
    if (!/flex gap-2\.5 rounded-lg bg-white px-2\.5 py-2\.5/.test(src)) throw new Error("缺：10px 边距方案条");
    if (!/w-1 shrink-0 self-stretch rounded-full/.test(src)) throw new Error("缺：左竖色条");
  });

  it("版本标记存在（具体版本号由最新版测试锁定）", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
