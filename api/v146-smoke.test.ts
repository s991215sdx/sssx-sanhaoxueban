/* v146 冒烟：得分表两处标题（三阶九能得分表 / 附录·三阶九能观察点得分表）绿字改黑字 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v146 得分表标题改黑字", () => {
  it("答题卷面板「三阶九能得分表」标题为黑色", () => {
    const src = readFileSync("src/components/AnswerSheetsPanel.tsx", "utf-8");
    if (!/font-semibold text-\[#1E3530\][\s\S]{0,120}三阶九能得分表/.test(src)) throw new Error("缺：标题黑字");
    if (/font-semibold text-\[#2F7A41\][\s\S]{0,120}三阶九能得分表/.test(src)) throw new Error("残留：标题仍是绿色");
    if (!/TreePine size=\{14\}/.test(src)) throw new Error("缺：小树图标保留");
  });

  it("附录「三阶九能观察点得分表」标题为黑色", () => {
    const src = readFileSync("src/components/reports/AbilityScoreTable.tsx", "utf-8");
    if (!/font-bold text-\[#1E3530\][\s\S]{0,120}三阶九能观察点得分表/.test(src)) throw new Error("缺：附录标题黑字");
    if (/font-bold text-\[#2F7A41\]/.test(src)) throw new Error("残留：附录标题仍是绿色");
    if (!/TreePine size=\{16\}/.test(src)) throw new Error("缺：小树图标保留");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!r.includes('const BUILD_TAG = "v146-2026-10-13";')) throw new Error("BUILD_TAG 未递增到 v146");
  });
});
