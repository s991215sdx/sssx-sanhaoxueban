import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v135 框架图大卡片白底 + 小项底色随档", () => {
  const src = readFileSync("src/components/reports/SystemFramework.tsx", "utf-8");

  it("大卡片（三阶/条件/学能）白底，边框与标题仍按档", () => {
    if (!/return \{ borderColor: band\.border, background: "#FFFFFF", titleColor: band\.text \};/.test(src))
      throw new Error("缺：大卡片白底");
  });

  it("能力小项底色按档着色", () => {
    if (!/borderColor: band\.border, background: band\.bg/.test(src)) throw new Error("缺：小项档色底");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!r.includes('const BUILD_TAG = "v135-2026-10-13";')) throw new Error("BUILD_TAG 未递增到 v135");
  });
});
