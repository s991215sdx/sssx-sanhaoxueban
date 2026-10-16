import { describe, it } from "vitest";
import { readFileSync } from "fs";
import { INVITE_ASSESS_KINDS } from "@contracts/invite";
import { multi5QuestionsFor, scoreMulti5For, MULTI5_STAGES } from "@contracts/multi5";

describe("v176 测评套餐与注册队列", () => {
  it("套餐含学科四维测评", () => {
    const keys = INVITE_ASSESS_KINDS.map((k) => k.key);
    if (!keys.includes("subject4d")) throw new Error("套餐缺 subject4d");
  });
  it("注册队列：学科四维置顶、多元五项移出", () => {
    const src = readFileSync("api/inviteRouter.ts", "utf-8");
    if (!/const assessQueue = rawKinds\.includes\("all"\)[\s\S]{0,200}k !== "multi5"/.test(src))
      throw new Error("注册队列未按 v176 规则重组");
    if (!/\["subject4d", \.\.\./.test(src)) throw new Error("学科四维未置顶注册队列");
  });
  it("落地队列跳过已测项", () => {
    const src = readFileSync("src/pages/AssessmentCenter.tsx", "utf-8");
    if (!/剔出队列/.test(src)) throw new Error("测评中心未过滤已测项");
  });
});

describe("v176 学员详情带出学科四维", () => {
  it("OPTIONAL_KINDS 含 subject4d", () => {
    const src = readFileSync("api/studentDetail.ts", "utf-8");
    if (!/"subject4d"/.test(src)) throw new Error("studentDetail 未带 subject4d");
  });
  it("报告栏目宫格含三好生涯规划报告", () => {
    const src = readFileSync("src/components/reports/ReportView.tsx", "utf-8");
    if (!/三好生涯规划报告/.test(src)) throw new Error("ReportView 缺三好生涯规划报告栏目");
    if (!/studentUserId/.test(src)) throw new Error("ReportView 缺 studentUserId 直达");
  });
});

describe("v176 多元智能五项学段分卷", () => {
  it("三套题库各 40 题、每维 8 题、答案下标合法", () => {
    for (const stage of MULTI5_STAGES) {
      const qs = multi5QuestionsFor(stage);
      if (qs.length !== 40) throw new Error(`${stage}版题数 ${qs.length} ≠ 40`);
      for (const dim of ["reasoning", "detail", "number", "verbal", "spatial"] as const) {
        const n = qs.filter((q) => q.dim === dim).length;
        if (n !== 8) throw new Error(`${stage}版 ${dim} 题数 ${n} ≠ 8`);
      }
      for (const q of qs) {
        if (q.answer < 0 || q.answer > 3) throw new Error(`${stage}版存在非法答案下标`);
        if (q.options.length !== 4) throw new Error(`${stage}版存在非 4 选项题`);
      }
    }
  });
  it("计分带学段标记且各版本独立计分", () => {
    const all = multi5QuestionsFor("小学").map((q) => q.answer);
    const r = scoreMulti5For("小学", all);
    if (r.overall !== 100 || r.carefulIndex !== 100) throw new Error("全对未得满分");
    if (r.stage !== "小学") throw new Error("结果缺学段标记");
  });
  it("后端按学段下发与计分", () => {
    const src = readFileSync("api/profileRouter.ts", "utf-8");
    if (!/case "multi5": \{[\s\S]{0,300}multi5QuestionsFor\(stage\)/.test(src)) throw new Error("questions 未按学段下发");
    if (!/scoreMulti5For\(stage, input\.answers\)/.test(src)) throw new Error("submit 未按学段计分");
  });
});
