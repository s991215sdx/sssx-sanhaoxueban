import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  coachingCheckins, coachingDeliverables, coachingEvents, coachingMonthlyReports, coachingTasks,
  courseParticipants, courseSessions, studySupervisionRecords,
} from "@db/schema";
import type { getDb } from "./queries/connection";
import type { StaffUser } from "./orgAccess";
import type { PointTx } from "./orgPoints";
import { assertCaseAccess } from "./coachingAccess";
import { queueFamilyCoachingNotification } from "./coachingNotifications";

type Db = ReturnType<typeof getDb>;
type QueryDb = Db | PointTx;

export type CoachingMonthlyMetrics = {
  month: string;
  periodStart: string;
  periodEnd: string;
  checkinDays: number;
  averageCompletion: number | null;
  averageAccuracy: number | null;
  tasksDue: number;
  tasksVerified: number;
  taskVerificationRate: number | null;
  completedSessions: number;
  feedbackSessions: number;
  feedbackRate: number | null;
  completedSupervisions: number;
  feynmanDays: number;
  fullTraceDays: number;
  sources: string[];
};

type MonthlySource = {
  studentUserId: number;
  checkins: (typeof coachingCheckins.$inferSelect)[];
  tasks: (typeof coachingTasks.$inferSelect)[];
  supervisions: (typeof studySupervisionRecords.$inferSelect)[];
  sessions: (typeof courseSessions.$inferSelect)[];
  participants: (typeof courseParticipants.$inferSelect)[];
  deliverables: Pick<typeof coachingDeliverables.$inferSelect, "participantId" | "visibility" | "pushedAt">[];
};

function assertMonth(month: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new TRPCError({ code: "BAD_REQUEST", message: "月份格式应为 YYYY-MM" });
}

