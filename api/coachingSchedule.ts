import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { coachingCases, coachingEvents, coachingSessionEvents, coachingTasks, courseParticipants, courseSessions, courseSessionUnits, studySupervisionRecords, users } from "@db/schema";
import { phaseForVisit, validateSessionPhase } from "@contracts/orgService";
import type { getDb } from "./queries/connection";
import type { PointTx } from "./orgPoints";
import { assertCaseAccess, type CoachingCaseRow } from "./coachingAccess";
import { assertStudentAccess, type StaffUser } from "./orgAccess";
import { familyRecipients } from "./coachingRecipients";

type Db = ReturnType<typeof getDb>;

function reason(value: string | undefined) {
  const text = value?.trim() ?? "";
  if (text.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "请填写具体原因，历史快照和操作人会一并保留" });
  return text;
}

async function audit(db: PointTx, caseId: number, actorUserId: number, content: string) {
  await db.insert(coachingEvents).values({ caseId, actorUserId, type: "delivery_schedule_changed", content, visibility: "internal" });
}

/** 小组草稿必须整组读取；不能只取当前主档学员后覆盖其他成员的出勤、行动和反馈。 */
export async function courseSessionForEdit(db: Db, me: StaffUser, sessionId: number) {
  const [session] = await db.select().from(courseSessions).where(eq(courseSessions.id, sessionId)).limit(1);
  if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "课堂不存在" });
  if (!["draft", "scheduled"].includes(session.status)) throw new TRPCError({ code: "CONFLICT", message: "已完成或已取消课堂只读保留，不能续写" });
  const coachingCase = await assertCaseAccess(db, me, session.caseId);
  if (session.orgId !== coachingCase.orgId || session.caseId !== coachingCase.id) throw new TRPCError({ code: "NOT_FOUND", message: "课堂与主档不匹配" });
  const [units, participants, events] = await Promise.all([
    db.select().from(courseSessionUnits).where(eq(courseSessionUnits.sessionId, session.id)).orderBy(courseSessionUnits.sortOrder),
    db.select().from(courseParticipants).where(eq(courseParticipants.sessionId, session.id)).orderBy(courseParticipants.id),
    db.select({ event: coachingSessionEvents, actorName: users.name }).from(coachingSessionEvents)
      .leftJoin(users, eq(coachingSessionEvents.actorUserId, users.id)).where(eq(coachingSessionEvents.sessionId, session.id)).orderBy(coachingSessionEvents.id),
  ]);
  const studentIds = [...new Set(participants.map((row) => row.studentUserId))];
  const [ownerCases, studentRows] = await Promise.all([
    db.select().from(coachingCases).where(and(eq(coachingCases.orgId, coachingCase.orgId), inArray(coachingCases.studentUserId, studentIds))),
    db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, studentIds)),
  ]);
  const cases = new Map(ownerCases.map((row) => [row.studentUserId, row]));
  const names = new Map(studentRows.map((row) => [row.id, row.name]));
  for (const studentId of studentIds) {
    await assertStudentAccess(db, me, studentId);
    if (!cases.has(studentId)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "每位参与学员必须有同机构陪跑主档" });
  }
  const taskIds = participants.map((row) => row.actionTaskId).filter((value): value is number => value != null);
  const actions = taskIds.length ? await db.select().from(coachingTasks).where(inArray(coachingTasks.id, taskIds)) : [];
  const supervision = session.supervisionId ? (await db.select().from(studySupervisionRecords)
    .where(and(eq(studySupervisionRecords.id, session.supervisionId), eq(studySupervisionRecords.caseId, coachingCase.id))).limit(1))[0] ?? null : null;
  const groupSupervisions = await db.select().from(studySupervisionRecords).where(and(
    inArray(studySupervisionRecords.caseId, ownerCases.map((row) => row.id)), eq(studySupervisionRecords.visitAt, session.startAt), eq(studySupervisionRecords.mode, "mixed"),
  ));
  return { session, units, supervision, events: events.map((row) => ({ ...row.event, actorName: row.actorName })),
    participants: participants.map((participant) => {
      const ownerCase = cases.get(participant.studentUserId)!;
      const linked = groupSupervisions.filter((row) => row.caseId === ownerCase.id);
      return { participant, caseId: ownerCase.id, studentName: names.get(participant.studentUserId) ?? `学员 ${participant.studentUserId}`,
        supervisionId: linked.length === 1 ? linked[0]!.id : null,
        action: actions.find((row) => row.id === participant.actionTaskId && row.caseId === ownerCase.id) ?? null };
    }) };
}

