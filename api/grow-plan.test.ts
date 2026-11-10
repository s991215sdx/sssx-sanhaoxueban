import { describe, expect, it } from "vitest";
import { ABILITY_TO_COURSE, COURSE_OUTLINE, composeGoalText, composePlanText, defaultCoursePlan, emptyGrowPlan, parseGrowForm } from "../src/components/org/growPlan";

/** v275：GROW 规划课四要素表单的数据契约——五大课目标、课程计划、合成纯文本与宽容解析。 */
describe("growPlan 五大课定义（v275 用户拍板文案）", () => {
  it("五门课的目标、系统与默认安排完整", () => {
    expect(COURSE_OUTLINE.map((c) => c.course)).toEqual(["规划课", "心法课", "技法课", "督学课", "亲子课"]);
    expect(COURSE_OUTLINE.map((c) => c.goal)).toEqual([
      "目标明确、路径清晰",
      "心智成长、认知发展",
      "校内学法优化、校外 AI 学习",
      "高效执行、温度陪伴",
      "学会说话、关系亲密",
    ]);
    for (const c of COURSE_OUTLINE) {
      expect(c.outline.length).toBeGreaterThan(4);
      expect(defaultCoursePlan(c.course).format.length).toBeGreaterThan(0);
    }
  });

  it("九能映射覆盖全部十二项且指向存在的课程", () => {
    const names = new Set(COURSE_OUTLINE.map((c) => c.course));
    for (const courses of Object.values(ABILITY_TO_COURSE)) for (const c of courses) expect(names.has(c)).toBe(true);
    expect(Object.keys(ABILITY_TO_COURSE)).toHaveLength(12);
  });
});

describe("composeGoalText / composePlanText 合成纯文本", () => {
  it("目标栏含目的、升学目标与学科目标", () => {
    const form = { ...emptyGrowPlan(), purpose: ["分数提升" as const], purposeNote: "先稳数学", targetSchool: "三好目标中学", subjects: [{ name: "数学", baseline: 85, target: 95 }] };
    const text = composeGoalText(form);
    expect(text).toContain("【目的】分数提升（先稳数学）");
    expect(text).toContain("【升学目标】三好目标中学");
    expect(text).toContain("【学科目标】数学 85→95");
  });

  it("计划栏每门课含课程目标与频次形式，衡量段完整", () => {
    const form = {
      ...emptyGrowPlan(),
      courses: ["心法课", "督学课"],
      coursePlans: [{ course: "心法课", frequency: "每周 1 次", format: "一对一" }],
      weekly: [{ item: "数学错题当天重做", metric: "周测 ≥85" }],
      exams: [{ name: "期中考试", date: "2026-11-15", scores: "" }],
    };
    const text = composePlanText(form, COURSE_OUTLINE);
    expect(text).toContain("心法课（心智成长、认知发展）");
    expect(text).toContain("〔每周 1 次 · 一对一〕");
    expect(text).toContain("督学课（高效执行、温度陪伴）");
    expect(text).toContain("【衡量·每周修正项】");
    expect(text).toContain("【衡量·大考成绩】");
  });
});

describe("parseGrowForm 宽容解析", () => {
  it("旧数据（无 coursePlans）回退为空数组不炸", () => {
    const parsed = parseGrowForm({ purpose: ["分数提升"], courses: ["心法课"], weekly: [{ item: "错题重做" }] });
    expect(parsed?.coursePlans).toEqual([]);
    expect(parsed?.courses).toEqual(["心法课"]);
  });

  it("非对象与脏字段返回安全默认值", () => {
    expect(parseGrowForm(null)).toBeNull();
    expect(parseGrowForm("x")).toBeNull();
    const parsed = parseGrowForm({ purpose: ["不存在的选项"], subjects: "bad", coursePlans: [{ course: "亲子课", frequency: 3 }] });
    expect(parsed?.purpose).toEqual([]);
    expect(parsed?.subjects).toEqual([]);
    expect(parsed?.coursePlans[0]).toEqual({ course: "亲子课", frequency: "", format: "" });
  });
});