export function shiftCoachingMonth(month: string, offset: number): string {
  assertMonth(month);
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, mon - 1 + offset, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function coachingMonthRange(month: string): { start: string; end: string; endExclusive: string } {
  assertMonth(month);
  const [year, mon] = month.split("-").map(Number);
  return {
    start: `${month}-01`,
    end: new Date(Date.UTC(year, mon, 0)).toISOString().slice(0, 10),
    endExclusive: `${shiftCoachingMonth(month, 1)}-01`,
  };
}

function shanghaiDate(value: Date): string {
  return new Date(value.getTime() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}
function inMonth(text: string, start: string, endExclusive: string): boolean {
  return text >= start && text < endExclusive;
}
function average(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 10) / 10 : null;
}
function percent(numerator: number, denominator: number): number | null {
  return denominator ? Math.round(numerator / denominator * 1000) / 10 : null;
}

/** 纯统计：每天只采用最新日检验；无数据返回 null，绝不把缺数据写成 0%。 */
export function buildCoachingMonthlyMetrics(source: MonthlySource, month: string): CoachingMonthlyMetrics {
  const { start, end, endExclusive } = coachingMonthRange(month);
  const latestByDate = new Map<string, typeof coachingCheckins.$inferSelect>();
  for (const row of source.checkins) {
    if (!inMonth(row.checkDate, start, endExclusive)) continue;
    const previous = latestByDate.get(row.checkDate);
    if (!previous || row.version > previous.version || (row.version === previous.version && row.id > previous.id)) latestByDate.set(row.checkDate, row);
  }
  const checkins = [...latestByDate.values()];
  const tasks = source.tasks.filter((row) => inMonth(row.dueDate, start, endExclusive));
  const verified = tasks.filter((row) => row.status === "verified" && row.evidence.trim() && row.result.trim()).length;
  const sessions = [...new Map(source.sessions.filter((row) => row.status === "completed" && inMonth(shanghaiDate(row.startAt), start, endExclusive))
    .map((row) => [row.id, row])).values()];
  const sessionIds = new Set(sessions.map((row) => row.id));
  const participants = [...new Map(source.participants.filter((row) => row.studentUserId === source.studentUserId && sessionIds.has(row.sessionId))
    .map((row) => [row.id, row])).values()];
  const pushedParticipantIds = new Set(source.deliverables.filter((row) => row.visibility === "family" && row.pushedAt && row.participantId != null).map((row) => row.participantId));
  const feedbackSessionIds = new Set(participants.filter((row) => row.feedbackVersion > 0 || pushedParticipantIds.has(row.id)).map((row) => row.sessionId));
  const supervisions = source.supervisions.filter((row) => row.status === "completed" && inMonth(shanghaiDate(row.visitAt), start, endExclusive));
  return {
    month, periodStart: start, periodEnd: end,
    checkinDays: checkins.length,
    averageCompletion: average(checkins.map((row) => row.completionRate)),
    averageAccuracy: average(checkins.map((row) => row.accuracyRate)),
    tasksDue: tasks.length, tasksVerified: verified, taskVerificationRate: percent(verified, tasks.length),
    completedSessions: sessions.length, feedbackSessions: feedbackSessionIds.size, feedbackRate: percent(feedbackSessionIds.size, sessions.length),
    completedSupervisions: supervisions.length,
    feynmanDays: checkins.filter((row) => row.feynmanOutput.trim().length > 0).length,
    fullTraceDays: checkins.filter((row) => new Set(row.traces).size === 5).length,
    sources: [
      "日检验按每个检验日期的最新版本统计，周期按 Asia/Shanghai 日期归属",
      "行动任务按截止日期归月，验收率为保存月报时的当前状态，并要求证据与结果非空",
      "课堂与督学只统计已完成记录；家庭反馈按本学员参与记录或已推送附件去重",
      "成绩、排名和服务效果不由课程数量、出勤或积分自动推断",
    ],
  };
}

export async function getCoachingMonthlyPreview(db: QueryDb, me: StaffUser, caseId: number, month: string) {
  assertMonth(month);
  const coachingCase = await assertCaseAccess(db as Db, me, caseId);
  const [checkins, tasks, supervisions, ownSessions, joinedSessions, participantRows] = await Promise.all([
    db.select().from(coachingCheckins).where(and(eq(coachingCheckins.caseId, caseId), eq(coachingCheckins.orgId, coachingCase.orgId))),
    db.select().from(coachingTasks).where(eq(coachingTasks.caseId, caseId)),
    db.select().from(studySupervisionRecords).where(eq(studySupervisionRecords.caseId, caseId)),
    db.select().from(courseSessions).where(and(eq(courseSessions.caseId, caseId), eq(courseSessions.orgId, coachingCase.orgId))),
    db.select({ session: courseSessions }).from(courseSessions).innerJoin(courseParticipants, eq(courseParticipants.sessionId, courseSessions.id))
      .where(and(eq(courseParticipants.studentUserId, coachingCase.studentUserId), eq(courseSessions.orgId, coachingCase.orgId))),
    db.select({ participant: courseParticipants }).from(courseParticipants).innerJoin(courseSessions, eq(courseParticipants.sessionId, courseSessions.id))
      .where(and(eq(courseParticipants.studentUserId, coachingCase.studentUserId), eq(courseSessions.orgId, coachingCase.orgId))),
  ]);
  const sessionMap = new Map<number, typeof courseSessions.$inferSelect>();
  for (const row of ownSessions) sessionMap.set(row.id, row);
  for (const row of joinedSessions) sessionMap.set(row.session.id, row.session);
  const participants = participantRows.map((row) => row.participant);
  const participantIds = participants.map((row) => row.id);
  const deliverables = participantIds.length ? await db.select({ participantId: coachingDeliverables.participantId,
    visibility: coachingDeliverables.visibility, pushedAt: coachingDeliverables.pushedAt }).from(coachingDeliverables)
    .where(and(inArray(coachingDeliverables.participantId, participantIds), eq(coachingDeliverables.visibility, "family"))) : [];
  const source = { studentUserId: coachingCase.studentUserId, checkins, tasks, supervisions,
    sessions: [...sessionMap.values()], participants, deliverables };
  const previousMonth = shiftCoachingMonth(month, -1);
  const baselineMonth = coachingCase.serviceStart.slice(0, 7);
  return {
    caseId, month, generatedAt: new Date().toISOString(), baselineMonth,
    current: buildCoachingMonthlyMetrics(source, month),
    previous: buildCoachingMonthlyMetrics(source, previousMonth),
    baseline: buildCoachingMonthlyMetrics(source, baselineMonth),
  };
}

type MonthlyReportInput = {
  caseId: number;
  month: string;
  goalProgress: string;
  academicProgress: string;
  taskExecution: string;
  learningMethod: string;
  habitFamily: string;
  meetingNotes?: string;
  nextActions: string[];
  familyAction: string;
};

function required(value: string | undefined, message: string): string {
  const text = value?.trim() ?? "";
  if (text.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message });
  return text;
}

