/* v149 冒烟：报告折叠条去外边框，标题左侧改墨绿色条（与文字间距 10px）。
   v149b：冰山表内的 AnswersFold（答题明细）同样是独立实现，一并去边框改色条。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v149 Fold 折叠条去边框改色条", () => {
  const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");

  it("details 容器无外边框", () => {
    if (!/group mt-3 overflow-hidden rounded-xl bg-cream\/50/.test(src)) throw new Error("缺：去边框后的容器");
    if (/overflow-hidden rounded-xl border border-border bg-cream\/50/.test(src)) throw new Error("残留：旧边框容器");
  });

  it("summary 左侧墨绿色条 + 与文字 10px 间距", () => {
    if (!/inline-block h-4 w-1 shrink-0 rounded-full bg-\[#0C7064\]/.test(src)) throw new Error("缺：左竖色条");
    if (!/items-center gap-2\.5 px-3\.5 py-2\.5/.test(src)) throw new Error("缺：10px 间距");
    if (!/<span className="flex-1">\{title\}<\/span>/.test(src)) throw new Error("缺：标题 flex-1 布局");
  });

  it("冰山表 AnswersFold 同步去边框改色条", () => {
    if (!/group mt-1\.5 overflow-hidden rounded-lg bg-white\/60 print:hidden/.test(src)) throw new Error("缺：AnswersFold 去边框");
    if (/rounded-lg border border-border\/70 bg-white\/60 print:hidden/.test(src)) throw new Error("残留：AnswersFold 旧边框");
    if (!/inline-block h-3\.5 w-1 shrink-0 rounded-full bg-\[#0C7064\]/.test(src)) throw new Error("缺：AnswersFold 左竖色条");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
