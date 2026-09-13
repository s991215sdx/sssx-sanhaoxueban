/** @jsxImportSource react */
/* v35 冒烟：renderToStaticMarkup 渲染 ReportView，验证六项新需求的关键标记
   1. 框架图链接 + 二级考察点；2. 冰山成绩未填写态 + 各行答题明细链接；
   3. 层内重点项链接 + 评分原则备注；4. 先抓这三件事在方案后；5. 简版框架置顶（结构性验证在代码层）；
   6. 概要总论 → 简要总结三档折叠。 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import ReportView from "../src/components/reports/ReportView";
import { scoreMbti, scoreDisc } from "../contracts/assessments";
import { scoreE3V37 } from "../contracts/e3v37";
import { scoreHolland } from "../contracts/holland";
import { scoreAnchor } from "../contracts/careerAnchor";
import { scoreMulti5, MULTI5_QUESTIONS } from "../contracts/multi5";
import { scoreMental, MENTAL_V2_QUESTION_COUNT } from "../contracts/mentalHealth";

const ratings70 = Array.from({ length: 70 }, (_, i) => (i % 5) + 1);
const mbti = scoreMbti(Array.from({ length: 28 }, (_, i) => (i % 3 === 0 ? 0 : 1)));
const disc = scoreDisc(Array.from({ length: 24 }, (_, i) => i % 2));
const e3 = scoreE3V37({
  stage: "junior",
  ratings: ratings70,
  motivation: "want",
  subjects: [{ name: "数学", like: 4, master: 3, perform: 3, rank: 3, weak: true }] as any,
  lossReasons: [],
  scoreTrend: "基本稳定",
  lifeEvents: Array.from({ length: 8 }, () => 0),
  openAnswers: [],
});
const academics = {
  examName: "期中考试",
  subjects: [
    { name: "语文", selfLevel: 3, fullScore: 120, lastScore: 96, targetScore: 108 },
    { name: "数学", selfLevel: 3, fullScore: 120, lastScore: 100, targetScore: 112 },
  ],
  updatedAt: Date.now(),
} as any;

const data: any = {
  mbti, disc, e3,
  multi5: scoreMulti5(MULTI5_QUESTIONS.map((q: any) => q.answer ?? 0)),
  holland: scoreHolland(Array.from({ length: 36 }, (_, i) => (i % 5) + 1)),
  anchor: scoreAnchor(Array.from({ length: 40 }, (_, i) => (i % 5) + 1)),
  mental: scoreMental(Array.from({ length: MENTAL_V2_QUESTION_COUNT }, (_, i) => i % 3)),
  raw: [
    { kind: "e3", answers: { stage: "junior", ratings: ratings70, motivation: "want", subjects: [], lossReasons: [], scoreTrend: "", lifeEvents: [], openAnswers: [] }, createdAt: new Date() },
    { kind: "mbti", answers: Array.from({ length: 28 }, () => 0), createdAt: new Date() },
    { kind: "disc", answers: Array.from({ length: 24 }, () => 0), createdAt: new Date() },
    { kind: "multi5", answers: MULTI5_QUESTIONS.map((q: any) => q.answer ?? 0), createdAt: new Date() },
    { kind: "anchor", answers: Array.from({ length: 40 }, () => 3), createdAt: new Date() },
    { kind: "holland", answers: Array.from({ length: 36 }, () => 3), createdAt: new Date() },
    { kind: "mental", answers: Array.from({ length: MENTAL_V2_QUESTION_COUNT }, () => 1), createdAt: new Date() },
  ],
  discParents: [],
};

const render = (tab: string, opts: { viewer?: "student" | "tutor"; withAcad?: boolean } = {}) =>
  renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      { initialEntries: [`/report-detail?tab=${tab}`] },
      React.createElement(ReportView, {
        data,
        profile: { name: "测试员", grade: "初一", academics: opts.withAcad === false ? undefined : academics },
        viewer: opts.viewer ?? "student",
        onEditAcademics: () => {},
      }),
    ),
  );

const need = (html: string, kw: string, where: string) => {
  if (!html.includes(kw)) throw new Error(`${where} 缺少: ${kw}`);
  console.log(`OK [${where}] ${kw}`);
};

/* 双模式全 tab 白屏检查 */
for (const viewer of ["student", "tutor"] as const) {
  for (const tab of ["combined", "e3", "mbti", "disc", "multi5", "anchor", "holland", "mental", "academics"]) {
    const html = render(tab, { viewer });
    if (html.length < 200) throw new Error(`${viewer}/${tab} 渲染内容过短`);
  }
}
console.log("双模式全 tab 白屏检查 OK");

const full = render("combined");
/* 需求6：简要总结三档 */
need(full, "简要总结", "综合详版");
need(full, "优势点总结", "综合详版");
need(full, "待提升总结", "综合详版");
need(full, "卡点总结", "综合详版");
if (full.includes("概要总论")) throw new Error("仍存在「概要总论」");
console.log("OK 概要总论已移除");
/* 需求4：先抓这三件事（在方案之后） */
need(full, "先抓这三件事", "综合详版");
if (!(full.indexOf("哪层不行补哪层") < full.indexOf("先抓这三件事"))) throw new Error("先抓这三件事 应在建议进步方案之后");
console.log("OK 先抓这三件事位于建议进步方案之后");
/* 需求3：评分原则备注 */
need(full, "评分原则", "综合详版");
need(full, "优先干预", "综合详版");
/* 需求2：冰山各行答题明细链接 + 锚点 */
need(full, "答题明细", "综合详版");
for (const id of ["ansblk-mental", "ansblk-multi5", "ansblk-anchor", "ansblk-holland", "ansblk-mbti"]) {
  need(full, `id="ansblk-${id === "ansblk-mental" ? "mental" : id.slice(7)}"`, "综合详版");
}
if (!/id="ansblk-disc-/.test(full)) throw new Error("综合详版缺少 ansblk-disc- 前缀锚点");
console.log("OK ansblk-disc- 前缀锚点");
/* 需求1：框架图二级考察点（kp chip） */
need(full, "学习兴趣", "框架图");
need(full, "点击任意徽章", "框架图");

/* e3 tab：五段答题明细锚点（冰山层行/层内重点项链接目标） */
const e3tab = render("e3");
for (const id of ["ansblk-e3-lexue", "ansblk-e3-huixue", "ansblk-e3-shanxue", "ansblk-e3-tiaojian", "ansblk-e3-xueneng"]) {
  need(e3tab, `id="${id}"`, "e3 tab");
}

/* 需求2：成绩未填写 → 冰山上显示「未填写」+ 去填写链接（学生/伴学师双模式） */
const noAcad = render("combined", { withAcad: false });
need(noAcad, "未填写", "综合详版(无成绩)");
need(noAcad, "去填写成绩与目标", "综合详版(无成绩)");
if (noAcad.includes("各科均已达标")) throw new Error("无成绩时不应显示「各科均已达标」");
console.log("OK 无成绩时不显示「已达标」");
const noAcadTutor = render("combined", { withAcad: false, viewer: "tutor" });
need(noAcadTutor, "去填写成绩与目标", "综合详版(无成绩,tutor)");

console.log("RENDER_SMOKE_V35_OK");
