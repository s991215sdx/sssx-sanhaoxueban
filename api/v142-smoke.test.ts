import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v142 简要方案条白底 + 三阶主题色边框", () => {
  const src = readFileSync("src/components/training/AbilityPlanCard.tsx", "utf-8");

  it("简要方案条白底，边框随三阶色", () => {
    if (!/rounded-lg border bg-white px-3 py-2\.5/.test(src)) throw new Error("缺：白底方案条");
    if (!/borderColor: THREE_TIER_STYLE\[tier\]\.color/.test(src)) throw new Error("缺：三阶色边框");
    if (/bg-lime-pale px-3 py-2\.5/.test(src)) throw new Error("残留：浅绿方案条");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!r.includes('const BUILD_TAG = "v142-2026-10-13";')) throw new Error("BUILD_TAG 未递增到 v142");
  });
});
