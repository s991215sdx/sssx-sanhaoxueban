/** @jsxImportSource react */
/* v34 冒烟：renderToStaticMarkup 渲染 ReportView（student + tutor 双模式），抓白屏类运行时错误 */
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

const mbti = scoreMbti(Array.from({ length: 28 }, (_, i) => (i % 3 === 0 ? 0 : 1)));
const disc = scoreDisc(Array.from({ length: 24 }, (_, i) => i % 2));
const e3 = scoreE3V37({
  stage: "junior",
  ratings: Array.from({ length: 70 }, (_, i) => (i % 5) + 1),
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
  multi5: scoreMulti5(MULTI5_QUESTIONS.map((q: any, i: number) => (i % 4 === 0 ? q.answer ?? 0 : (q.answer ?? 0) + 0))),
  holland: scoreHolland(Array.from({ length: 36 }, (_, i) => (i % 5) + 1)),
  anchor: scoreAnchor(Array.from({ length: 40 }, (_, i) => (i % 5) + 1)),
  mental: scoreMental(Array.from({ length: MENTAL_V2_QUESTION_COUNT }, (_, i) => i % 3)),
  raw: [],
  discParents: [],
};

for (const viewer of ["student", "tutor"] as const) {
  for (const tab of ["combined", "e3", "mbti", "disc", "multi5", "anchor", "holland", "mental", "academics"]) {
    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: [`/report-detail?tab=${tab}`] },
        React.createElement(ReportView, {
          data,
          profile: { name: "测试员", grade: "初一", academics },
          viewer,
          onEditAcademics: () => {},
        }),
      ),
    );
    if (html.length < 200) throw new Error(`${viewer}/${tab} 渲染内容过短: ${html.length}`);
    console.log(`${viewer}/${tab}: ${html.length} chars OK`);
  }
}

const full = renderToStaticMarkup(
  React.createElement(
    MemoryRouter,
    { initialEntries: ["/report-detail?tab=combined"] },
    React.createElement(ReportView, { data, profile: { name: "测试员", grade: "初一", academics }, viewer: "student" }),
  ),
);
for (const kw of ["深层特质", "学习目标 · 成绩", "冰山下", "职业锚", "霍兰德兴趣", "概要总论", "本章相关测评", "理清现状与目标"]) {
  if (!full.includes(kw)) throw new Error(`综合报告缺少关键词: ${kw}`);
  console.log(`关键词 OK: ${kw}`);
}
if (full.includes("九宫格")) throw new Error("仍存在九宫格");
console.log("RENDER_SMOKE_OK");
