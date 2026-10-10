/* v84 冒烟：升学规划报告模仿《智慧生涯测评报告》（郭老师升学规划样例）完善 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { buildGuidanceReport } from "../src/data/reports/guidance";
import { getMajorDetail, getCareerDetail, MAJOR_DETAILS, CAREER_DETAILS } from "../src/data/reports/careerData";
import type { HollandResult } from "@contracts/holland";
import type { AcademicsData } from "@contracts/academics";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

/* 满测评 + 成绩的高中输入。 */
const holland: HollandResult = {
  dims: { R: 2.5, I: 4.2, A: 3.0, S: 4.5, E: 3.3, C: 3.1 },
  top3: ["S", "I", "E"],
  code: "SIE",
  keywords: "热心 · 亲和 · 合作；好奇 · 理性 · 钻研；果断 · 自信 · 领导",
  summary: "test",
};
const academics: AcademicsData = {
  examName: "期中考试",
  updatedAt: Date.now(),
  subjects: [
    { name: "语文", selfLevel: 4, fullScore: 150, lastScore: 108, targetScore: 120 },
    { name: "数学", selfLevel: 4, fullScore: 150, lastScore: 118, targetScore: 130 },
    { name: "英语", selfLevel: 3, fullScore: 150, lastScore: 105, targetScore: null },
    { name: "物理", selfLevel: 4, fullScore: 100, lastScore: 82, targetScore: 90 },
    { name: "化学", selfLevel: 5, fullScore: 100, lastScore: 88, targetScore: 95 },
    { name: "道德与法治", selfLevel: 3, fullScore: 100, lastScore: 70, targetScore: null },
    { name: "历史", selfLevel: 2, fullScore: 100, lastScore: 55, targetScore: null },
    { name: "地理", selfLevel: 3, fullScore: 100, lastScore: 66, targetScore: null },
    { name: "生物", selfLevel: 4, fullScore: 100, lastScore: 80, targetScore: 85 },
  ],
};

describe("v84 buildGuidanceReport 新板块", () => {
  const g = buildGuidanceReport({ grade: "高二", studentName: "曹同学", holland, academics })!;

  it("有报告才生成（非空）", () => {
    expect(g).toBeTruthy();
  });

  it("overview 六行（5 测评 + 学业），完成态标注正确", () => {
    expect(g.overview.length).toBe(6);
    const hol = g.overview.find((o) => o.label.includes("霍兰德"))!;
    expect(hol.status).toBe("done");
    expect(hol.value).toContain("SIE");
    expect(g.overview.filter((o) => o.status === "todo").length).toBe(4); // mbti/disc/multi5/anchor 未测
  });

  it("hollandDeep：个人侧写 + top3 各型特征 bullet", () => {
    expect(g.hollandDeep?.code).toBe("SIE");
    expect(g.hollandDeep?.types.length).toBe(3);
    for (const t of g.hollandDeep!.types) {
      expect(t.trait.length).toBeGreaterThan(10);
      expect(t.studyImpact.length).toBeGreaterThanOrEqual(3);
    }
    expect(g.hollandDeep?.relationNote).toContain("相邻");
  });

  it("gapTable：目标分数换算与分差计算", () => {
    expect(g.gapTable).toBeTruthy();
    const math = g.gapTable!.rows.find((r) => r.name === "数学")!;
    expect(math.raw).toBe(118);
    expect(math.targetRaw).not.toBeNull();
    expect(math.gapRaw!).toBeGreaterThan(0);
    const hist = g.gapTable!.rows.find((r) => r.name === "历史")!;
    expect(hist.targetRaw).toBeNull();
  });

  it("subjectCards：每科画像卡 + tone 评语", () => {
    expect(g.subjectCards!.length).toBe(9);
    const chem = g.subjectCards!.find((c) => c.name === "化学")!;
    expect(chem.tone).toBe("优势");
    expect(chem.comment).toContain("化学");
    const hist = g.subjectCards!.find((c) => c.name === "历史")!;
    /* 历史 55 分但 S 型兴趣映射 90 分 → 兴趣浓厚成绩未跟上 = 潜能 */
    expect(hist.tone).toBe("潜能");
    expect(hist.comment).toContain("历史");
    /* 兴趣映射：S/I 型均映射道德与法治/生物等 */
    const bio = g.subjectCards!.find((c) => c.name === "生物")!;
    expect(bio.interest).toBeGreaterThan(0);
    expect(bio.interestFrom.length).toBeGreaterThan(0);
  });

  it("futureExpect / letterParas / 详情库匹配", () => {
    expect(g.futureExpect?.majorHints.length).toBeGreaterThan(0);
    expect(g.letterParas.length).toBeGreaterThanOrEqual(4);
    expect(g.letterParas[0]).toContain("曹同学");
    expect(g.letterParas.join("")).toContain("SIE");
    /* SIE 兴趣 → 教育学/心理学等 majors → 详情库命中 */
    expect(g.majorDetails.length).toBeGreaterThan(0);
    for (const m of g.majorDetails) {
      expect(m.courses.length).toBeGreaterThan(0);
      expect(m.careers.length).toBeGreaterThan(0);
    }
    expect(g.careerDetails.length).toBeGreaterThan(0);
    for (const c of g.careerDetails) {
      expect(c.duties.length).toBeGreaterThan(0);
      expect(c.path.length).toBeGreaterThan(0);
      expect(c.trend.length).toBeGreaterThan(0);
    }
  });

  it("小学段也能生成（学科卡/信/概览不依赖高中）", () => {
    const p = buildGuidanceReport({ grade: "五年级", studentName: "小同学", holland, academics: null })!;
    expect(p.overview.length).toBe(6);
    expect(p.subjectCards).toBeNull();
    expect(p.letterParas.length).toBeGreaterThanOrEqual(3);
  });
});

