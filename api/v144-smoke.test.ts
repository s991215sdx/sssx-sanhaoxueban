import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v144 简要方案条去边框 + 左竖色条 + 10px 边距", () => {
  const src = readFileSync("src/components/training/AbilityPlanCard.tsx", "utf-8");

  it("方案条无整框，左侧竖色条随三阶色", () => {
    if (!/flex gap-2\.5 rounded-lg bg-white px-2\.5 py-2\.5/.test(src)) throw new Error("缺：10px 边距白底条");
    if (!/w-1 shrink-0 self-stretch rounded-full[\s\S]{0,80}background: THREE_TIER_STYLE\[tier\]\.color/.test(src))
      throw new Error("缺：左竖三阶色条");
  });

  it("版本标记存在（具体版本号由最新版测试锁定）", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
