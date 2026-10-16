/** 临时冒烟：复现综合报告三阶九能版（view=v39）白屏 */
import { describe, it, expect, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";

/* ReportView 内部有若干 trpc 查询（如 academicRecords），冒烟环境无后端——用嵌套 Proxy 打桩 */
vi.mock("@/providers/trpc", () => {
  const make: any = () =>
    new Proxy(() => ({}), {
      get: (_t, k) => {
        if (k === "useQuery") return () => ({ data: undefined });
        if (k === "useMutation") return () => ({ mutate: () => {} });
        if (k === "useUtils") return () => new Proxy({}, { get: () => () => {} });
        return make();
      },
    });
  return { trpc: make() };
});

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
  ],
  discParents: [],
};

describe("v39 三阶九能版冒烟", () => {
  it("渲染 combined&view=v39", () => {
    const html = renderToStaticMarkup(
      React.createElement(
        MemoryRouter,
        { initialEntries: ["/report-detail?tab=combined&view=v39"] },
        React.createElement(ReportView as any, {
          data,
          profile: { name: "测试员", grade: "初一", academics },
          viewer: "student",
          onEditAcademics: () => {},
        }),
      ),
    );
    expect(html.length).toBeGreaterThan(200);
    for (const kw of ["体系版本", "三阶九能", "元认知"]) {
      expect(html).toContain(kw);
    }
  });
});
