/**
 * v181 冒烟测试：测评中心双轨入口 + 报告更名 + 答题题目自动定位。
 * 1. 学习力测评（CombinedSuite）：7 步含心理健康A版(SD Q)，完成页含家长提醒卡（家长DISC/家长认知）。
 * 2. 选科及升学规划测评（ZhihuiSuite）：学科四维→霍兰德→职业锚，多元智能折叠且不影响推荐。
 * 3. 「三好生涯规划报告」全局更名「选科及升学规划报告」（zhihui 相关文件）。
 * 4. quizScroll.ts 存在且被至少 6 个组件引用。
 * 5. Subject4dQuiz 不再渲染维度标签 chip。
 */
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = `${__dirname}/..`;
const read = (p: string) => readFileSync(`${ROOT}/${p}`, "utf8");

describe("v181 双轨测评中心", () => {
  it("ZhihuiSuite：三步 + 折叠参考项", () => {
    const src = read("src/components/assessment/ZhihuiSuite.tsx");
    expect(src).toContain("subject4d");
    expect(src).toContain("holland");
    expect(src).toContain("anchor");
    expect(src).toContain("暂不影响选科与专业推荐");
    expect(src).toContain("zhihui-report");
  });

  it("CombinedSuite：心理健康A版 + 家长提醒", () => {
    const src = read("src/components/assessment/CombinedSuite.tsx");
    expect(src).toContain("mentalsdq");
    expect(src).toContain("家长");
    expect(src).toContain("discparent");
    expect(src).toContain("e3parent");
    expect(src).toContain("学习力测评");
  });

  it("AssessmentCenter：双轨入口", () => {
    const src = read("src/pages/AssessmentCenter.tsx");
    expect(src).toContain("ZhihuiSuite");
    expect(src).toContain("选科及升学规划测评");
    expect(src).toContain("学习力测评");
  });

  it("v181d：两个推荐入口受渠道套餐全量权限控制", () => {
    const src = read("src/pages/AssessmentCenter.tsx");
    // 学习力测评：渠道可勾选的核心四种须全套（MBTI/DISC/E3/智能五项；心理健康A版可跳过、非渠道可勾种类）
    expect(src).toMatch(/\["mbti", "disc", "e3", "multi5"\]\.every/);
    // 选科及升学规划测评：套餐须含 学科四维/霍兰德/职业锚 全套
    expect(src).toMatch(/\["subject4d", "holland", "anchor"\]\.every/);
    expect(src).toContain("更多测评");
    expect(src).toContain("assessment-list");
  });

  it("v181e：注册/基本信息后落到测评中心自选（不再自动连测）", () => {
    const ir = read("src/pages/InviteRegister.tsx");
    expect(ir).toContain('navigate("/assessments", { replace: true })');
    expect(ir).not.toContain("queue=");
    const app = read("src/App.tsx");
    expect(app).toContain('window.location.replace("/assessments")');
  });

  it("v181e：报告模块不受模块开关限制（学员做完测评可进报告中心）", () => {
    const app = read("src/App.tsx");
    expect(app).toMatch(/key !== "assessments" && key !== "report"/);
  });

  it("v181e：九能档色只按分值（红<3.0/黄3.0-3.7/绿≥3.8），强制卡点不改色", () => {
    const fw = read("src/components/reports/SystemFramework.tsx");
    // UnitBlock 必须按分数判定档位，而不是直接用 unit.level
    expect(fw).toMatch(/frameworkScoreLevel\(unit\.score\)/);
    const radar = read("src/components/reports/NineAbilityRadar.tsx");
    expect(radar).toMatch(/e3v37Level\(d\.得分\)/);
    const ov = read("src/components/reports/E3V37OverviewCard.tsx");
    expect(ov).toMatch(/e3v37Level\(a\.score\)/);
    const rv = read("src/components/reports/ReportView.tsx");
    expect(rv).toMatch(/level: e3v37Level\(a\.score\)/);
  });

  it("报告更名：选科及升学规划报告", () => {
    for (const p of [
      "src/pages/ZhihuiReport.tsx",
      "src/pages/AssessmentCenter.tsx",
      "src/pages/ReportDetail.tsx",
      "src/components/reports/ReportView.tsx",
      "src/components/assessment/ZhihuiSuite.tsx",
    ]) {
      const src = read(p);
      expect(src).toContain("选科及升学规划报告");
      expect(src).not.toContain("三好生涯规划报告");
    }
  });

  it("题目自动定位：quizScroll 被 ≥6 个组件引用", () => {
    const files = [
      "src/components/companion/HollandQuiz.tsx",
      "src/components/companion/AnchorQuiz.tsx",
      "src/components/companion/Multi5Quiz.tsx",
      "src/components/companion/MentalSdqQuiz.tsx",
      "src/components/companion/MentalPaQuiz.tsx",
      "src/components/companion/MentalQuiz.tsx",
      "src/components/companion/MentalScl90Quiz.tsx",
      "src/components/companion/SubjectQuiz.tsx",
      "src/components/companion/Subject4dQuiz.tsx",
      "src/components/companion/DiscV2Quiz.tsx",
      "src/components/welcome/ChoiceStage.tsx",
    ];
    let used = 0;
    for (const p of files) {
      if (read(p).includes("useScrollToQuestion")) used += 1;
    }
    expect(used).toBeGreaterThanOrEqual(6);
    expect(read("src/lib/quizScroll.ts")).toContain("scrollIntoView");
  });

  it("Subject4dQuiz：不再渲染维度标签 chip", () => {
    const src = read("src/components/companion/Subject4dQuiz.tsx");
    expect(src).not.toContain("SUBJECT4D_DIM_LABEL");
    expect(src).toContain("scroll-mt-24");
  });

  it("回归：useScrollToQuestion 必须位于所有提前 return 之前（防止白屏）", () => {
    const files = [
      "src/components/companion/Subject4dQuiz.tsx",
      "src/components/companion/HollandQuiz.tsx",
      "src/components/companion/AnchorQuiz.tsx",
      "src/components/companion/Multi5Quiz.tsx",
      "src/components/companion/MentalSdqQuiz.tsx",
      "src/components/companion/MentalPaQuiz.tsx",
      "src/components/companion/MentalQuiz.tsx",
      "src/components/companion/MentalScl90Quiz.tsx",
      "src/components/companion/SubjectQuiz.tsx",
      "src/components/welcome/ChoiceStage.tsx",
    ];
    for (const p of files) {
      const lines = read(p).split("\n");
      const hookAt = lines.findIndex((l) => l.includes("useScrollToQuestion("));
      expect(hookAt, `${p} 缺少 useScrollToQuestion`).toBeGreaterThanOrEqual(0);
      // 结果卡提前 return（含嵌套在 if 块内、4 空格缩进的 return）是 hook 顺序问题的根源，
      // 断言 hook 位于文件里第一个「if (submit.isSuccess」之前。
      const resultCardAt = lines.findIndex((l) => l.includes("if (submit.isSuccess"));
      if (resultCardAt >= 0) {
        expect(hookAt, `${p} 的 useScrollToQuestion 位于结果卡提前 return 之后，做完测评会白屏`).toBeLessThan(resultCardAt);
      }
    }
  });
});
