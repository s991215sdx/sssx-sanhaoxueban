/** v274 GROW 表单化（规划课四要素）：目的 / 目标 / 策略 / 衡量。
 *  结构化数据存 coaching_cases.grow_form（JSON），同时合成 goal/currentSituation/planSummary
 *  纯文本，保证既有消费方（家长端、交接、快照）无需迁移即可阅读。
 *  v275：③策略改为表格；每门课补「课程目标」（用户拍板文案），并支持每课频次/形式安排。 */

export interface GrowPlanForm {
  purpose: (typeof PURPOSE_OPTIONS)[number][];
  purposeNote: string;
  targetSchool: string;
  subjects: { name: string; baseline: number | null; target: number | null }[];
  courses: string[];
  /** 每门课的频次与形式安排（key 为课程名），未设置的课用 DEFAULT_COURSE_PLAN 兜底 */
  coursePlans: { course: string; frequency: string; format: string }[];
  strategyNote: string;
  weekly: { item: string; metric: string }[];
  exams: { name: string; date: string; scores: string }[];
}

export const PURPOSE_OPTIONS = ["分数提升", "综合成长"] as const;

/** 五大课定义（v275 按用户白板拍板：课程 / 系统 / 目标 / 课纲重点 / 默认频次与形式）。
 *  v276：亲子课更名「亲子美言课」，并补每课「标准周期」（融入 11-11 产品培训节奏）。 */
export const COURSE_OUTLINE: { course: string; system: string; goal: string; outline: string; frequency: string; format: string; period: string }[] = [
  { course: "规划课", system: "方向", goal: "目标明确、路径清晰", outline: "全维度测评 · 考情解读 · 升学目标定位与拆分 · 学业＋升学双方案（每学期滚动修订）", frequency: "每学期第 1 次", format: "一对一", period: "启动 1 次 · 唤醒内驱力" },
  { course: "心法课", system: "乐学", goal: "心智成长、认知发展", outline: "立志（修齐治平）· 三观 · 秀塔 · 三个钱袋子 · 三大主义 · 教育选型 · 楼层驱动 · 三个美好 · 五型防御机制 · 情绪坐标", frequency: "每周 1 次", format: "一对一", period: "标准 4–8 周 · 先关系后学习" },
  { course: "技法课", system: "会学", goal: "校内学法优化、校外 AI 学习", outline: "12 次课：综合测评与立志 → 全科学习策略 → 计划与总结 → 复盘与费曼输出 → 高效作业 → 预习与听课 → 笔记与思维导图 → 错题整理 → 试卷分析 → 专注力与时间管理 → 记忆流程与技巧 → 考前心态与考场策略", frequency: "每周 1 次", format: "一对一", period: "心法稳定后上线 · 成长区学习" },
  { course: "督学课", system: "真学", goal: "高效执行、温度陪伴", outline: "周计划落地 · 日检验·周复盘·月家长会 · 费曼输出训练 · 九大习惯 · 痕迹管理 · 试卷分析", frequency: "每次到店", format: "督学", period: "常态 · 首月以发现问题为主" },
  { course: "亲子美言课", system: "家庭", goal: "学会说话、关系亲密", outline: "YES 模型（接纳→探索→解决）· 亲子美言 · 每天 10 分钟＋每周复盘 · 五型防御机制 · 家访", frequency: "每月 1 周期", format: "家长课＋沙龙", period: "1 个月周期" },
];

/** 课程名兼容：旧数据/旧文案中的「亲子课」统一显示为「亲子美言课」。 */
export function normalizeCourseName(course: string): string {
  return course === "亲子课" ? "亲子美言课" : course;
}

export const COURSE_FORMATS = ["一对一", "沙龙", "学习坊", "督学", "混合", "一对一＋沙龙"] as const;

/** 九能 → 课程映射：乐学进心法课，会学进技法课，善学进督学课＋技法课，条件系统进亲子美言课。 */
export const ABILITY_TO_COURSE: Record<string, string[]> = {
  动力: ["心法课"], 信心: ["心法课"], 韧劲: ["心法课"],
  学懂: ["技法课"], 记住: ["技法课"], 会用: ["技法课"],
  计划: ["督学课", "技法课"], 复盘: ["督学课", "技法课"], 智学: ["技法课", "督学课"],
  状态: ["亲子美言课"], 关系: ["亲子美言课"], 资源: ["亲子美言课"],
};

export function courseGoal(course: string): string {
  return COURSE_OUTLINE.find((c) => c.course === course)?.goal ?? "";
}

export function defaultCoursePlan(course: string): { frequency: string; format: string } {
  const hit = COURSE_OUTLINE.find((c) => c.course === course);
  return { frequency: hit?.frequency ?? "", format: hit?.format ?? "一对一" };
}

