import { INVITE_ASSESS_KINDS } from "./invite";

/** 机构测评计价：价格为积分快照，历史活动不随后续目录调整变化。 */
export const COMPREHENSIVE_ASSESSMENT = "learning_comprehensive" as const;
export const XUANKE_ASSESSMENT = "xuanke_free" as const;
export const COMPREHENSIVE_KINDS = ["mbti", "disc", "e3", "multi5", "mentalsdq"] as const;
export const FREE_ASSESSMENT_KINDS = ["mbti", "disc", "discparent"] as const;
export const DEFAULT_ORG_POINTS = 60_000;
export const FULL_COVERAGE_STUDENTS = 200;

export type AssessmentSelection = {
  key: string;
  title: string;
  kinds: string[];
  price: number;
  category: "学习力" | "选科升学" | "亲子沟通" | "心理状态";
  description: string;
};

export const ASSESSMENT_PACKAGES: AssessmentSelection[] = [
  {
    key: COMPREHENSIVE_ASSESSMENT,
    title: "学习力综合诊断",
    kinds: [...COMPREHENSIVE_KINDS],
    price: 199,
    category: "学习力",
    description: "MBTI、DISC、E3、心理健康 A 版与多元智能五项；包内子项不重复扣费。",
  },
  {
    key: XUANKE_ASSESSMENT,
    title: "选科及升学规划组合",
    kinds: ["subject4d", "holland"],
    price: 0,
    category: "选科升学",
    description: "沿用既有选科组合免费口径；脱离组合单独发起时按单项价格计费。",
  },
  {
    key: "learning_suite",
    title: "学习力提升组合",
    kinds: ["e3", "multi5"],
    price: 20,
    category: "学习力",
    description: "E3 学业诊断与多元智能五项。",
  },
  {
    key: "family_support",
    title: "亲子沟通组合",
    kinds: ["e3parent", "discparent"],
    price: 10,
    category: "亲子沟通",
    description: "家庭支持家长卷与免费的家长 DISC。",
  },
  {
    key: "family_relation",
    title: "家庭关系组合",
    kinds: ["familystudent", "familyparent"],
    price: 20,
    category: "亲子沟通",
    description: "学生卷、家长卷分别形成一份有效结果。",
  },
];

export function assessmentCredits(kind: string): number {
  return (FREE_ASSESSMENT_KINDS as readonly string[]).includes(kind) ? 0 : 10;
}

export function selectionFor(key: string): AssessmentSelection | null {
  const pack = ASSESSMENT_PACKAGES.find((p) => p.key === key);
  if (pack) return pack;
  const item = INVITE_ASSESS_KINDS.find((k) => k.key === key);
  if (!item) return null;
  return {
    key: item.key,
    title: item.label,
    kinds: [item.key],
    price: assessmentCredits(item.key),
    category: ["mental", "mentalsdq", "mentalpa", "scl90"].includes(item.key)
      ? "心理状态"
      : ["e3parent", "discparent", "familystudent", "familyparent"].includes(item.key)
        ? "亲子沟通"
        : ["subject4d", "holland", "anchor"].includes(item.key)
          ? "选科升学"
          : "学习力",
    description: "按现有量表与报告生成规则执行。",
  };
}

/** 综合包覆盖 E3、SDQ、多元智能；完整理论覆盖按其余十项独立小测另计。 */
export function fullCoverageCredits(): number {
  const included = new Set<string>(COMPREHENSIVE_KINDS);
  const extras = INVITE_ASSESS_KINDS.filter((k) => !included.has(k.key));
  return 199 + extras.reduce((sum, k) => sum + assessmentCredits(k.key), 0);
}

export function recommendedOrgPoints(students = FULL_COVERAGE_STUDENTS): number {
  return Math.ceil((fullCoverageCredits() * students) / 1000) * 1000;
}

