import { TRPCError } from "@trpc/server";
import { and, desc, eq, gte, isNull, lte, or } from "drizzle-orm";
import { assessmentActivities, assessmentActivityItems, assessmentAssignments, assessmentResults, users } from "@db/schema";
import type { getDb } from "./queries/connection";
import { assertStudentAccess, requireOrgStaff, type StaffUser } from "./orgAccess";
import { getTutorReportAccess } from "./tutorAccess";

type Db = ReturnType<typeof getDb>;

/** 新报告列表、GROW 列表和计划关联统一走这里；报告正文仍沿用学员详情原权限。 */
export async function hasAssessmentReportAccess(db: Db, me: StaffUser, studentUserId: number): Promise<boolean> {
  try {
    await assertStudentAccess(db, me, studentUserId);
    if (me.role === "admin") return true;
    return (await getTutorReportAccess(db, me.id, studentUserId)).allowed;
  } catch {
    return false;
  }
}

export async function assertAssessmentReportAccess(db: Db, me: StaffUser, studentUserId: number) {
  if (!(await hasAssessmentReportAccess(db, me, studentUserId))) {
    throw new TRPCError({ code: "FORBIDDEN", message: "你没有查看或关联该学员测评报告的权限，或权限已到期" });
  }
}

export async function listAssessmentReports(db: Db, me: StaffUser, input: {
  studentUserId?: number; activityId?: number; kind?: string; from?: Date; to?: Date; query?: string;
}) {
  const orgId = requireOrgStaff(me);
  const filters = [
    or(eq(users.orgId, orgId), isNull(users.orgId)),
    /* 未归属机构的历史学员也必须限定活动租户，不能带出其他机构的活动标题与报告。 */
    or(isNull(assessmentActivities.id), eq(assessmentActivities.orgId, orgId)),
  ];
  if (input.studentUserId) filters.push(eq(assessmentResults.userId, input.studentUserId));
  if (input.activityId) filters.push(eq(assessmentActivities.id, input.activityId));
  if (input.kind) filters.push(eq(assessmentResults.kind, input.kind as typeof assessmentResults.$inferSelect.kind));
  if (input.from) filters.push(gte(assessmentResults.createdAt, input.from));
  if (input.to) filters.push(lte(assessmentResults.createdAt, input.to));
  const rows = await db.select({
    id: assessmentResults.id, kind: assessmentResults.kind, createdAt: assessmentResults.createdAt,
    studentUserId: assessmentResults.userId, studentName: users.name,
    assignmentId: assessmentAssignments.id, startedAt: assessmentAssignments.startedAt, completedAt: assessmentAssignments.completedAt,
    assignmentStatus: assessmentAssignments.status, retestOfAssignmentId: assessmentAssignments.retestOfAssignmentId,
    itemId: assessmentActivityItems.id, selectionKey: assessmentActivityItems.selectionKey, packageTitle: assessmentActivityItems.title,
    activityId: assessmentActivities.id, activityTitle: assessmentActivities.title, activityStatus: assessmentActivities.status,
    activityDueAt: assessmentActivities.dueAt, activityCreatedBy: assessmentActivities.createdBy,
  }).from(assessmentResults).innerJoin(users, eq(assessmentResults.userId, users.id))
    .leftJoin(assessmentAssignments, eq(assessmentResults.assignmentId, assessmentAssignments.id))
    .leftJoin(assessmentActivityItems, eq(assessmentAssignments.activityItemId, assessmentActivityItems.id))
    .leftJoin(assessmentActivities, eq(assessmentActivityItems.activityId, assessmentActivities.id))
    .where(and(...filters)).orderBy(desc(assessmentResults.id)).limit(600);
  const allowed = new Map<number, boolean>();
  const visible = [];
  for (const row of rows) {
    if (row.activityId != null && row.activityDueAt == null && row.activityTitle == null) continue;
    if (!allowed.has(row.studentUserId)) allowed.set(row.studentUserId, await hasAssessmentReportAccess(db, me, row.studentUserId));
    if (!allowed.get(row.studentUserId)) continue;
    if (input.query?.trim()) {
      const query = input.query.trim().toLowerCase();
      const haystack = `${row.studentName ?? ""} ${row.activityTitle ?? ""} ${row.packageTitle ?? ""} ${row.kind}`.toLowerCase();
      if (!haystack.includes(query)) continue;
    }
    visible.push({ ...row, status: "completed" as const, durationSeconds: row.startedAt && row.completedAt
      ? Math.max(0, Math.round((row.completedAt.getTime() - row.startedAt.getTime()) / 1000)) : null,
      source: row.activityId ? "activity" as const : "legacy" as const });
    if (visible.length >= 300) break;
  }
  return visible;
}