/** 亲子课逐生返回有效监护人，不借用当前主档或其他家庭的接收人。 */
export async function courseSessionRecipients(db: Db, me: StaffUser, caseId: number, studentUserIds: number[]) {
  const coachingCase = await assertCaseAccess(db, me, caseId);
  const studentIds = [...new Set(studentUserIds)];
  if (!studentIds.length || studentIds.length > 30 || !studentIds.includes(coachingCase.studentUserId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "请选择 1～30 位参与学员，并包含当前主档学员" });
  }
  const ownerCases = await db.select().from(coachingCases).where(and(eq(coachingCases.orgId, coachingCase.orgId), inArray(coachingCases.studentUserId, studentIds)));
  const names = await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, studentIds));
  const result = [];
  for (const studentId of studentIds) {
    await assertStudentAccess(db, me, studentId);
    const ownerCase = ownerCases.find((row) => row.studentUserId === studentId);
    if (!ownerCase) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "每位参与学员必须有同机构陪跑主档" });
    result.push({ caseId: ownerCase.id, studentUserId: studentId, studentName: names.find((row) => row.id === studentId)?.name ?? `学员 ${studentId}`,
      recipients: await familyRecipients(db, ownerCase) });
  }
  return result;
}

async function groupSupervisionRows(tx: PointTx, session: typeof courseSessions.$inferSelect, participants: (typeof courseParticipants.$inferSelect)[]) {
  const ownerCases = await tx.select().from(coachingCases).where(and(eq(coachingCases.orgId, session.orgId), inArray(coachingCases.studentUserId, participants.map((row) => row.studentUserId))));
  const records = ownerCases.length ? await tx.select().from(studySupervisionRecords).where(and(
    inArray(studySupervisionRecords.caseId, ownerCases.map((row) => row.id)), eq(studySupervisionRecords.visitAt, session.startAt), eq(studySupervisionRecords.mode, "mixed"),
  )).for("update") : [];
  return { ownerCases, records };
}

export async function rescheduleCourseSession(db: Db, me: StaffUser, input: { sessionId: number; startAt: Date; reason: string }) {
  const [original] = await db.select().from(courseSessions).where(eq(courseSessions.id, input.sessionId)).limit(1);
  if (!original) throw new TRPCError({ code: "NOT_FOUND", message: "课堂不存在" });
  const coachingCase = await assertCaseAccess(db, me, original.caseId);
  const why = reason(input.reason);
  if (["completed", "cancelled"].includes(original.status)) throw new TRPCError({ code: "CONFLICT", message: "已完成课堂属于历史事实，已取消课堂不能改期；请另建课堂" });
  return db.transaction(async (tx) => {
    const [session] = await tx.select().from(courseSessions).where(eq(courseSessions.id, input.sessionId)).limit(1).for("update");
    if (!session || session.orgId !== coachingCase.orgId || session.caseId !== coachingCase.id) throw new TRPCError({ code: "NOT_FOUND", message: "课堂不存在或与主档不匹配" });
    if (["completed", "cancelled"].includes(session.status)) throw new TRPCError({ code: "CONFLICT", message: "课堂状态已变化，不能改期" });
    const [units, participants] = await Promise.all([
      tx.select().from(courseSessionUnits).where(eq(courseSessionUnits.sessionId, session.id)),
      tx.select().from(courseParticipants).where(eq(courseParticipants.sessionId, session.id)),
    ]);
    const phase = phaseForVisit(coachingCase.serviceStart, input.startAt);
    const group = await groupSupervisionRows(tx, session, participants);
    for (const participant of participants) {
      const ownerCase = group.ownerCases.find((row) => row.studentUserId === participant.studentUserId);
      if (!ownerCase) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "参与学员缺少同机构陪跑主档，不能改期" });
      await assertStudentAccess(db, me, participant.studentUserId);
      const nextPhase = phaseForVisit(ownerCase.serviceStart, input.startAt);
      const phaseError = validateSessionPhase({ phase: nextPhase, hasCoachUnit: units.length > 0, hasSupervision: true,
        format: session.format as "one_to_one" | "salon" | "workshop" | "mixed",
        lateChangeReason: session.changeReason, lateChangeConfirmedBy: session.changeConfirmedBy });
      if (phaseError) throw new TRPCError({ code: "BAD_REQUEST", message: `学员 ${participant.studentUserId}：${phaseError}` });
      const records = group.records.filter((row) => row.caseId === ownerCase.id);
      if (records.length > 1) throw new TRPCError({ code: "CONFLICT", message: "小组成员原督学记录不唯一，请先核对历史数据" });
      const record = records[0];
      if (record) await tx.update(studySupervisionRecords).set({ visitAt: input.startAt, phase: nextPhase, status: "scheduled" })
        .where(and(eq(studySupervisionRecords.id, record.id), eq(studySupervisionRecords.caseId, ownerCase.id)));
      else if (participant.studentUserId === coachingCase.studentUserId && session.supervisionId) {
        await tx.update(studySupervisionRecords).set({ visitAt: input.startAt, phase, status: "scheduled" })
          .where(and(eq(studySupervisionRecords.id, session.supervisionId), eq(studySupervisionRecords.caseId, ownerCase.id)));
      }
    }
    // 改期不改变原课堂形式变更的依据与确认人；改期原因单独进入历史事件。
    await tx.update(courseSessions).set({ startAt: input.startAt, phase, status: "scheduled", changeReason: why }).where(eq(courseSessions.id, session.id));
    await tx.insert(coachingSessionEvents).values({ orgId: session.orgId, caseId: session.caseId, sessionId: session.id, action: "rescheduled",
      previousStartAt: session.startAt, nextStartAt: input.startAt, previousStatus: session.status, nextStatus: "scheduled",
      snapshot: { session, units, participants } as unknown as Record<string, unknown>, reason: why, actorUserId: me.id });
    await audit(tx, session.caseId, me.id, `课堂 #${session.id} 已改期，原因：${why}`);
    return { sessionId: session.id, status: "scheduled" as const };
  });
}

