export type FamilyStageSnapshot = {
  schemaVersion: 1;
  monthlyReport: {
    id: number; month: string; version: number; goalProgress: string; academicProgress: string;
    taskExecution: string; learningMethod: string; habitFamily: string; meetingNotes: string;
    nextActions: string[]; familyAction: string; pushedAt: string;
  };
  nextPlan: {
    id: number; level: string; title: string; content: string; startDate: string; endDate: string;
    version: number; issuedAt: string;
  };
  familyAction: { id: number; responsibleUserId: number; action: string; dueAt: string };
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

/** 只接受页面所需的完整快照结构；异常旧数据不能被当成已阅读材料。 */
export function readFamilyStageSnapshot(value: unknown): FamilyStageSnapshot | null {
  const root = record(value);
  const report = record(root?.monthlyReport);
  const plan = record(root?.nextPlan);
  const action = record(root?.familyAction);
  if (!root || !report || !plan || !action || root.schemaVersion !== 1) return null;
  const reportText = ["month", "goalProgress", "academicProgress", "taskExecution", "learningMethod", "habitFamily", "meetingNotes", "familyAction", "pushedAt"];
  const planText = ["level", "title", "content", "startDate", "endDate", "issuedAt"];
  if (reportText.some((key) => typeof report[key] !== "string") || planText.some((key) => typeof plan[key] !== "string")) return null;
  if (typeof action.action !== "string" || typeof action.dueAt !== "string" || !Array.isArray(report.nextActions)
    || report.nextActions.some((item) => typeof item !== "string")) return null;
  if (["id", "version"].some((key) => typeof report[key] !== "number") || ["id", "version"].some((key) => typeof plan[key] !== "number")) return null;
  if (typeof action.id !== "number" || typeof action.responsibleUserId !== "number") return null;
  return value as FamilyStageSnapshot;
}
