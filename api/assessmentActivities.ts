import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import { assessmentActivities, assessmentActivityItems, assessmentAssignments, assessmentResults, users } from "@db/schema";
import { selectionFor } from "@contracts/orgService";
import type { getDb } from "./queries/connection";
import { assertStudentAccess, requireOrgStaff, type StaffUser } from "./orgAccess";
import { debitPoints, refundOriginalDebitTx } from "./orgPoints";

type Db = ReturnType<typeof getDb>;

function duplicateEntry(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "ER_DUP_ENTRY" || e?.cause?.code === "ER_DUP_ENTRY";
}

export async function createAssessmentActivity(db: Db, me: StaffUser, input: { requestKey: string; studentIds: number[]; selections: string[]; title: string; note?: string; dueAt?: Date | null }) {
  const orgId = requireOrgStaff(me);
  const studentIds = [...new Set(input.studentIds)];
  const selectionKeys = [...new Set(input.selections)];
  if (!studentIds.length || studentIds.length > 50) throw new TRPCError({ code: "BAD_REQUEST", message: "每次请选择 1～50 位学员" });
  if (!selectionKeys.length || selectionKeys.length > 20) throw new TRPCError({ code: "BAD_REQUEST", message: "请选择要发起的测评" });
  const selections = selectionKeys.map((key) => {
    const item = selectionFor(key);
    if (!item) throw new TRPCError({ code: "BAD_REQUEST", message: `未知测评：${key}` });
    return item;
  });
  const selectedKinds = new Map<string, string>();
  for (const selection of selections) {
    for (const kind of selection.kinds) {
      const previous = selectedKinds.get(kind);
      if (previous) throw new TRPCError({ code: "CONFLICT", message: `「${selection.title}」与「${previous}」包含重复测评，请只保留一个` });
      selectedKinds.set(kind, selection.title);
    }
  }
  const ownedActivity = (activity: typeof assessmentActivities.$inferSelect | undefined) => {
    if (!activity) return null;
    if (activity.createdBy !== me.id || activity.orgId !== orgId) throw new TRPCError({ code: "CONFLICT", message: "发起标识已被占用，请刷新重试" });
    return { activityId: activity.id, duplicate: true as const };
  };
  const [old] = await db.select().from(assessmentActivities).where(eq(assessmentActivities.requestKey, input.requestKey)).limit(1);
  const duplicate = ownedActivity(old);
  if (duplicate) return duplicate;
  for (const id of studentIds) await assertStudentAccess(db, me, id);
  try {
    return await db.transaction(async (tx) => {
      const [again] = await tx.select().from(assessmentActivities).where(eq(assessmentActivities.requestKey, input.requestKey)).limit(1).for("update");
      const existing = ownedActivity(again);
      if (existing) return existing;
      const [{ id: activityId }] = await tx.insert(assessmentActivities).values({ orgId, createdBy: me.id, requestKey: input.requestKey,
        title: input.title.trim() || "伴学测评", note: input.note?.trim() ?? "", dueAt: input.dueAt ?? null }).$returningId();
      for (let index = 0; index < selections.length; index++) {
        const selection = selections[index];
        const [{ id: itemId }] = await tx.insert(assessmentActivityItems).values({ activityId, selectionKey: selection.key,
          title: selection.title, includedKinds: selection.kinds, priceSnapshot: selection.price, category: selection.category, sortOrder: index }).$returningId();
        for (const studentUserId of studentIds) {
          let firstAssignmentId: number | null = null;
          for (const kind of selection.kinds) {
            const [{ id }] = await tx.insert(assessmentAssignments).values({ activityItemId: itemId, studentUserId, tutorUserId: me.id, kind }).$returningId();
            firstAssignmentId ??= id;
          }
          await debitPoints(tx, { orgId, payerUserId: me.id, actorUserId: me.id, amount: selection.price,
            eventKey: `assessment:item:${itemId}:student:${studentUserId}`, activityId, assignmentId: firstAssignmentId,
            studentUserId, kind: selection.key, reason: `发起测评：${selection.title}` });
        }
      }
      return { activityId, duplicate: false as const };
    });
  } catch (error) {
    /* 两个相同请求同时穿过首次查询时，由唯一键决胜；失败事务回滚后返回胜者的同一活动。 */
    if (!duplicateEntry(error)) throw error;
    const [existing] = await db.select().from(assessmentActivities).where(eq(assessmentActivities.requestKey, input.requestKey)).limit(1);
    return ownedActivity(existing) ?? (() => { throw error; })();
  }
}

async function assertActivityAccess(db: Db, me: StaffUser, activityId: number) {
  const orgId = requireOrgStaff(me);
  const [activity] = await db.select().from(assessmentActivities).where(eq(assessmentActivities.id, activityId)).limit(1);
  if (!activity || activity.orgId !== orgId || (me.role !== "admin" && activity.createdBy !== me.id)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "无权访问该测评活动" });
  }
  return activity;
}

