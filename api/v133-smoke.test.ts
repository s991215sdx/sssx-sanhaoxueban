import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v133 框架图能力块：白底 + 档色边框 + 档色文字", () => {
  const src = readFileSync("src/components/reports/SystemFramework.tsx", "utf-8");

  it("UnitBlock 底色按档着色，名称与分数按档着色（v135 断言随设计更新）", () => {
    if (!/rounded-xl border px-1 py-2 text-center shadow-sm/.test(src)) throw new Error("缺：能力块");
    if (!/borderColor: band\.border, background: band\.bg/.test(src)) throw new Error("缺：底色按档着色");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
