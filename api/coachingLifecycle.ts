import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import {
  coachingCases, coachingCaseScenarios, coachingDeliverables, coachingEvents, coachingExceptions, coachingHandoffs,
  coachingPlans, coachingReviews, coachingTasks, courseParticipants, courseSessions, studySupervisionRecords, users,
} from "@db/schema";
import type { getDb } from "./queries/connection";
import { requireOrgStaff, type StaffUser } from "./orgAccess";
import { assertCaseAccess, type CoachingCaseRow } from "./coachingAccess";
import type { PointTx } from "./orgPoints";

type Db = ReturnType<typeof getDb>;
type QueryDb = Db | PointTx;
type HandoffRow = typeof coachingHandoffs.$inferSelect;
type ClosureCheck = { code: string; label: string; ok: boolean; count: number };
export type CoachingClosureReadiness = { ready: boolean; checks: ClosureCheck[]; blockers: ClosureCheck[] };

function required(value: string | undefined, message: string): string {
  const text = value?.trim() ?? "";
  if (!text) throw new TRPCError({ code: "BAD_REQUEST", message });
  return text;
}
async function event(db: QueryDb, caseId: number, actorUserId: number, type: string, content: string) {
  await db.insert(coachingEvents).values({ caseId, actorUserId, type, content, visibility: "internal" });
}
async function assertStaffRecipient(db: QueryDb, orgId: number, userId: number) {
  const [user] = await db.select({ id: users.id }).from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, orgId), inArray(users.role, ["tutor", "admin"]), isNull(users.deletedAt))).limit(1);
  if (!user) throw new TRPCError({ code: "FORBIDDEN", message: "接收人必须是本机构伴学师或管理员" });
}
function changedRows(result: unknown): number | null {
  return typeof result === "object" && result !== null && "affectedRows" in result ? Number(result.affectedRows) : null;
}
function assertAffected(result: unknown, message: string) {
  const count = changedRows(result);
  if (count !== null && count !== 1) throw new TRPCError({ code: "CONFLICT", message });
}

/** 新督学在接收前可阅读必要的 GROW 背景，但不能借此修改主档或查看敏感正文。 */
export async function listIncomingHandoffs(db: Db, me: StaffUser) {
  const orgId = requireOrgStaff(me);
  return db.select({ handoff: coachingHandoffs, studentName: users.name,
    goal: coachingCases.goal, currentSituation: coachingCases.currentSituation, planSummary: coachingCases.planSummary })
    .from(coachingHandoffs).innerJoin(coachingCases, eq(coachingHandoffs.caseId, coachingCases.id))
    .innerJoin(users, eq(coachingCases.studentUserId, users.id))
    .where(and(eq(coachingHandoffs.toUserId, me.id), eq(coachingHandoffs.status, "pending"), eq(coachingCases.orgId, orgId)))
    .orderBy(desc(coachingHandoffs.id)).limit(100);
}

/** H5 只生成待接收改派，不直接改负责人。接收人是新督学，而不是旧教练。 */
export async function reassignCoachingCase(db: Db, me: StaffUser, input: { caseId: number; coachId: number; supervisorId: number; reason: string }) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "仅机构管理员可改派人员" });
  if (!["active", "paused"].includes(coachingCase.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "已结课或归档主档不能改派" });
  const reason = required(input.reason, "请填写改派原因");
  if (input.coachId === coachingCase.coachId && input.supervisorId === coachingCase.supervisorId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "新负责人未发生变化，无需发起改派" });
  }
  await assertStaffRecipient(db, coachingCase.orgId, input.coachId);
  await assertStaffRecipient(db, coachingCase.orgId, input.supervisorId);
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(coachingCases).where(eq(coachingCases.id, input.caseId)).limit(1).for("update");
    if (!current || current.orgId !== coachingCase.orgId) throw new TRPCError({ code: "NOT_FOUND", message: "陪跑主档不存在" });
    const pending = await tx.select({ id: coachingHandoffs.id }).from(coachingHandoffs)
      .where(and(eq(coachingHandoffs.caseId, input.caseId), eq(coachingHandoffs.type, "H5"), eq(coachingHandoffs.status, "pending"))).limit(1).for("update");
    if (pending.length) throw new TRPCError({ code: "CONFLICT", message: "已有待接收改派，请先由新督学接收或由管理员取消" });
    const [{ id }] = await tx.insert(coachingHandoffs).values({ caseId: input.caseId, type: "H5", fromUserId: me.id,
      toUserId: input.supervisorId, title: "人员改派 · 待新督学接收", content: reason, status: "pending",
      fromCoachId: current.coachId, fromSupervisorId: current.supervisorId, nextCoachId: input.coachId, nextSupervisorId: input.supervisorId }).$returningId();
    await event(tx, input.caseId, me.id, "case_reassignment_requested", `发起 H5 改派 #${id}，等待新督学接收：${reason}`);
    return { id, status: "pending" as const };
  });
}