export const COURSE_CATALOG = [
  {
    key: "planning",
    title: "规划课",
    audience: "学生",
    purpose: "明确目标",
    description: "综合测评、考情依据、目标拆解与学业／升学双方案，滚动修订并保留确认版本。",
    rhythm: "每学期第一次，后续按实际情况修订",
  },
  {
    key: "mindset",
    title: "心法课",
    audience: "学生",
    purpose: "心智成长",
    description: "围绕表达、情绪调节、自我认识与成长练习，不形成心理诊断、人格定论或学习标签。",
    rhythm: "前三个月一对一；后三个月按学生评估选择形式",
  },
  {
    key: "method",
    title: "技法课",
    audience: "学生",
    purpose: "学习方法",
    description: "学习流程、学科策略、现场演练与一对一补弱，形成一个可验证动作。",
    rhythm: "十二次大纲，可与心法课、规划课混合",
  },
  {
    key: "supervision",
    title: "督学课",
    audience: "学生",
    purpose: "抓落实",
    description: "任务对齐、自习巡查、费曼输出、日检验、补位和离店验收；签到不等于掌握。",
    rhythm: "每次到店必有，贯穿前三个月与后三个月",
  },
  {
    key: "parent",
    title: "亲子美言课",
    audience: "家长",
    purpose: "亲密关系",
    description: "以 YES 接纳、探索、解决和亲子美言练习形成可观察的家庭行动，按监护人分别授权反馈。",
    rhythm: "一个月一期，月内频次与日期按家庭需要配置",
  },
] as const;

export const TECHNIQUE_LESSONS = [
  [1, "综合测评与立志", "全维度测评、考情与报考格局、目标拆解、个人目标宣言"],
  [2, "全科学习策略与全周期节奏", "学科特点、备考周期、时间资源分配、个人学习节奏"],
  [3, "计划与总结", "SMART 目标、周日计划、四象限、每日每周复盘"],
  [4, "复盘与输出式学习", "事实—原因—改进、费曼学习法、现场讲出薄弱知识点"],
  [5, "有效任务与高效作业", "作业分级、先复习再动笔、限时完成、卡点处理"],
  [6, "预习与高效听课", "预习四步、课堂重点、十分钟靶向预习"],
  [7, "笔记与思维导图", "康奈尔笔记、逻辑框架、文理科策略、现场导图"],
  [8, "错题整理与回顾", "错题五要素、三类错题、三刷与规范归因"],
  [9, "试卷分析与总结", "得分结构、失分原因、补强方案、现场试卷诊断"],
  [10, "专注力与时间观提升", "分心来源、番茄工作法、碎片时间、专注训练"],
  [11, "全科记忆流程与技巧", "遗忘规律、间隔重复、理解记忆、背诵实操"],
  [12, "考前心态与考场策略", "焦虑识别与调节、答题顺序、时间分配、突发模拟"],
] as const;

export type CourseKey = (typeof COURSE_CATALOG)[number]["key"];
export const COACHING_SCENARIOS = ["新生接手", "方案调整", "结课复盘", "回访"] as const;
export const HANDOFF_TYPES = ["H1", "H2", "H3", "H4", "H5"] as const;

export function phaseForVisit(serviceStart: string, visitAt: Date): "early" | "late" {
  const start = new Date(`${serviceStart}T00:00:00+08:00`);
  if (Number.isNaN(start.getTime())) throw new Error("陪跑开始日期无效");
  const late = new Date(start);
  late.setUTCMonth(late.getUTCMonth() + 3);
  return visitAt.getTime() < late.getTime() ? "early" : "late";
}

export function validateSessionPhase(input: {
  phase: "early" | "late";
  hasCoachUnit: boolean;
  hasSupervision: boolean;
  format: "one_to_one" | "salon" | "workshop" | "mixed" | "supervision";
  lateChangeReason?: string;
  lateChangeConfirmedBy?: number | null;
}): string | null {
  if (!input.hasSupervision) return "每次到店都必须保留督学记录";
  if (input.phase === "early" && (!input.hasCoachUnit || input.format !== "one_to_one")) {
    return "前三个月每次均为一对一教练课＋督学";
  }
  if (input.phase === "late" && !["one_to_one", "supervision"].includes(input.format) && (!input.lateChangeReason?.trim() || !input.lateChangeConfirmedBy)) {
    return "后三个月改为小组／学习坊须填写变更原因与确认人";
  }
  return null;
}
