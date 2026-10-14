/* v165 冒烟：章节卡左边框按用户参考图回调为 8px 细弧边框——
   参考图的边框是顺卡片圆角平滑弯曲的细弧线；v164 的 24px 超过圆角半径（16px），
   角上弧线被削平方头化。边框宽度必须 ≤ 圆角半径才能保留 "(" 形弧线。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v165 左边框细弧边框（8px）", () => {
  const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");

  it("左边框 8px（≤圆角半径 16px，角上保留弧线）", () => {
    if (!/border-l-\[8px\]/.test(src)) throw new Error("缺：border-l-[8px]");
    if (/border-l-\[(12|16|20|24|28|32)px\]/.test(src)) throw new Error("残留：超过圆角半径的粗边框");
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
    if (!r.includes('const BUILD_TAG = "v165-2026-10-14";')) throw new Error("BUILD_TAG 未递增到 v165");
  });
});
