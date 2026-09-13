/**
 * 学科自评与中考目标：孩子自己填写的各科现状、最近大考分数、目标分数。
 * 前后端共享：纯类型、纯数据、纯函数。
 */

/** 全部支持的科目（固定顺序，zod 校验用）。 */
export const ACADEMIC_SUBJECTS = ["语文", "数学", "英语", "物理", "化学", "道德与法治", "历史", "地理", "生物", "科学"] as const;

/** 小学段科目（语数英+道法+科学）。 */
export const PRIMARY_SUBJECTS = ["语文", "数学", "英语", "道德与法治", "科学"] as const;

export type AcademicSubject = (typeof ACADEMIC_SUBJECTS)[number];

/** 按档案年级返回应填的科目列表；非小学年级返回全科。 */
export function subjectsForGrade(grade: string | null | undefined): readonly AcademicSubject[] {
  if (grade && /^(一|二|三|四|五|六)年级$/.test(grade)) return PRIMARY_SUBJECTS;
  return ACADEMIC_SUBJECTS.filter((s) => s !== "科学");
}

/** 是否主科（语数英）：主科默认满分 120，其余科目默认满分 100。 */
export const isMainSubject = (name: string): boolean => name === "语文" || name === "数学" || name === "英语";

/** 该科默认满分：非主科固定 100；语数英按学段——小学 100、初中 120、高中 150（用户可在表单里逐科改）。 */
export function defaultFullScore(name: string, grade?: string | null): number {
  if (!isMainSubject(name)) return 100;
  if (grade && /^(一|二|三|四|五|六)年级$/.test(grade)) return 100;
  if (grade && /^高(一|二|三)$/.test(grade)) return 150;
  return 120;
}

/** 自评现状五档（1-5，便于量化）。 */
export const SELF_LEVELS = [
  { value: 1, label: "吃力", hint: "上课听不太懂，作业经常卡壳" },
  { value: 2, label: "偏弱", hint: "能跟上但费劲，成绩不太稳" },
  { value: 3, label: "中等", hint: "基本能跟上，时好时坏" },
  { value: 4, label: "良好", hint: "比较轻松，成绩中上" },
  { value: 5, label: "优势", hint: "学得很顺，是我的强项" },
] as const;

export type SubjectStatus = {
  name: string;
  /** 自评档位 1-5；未填为 null */
  selfLevel: number | null;
  /** 该科满分（各地/各科不同，逐科填写，默认 120） */
  fullScore: number | null;
  /** 最近一次大考分数；未填为 null */
  lastScore: number | null;
  /** 中考目标分数；未填为 null */
  targetScore: number | null;
};

export type AcademicsData = {
  /** 最近这次大考的名称，如「期中考试」 */
  examName: string;
  subjects: SubjectStatus[];
  updatedAt: number;
};

export type SubjectGap = SubjectStatus & {
  /** 目标 - 最近；缺任一为 null */
  gap: number | null;
  /** 差距占该科满分比例（0-1），供图表 */
  gapRatio: number | null;
};

/** 计算每科差距。 */
export function calcGaps(data: AcademicsData): SubjectGap[] {
  return data.subjects.map((s) => {
    const gap = s.lastScore != null && s.targetScore != null ? s.targetScore - s.lastScore : null;
    return {
      ...s,
      gap,
      gapRatio: gap != null && s.fullScore ? Math.round((gap / s.fullScore) * 100) / 100 : null,
    };
  });
}

/** 总分维度的小结：已填科目的最近总分、目标总分、总差距。 */
export function summarizeGaps(data: AcademicsData): {
  filled: number;
  lastTotal: number | null;
  targetTotal: number | null;
  totalGap: number | null;
} {
  const withScores = data.subjects.filter((s) => s.lastScore != null && s.targetScore != null);
  if (withScores.length === 0) return { filled: 0, lastTotal: null, targetTotal: null, totalGap: null };
  const lastTotal = withScores.reduce((s, x) => s + (x.lastScore ?? 0), 0);
  const targetTotal = withScores.reduce((s, x) => s + (x.targetScore ?? 0), 0);
  return { filled: withScores.length, lastTotal, targetTotal, totalGap: targetTotal - lastTotal };
}