export async function cancelCourseSession(db: Db, me: StaffUser, input: { sessionId: number; reason: string }) {
  const [original] = await db.select().from(courseSessions).where(eq(courseSessions.id, input.sessionId)).limit(1);
  if (!original) throw new TRPCError({ code: "NOT_FOUND", message: "课堂不存在" });
  await assertCaseAccess(db, me, original.caseId);
  const why = reason(input.reason);
  return db.transaction(async (tx) => {
    const [session] = await tx.select().from(courseSessions).where(eq(courseSessions.id, input.sessionId)).limit(1).for("update");
    if (!session || session.orgId !== original.orgId || session.caseId !== original.caseId) throw new TRPCError({ code: "NOT_FOUND", message: "课堂不存在或与主档不匹配" });
    if (session.status === "cancelled") return { sessionId: session.id, duplicate: true as const };
    if (session.status === "completed") throw new TRPCError({ code: "CONFLICT", message: "已完成课堂属于历史事实，不能取消；如需更正请追加记录" });
    const [units, participants] = await Promise.all([
      tx.select().from(courseSessionUnits).where(eq(courseSessionUnits.sessionId, session.id)),
      tx.select().from(courseParticipants).where(eq(courseParticipants.sessionId, session.id)),
    ]);
    const now = new Date();
    const group = await groupSupervisionRows(tx, session, participants);
    for (const ownerCase of group.ownerCases) {
      await assertStudentAccess(db, me, ownerCase.studentUserId);
      const records = group.records.filter((row) => row.caseId === ownerCase.id);
      if (records.length > 1) throw new TRPCError({ code: "CONFLICT", message: "小组成员原督学记录不唯一，请先核对历史数据" });
      if (records[0]) await tx.update(studySupervisionRecords).set({ status: "cancelled", cancelledAt: now, cancelReason: why })
        .where(and(eq(studySupervisionRecords.id, records[0].id), eq(studySupervisionRecords.caseId, ownerCase.id)));
    }
    if (session.supervisionId && !group.records.some((row) => row.id === session.supervisionId)) {
      await tx.update(studySupervisionRecords).set({ status: "cancelled", cancelledAt: now, cancelReason: why })
        .where(and(eq(studySupervisionRecords.id, session.supervisionId), eq(studySupervisionRecords.caseId, session.caseId)));
    }
    await tx.update(courseSessions).set({ status: "cancelled", cancelledAt: now, cancelReason: why, cancelledBy: me.id }).where(eq(courseSessions.id, session.id));
    await tx.insert(coachingSessionEvents).values({ orgId: session.orgId, caseId: session.caseId, sessionId: session.id, action: "cancelled",
      previousStartAt: session.startAt, nextStartAt: session.startAt, previousStatus: session.status, nextStatus: "cancelled",
      snapshot: { session, units, participants } as unknown as Record<string, unknown>, reason: why, actorUserId: me.id });
    await audit(tx, session.caseId, me.id, `课堂 #${session.id} 已取消并保留原记录，原因：${why}`);
    return { sessionId: session.id, duplicate: false as const };
  });
}

