/** v274 GROW 表单化（规划课四要素）：目的 / 目标 / 策略 / 衡量。
 *  结构化数据存 coaching_cases.grow_form（JSON），同时合成 goal/currentSituation/planSummary
 *  纯文本，保证既有消费方（家长端、交接、快照）无需迁移即可阅读。 */

export interface GrowPlanForm {
  purpose: (typeof PURPOSE_OPTIONS)[number][];
  purposeNote: string;
  targetSchool: string;
  subjects: { name: string; baseline: number | null; target: number | null }[];
  courses: string[];
  strategyNote: string;
  weekly: { item: string; metric: string }[];
  exams: { name: string; date: string; scores: string }[];
}

export const PURPOSE_OPTIONS = ["分数提升", "综合成长"] as const;

export function emptyGrowPlan(): GrowPlanForm {
  return { purpose: [], purposeNote: "", targetSchool: "", subjects: [], courses: [], strategyNote: "", weekly: [{ item: "", metric: "" }], exams: [] };
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
    courses: Array.isArray(v.courses) ? v.courses.filter((c): c is string => typeof c === "string").slice(0, 5) : [],
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

/** 计划栏纯文本：策略（五大课课纲）→ 衡量（每周修正项 + 大考分数）。 */
export function composePlanText(form: GrowPlanForm, courseOutlines: { course: string; outline: string }[]): string {
  const lines: string[] = [];
  if (form.courses.length) {
    const detail = form.courses.map((c) => {
      const hit = courseOutlines.find((o) => o.course === c);
      return hit ? `· ${c}：${hit.outline}` : `· ${c}`;
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
