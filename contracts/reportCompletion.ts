/** 报告栏目只依据 assessment_results 的持久化结果判完成，不把待答/答题中任务算作结果。 */
export type CompletedAssessmentRecord = {
  userId: number;
  kind: string;
  createdAt: Date | string;
};

export type ReportCompletionRecord = Pick<CompletedAssessmentRecord, "kind" | "createdAt">;

/** 双保险：即便上游误传入混合学员记录，也绝不跨学员点亮报告。 */
export function completedRecordsForStudent(
  rows: readonly CompletedAssessmentRecord[],
  studentUserId: number,
): ReportCompletionRecord[] {
  return rows.filter((row) => row.userId === studentUserId).map(({ kind, createdAt }) => ({ kind, createdAt }));
}

export type ReportTabCompletion = {
  highlighted: boolean;
  complete: boolean;
  label: string;
  matchedKinds: string[];
  latestCompletedAt: Date | string | null;
};

const DIRECT_KINDS: Record<string, string[]> = {
  e3: ["e3"],
  mbti: ["mbti"],
  disc: ["disc"],
  multi5: ["multi5"],
  anchor: ["anchor"],
  holland: ["holland"],
  mental: ["mental", "mentalsdq", "mentalpa", "scl90"],
  subject: ["subject"],
  parent: ["e3parent", "discparent"],
  family: ["familystudent", "familyparent"],
  commkit: ["disc", "discparent"],
  guidance: ["holland", "anchor", "mbti", "disc", "multi5"],
};

/** 综合栏目展示实际已测进度；报告内原本就支持补测，不隐藏未完成部分。 */
const COMPOSITE_KINDS: Record<string, string[]> = {
  combined: ["mbti", "disc", "e3"],
  zhihui: ["subject4d", "holland"],
};

export function getReportTabCompletion(
  tab: string,
  records: readonly ReportCompletionRecord[] | null | undefined,
  hasAcademics = false,
): ReportTabCompletion {
  const rows = records ?? [];
  if (tab === "academics") {
    return { highlighted: hasAcademics, complete: hasAcademics, label: hasAcademics ? "已填写" : "未填写", matchedKinds: [], latestCompletedAt: null };
  }
  const compositeKinds = COMPOSITE_KINDS[tab];
  const requiredKinds = compositeKinds ?? DIRECT_KINDS[tab] ?? [];
  const latestByKind = new Map<string, Date | string>();
  for (const row of rows) {
    if (!requiredKinds.includes(row.kind)) continue;
    const time = new Date(row.createdAt).getTime();
    if (!Number.isFinite(time)) continue;
    const previous = latestByKind.get(row.kind);
    if (previous && new Date(previous).getTime() >= time) continue;
    latestByKind.set(row.kind, row.createdAt);
  }
  const matchedKinds = requiredKinds.filter((kind) => latestByKind.has(kind));
  const highlighted = matchedKinds.length > 0 || (tab === "guidance" && hasAcademics);
  const complete = compositeKinds ? matchedKinds.length === compositeKinds.length : highlighted;
  const latestCompletedAt = matchedKinds.length
    ? matchedKinds.map((kind) => latestByKind.get(kind)!).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
    : null;
  return {
    highlighted,
    complete,
    label: !highlighted ? "未完成" : !complete ? `已测 ${matchedKinds.length}/${compositeKinds.length} 项` : "已完成",
    matchedKinds,
    latestCompletedAt,
  };
}
