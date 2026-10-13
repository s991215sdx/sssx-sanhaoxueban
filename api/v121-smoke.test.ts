/* v121 冒烟：全系统判定口径统一——红 <3.0（≈<50）卡点 · 黄 3.0-3.7（≈50-69）待提升 · 绿 ≥3.8（≈≥70）正常 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v121 全局判定口径统一", () => {
  it("框架图档位名与阈值并入全局口径（无重点关注/预警残留）", () => {
    const src = read("src/components/reports/SystemFramework.tsx");
    if (/label: "重点关注"|label: "预警"/.test(src)) throw new Error("残留：框架图旧档名");
    for (const tok of ['{lv === "正常" ? "≥ 3.8" : lv === "待提升" ? "3.0 – 3.7" : "< 3.0"}',
      "红 &lt;3.0 卡点 · 黄 3.0–3.7 待提升 · 绿 ≥3.8 正常。"]) {
      if (!src.includes(tok)) throw new Error(`缺：${tok}`);
    }
  });

  it("ReportView 百分制阈值 <50、自评短板 <3.0、学科条 <3.0/<3.8", () => {
    const src = read("src/components/reports/ReportView.tsx");
    if (/dims\[k\] < 60|carefulIndex < 70|overall < 3\.5|v < 60|avg < 2\.5|avg < 3\.5/.test(src))
      throw new Error("残留：旧阈值");
    for (const tok of ["bad={multi5.dims[k] < 50}", "bad={multi5.carefulIndex < 50}",
      "bad={s.overall < 3.0}", 'st.avg < 3.0 ? "bg-terra" : st.avg < 3.8 ? "bg-[#c7a23a]"']) {
      if (!src.includes(tok)) throw new Error(`缺：${tok}`);
    }
  });

  it("其余界面阈值同步：GuidanceTab 得分率 50/70、SubjectQuiz 学科条、combined.ts 细心指数", () => {
    const g = read("src/components/reports/GuidanceTab.tsx");
    if (!g.includes('c.pct >= 70 ? "text-lime" : c.pct >= 50 ? "text-amber" : "text-rose"'))
      throw new Error("缺：GuidanceTab 得分率阈值");
    const q = read("src/components/companion/SubjectQuiz.tsx");
    if (!q.includes('st.avg < 3.0 ? "bg-terra" : st.avg < 3.8 ? "bg-[#c7a23a]"'))
      throw new Error("缺：SubjectQuiz 学科条阈值");
    const c = read("src/data/reports/combined.ts");
    if (/carefulIndex < 70|w\[1\] < 60/.test(c)) throw new Error("残留：combined.ts 旧阈值");
  });
});