export async function saveCoachingMonthlyReport(db: Db, me: StaffUser, input: MonthlyReportInput) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  assertMonth(input.month);
  const fields = {
    goalProgress: required(input.goalProgress, "请填写目标推进事实"),
    academicProgress: required(input.academicProgress, "请填写成绩事实或明确本月暂无同口径新数据"),
    taskExecution: required(input.taskExecution, "请填写任务执行分析"),
    learningMethod: required(input.learningMethod, "请填写学习方法分析"),
    habitFamily: required(input.habitFamily, "请填写习惯与家校协同情况"),
    familyAction: required(input.familyAction, "请填写家长一件配合事"),
  };
  const nextActions = input.nextActions.map((item) => item.trim()).filter(Boolean);
  if (!nextActions.length || nextActions.length > 3 || nextActions.some((item) => item.length < 2)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "下月动作须填写 1—3 条，每条至少 2 个字" });
  }
  return db.transaction(async (tx) => {
    const previous = await tx.select().from(coachingMonthlyReports)
      .where(and(eq(coachingMonthlyReports.caseId, input.caseId), eq(coachingMonthlyReports.month, input.month)))
      .orderBy(desc(coachingMonthlyReports.version)).limit(1).for("update");
    const version = (previous[0]?.version ?? 0) + 1;
    const preview = await getCoachingMonthlyPreview(tx, me, input.caseId, input.month);
    const metricSnapshot = { generatedAt: preview.generatedAt, baselineMonth: preview.baselineMonth,
      current: preview.current, previous: preview.previous, baseline: preview.baseline };
    const [{ id }] = await tx.insert(coachingMonthlyReports).values({
      caseId: input.caseId, orgId: coachingCase.orgId, month: input.month, version, previousId: previous[0]?.id ?? null,
      metricSnapshot, ...fields, meetingNotes: input.meetingNotes?.trim() ?? "", nextActions, createdBy: me.id,
    }).$returningId();
    await tx.insert(coachingEvents).values({ caseId: input.caseId, actorUserId: me.id, type: "monthly_report_saved",
      content: `${input.month} 月度学习报告 V${version} 已保存（数据快照同步留存）`, visibility: "internal" });
    return { id, version };
  });
}

export async function listCoachingMonthlyReports(db: Db, me: StaffUser, caseId: number) {
  await assertCaseAccess(db, me, caseId);
  return db.select().from(coachingMonthlyReports).where(eq(coachingMonthlyReports.caseId, caseId))
    .orderBy(desc(coachingMonthlyReports.month), desc(coachingMonthlyReports.version), desc(coachingMonthlyReports.id)).limit(36);
}

export async function pushCoachingMonthlyReport(db: Db, me: StaffUser, reportId: number) {
  const [report] = await db.select().from(coachingMonthlyReports).where(eq(coachingMonthlyReports.id, reportId)).limit(1);
  if (!report) throw new TRPCError({ code: "NOT_FOUND", message: "月度报告不存在" });
  await assertCaseAccess(db, me, report.caseId);
  if (report.pushedAt) return { id: report.id, version: report.version, duplicate: true as const };
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(coachingMonthlyReports).where(eq(coachingMonthlyReports.id, reportId)).limit(1).for("update");
    if (!current) throw new TRPCError({ code: "NOT_FOUND", message: "月度报告不存在" });
    if (current.pushedAt) return { id: current.id, version: current.version, duplicate: true as const };
    const now = new Date();
    const result = await tx.update(coachingMonthlyReports).set({ pushedAt: now, pushedBy: me.id })
      .where(and(eq(coachingMonthlyReports.id, reportId), isNull(coachingMonthlyReports.pushedAt)));
    const affectedRows = typeof result === "object" && result !== null && "affectedRows" in result ? Number(result.affectedRows) : 1;
    if (affectedRows !== 1) throw new TRPCError({ code: "CONFLICT", message: "报告推送状态已变化，请刷新" });
    await tx.insert(coachingEvents).values({ caseId: current.caseId, actorUserId: me.id, type: "monthly_report_pushed",
      content: `${current.month} 月度学习报告 V${current.version} 已正式推送家庭`, visibility: "internal" });
    await queueFamilyCoachingNotification(tx, { caseId: current.caseId, type: "monthly_report_pushed",
      title: "新的月度学习报告", body: `伴学师已正式推送 ${current.month} 月度学习报告，请在陪跑反馈中查看。`,
      idempotencyKey: `monthly:${current.id}:v${current.version}`, createdBy: me.id });
    return { id: current.id, version: current.version, duplicate: false as const };
  });
}
