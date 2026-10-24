import { describe, it } from "vitest";
import { readFileSync } from "fs";
import {
  MULTI5_COMMON_STAGE,
  MULTI5_DIM_ORDER,
  multi5QuestionsFor,
  multi5TimeFactor,
  scoreMulti5For,
} from "@contracts/multi5";

/** v234：多元智能五项作答速度计入得分（30s 内不扣，30→120s 线性降到 0.6，兜底 0.6）。 */
describe("v234 作答时间系数", () => {
  it("时间系数曲线：≤30s=1，75s=0.8，≥120s=0.6", () => {
    const cases: [number, number][] = [[0, 1], [30, 1], [75, 0.8], [120, 0.6], [600, 0.6]];
    for (const [sec, expected] of cases) {
      const f = multi5TimeFactor(sec);
      if (Math.abs(f - expected) > 0.001) throw new Error(`${sec}s 系数 ${f} ≠ ${expected}`);
    }
  });

  it("全对+全快（10s/题）= 满分且标记时间系数生效", () => {
    const qs = multi5QuestionsFor(MULTI5_COMMON_STAGE);
    const r = scoreMulti5For(
      MULTI5_COMMON_STAGE,
      qs.map((q) => q.answer),
      qs.map(() => 10),
    );
    if (r.overall !== 100) throw new Error(`全对全快应得 100，实际 ${r.overall}`);
    if (r.timeFactorUsed !== true) throw new Error("未标记 timeFactorUsed");
    if (r.avgSecPerQ !== 10) throw new Error(`avgSecPerQ ${r.avgSecPerQ} ≠ 10`);
    if (r.carefulIndex !== 100) throw new Error("细心指数不应受时间影响");
  });

  it("全对但全慢（120s/题）= 综合 60（0.6 兜底）", () => {
    const qs = multi5QuestionsFor(MULTI5_COMMON_STAGE);
    const r = scoreMulti5For(
      MULTI5_COMMON_STAGE,
      qs.map((q) => q.answer),
      qs.map(() => 120),
    );
    if (r.overall !== 60) throw new Error(`全对全慢应得 60，实际 ${r.overall}`);
    // perDim.correct 保持原始答对数（报告展示用），weighted 才是加权值
    for (const p of r.perDim) {
      if (p.correct !== 8) throw new Error(`${p.key} 原始答对数 ${p.correct} ≠ 8`);
      if (Math.abs((p.weighted ?? 0) - 4.8) > 0.001) throw new Error(`${p.key} 加权得分 ${p.weighted} ≠ 4.8`);
    }
  });

  it("半快半慢：每维 4 题 10s + 4 题 120s → 维度 80 分", () => {
    const qs = multi5QuestionsFor(MULTI5_COMMON_STAGE);
    const r = scoreMulti5For(
      MULTI5_COMMON_STAGE,
      qs.map((q) => q.answer),
      qs.map((_, i) => (i % 2 === 0 ? 10 : 120)),
    );
    for (const k of MULTI5_DIM_ORDER) {
      if (r.dims[k] !== 80) throw new Error(`${k} 应得 80，实际 ${r.dims[k]}`);
    }
  });

  it("无 times（旧记录口径）分数不变；答错题再慢也不加分", () => {
    const qs = multi5QuestionsFor(MULTI5_COMMON_STAGE);
    const all = qs.map((q) => q.answer);
    const r0 = scoreMulti5For(MULTI5_COMMON_STAGE, all);
    if (r0.overall !== 100 || r0.timeFactorUsed !== false) throw new Error("旧口径应满分且不标记时间系数");
    // 全答错 + 全 10s → 仍 0 分
    const wrong = qs.map((q) => (q.answer + 1) % 4);
    const r1 = scoreMulti5For(MULTI5_COMMON_STAGE, wrong, qs.map(() => 10));
    if (r1.overall !== 0) throw new Error("答错题不应因快而得分");
    // 全选不会 + 计时 → 仍 0 分且不标记
    const r2 = scoreMulti5For(MULTI5_COMMON_STAGE, qs.map(() => 4), qs.map(() => 10));
    if (r2.overall !== 0 || r2.timeFactorUsed !== false) throw new Error("不会题不应参与时间计分");
  });

  it("后端 submit 接收 times 并随作答存储", () => {
    const src = readFileSync("api/profileRouter.ts", "utf-8");
    if (!/times: z\.array\(z\.number\(\)\.min\(0\)\.max\(3600\)\)/.test(src))
      throw new Error("submit schema 未接收 times");
    if (!/scoreMulti5For\(stage, input\.answers, input\.times\)/.test(src))
      throw new Error("计分未传 times");
    if (!/picks: input\.answers, times: input\.times/.test(src))
      throw new Error("作答未随存 times");
  });

  it("前端逐题计时并随答案提交", () => {
    const src = readFileSync("src/components/companion/Multi5Quiz.tsx", "utf-8");
    if (!/startRef\.current = Date\.now\(\)/.test(src)) throw new Error("前端缺逐题计时重置");
    if (!/timesRef\.current\[idx\] =/.test(src)) throw new Error("前端缺逐题用时记录");
    if (!/kind: "multi5", answers: next, times/.test(src)) throw new Error("提交未带 times");
    if (!/速度已计入得分/.test(src)) throw new Error("结果卡缺用时说明");
  });
});
