/* v164 冒烟：章节卡左边框加粗一倍——12px → 24px（用户要求），仍仅左边框随评分档染色。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v164 左边框加粗一倍（24px）", () => {
  const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");

  it("左边框 24px", () => {
    if (!/border-l-\[24px\]/.test(src)) throw new Error("缺：border-l-[24px]");
  });

  it("仍仅左边框染色，大标题随档着色", () => {
    if (!/style=\{accent \? \{ borderLeftColor: E3V37_LEVEL_STYLE\[accent\]\.bar \} : undefined\}/.test(src))
      throw new Error("缺：仅 borderLeftColor 染色");
    if (/\{ borderColor: E3V37_LEVEL_STYLE\[accent\]\.bar \}/.test(src)) throw new Error("残留：整框 borderColor 染色");
    if (!/style=\{accent \? \{ color: E3V37_LEVEL_STYLE\[accent\]\.bar \} : undefined\}/.test(src))
      throw new Error("缺：h3 标题随档着色");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!r.includes('const BUILD_TAG = "v164-2026-10-14";')) throw new Error("BUILD_TAG 未递增到 v164");
  });
});
