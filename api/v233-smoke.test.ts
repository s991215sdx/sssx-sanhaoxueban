import { describe, it } from "vitest";
import { readFileSync } from "fs";
import {
  MULTI5_COMMON_STAGE,
  MULTI5_DIM_ORDER,
  multi5QuestionsFor,
  scoreMulti5For,
  toMulti5Public,
} from "@contracts/multi5";

/** v233：多元智能五项改通用版卷 + 每题附加「这题我不会」选项。 */
describe("v233 多元智能五项通用卷", () => {
  it("通用卷 40 题、每维 8 题、4 选项+合法答案", () => {
    const qs = multi5QuestionsFor(MULTI5_COMMON_STAGE);
    if (qs.length !== 40) throw new Error(`通用版题数 ${qs.length} ≠ 40`);
    for (const dim of MULTI5_DIM_ORDER) {
      const n = qs.filter((q) => q.dim === dim).length;
      if (n !== 8) throw new Error(`通用版 ${dim} 题数 ${n} ≠ 8`);
    }
    for (const q of qs) {
      if (q.options.length !== 4) throw new Error("通用版存在非 4 选项题");
      if (q.answer < 0 || q.answer > 3) throw new Error("通用版存在非法答案下标");
    }
    if (qs.some((q) => /lg |sin |向量|导数|语病|英语单词/.test(q.text)))
      throw new Error("通用版混入纯学科题");
  });

  it("公开题干附带第 5 选项「这题我不会」", () => {
    const qs = multi5QuestionsFor(MULTI5_COMMON_STAGE).map(toMulti5Public);
    for (const q of qs) {
      if (q.options.length !== 5) throw new Error(`第 ${q.no} 题公开选项数 ${q.options.length} ≠ 5`);
      if (q.options[4] !== "这题我不会") throw new Error(`第 ${q.no} 题第 5 选项不是「这题我不会」`);
      if ("answer" in q && (q as { answer?: unknown }).answer !== undefined) throw new Error("公开题泄漏答案");
    }
  });

  it("选「这题我不会」(4) 不计对不计错、剔除分母", () => {
    const qs = multi5QuestionsFor(MULTI5_COMMON_STAGE);
    const allDontKnow = qs.map(() => 4);
    const r0 = scoreMulti5For(MULTI5_COMMON_STAGE, allDontKnow);
    if (r0.overall !== 0 || r0.carefulIndex !== 0) throw new Error("全选不会应得 0 分");
    for (const p of r0.perDim) {
      if (p.total !== 0 || (p.dontKnow ?? 0) !== 8) throw new Error(`${p.key} 不会计分错误`);
    }
    if (r0.stage !== "通用") throw new Error("结果缺通用版标记");
    // 每维 4 题答对 + 4 题不会 → 该维 100 分（分母按实际作答 4 题）
    const half = qs.map((q) => (q.no % 2 === 1 ? q.answer : 4));
    const r1 = scoreMulti5For(MULTI5_COMMON_STAGE, half);
    for (const p of r1.perDim) {
      if (p.total !== 4 || p.correct !== 4 || (p.dontKnow ?? 0) !== 4) throw new Error(`${p.key} 半答半不会计分错误`);
    }
    if (r1.overall !== 100) throw new Error("答对题全对应得满分");
  });

  it("全对仍满分；下标 5 非法", () => {
    const qs = multi5QuestionsFor(MULTI5_COMMON_STAGE);
    const all = qs.map((q) => q.answer);
    const r = scoreMulti5For(MULTI5_COMMON_STAGE, all);
    if (r.overall !== 100 || r.carefulIndex !== 100) throw new Error("全对未得满分");
    let threw = false;
    try {
      scoreMulti5For(MULTI5_COMMON_STAGE, qs.map(() => 5));
    } catch {
      threw = true;
    }
    if (!threw) throw new Error("非法下标 5 未拦截");
  });

  it("历史学段卷仍可还原（旧结果答题明细兼容）", () => {
    for (const stage of ["小学", "初中", "高中"]) {
      const qs = multi5QuestionsFor(stage);
      if (qs.length !== 40) throw new Error(`${stage}版历史卷丢失`);
    }
    // 旧卷没有「不会」下标，0-3 全部作答的计分口径不变
    const jr = multi5QuestionsFor("初中").map((q) => q.answer);
    const r = scoreMulti5For("初中", jr);
    if (r.overall !== 100 || r.stage !== "初中") throw new Error("历史卷计分口径被改坏");
  });

  it("后端 submit 入参 schema 放行下标 4、拦截 5", () => {
    const src = readFileSync("api/profileRouter.ts", "utf-8");
    if (!/kind: z\.literal\("multi5"\),[\s\S]{0,120}min\(0\)\.max\(4\)/.test(src))
      throw new Error("submit schema 未放行「这题我不会」下标 4");
    if (/kind: z\.literal\("multi5"\),[\s\S]{0,120}min\(0\)\.max\(3\)/.test(src))
      throw new Error("submit schema 仍限制 max(3)，第 5 选项会被拒");
  });

  it("前端「不会」选项弱化样式 + 提示文案", () => {
    const src = readFileSync("src/components/companion/Multi5Quiz.tsx", "utf-8");
    if (!/DONT_KNOW_IDX = 4/.test(src)) throw new Error("前端缺「不会」下标常量");
    if (!/不算错也不扣分/.test(src)) throw new Error("前端缺「不会」提示文案");
  });
});
