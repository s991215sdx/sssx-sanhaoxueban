import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, lte, ne } from "drizzle-orm";
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

export async function createAssessmentActivity(db: Db, me: StaffUser, input: { requestKey: string; studentIds: number[]; selections: string[]; title: string; note?: string; dueAt?: Date | null; expiryPolicy?: "auto_refund" | "manual_review"; retestOfAssignmentId?: number | null }) {
  const orgId = requireOrgStaff(me);
  const studentIds = [...new Set(input.studentIds)];
  const selectionKeys = [...new Set(input.selections)];
  if (!studentIds.length || studentIds.length > 50) throw new TRPCError({ code: "BAD_REQUEST", message: "每次请选择 1～50 位学员" });
  if (!selectionKeys.length || selectionKeys.length > 20) throw new TRPCError({ code: "BAD_REQUEST", message: "请选择要发起的测评" });
  if (input.dueAt && input.dueAt.getTime() <= Date.now()) throw new TRPCError({ code: "BAD_REQUEST", message: "完成期限必须晚于当前时间" });
  if (input.retestOfAssignmentId && (studentIds.length !== 1 || selectionKeys.length !== 1)) throw new TRPCError({ code: "BAD_REQUEST", message: "每次复测仅选择一位学员和一个原测评项目" });
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
  if (input.retestOfAssignmentId) {
    const [source] = await db.select({ assignment: assessmentAssignments, selectionKey: assessmentActivityItems.selectionKey }).from(assessmentAssignments)
      .innerJoin(assessmentActivityItems, eq(assessmentAssignments.activityItemId, assessmentActivityItems.id)).where(eq(assessmentAssignments.id, input.retestOfAssignmentId)).limit(1);
    if (!source || source.assignment.status !== "completed" || source.assignment.studentUserId !== studentIds[0] || source.selectionKey !== selectionKeys[0]) {
      throw new TRPCError({ code: "CONFLICT", message: "复测必须来自同一学员已完成项目的整包任务" });
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
        title: input.title.trim() || "伴学测评", note: input.note?.trim() ?? "", dueAt: input.dueAt ?? null, expiryPolicy: input.expiryPolicy ?? "auto_refund" }).$returningId();
      for (let index = 0; index < selections.length; index++) {
        const selection = selections[index];
        const [{ id: itemId }] = await tx.insert(assessmentActivityItems).values({ activityId, selectionKey: selection.key,
          title: selection.title, includedKinds: selection.kinds, priceSnapshot: selection.price, category: selection.category, sortOrder: index }).$returningId();
        for (const studentUserId of studentIds) {
          let firstAssignmentId: number | null = null;
          for (const kind of selection.kinds) {
            const [{ id }] = await tx.insert(assessmentAssignments).values({ activityItemId: itemId, studentUserId, tutorUserId: me.id, kind,
              retestOfAssignmentId: input.retestOfAssignmentId ?? null }).$returningId();
            firstAssignmentId ??= id;
          }
          await debitPoints(tx, { orgId, payerUserId: me.id, actorUserId: me.id, amount: selection.price,
            eventKey: `assessment:item:${itemId}:student:${studentUserId}`, activityId, assignmentId: firstAssignmentId,
            studentUserId, kind: selection.key, reason: `${input.retestOfAssignmentId ? "复测" : "发起测评"}：${selection.title}` });
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

/** 到期由读路径和提交路径共同结算；综合包只有全部子项未开始才退一次。 */
export async function expireAssessmentActivity(db: Db, activityId: number, actorUserId = 0) {
  return db.transaction(async (tx) => {
    const [activity] = await tx.select().from(assessmentActivities).where(eq(assessmentActivities.id, activityId)).limit(1).for("update");
    if (!activity || activity.status !== "open" || !activity.dueAt || activity.dueAt.getTime() > Date.now()) return { expired: 0, refunded: 0 };
    const rows = await tx.select({ assignment: assessmentAssignments, price: assessmentActivityItems.priceSnapshot }).from(assessmentAssignments)
      .innerJoin(assessmentActivityItems, eq(assessmentAssignments.activityItemId, assessmentActivityItems.id))
      .where(eq(assessmentActivityItems.activityId, activityId)).for("update");
    const groups = new Map<string, typeof rows>();
    for (const row of rows) {
      const key = `${row.assignment.activityItemId}:${row.assignment.studentUserId}`;
      groups.set(key, [...(groups.get(key) ?? []), row]);
    }
    const expiredIds: number[] = [];
    let refunded = 0;
    for (const [key, group] of groups) {
      const open = group.filter((r) => ["pending", "in_progress"].includes(r.assignment.status));
      if (!open.length) continue;
      expiredIds.push(...open.map((r) => r.assignment.id));
      if (activity.expiryPolicy === "auto_refund" && group.every((r) => r.assignment.status === "pending") && group[0]!.price > 0) {
        const [itemId, studentId] = key.split(":");
        const result = await refundOriginalDebitTx(tx, { eventKey: `assessment:item:${itemId}:student:${studentId}`, actorUserId, reason: "超过完成期限，未开始任务自动过期退款" });
        if (result.refunded) refunded += 1;
      }
    }
    if (expiredIds.length) await tx.update(assessmentAssignments).set({ status: "expired", expiredAt: new Date(), cancelledReason: "超过完成期限" })
      .where(and(inArray(assessmentAssignments.id, expiredIds), inArray(assessmentAssignments.status, ["pending", "in_progress"])));
    if (!rows.some((r) => ["pending", "in_progress"].includes(r.assignment.status) && !expiredIds.includes(r.assignment.id))) {
      await tx.update(assessmentActivities).set({ status: "expired" }).where(and(eq(assessmentActivities.id, activityId), eq(assessmentActivities.status, "open")));
    }
    return { expired: expiredIds.length, refunded };
  });
}

export async function listAssessmentActivities(db: Db, me: StaffUser) {
  const orgId = requireOrgStaff(me);
  const conditions = me.role === "admin" ? eq(assessmentActivities.orgId, orgId) : and(eq(assessmentActivities.orgId, orgId), eq(assessmentActivities.createdBy, me.id));
  let activities = await db.select().from(assessmentActivities).where(conditions).orderBy(desc(assessmentActivities.id)).limit(100);
  const due = activities.filter((a) => a.status === "open" && a.dueAt && a.dueAt.getTime() <= Date.now());
  for (const activity of due) await expireAssessmentActivity(db, activity.id, me.id);
  if (due.length) activities = await db.select().from(assessmentActivities).where(conditions).orderBy(desc(assessmentActivities.id)).limit(100);
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
    if (open.length !== assignments.length || !open.length) throw new TRPCError({ code: "CONFLICT", message: "已有学员开始、完成或过期，不能整项取消；请按学员处理" });
    await tx.update(assessmentAssignments).set({ status: "cancelled", cancelledAt: new Date(), cancelledReason: reason.trim() }).where(eq(assessmentAssignments.activityItemId, itemId));
    if (item.priceSnapshot > 0) {
      for (const studentId of new Set(open.map((a) => a.studentUserId))) {
        await refundOriginalDebitTx(tx, { eventKey: `assessment:item:${itemId}:student:${studentId}`, actorUserId: me.id, reason: reason.trim() || "未开始取消测评" });
      }
    }
    const remaining = await tx.select({ id: assessmentAssignments.id }).from(assessmentAssignments)
      .innerJoin(assessmentActivityItems, eq(assessmentAssignments.activityItemId, assessmentActivityItems.id))
      .where(and(eq(assessmentActivityItems.activityId, item.activityId), ne(assessmentAssignments.status, "cancelled"))).limit(1);
    if (!remaining.length) await tx.update(assessmentActivities).set({ status: "cancelled" }).where(eq(assessmentActivities.id, item.activityId));
    return { ok: true as const, count: new Set(open.map((a) => a.studentUserId)).size };
  });
}

/** 取消同一项目下一位学员的整包任务，原子更新并按原扣费事件退款。 */
export async function cancelAssessmentStudent(db: Db, me: StaffUser, itemId: number, studentUserId: number, reason: string) {
  const [item] = await db.select().from(assessmentActivityItems).where(eq(assessmentActivityItems.id, itemId)).limit(1);
  if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "测评项目不存在" });
  await assertActivityAccess(db, me, item.activityId);
  return db.transaction(async (tx) => {
    const rows = await tx.select().from(assessmentAssignments).where(and(eq(assessmentAssignments.activityItemId, itemId), eq(assessmentAssignments.studentUserId, studentUserId))).for("update");
    if (!rows.length || rows.some((r) => !["pending", "expired"].includes(r.status) || r.startedAt != null || r.completedAt != null)) throw new TRPCError({ code: "CONFLICT", message: "该学员已有子项开始或完成，整包不能取消退款；历史将保留" });
    await tx.update(assessmentAssignments).set({ status: "cancelled", cancelledAt: new Date(), cancelledReason: reason.trim() })
      .where(and(eq(assessmentAssignments.activityItemId, itemId), eq(assessmentAssignments.studentUserId, studentUserId), inArray(assessmentAssignments.status, ["pending", "expired"])));
    const refund = item.priceSnapshot > 0 ? await refundOriginalDebitTx(tx, { eventKey: `assessment:item:${itemId}:student:${studentUserId}`, actorUserId: me.id, reason: reason.trim() }) : { refunded: false };
    return { ok: true as const, count: rows.length, refunded: refund.refunded };
  });
}