export async function acceptHandoff(db: Db, me: StaffUser, handoffId: number) {
  const orgId = requireOrgStaff(me);
  const [row] = await db.select({ handoff: coachingHandoffs, coachingCase: coachingCases }).from(coachingHandoffs)
    .innerJoin(coachingCases, eq(coachingHandoffs.caseId, coachingCases.id)).where(eq(coachingHandoffs.id, handoffId)).limit(1);
  if (!row || row.coachingCase.orgId !== orgId) throw new TRPCError({ code: "NOT_FOUND", message: "交接记录不存在" });
  if (row.handoff.toUserId !== me.id || row.handoff.status !== "pending") {
    throw new TRPCError({ code: "FORBIDDEN", message: "只能接收分配给自己的待交接事项" });
  }
  return db.transaction(async (tx) => {
    const [handoff] = await tx.select().from(coachingHandoffs).where(eq(coachingHandoffs.id, handoffId)).limit(1).for("update");
    if (!handoff || handoff.toUserId !== me.id || handoff.status !== "pending") {
      throw new TRPCError({ code: "CONFLICT", message: "交接状态已变化，请刷新后再操作" });
    }
    let reassigned = false;
    const now = new Date();
    if (handoff.type === "H5" && handoff.nextSupervisorId != null) {
      if (handoff.fromCoachId == null || handoff.fromSupervisorId == null || handoff.nextCoachId == null) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "改派快照不完整，请管理员取消后重新发起" });
      }
      await assertStaffRecipient(tx, orgId, handoff.nextCoachId);
      await assertStaffRecipient(tx, orgId, handoff.nextSupervisorId);
      const [current] = await tx.select().from(coachingCases).where(eq(coachingCases.id, handoff.caseId)).limit(1).for("update");
      if (!current || current.orgId !== orgId) throw new TRPCError({ code: "NOT_FOUND", message: "陪跑主档不存在" });
      if (!["active", "paused"].includes(current.status)) throw new TRPCError({ code: "CONFLICT", message: "主档已结课或归档，不能接收改派" });
      if (current.coachId !== handoff.fromCoachId || current.supervisorId !== handoff.fromSupervisorId) {
        throw new TRPCError({ code: "CONFLICT", message: "负责人已变化，本次改派不能覆盖新安排；请联系管理员重新发起" });
      }
      const result = await tx.update(coachingCases).set({ coachId: handoff.nextCoachId, supervisorId: handoff.nextSupervisorId })
        .where(and(eq(coachingCases.id, current.id), eq(coachingCases.coachId, handoff.fromCoachId), eq(coachingCases.supervisorId, handoff.fromSupervisorId)));
      assertAffected(result, "负责人已变化，请刷新后再接收");
      reassigned = true;
    }
    const result = await tx.update(coachingHandoffs).set({ status: "accepted", acceptedAt: now, appliedAt: reassigned ? now : null })
      .where(and(eq(coachingHandoffs.id, handoff.id), eq(coachingHandoffs.status, "pending")));
    assertAffected(result, "交接状态已变化，请刷新后再操作");
    await event(tx, handoff.caseId, me.id, reassigned ? "case_reassigned" : "handoff_accepted",
      reassigned ? `H5 改派 #${handoff.id} 已由新督学接收并生效` : `${handoff.type} ${handoff.title}`);
    return { ok: true as const, reassigned };
  });
}

