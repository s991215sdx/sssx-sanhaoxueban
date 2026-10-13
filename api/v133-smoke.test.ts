import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v133 框架图能力块：白底 + 档色边框 + 档色文字", () => {
  const src = readFileSync("src/components/reports/SystemFramework.tsx", "utf-8");

  it("UnitBlock 白底带边框，名称与分数按档着色", () => {
    if (!/rounded-xl border bg-white px-1 py-2 text-center shadow-sm/.test(src)) throw new Error("缺：白底边框能力块");
    if (!/borderColor: band\.border/.test(src)) throw new Error("缺：边框按档着色");
    const nameColor = (src.match(/text-\[12px\] font-semibold" style=\{\{ color: band\.text \}\}/g) || []).length;
    if (nameColor < 1) throw new Error("缺：名称按档着色");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!r.includes('const BUILD_TAG = "v133-2026-10-13";')) throw new Error("BUILD_TAG 未递增到 v133");
  });
});