export function emptyGrowPlan(): GrowPlanForm {
  return { purpose: [], purposeNote: "", targetSchool: "", subjects: [], courses: [], coursePlans: [], strategyNote: "", weekly: [{ item: "", metric: "" }], exams: [] };
}

/** 宽容解析：字段缺失/类型不符时回退默认值，保证旧数据与脏数据不炸。 */
export function parseGrowForm(value: unknown): GrowPlanForm | null {
  if (typeof value !== "object" || value === null) return null;
  const v = value as Record<string, unknown>;
  const str = (x: unknown) => (typeof x === "string" ? x : "");
  const numOrNull = (x: unknown) => (typeof x === "number" && Number.isFinite(x) ? x : null);
  const subjects = Array.isArray(v.subjects)
    ? v.subjects.filter((s): s is Record<string, unknown> => typeof s === "object" && s !== null)
        .map((s) => ({ name: str(s.name), baseline: numOrNull(s.baseline), target: numOrNull(s.target) })).filter((s) => s.name)
    : [];
  const coursePlansRaw = Array.isArray(v.coursePlans)
    ? v.coursePlans.filter((p): p is Record<string, unknown> => typeof p === "object" && p !== null)
        .map((p) => ({ course: str(p.course), frequency: str(p.frequency), format: str(p.format) })).filter((p) => p.course)
    : [];
  const coursePlans = coursePlansRaw.map((p) => ({ ...p, course: normalizeCourseName(p.course) }));
  const weekly = Array.isArray(v.weekly)
    ? v.weekly.filter((w): w is Record<string, unknown> => typeof w === "object" && w !== null)
        .map((w) => ({ item: str(w.item), metric: str(w.metric) })).filter((w) => w.item)
    : [];
  const exams = Array.isArray(v.exams)
    ? v.exams.filter((e): e is Record<string, unknown> => typeof e === "object" && e !== null)
        .map((e) => ({ name: str(e.name), date: str(e.date), scores: str(e.scores) })).filter((e) => e.name)
    : [];
  return {
    purpose: Array.isArray(v.purpose) ? v.purpose.filter((p): p is (typeof PURPOSE_OPTIONS)[number] => typeof p === "string" && (PURPOSE_OPTIONS as readonly string[]).includes(p)) : [],
    purposeNote: str(v.purposeNote),
    targetSchool: str(v.targetSchool),
    subjects,
    courses: Array.isArray(v.courses) ? v.courses.filter((c): c is string => typeof c === "string").slice(0, 5).map(normalizeCourseName) : [],
    coursePlans,
    strategyNote: str(v.strategyNote),
    weekly,
    exams,
  };
}

/** 目标栏纯文本：目的 → 升学目标 → 学科目标（现状分→提升目标）。 */
export function composeGoalText(form: GrowPlanForm): string {
  const lines: string[] = [];
  if (form.purpose.length) lines.push(`【目的】${form.purpose.join(" · ")}${form.purposeNote ? `（${form.purposeNote}）` : ""}`);
  if (form.targetSchool) lines.push(`【升学目标】${form.targetSchool}`);
  const subs = form.subjects.filter((s) => s.name && (s.baseline != null || s.target != null));
  if (subs.length) lines.push(`【学科目标】${subs.map((s) => `${s.name} ${s.baseline ?? "?" }→${s.target ?? "?"}`).join("；")}`);
  return lines.join("\n");
}

/** 计划栏纯文本：策略（五大课：目标＋课纲＋频次/形式）→ 衡量（每周修正项 + 大考分数）。 */
export function composePlanText(form: GrowPlanForm, courseOutlines: { course: string; goal?: string; outline: string }[]): string {
  const lines: string[] = [];
  if (form.courses.length) {
    const detail = form.courses.map((c) => {
      const hit = courseOutlines.find((o) => o.course === c);
      const goal = hit?.goal ? `（${hit.goal}）` : "";
      const plan = form.coursePlans.find((p) => p.course === c);
      const arrange = plan && (plan.frequency || plan.format) ? `〔${[plan.frequency, plan.format].filter(Boolean).join(" · ")}〕` : "";
      return `· ${c}${goal}：${hit ? hit.outline : "课纲待补充"}${arrange}`;
    });
    lines.push(`【策略·课程设计】\n${detail.join("\n")}`);
  }
  if (form.strategyNote) lines.push(`【策略补充】${form.strategyNote}`);
  const weekly = form.weekly.filter((w) => w.item);
  if (weekly.length) lines.push(`【衡量·每周修正项】\n${weekly.map((w) => `· ${w.item}${w.metric ? `（对应分数/指标：${w.metric}）` : ""}`).join("\n")}`);
  const exams = form.exams.filter((e) => e.name);
  if (exams.length) lines.push(`【衡量·大考成绩】\n${exams.map((e) => `· ${e.name}${e.date ? `（${e.date}）` : ""}：${e.scores || "待记录"}`).join("\n")}`);
  return lines.join("\n");
}