export async function cancelReassignment(db: Db, me: StaffUser, input: { handoffId: number; reason: string }) {
  if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "仅机构管理员可取消改派" });
  const [handoff] = await db.select().from(coachingHandoffs).where(eq(coachingHandoffs.id, input.handoffId)).limit(1);
  if (!handoff || handoff.type !== "H5" || handoff.nextSupervisorId == null) throw new TRPCError({ code: "NOT_FOUND", message: "待接收改派不存在" });
  await assertCaseAccess(db, me, handoff.caseId);
  const reason = required(input.reason, "请填写取消改派原因");
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(coachingHandoffs).where(eq(coachingHandoffs.id, handoff.id)).limit(1).for("update");
    if (!current || current.status !== "pending") throw new TRPCError({ code: "CONFLICT", message: "改派已接收或取消，不能重复操作" });
    const result = await tx.update(coachingHandoffs).set({ status: "cancelled" })
      .where(and(eq(coachingHandoffs.id, handoff.id), eq(coachingHandoffs.status, "pending")));
    assertAffected(result, "改派状态已变化，请刷新后再操作");
    await event(tx, handoff.caseId, me.id, "case_reassignment_cancelled", `取消 H5 改派 #${handoff.id}：${reason}`);
    return { ok: true as const };
  });
}

type ClosureSource = {
  coachingCase: CoachingCaseRow;
  scenarioHistory: (typeof coachingCaseScenarios.$inferSelect)[];
  plans: (typeof coachingPlans.$inferSelect)[];
  tasks: (typeof coachingTasks.$inferSelect)[];
  reviews: (typeof coachingReviews.$inferSelect)[];
  exceptions: Pick<typeof coachingExceptions.$inferSelect, "status">[];
  handoffs: HandoffRow[];
  supervisions: (typeof studySupervisionRecords.$inferSelect)[];
  sessions: (typeof courseSessions.$inferSelect)[];
  participants: { participant: typeof courseParticipants.$inferSelect }[];
  deliverables: Pick<typeof coachingDeliverables.$inferSelect, "sessionId" | "participantId" | "visibility" | "pushedAt">[];
};

/** 纯计算结课清单：页面预览与服务端提交共用同一规则，不返回敏感异常正文。 */
export function buildCoachingClosureReadiness(source: ClosureSource): CoachingClosureReadiness {
  const checks: ClosureCheck[] = [];
  const add = (code: string, label: string, count: number, inverse = false) => {
    const ok = inverse ? count > 0 : count === 0;
    checks.push({ code, label, ok, count });
  };
  const growIncomplete = [source.coachingCase.goal, source.coachingCase.currentSituation, source.coachingCase.planSummary].filter((text) => text.trim().length < 2).length;
  add("grow", "GROW 目标、现状与计划须完整", growIncomplete);
  add("plans", "至少一份已确认计划", source.plans.filter((plan) => plan.status === "confirmed").length, true);
  add("scenarios", "至少一个使用中的服务场景", source.scenarioHistory.filter((row) => !row.endedAt).length, true);
  const draftCount = source.sessions.filter((row) => row.status !== "completed").length + source.supervisions.filter((row) => row.status !== "completed").length;
  add("drafts", "课堂与督学草稿须完成或妥善处理", draftCount);
  const supervisionIncomplete = source.supervisions.filter((row) => row.status === "completed"
    && (!row.alignment.trim() || !row.checks.trim() || !row.exitCheck.trim())).length;
  add("supervisions", "已完成督学须有任务对齐、检查与离店验收", supervisionIncomplete);
  const pushed = source.deliverables.filter((row) => row.visibility === "family" && row.pushedAt);
  const missingFeedback = source.sessions.filter((session) => session.status === "completed").filter((session) => {
    const participant = source.participants.find((row) => row.participant.sessionId === session.id
      && row.participant.studentUserId === source.coachingCase.studentUserId);
    if (!participant) return true;
    if (participant.participant.feedbackVersion > 0) return false;
    return !pushed.some((file) => file.participantId != null && file.participantId === participant.participant.id);
  }).length;
  add("feedback", "每场已完成课堂均须已推送本学员家长反馈", missingFeedback);
  add("tasks", "行动任务须全部验收并保留证据", source.tasks.filter((task) => task.status !== "verified"
    || !task.evidence.trim() || !task.result.trim()).length);
  add("exceptions", "异常须全部处理并核验关闭证据", source.exceptions.filter((row) => row.status !== "closed").length);
  add("handoffs", "交接与待接收改派须全部办结", source.handoffs.filter((row) => row.status === "pending").length);
  add("termReview", "至少一份有后续行动的学期结课复盘", source.reviews.filter((review) => review.period === "term"
    && review.content.trim().length >= 2 && review.nextActions.trim().length >= 2).length, true);
  const blockers = checks.filter((check) => !check.ok);
  return { ready: blockers.length === 0, checks, blockers };
}

