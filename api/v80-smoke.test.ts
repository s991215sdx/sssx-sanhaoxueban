import { describe, it, expect } from "vitest";
import { normalizeReportKinds } from "@contracts/invite";
import { buildSubjectAnalysis, scoreSubjectAssessment, SUBJECT_BANK } from "@contracts/subjectAssessment";

describe("v80 normalizeReportKinds", () => {
  it("保留合法 key 并去重", () => {
    expect(normalizeReportKinds(["subject", "mbti", "subject", "hack"])).toEqual(["subject", "mbti"]);
  });
  it("all 直接放行全部", () => {
    expect(normalizeReportKinds(["all", "x"])).toEqual(["all"]);
  });
  it("非法输入返回空或 null", () => {
    expect(normalizeReportKinds(undefined)).toEqual([]);
    expect(normalizeReportKinds("not-json")).toBeNull();
    expect(normalizeReportKinds('["e3","subject"]')).toEqual(["e3", "subject"]);
  });
});

describe("v80 buildSubjectAnalysis", () => {
  it("由真实计分结果生成完整分析", () => {
    // 语文全 5 分、数学全 2 分 → 一科优秀一科待提升
    const answers = {
      语文: SUBJECT_BANK["语文"].map(() => 5),
      数学: SUBJECT_BANK["数学"].map(() => 2),
    };
    const result = scoreSubjectAssessment(answers);
    const a = buildSubjectAnalysis(result);
    expect(a.headline).toContain("语文");
    expect(a.subjects.length).toBe(2);
    const math = a.subjects.find((s) => s.name === "数学")!;
    expect(math.grade).toBe("待提升");
    expect(math.suggestions.length).toBeGreaterThan(0);
    expect(a.priority.length).toBeGreaterThan(0);
    expect(a.priority[0].title).toContain("数学");
  });
  it("同一结果生成同一报告（纯函数）", () => {
    const answers = { 英语: SUBJECT_BANK["英语"].map(() => 4) };
    const r1 = buildSubjectAnalysis(scoreSubjectAssessment(answers));
    const r2 = buildSubjectAnalysis(scoreSubjectAssessment(answers));
    expect(JSON.stringify(r1)).toBe(JSON.stringify(r2));
  });
});

describe("v81 学科测评累计合并", () => {
  it("新科目并入、同科目覆盖、无历史时等同本次", async () => {
    const { mergeSubjectAnswers } = await import("@contracts/subjectAssessment");
    const hist = SUBJECT_BANK["历史"].map(() => 4);
    const math = SUBJECT_BANK["数学"].map(() => 3);
    const math2 = SUBJECT_BANK["数学"].map(() => 5);
    // 先测历史，再测数学 → 两科都在
    const m1 = mergeSubjectAnswers(null, { 历史: hist });
    expect(Object.keys(m1)).toEqual(["历史"]);
    const m2 = mergeSubjectAnswers(m1, { 数学: math });
    expect(Object.keys(m2).sort()).toEqual(["历史", "数学"]);
    // 重测数学覆盖旧数学，历史保留
    const m3 = mergeSubjectAnswers(m2, { 数学: math2 });
    expect(m3["数学"]).toEqual(math2);
    expect(m3["历史"]).toEqual(hist);
    // 合并结果可直接计分且覆盖 2 科
    const r = scoreSubjectAssessment(m3);
    expect(r.subjects.length).toBe(2);
  });
});