export async function listAssessmentActivities(db: Db, me: StaffUser) {
  const orgId = requireOrgStaff(me);
  const conditions = me.role === "admin" ? eq(assessmentActivities.orgId, orgId) : and(eq(assessmentActivities.orgId, orgId), eq(assessmentActivities.createdBy, me.id));
  const activities = await db.select().from(assessmentActivities).where(conditions).orderBy(desc(assessmentActivities.id)).limit(100);
  if (!activities.length) return [];
  const ids = activities.map((a) => a.id);
  const items = await db.select().from(assessmentActivityItems).where(inArray(assessmentActivityItems.activityId, ids));
  const assignments = await db.select({ assignment: assessmentAssignments, itemId: assessmentActivityItems.id, activityId: assessmentActivityItems.activityId, studentName: users.name })
    .from(assessmentAssignments).innerJoin(assessmentActivityItems, eq(assessmentAssignments.activityItemId, assessmentActivityItems.id))
    .leftJoin(users, eq(assessmentAssignments.studentUserId, users.id)).where(inArray(assessmentActivityItems.activityId, ids)).orderBy(assessmentAssignments.id);
  return activities.map((activity) => ({
    ...activity,
    items: items.filter((i) => i.activityId === activity.id).map((item) => ({ ...item,
      assignments: assignments.filter((a) => a.itemId === item.id).map((a) => ({ ...a.assignment, studentName: a.studentName ?? `学员 ${a.assignment.studentUserId}` })) })),
  }));
}

export async function cancelAssessmentItem(db: Db, me: StaffUser, itemId: number, reason: string) {
  const [item] = await db.select().from(assessmentActivityItems).where(eq(assessmentActivityItems.id, itemId)).limit(1);
  if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "测评项目不存在" });
  await assertActivityAccess(db, me, item.activityId);
  return db.transaction(async (tx) => {
    const assignments = await tx.select().from(assessmentAssignments).where(eq(assessmentAssignments.activityItemId, itemId)).for("update");
    const open = assignments.filter((a) => a.status === "pending");
    if (open.length !== assignments.length || !open.length) throw new TRPCError({ code: "CONFLICT", message: "已有学员开始或完成，不能整项取消；请保留记录并个别处理" });
    await tx.update(assessmentAssignments).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(assessmentAssignments.activityItemId, itemId));
    if (item.priceSnapshot > 0) {
      for (const assignment of open) {
        await refundOriginalDebitTx(tx, { eventKey: `assessment:item:${itemId}:student:${assignment.studentUserId}`, actorUserId: me.id, reason: reason.trim() || "未开始取消测评" });
      }
    }
    const remaining = await tx.select({ id: assessmentAssignments.id }).from(assessmentAssignments)
      .innerJoin(assessmentActivityItems, eq(assessmentAssignments.activityItemId, assessmentActivityItems.id))
      .where(and(eq(assessmentActivityItems.activityId, item.activityId), ne(assessmentAssignments.status, "cancelled"))).limit(1);
    if (!remaining.length) await tx.update(assessmentActivities).set({ status: "cancelled" }).where(eq(assessmentActivities.id, item.activityId));
    return { ok: true as const, count: open.length };
  });
}

export async function myAssessmentAssignments(db: Db, studentUserId: number) {
  return db.select({ assignment: assessmentAssignments, title: assessmentActivityItems.title, selectionKey: assessmentActivityItems.selectionKey,
    activityTitle: assessmentActivities.title, dueAt: assessmentActivities.dueAt, tutorName: users.name, resultId: assessmentResults.id })
    .from(assessmentAssignments).innerJoin(assessmentActivityItems, eq(assessmentAssignments.activityItemId, assessmentActivityItems.id))
    .innerJoin(assessmentActivities, eq(assessmentActivityItems.activityId, assessmentActivities.id))
    .leftJoin(users, eq(assessmentAssignments.tutorUserId, users.id))
    .leftJoin(assessmentResults, eq(assessmentAssignments.resultId, assessmentResults.id))
    .where(and(eq(assessmentAssignments.studentUserId, studentUserId), ne(assessmentAssignments.status, "cancelled"), eq(assessmentActivities.status, "open")))
    .orderBy(desc(assessmentAssignments.id));
}

export async function startAssessmentAssignment(db: Db, studentUserId: number, assignmentId: number) {
  return db.transaction(async (tx) => {
    const [row] = await tx.select({ assignment: assessmentAssignments, activityStatus: assessmentActivities.status })
      .from(assessmentAssignments)
      .innerJoin(assessmentActivityItems, eq(assessmentAssignments.activityItemId, assessmentActivityItems.id))
      .innerJoin(assessmentActivities, eq(assessmentActivityItems.activityId, assessmentActivities.id))
      .where(eq(assessmentAssignments.id, assignmentId)).limit(1).for("update");
    if (!row || row.assignment.studentUserId !== studentUserId) throw new TRPCError({ code: "FORBIDDEN", message: "这不是你的测评任务" });
    const assignment = row.assignment;
    if (row.activityStatus !== "open" || !["pending", "in_progress"].includes(assignment.status)) {
      throw new TRPCError({ code: "CONFLICT", message: "这项任务已完成或已取消" });
    }
    await tx.update(assessmentAssignments).set({ status: "pending", startedAt: null }).where(and(eq(assessmentAssignments.studentUserId, studentUserId), eq(assessmentAssignments.kind, assignment.kind), eq(assessmentAssignments.status, "in_progress"), ne(assessmentAssignments.id, assignment.id)));
    await tx.update(assessmentAssignments).set({ status: "in_progress", startedAt: assignment.startedAt ?? new Date() }).where(eq(assessmentAssignments.id, assignment.id));
    return { kind: assignment.kind, assignmentId: assignment.id };
  });
}