export async function myAssessmentAssignments(db: Db, studentUserId: number) {
  const due = await db.select({ id: assessmentActivities.id }).from(assessmentActivities)
    .innerJoin(assessmentActivityItems, eq(assessmentActivityItems.activityId, assessmentActivities.id))
    .innerJoin(assessmentAssignments, eq(assessmentAssignments.activityItemId, assessmentActivityItems.id))
    .where(and(eq(assessmentAssignments.studentUserId, studentUserId), eq(assessmentActivities.status, "open"), lte(assessmentActivities.dueAt, new Date()))).limit(30);
  for (const activity of due) await expireAssessmentActivity(db, activity.id);
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
    const [row] = await tx.select({ assignment: assessmentAssignments, activityStatus: assessmentActivities.status, dueAt: assessmentActivities.dueAt })
      .from(assessmentAssignments)
      .innerJoin(assessmentActivityItems, eq(assessmentAssignments.activityItemId, assessmentActivityItems.id))
      .innerJoin(assessmentActivities, eq(assessmentActivityItems.activityId, assessmentActivities.id))
      .where(eq(assessmentAssignments.id, assignmentId)).limit(1).for("update");
    if (!row || row.assignment.studentUserId !== studentUserId) throw new TRPCError({ code: "FORBIDDEN", message: "这不是你的测评任务" });
    const assignment = row.assignment;
    if (row.dueAt && row.dueAt.getTime() <= Date.now()) throw new TRPCError({ code: "CONFLICT", message: "这项任务已超过完成期限，请联系伴学师处理" });
    if (row.activityStatus !== "open" || !["pending", "in_progress"].includes(assignment.status)) {
      throw new TRPCError({ code: "CONFLICT", message: "这项任务已完成、过期或取消" });
    }
    await tx.update(assessmentAssignments).set({ status: "pending", startedAt: null }).where(and(eq(assessmentAssignments.studentUserId, studentUserId), eq(assessmentAssignments.kind, assignment.kind), eq(assessmentAssignments.status, "in_progress"), ne(assessmentAssignments.id, assignment.id)));
    await tx.update(assessmentAssignments).set({ status: "in_progress", startedAt: assignment.startedAt ?? new Date() }).where(eq(assessmentAssignments.id, assignment.id));
    return { kind: assignment.kind, assignmentId: assignment.id };
  });
}