async function editableSupervision(db: Db, me: StaffUser, supervisionId: number): Promise<{ record: typeof studySupervisionRecords.$inferSelect; coachingCase: CoachingCaseRow }> {
  const [record] = await db.select().from(studySupervisionRecords).where(eq(studySupervisionRecords.id, supervisionId)).limit(1);
  if (!record) throw new TRPCError({ code: "NOT_FOUND", message: "督学记录不存在" });
  const coachingCase = await assertCaseAccess(db, me, record.caseId);
  const [linked] = await db.select({ id: courseSessions.id }).from(courseSessions)
    .where(and(eq(courseSessions.supervisionId, supervisionId), eq(courseSessions.orgId, coachingCase.orgId))).limit(1);
  if (linked) throw new TRPCError({ code: "BAD_REQUEST", message: "该督学属于教练课堂，请从对应课堂改期或取消" });
  return { record, coachingCase };
}

export async function rescheduleSupervision(db: Db, me: StaffUser, input: { supervisionId: number; visitAt: Date; reason: string }) {
  const { record, coachingCase } = await editableSupervision(db, me, input.supervisionId);
  const why = reason(input.reason);
  if (["completed", "cancelled"].includes(record.status)) throw new TRPCError({ code: "CONFLICT", message: "已完成或已取消督学不能改期，请另建记录" });
  await db.update(studySupervisionRecords).set({ visitAt: input.visitAt, phase: phaseForVisit(coachingCase.serviceStart, input.visitAt), status: "scheduled", followUp: `${record.followUp}\n改期原因：${why}`.trim() })
    .where(and(eq(studySupervisionRecords.id, record.id), eq(studySupervisionRecords.caseId, coachingCase.id)));
  await db.insert(coachingEvents).values({ caseId: record.caseId, actorUserId: me.id, type: "supervision_rescheduled", content: `督学 #${record.id} 已改期，原因：${why}`, visibility: "internal" });
  return { supervisionId: record.id, status: "scheduled" as const };
}

export async function cancelSupervision(db: Db, me: StaffUser, input: { supervisionId: number; reason: string }) {
  const { record, coachingCase } = await editableSupervision(db, me, input.supervisionId);
  const why = reason(input.reason);
  if (record.status === "cancelled") return { supervisionId: record.id, duplicate: true as const };
  if (record.status === "completed") throw new TRPCError({ code: "CONFLICT", message: "已完成督学属于历史事实，不能取消；如需更正请追加记录" });
  await db.update(studySupervisionRecords).set({ status: "cancelled", cancelledAt: new Date(), cancelReason: why })
    .where(and(eq(studySupervisionRecords.id, record.id), eq(studySupervisionRecords.caseId, coachingCase.id)));
  await db.insert(coachingEvents).values({ caseId: record.caseId, actorUserId: me.id, type: "supervision_cancelled", content: `督学 #${record.id} 已取消并保留原记录，原因：${why}`, visibility: "internal" });
  return { supervisionId: record.id, duplicate: false as const };
}

export async function courseSessionHistory(db: Db, me: StaffUser, sessionId: number) {
  const [session] = await db.select({ id: courseSessions.id, orgId: courseSessions.orgId, caseId: courseSessions.caseId })
    .from(courseSessions).where(eq(courseSessions.id, sessionId)).limit(1);
  if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "课堂不存在" });
  await assertCaseAccess(db, me, session.caseId);
  const events = await db.select({ id: coachingSessionEvents.id, action: coachingSessionEvents.action,
    previousStartAt: coachingSessionEvents.previousStartAt, nextStartAt: coachingSessionEvents.nextStartAt,
    previousStatus: coachingSessionEvents.previousStatus, nextStatus: coachingSessionEvents.nextStatus,
    reason: coachingSessionEvents.reason, actorUserId: coachingSessionEvents.actorUserId, createdAt: coachingSessionEvents.createdAt,
    actorName: users.name }).from(coachingSessionEvents).leftJoin(users, eq(coachingSessionEvents.actorUserId, users.id))
    .where(and(eq(coachingSessionEvents.sessionId, session.id), eq(coachingSessionEvents.orgId, session.orgId))).orderBy(coachingSessionEvents.id);
  return events;
}