describe("v84 careerData 详情库", () => {
  it("每个专业详情内容完整", () => {
    for (const m of MAJOR_DETAILS) {
      expect(m.category.length).toBeGreaterThan(0);
      expect(m.intro.length).toBeGreaterThan(20);
      expect(m.courses.length).toBeGreaterThanOrEqual(4);
      expect(m.fields.length).toBeGreaterThan(0);
      expect(m.careers.length).toBeGreaterThan(0);
    }
  });
  it("每个职业详情内容完整", () => {
    for (const c of CAREER_DETAILS) {
      expect(c.category.length).toBeGreaterThan(0);
      expect(c.duties.length).toBeGreaterThan(0);
      expect(c.content.length).toBeGreaterThan(20);
      expect(c.skillsPro.length).toBeGreaterThan(0);
      expect(c.skillsGen.length).toBeGreaterThan(0);
      expect(c.prospect.length).toBeGreaterThan(10);
      expect(c.path.length).toBeGreaterThan(5);
      expect(c.trend.length).toBeGreaterThan(10);
    }
  });
  it("系统推荐名可命中（精确/别名/包含）", () => {
    expect(getMajorDetail("计算机科学与技术")?.name).toBe("计算机科学与技术");
    expect(getMajorDetail("电气工程")?.name).toBe("电气工程");
    expect(getMajorDetail("不存在的专业")).toBeNull();
    expect(getCareerDetail("教师/教育工作者")?.name).toBe("中学教师");
    expect(getCareerDetail("科研工作者")?.name).toBe("科研人员");
    expect(getCareerDetail("会计师/审计师")?.name).toBe("会计师");
    expect(getCareerDetail("xxx")).toBeNull();
  });
});

describe("v84 前端接线", () => {
  it("GuidanceTab 渲染 V84 板块", () => {
    const src = read("src/components/reports/GuidanceTab.tsx");
    need(src, "renderOverview", "测评结果概览");
    need(src, "hollandDeep", "个人侧写");
    need(src, "gapTable", "距离目标差距表");
    need(src, "subjectCards", "学科表现分析");
    need(src, "futureExpect", "未来期望");
    need(src, "letterParas", "给未来自己的一封信");
    need(src, "majorDetails", "推荐专业详情");
    need(src, "careerDetails", "推荐职业详情");
    need(src, "reportNo", "报告编号");
    need(src, "SOU 模型", "报告生成原理");
    need(src, "签名：＿＿＿＿＿＿", "信签名留白");
    need(src, "不是唯一的决策依据", "免责声明三条");
  });
  it("BUILD_TAG 递增到 v84", () => {
    need(read("api/router.ts"), 'BUILD_TAG = "v85-2026-10-10"', "版本号");
  });
});