export async function getCoachingClosureReadiness(db: QueryDb, me: StaffUser, caseId: number): Promise<CoachingClosureReadiness> {
  /* 事务与根连接共享 Drizzle 查询能力；权限函数的类型仍保留根连接签名。 */
  const coachingCase = await assertCaseAccess(db as Db, me, caseId);
  const [scenarioHistory, plans, tasks, reviews, exceptions, handoffs, supervisions, sessions, participants, deliverables] = await Promise.all([
    db.select().from(coachingCaseScenarios).where(and(eq(coachingCaseScenarios.caseId, caseId), eq(coachingCaseScenarios.orgId, coachingCase.orgId))),
    db.select().from(coachingPlans).where(eq(coachingPlans.caseId, caseId)),
    db.select().from(coachingTasks).where(eq(coachingTasks.caseId, caseId)),
    db.select().from(coachingReviews).where(eq(coachingReviews.caseId, caseId)),
    db.select({ status: coachingExceptions.status }).from(coachingExceptions).where(and(eq(coachingExceptions.caseId, caseId), eq(coachingExceptions.orgId, coachingCase.orgId))),
    db.select().from(coachingHandoffs).where(eq(coachingHandoffs.caseId, caseId)),
    db.select().from(studySupervisionRecords).where(eq(studySupervisionRecords.caseId, caseId)),
    (async () => {
      const [own, joined] = await Promise.all([
        db.select().from(courseSessions).where(and(eq(courseSessions.caseId, caseId), eq(courseSessions.orgId, coachingCase.orgId))),
        db.select({ session: courseSessions }).from(courseSessions).innerJoin(courseParticipants, eq(courseParticipants.sessionId, courseSessions.id))
          .where(and(eq(courseParticipants.studentUserId, coachingCase.studentUserId), eq(courseSessions.orgId, coachingCase.orgId))),
      ]);
      const unique = new Map<number, typeof courseSessions.$inferSelect>();
      for (const row of own) unique.set(row.id, row);
      for (const row of joined) unique.set(row.session.id, row.session);
      return [...unique.values()];
    })(),
    db.select({ participant: courseParticipants }).from(courseParticipants).innerJoin(courseSessions, eq(courseParticipants.sessionId, courseSessions.id))
      .where(and(eq(courseSessions.orgId, coachingCase.orgId), eq(courseParticipants.studentUserId, coachingCase.studentUserId))),
    db.select({ sessionId: coachingDeliverables.sessionId, participantId: coachingDeliverables.participantId,
      visibility: coachingDeliverables.visibility, pushedAt: coachingDeliverables.pushedAt }).from(coachingDeliverables).where(eq(coachingDeliverables.caseId, caseId)),
  ]);
  const sessionIds = new Set(sessions.map((row) => row.id));
  return buildCoachingClosureReadiness({ coachingCase, scenarioHistory, plans, tasks, reviews, exceptions, handoffs, supervisions, sessions,
    participants: participants.filter((row) => sessionIds.has(row.participant.sessionId)), deliverables });
}

function assertClosureReady(readiness: CoachingClosureReadiness) {
  if (!readiness.ready) {
    throw new TRPCError({ code: "PRECONDITION_FAILED",
      message: `结课前还有 ${readiness.blockers.length} 类事项未完成：${readiness.blockers.map((item) => item.label).join("；")}` });
  }
}

export async function setCoachingStatus(db: Db, me: StaffUser, input: { caseId: number; status: "active" | "paused" | "closed" | "archived"; reason: string }) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  if (input.status === "archived" && me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "仅机构管理员可归档" });
  const reason = required(input.reason, "请填写状态变更原因");
  await db.transaction(async (tx) => {
    const [current] = await tx.select().from(coachingCases).where(eq(coachingCases.id, input.caseId)).limit(1).for("update");
    if (!current || current.orgId !== coachingCase.orgId) throw new TRPCError({ code: "NOT_FOUND", message: "陪跑主档不存在" });
    if (input.status === "closed") assertClosureReady(await getCoachingClosureReadiness(tx, me, input.caseId));
    await tx.update(coachingCases).set({ status: input.status, scenario: input.status === "closed" ? "结课复盘" : current.scenario }).where(eq(coachingCases.id, input.caseId));
    if (input.status === "closed") await tx.insert(coachingHandoffs).values({ caseId: input.caseId, type: "H4", fromUserId: me.id, toUserId: current.supervisorId,
      title: "结课复盘与后续回访交接", content: reason, status: "closed", acceptedAt: null });
    await event(tx, input.caseId, me.id, "case_status", `${current.status} → ${input.status}：${reason}`);
  });
  return { ok: true as const };
}
