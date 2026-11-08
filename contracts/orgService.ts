import { expandAssessKinds, INVITE_ASSESS_KINDS, normalizeAssessKinds } from "./invite";

/** 机构测评计价：价格为积分快照，历史活动不随后续目录调整变化。 */
export const COMPREHENSIVE_ASSESSMENT = "learning_comprehensive" as const;
export const XUANKE_ASSESSMENT = "xuanke_free" as const;
export const COMPREHENSIVE_KINDS = ["mbti", "disc", "e3", "multi5", "mentalsdq"] as const;
export const FREE_ASSESSMENT_KINDS = ["mbti", "disc", "discparent"] as const;
export const DEFAULT_ORG_POINTS = 15_000;
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
    price: 20,
    category: "选科升学",
    description: "学科四维 10 积分＋霍兰德 10 积分，合计 20 积分／人；历史活动保留原价格快照。",
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

/**
 * 渠道二维码每成功注册一位学员的测评费用。
 * 注册流程始终包含学科四维； mental 按旧配置实际代表的四套心理量表展开。
 * 这里只按单项合计，不把渠道的全部单项自动换算成学习力综合诊断包。
 */
export function inviteAssessmentQuote(assessmentAccess: boolean, rawKinds: unknown) {
  const normalized = normalizeAssessKinds(rawKinds) ?? [];
  const selected = assessmentAccess
    ? normalized.includes("all")
      ? INVITE_ASSESS_KINDS.map((item) => item.key)
      : (expandAssessKinds(normalized) ?? [])
    : [];
  const kinds = [...new Set(["subject4d", ...selected])].filter((kind) =>
    (INVITE_ASSESS_KINDS as readonly { key: string }[]).some((item) => item.key === kind),
  );
  const items = kinds.map((key) => ({
    key,
    label: INVITE_ASSESS_KINDS.find((item) => item.key === key)!.label,
    credits: assessmentCredits(key),
  }));
  return { total: items.reduce((sum, item) => sum + item.credits, 0), kinds, items };
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
export const COACHING_SCENARIO_KEYS = ["A", "B", "C", "D"] as const;
export type CoachingScenarioKey = (typeof COACHING_SCENARIO_KEYS)[number];
export const COACHING_SCENARIOS = [
  { key: "A", name: "晚自习型", shortName: "晚自习", description: "签到、任务对齐、巡场检查、日总结与当日家长反馈" },
  { key: "B", name: "周末型", shortName: "周末", description: "逐科复盘、查缺补漏、费曼输出与下周计划" },
  { key: "C", name: "全日制型", shortName: "全日制", description: "三时段执行、出勤行踪、值班交接与补课衔接" },
  { key: "D", name: "假期集训型", shortName: "假期集训", description: "假期总计划、每日打卡、结营成果与开学交接" },
] as const satisfies readonly { key: CoachingScenarioKey; name: string; shortName: string; description: string }[];

/** 同一学员可叠加 A＋B 等场景；统一排序，避免重复或无效值进入主档。 */
export function normalizeCoachingScenarios(values: readonly string[]): CoachingScenarioKey[] {
  if (values.some((value) => !(COACHING_SCENARIO_KEYS as readonly string[]).includes(value))) throw new Error("陪跑服务场景无效");
  const selected = new Set(values);
  return COACHING_SCENARIO_KEYS.filter((key) => selected.has(key));
}

export function coachingScenarioLabel(key: string): string {
  const item = COACHING_SCENARIOS.find((scenario) => scenario.key === key);
  return item ? `${item.key} ${item.name}` : key;
}
export const HANDOFF_TYPES = ["H1", "H2", "H3", "H4", "H5"] as const;

export const COACHING_EXCEPTION_SEVERITIES = ["S1", "S2", "S3", "S4"] as const;
export type CoachingExceptionSeverity = (typeof COACHING_EXCEPTION_SEVERITIES)[number];
export const COACHING_EXCEPTION_CATEGORIES = [
  { key: "service", label: "服务延误", sensitive: false },
  { key: "archive", label: "档案缺项", sensitive: false },
  { key: "communication", label: "家校沟通", sensitive: false },
  { key: "attendance", label: "出勤异常", sensitive: false },
  { key: "complaint", label: "投诉异议", sensitive: true },
  { key: "integrity", label: "记录真实性", sensitive: true },
  { key: "wellbeing", label: "心理状态", sensitive: true },
  { key: "safety", label: "人身安全", sensitive: true },
  { key: "other", label: "其他事项", sensitive: false },
] as const;
export type CoachingExceptionCategory = (typeof COACHING_EXCEPTION_CATEGORIES)[number]["key"];

/** S4、心理与安全永远敏感；其他敏感类别不允许被前端取消保护。 */
export function coachingExceptionSensitive(severity: string, category: string, requested = false): boolean {
  return requested || severity === "S4" || Boolean(COACHING_EXCEPTION_CATEGORIES.find((item) => item.key === category)?.sensitive);
}

/** 仅作为可调整的页面默认值；真正期限随异常保存，不由列表临时推算。 */
export function defaultCoachingExceptionDueAt(severity: CoachingExceptionSeverity, now = new Date()): Date {
  const due = new Date(now);
  if (severity === "S1") due.setHours(23, 59, 0, 0);
  if (severity === "S2") due.setTime(now.getTime() + 2 * 60 * 60 * 1000);
  if (severity === "S3") due.setTime(now.getTime() + 24 * 60 * 60 * 1000);
  return due;
}

export const LEARNING_TRACE_KEYS = ["draft", "notes", "mindmap", "errorbook", "review"] as const;
export type LearningTraceKey = (typeof LEARNING_TRACE_KEYS)[number];
export const LEARNING_TRACES = [
  { key: "draft", label: "草稿" },
  { key: "notes", label: "笔记" },
  { key: "mindmap", label: "导图" },
  { key: "errorbook", label: "错题本" },
  { key: "review", label: "复盘文字" },
] as const satisfies readonly { key: LearningTraceKey; label: string }[];

export type DailyCheckinRuleInput = {
  checkDate: string;
  completionRate: number;
  accuracyRate: number;
  actualCompletion: string;
  evidence: string;
  gapReason?: string;
  errorCause?: string;
  correction?: string;
  followUp?: string;
  followUpDate?: string | null;
  tomorrowFirst: string;
  feynmanEnabled: boolean;
  feynmanConcept?: string;
  feynmanOutput?: string;
  feynmanGrade?: "A" | "B" | "C";
  feynmanStuck?: string;
  feynmanQuestion?: string;
  retestDate?: string | null;
  traces: string[];
  traceEvidence?: string;
  traceFollowUp?: string;
  hasPreviousVersion: boolean;
  changeReason?: string;
};

/** 前后端共用的日检验规则；服务端不能依赖页面是否禁用了提交按钮。 */
export function validateDailyCheckin(input: DailyCheckinRuleInput): string | null {
  if (!input.checkDate) return "请选择检验日期";
  if (input.actualCompletion.trim().length < 2) return "请填写实际完成情况";
  if (input.evidence.trim().length < 2) return "请填写可核验的学习证据，签到不等于掌握";
  if (input.tomorrowFirst.trim().length < 2) return "请填写明日第一件事";
  if (input.completionRate < 100) {
    if ((input.gapReason?.trim().length ?? 0) < 2) return "完成率不足 100% 时须填写未完成原因";
    if ((input.followUp?.trim().length ?? 0) < 2) return "完成率不足 100% 时须填写补位行动";
    if (!input.followUpDate) return "完成率不足 100% 时须选择补位日期";
    if (input.followUpDate < input.checkDate) return "补位日期不能早于检验日期";
  }
  if (input.accuracyRate < 100) {
    if ((input.errorCause?.trim().length ?? 0) < 2) return "准确率不足 100% 时须填写错因";
    if ((input.correction?.trim().length ?? 0) < 2) return "准确率不足 100% 时须填写订正情况";
  }
  if (input.feynmanEnabled) {
    if ((input.feynmanConcept?.trim().length ?? 0) < 2) return "费曼输出须填写知识点";
    if ((input.feynmanOutput?.trim().length ?? 0) < 2) return "请记录学生自己的讲解输出，而非只勾选已完成";
    if (!input.feynmanGrade || !["A", "B", "C"].includes(input.feynmanGrade)) return "请选择费曼输出 A／B／C 评级";
  }
  if (input.traces.some((key) => !(LEARNING_TRACE_KEYS as readonly string[]).includes(key))) return "学习痕迹类型无效";
  if (new Set(input.traces).size !== LEARNING_TRACE_KEYS.length && (input.traceFollowUp?.trim().length ?? 0) < 2) {
    return "五项学习痕迹未集齐时须填写缺项补齐安排";
  }
  if (input.hasPreviousVersion && (input.changeReason?.trim().length ?? 0) < 2) return "同日再次提交须填写修改原因，原版本不会被覆盖";
  return null;
}

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

/** 月报维度只描述已核实事实；成绩与排名不由课程、出勤或积分自动推断。 */
export const COACHING_MONTHLY_DIMENSIONS = [
  { key: "goalProgress", label: "目标", prompt: "本月目标推进事实、与起点或上月相比的变化" },
  { key: "academicProgress", label: "成绩", prompt: "同口径考试、分数或排名事实；没有新数据须明确说明" },
  { key: "taskExecution", label: "任务执行", prompt: "结合任务验收与日检验，说明执行亮点和未完成原因" },
  { key: "learningMethod", label: "学习方法", prompt: "订正、费曼输出、五项痕迹等方法的真实使用情况" },
  { key: "habitFamily", label: "习惯与家校协同", prompt: "作息、自主学习节奏及家庭配合的实际变化" },
] as const;

/** 质量框架集中配置，服务端和页面共用版本与分值；仅供内部质量管理。 */
export const COACHING_QUALITY_FRAMEWORK = {
  version: "1.0",
  modules: [
    { key: "plan", label: "计划质量", maxScore: 20 },
    { key: "execution", label: "执行质量", maxScore: 20 },
    { key: "archive", label: "档案质量", maxScore: 20 },
    { key: "family", label: "家校质量", maxScore: 20 },
    { key: "review", label: "复盘质量", maxScore: 20 },
  ],
} as const;

export type CoachingQualityScores = Record<(typeof COACHING_QUALITY_FRAMEWORK.modules)[number]["key"], number>;

export function coachingQualityLevel(total: number): { key: "green" | "yellow" | "red"; label: string } {
  if (total >= 90) return { key: "green", label: "绿 · 保持并复核" };
  if (total >= 75) return { key: "yellow", label: "黄 · 限期改进" };
  return { key: "red", label: "红 · 优先整改" };
}
