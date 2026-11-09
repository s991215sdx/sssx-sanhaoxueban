import { TRPCError } from "@trpc/server";
import { and, desc, eq, isNull } from "drizzle-orm";
import {
  coachingCases, coachingDeliverables, coachingEvents, coachingExtendedRecords, coachingHandoffs,
  coachingMonthlyReports, coachingPlans,
} from "@db/schema";
import type { getDb } from "./queries/connection";
import type { PointTx } from "./orgPoints";
import type { StaffUser } from "./orgAccess";
import { assertCaseAccess, type CoachingCaseRow } from "./coachingAccess";
import { assertFamilyRecipients, authorizedFamilyResources, grantFamilyResourcesTx, queueFamilyResourceNotifications } from "./coachingRecipients";

type Db = ReturnType<typeof getDb>;
type QueryDb = Db | PointTx;
type HandoffRow = typeof coachingHandoffs.$inferSelect;
type FamilyUser = { id: number; role: string };

export type StageHandoffInput = {
  caseId: number;
  monthlyReportId: number;
  nextPlanId: number;
  recipientUserId: number;
  title: string;
  familyAction: string;
  dueAt: Date;
};

type FamilySnapshot = {
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

function required(value: string, message: string): string {
  const text = value.trim();
  if (text.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message });
  return text;
}

function changedRows(result: unknown): number {
  return typeof result === "object" && result !== null && "affectedRows" in result ? Number(result.affectedRows) : 1;
}

function assertFamilyStage(row: HandoffRow | undefined): asserts row is HandoffRow {
  if (!row || row.type !== "H5" || row.nextSupervisorId != null) throw new TRPCError({ code: "NOT_FOUND", message: "家庭阶段交接不存在" });
}

function linkedMaterialsComplete(row: HandoffRow): boolean {
  return Boolean(row.monthlyReportId && row.nextPlanId && row.familyActionId && row.attachmentId && row.familySnapshot);
}

/** 快照只复制家庭本就能看到的内容，不带质量评分、异常正文或心理原始答案。 */
function buildFamilySnapshot(
  report: typeof coachingMonthlyReports.$inferSelect,
  plan: typeof coachingPlans.$inferSelect,
  familyActionId: number,
  input: StageHandoffInput,
  pushedAt: Date,
): FamilySnapshot {
  if (!plan.issuedAt) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "下阶段计划尚未正式生效" });
  return {
    schemaVersion: 1,
    monthlyReport: {
      id: report.id, month: report.month, version: report.version,
      goalProgress: report.goalProgress, academicProgress: report.academicProgress,
      taskExecution: report.taskExecution, learningMethod: report.learningMethod, habitFamily: report.habitFamily,
      meetingNotes: report.meetingNotes, nextActions: report.nextActions, familyAction: report.familyAction,
      pushedAt: pushedAt.toISOString(),
    },
    nextPlan: {
      id: plan.id, level: plan.level, title: plan.title, content: plan.content,
      startDate: plan.startDate, endDate: plan.endDate, version: plan.version, issuedAt: plan.issuedAt.toISOString(),
    },
    familyAction: { id: familyActionId, responsibleUserId: input.recipientUserId, action: input.familyAction.trim(), dueAt: input.dueAt.toISOString() },
  };
}

function handoffDocument(handoffId: number, snapshot: FamilySnapshot): string {
  const { monthlyReport: report, nextPlan: plan, familyAction } = snapshot;
  return [
    `三好学伴 · 家庭阶段交接单 #${handoffId}`,
    "",
    `一、阶段月报：${report.month} · V${report.version}`,
    `目标推进：${report.goalProgress}`,
    `学业事实：${report.academicProgress}`,
    `任务执行：${report.taskExecution}`,
    `学习方法：${report.learningMethod}`,
    `习惯与家校协同：${report.habitFamily}`,
    report.meetingNotes ? `沟通纪要：${report.meetingNotes}` : "",
    `后续行动：${report.nextActions.map((item, index) => `${index + 1}. ${item}`).join("；")}`,
    "",
    `二、下阶段正式计划：${plan.title} · V${plan.version}`,
    `执行周期：${plan.startDate} 至 ${plan.endDate}`,
    plan.content,
    "",
    "三、家庭配合事",
    familyAction.action,
    `办理期限：${familyAction.dueAt}`,
    "",
    "本交接单由指定接收人在本人账号内阅读并确认。确认交接不等于已完成家庭行动，也不代替计划三方会签。",
  ].filter(Boolean).join("\n");
}

export async function createCoachingStageHandoff(db: Db, me: StaffUser, input: StageHandoffInput) {
  if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "仅机构管理员可发起家庭阶段交接" });
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  if (!["active", "paused"].includes(coachingCase.status)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "已结课或归档主档不能发起阶段交接" });
  const title = required(input.title, "请填写阶段交接标题");
  const familyAction = required(input.familyAction, "请填写下一阶段家庭配合事");
  if (!(input.dueAt instanceof Date) || Number.isNaN(input.dueAt.getTime())) throw new TRPCError({ code: "BAD_REQUEST", message: "请填写有效的办理期限" });
  await assertFamilyRecipients(db, coachingCase, [input.recipientUserId]);

  return db.transaction(async (tx) => {
    const [report] = await tx.select().from(coachingMonthlyReports).where(eq(coachingMonthlyReports.id, input.monthlyReportId)).limit(1).for("update");
    if (!report || report.caseId !== coachingCase.id || report.orgId !== coachingCase.orgId) throw new TRPCError({ code: "BAD_REQUEST", message: "所选月报不属于当前陪跑主档" });
    const [plan] = await tx.select().from(coachingPlans).where(eq(coachingPlans.id, input.nextPlanId)).limit(1).for("update");
    if (!plan || plan.caseId !== coachingCase.id) throw new TRPCError({ code: "BAD_REQUEST", message: "所选下阶段计划不属于当前陪跑主档" });
    if (plan.status !== "confirmed" || !plan.issuedAt || plan.cancelledAt) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "下阶段计划必须已完成三方会签并正式生效" });
    await assertFamilyRecipients(tx, coachingCase, [input.recipientUserId]);
    const duplicates = await tx.select({ id: coachingHandoffs.id, monthlyReportId: coachingHandoffs.monthlyReportId, nextPlanId: coachingHandoffs.nextPlanId })
      .from(coachingHandoffs).where(and(eq(coachingHandoffs.caseId, coachingCase.id), eq(coachingHandoffs.type, "H5"),
        isNull(coachingHandoffs.nextSupervisorId), eq(coachingHandoffs.toUserId, input.recipientUserId), eq(coachingHandoffs.status, "pending"))).for("update");
    if (duplicates.some((row) => row.monthlyReportId === report.id && row.nextPlanId === plan.id)) {
      throw new TRPCError({ code: "CONFLICT", message: "同一接收人已有相同月报与计划的待确认交接，请勿重复发起" });
    }

    const now = new Date();
    const [{ id: handoffId }] = await tx.insert(coachingHandoffs).values({
      caseId: coachingCase.id, type: "H5", fromUserId: me.id, toUserId: input.recipientUserId,
      title, content: familyAction, dueAt: input.dueAt, status: "pending", nextSupervisorId: null,
    }).$returningId();
    const [{ id: familyActionId }] = await tx.insert(coachingExtendedRecords).values({
      orgId: coachingCase.orgId, caseId: coachingCase.id, recordType: "family_action", periodKey: `H5-${handoffId}`,
      title: `阶段交接 · ${title}`, payload: {
        guardianUserId: input.recipientUserId === coachingCase.studentUserId ? null : input.recipientUserId,
        responsibleUserId: input.recipientUserId, action: familyAction, evidence: "", result: "", verifiedBy: null, handoffId,
      }, payloadCiphertext: null, sensitive: false, status: "pending", version: 1,
      ownerId: coachingCase.supervisorId, dueAt: input.dueAt, createdBy: me.id, createdAt: now, updatedAt: now,
    }).$returningId();

    const pushedAt = report.pushedAt ?? now;
    if (!report.pushedAt) {
      const result = await tx.update(coachingMonthlyReports).set({ pushedAt: now, pushedBy: me.id })
        .where(and(eq(coachingMonthlyReports.id, report.id), isNull(coachingMonthlyReports.pushedAt)));
      if (changedRows(result) !== 1) throw new TRPCError({ code: "CONFLICT", message: "月报推送状态已变化，请刷新后重试" });
    }
    const snapshot = buildFamilySnapshot(report, plan, familyActionId, { ...input, title, familyAction }, pushedAt);
    const body = handoffDocument(handoffId, snapshot);
    const [{ id: attachmentId }] = await tx.insert(coachingDeliverables).values({
      caseId: coachingCase.id, sessionId: null, participantId: null, taskId: null,
      kind: "text", body, mediaData: null, mimeType: "text/plain;charset=utf-8", sizeBytes: Buffer.byteLength(body),
      visibility: "family", version: 1, uploadedBy: me.id, pushedAt: now, createdAt: now,
    }).$returningId();
    await tx.update(coachingHandoffs).set({ monthlyReportId: report.id, nextPlanId: plan.id, familyActionId, attachmentId, familySnapshot: snapshot })
      .where(eq(coachingHandoffs.id, handoffId));

    await grantFamilyResourcesTx(tx, { coachingCase, resourceType: "monthly_report", resourceIds: [report.id], recipientUserIds: [input.recipientUserId], actorUserId: me.id });
    await grantFamilyResourcesTx(tx, { coachingCase, resourceType: "plan", resourceIds: [plan.id], recipientUserIds: [input.recipientUserId], actorUserId: me.id });
    await grantFamilyResourcesTx(tx, { coachingCase, resourceType: "family_action", resourceIds: [familyActionId], recipientUserIds: [input.recipientUserId], actorUserId: me.id });
    await grantFamilyResourcesTx(tx, { coachingCase, resourceType: "deliverable", resourceIds: [attachmentId], recipientUserIds: [input.recipientUserId], actorUserId: me.id });
    if (!report.pushedAt) await tx.insert(coachingEvents).values({ caseId: coachingCase.id, actorUserId: me.id, type: "monthly_report_pushed",
      content: `${report.month} 月度学习报告 V${report.version} 随家庭阶段交接正式推送`, visibility: "internal" });
    await tx.insert(coachingEvents).values({ caseId: coachingCase.id, actorUserId: me.id, type: "stage_handoff_created",
      content: `H5 家庭阶段交接 #${handoffId} 已关联月报 V${report.version}、正式计划 V${plan.version}、家庭行动 #${familyActionId} 与交接单 #${attachmentId}`, visibility: "internal" });
    await queueFamilyResourceNotifications(tx, { coachingCase, resourceType: "deliverable", resourceId: attachmentId,
      recipientUserIds: [input.recipientUserId], type: "stage_handoff_assigned", title: "新的阶段交接待本人确认",
      body: "伴学主管已推送阶段月报、下阶段计划与家庭配合事，请进入陪跑反馈阅读并由本人确认。",
      idempotencyKey: `stage-handoff:${handoffId}`, createdBy: me.id });
    return { id: handoffId, familyActionId, attachmentId, status: "pending" as const };
  });
}

/** 快照也受逐份授权约束；撤销任一关联材料后，不再通过 H5 绕过授权读取副本。 */
async function accessibleFamilyHandoffs(db: QueryDb, coachingCase: CoachingCaseRow, rows: HandoffRow[], userId: number): Promise<HandoffRow[]> {
  const complete = rows.filter(linkedMaterialsComplete);
  const ids = (key: "monthlyReportId" | "nextPlanId" | "familyActionId" | "attachmentId") => complete.map((row) => row[key]!);
  const [reports, plans, actions, attachments] = await Promise.all([
    authorizedFamilyResources(db, coachingCase, "monthly_report", ids("monthlyReportId"), userId),
    authorizedFamilyResources(db, coachingCase, "plan", ids("nextPlanId"), userId),
    authorizedFamilyResources(db, coachingCase, "family_action", ids("familyActionId"), userId),
    authorizedFamilyResources(db, coachingCase, "deliverable", ids("attachmentId"), userId),
  ]);
  return complete.filter((row) => reports.has(row.monthlyReportId!) && plans.has(row.nextPlanId!) && actions.has(row.familyActionId!) && attachments.has(row.attachmentId!));
}

function publicFamilyHandoff(row: HandoffRow) {
  return {
    id: row.id, caseId: row.caseId, type: row.type, title: row.title, content: row.content,
    dueAt: row.dueAt, status: row.status, acceptedAt: row.acceptedAt, createdAt: row.createdAt,
    monthlyReportId: row.monthlyReportId, nextPlanId: row.nextPlanId, familyActionId: row.familyActionId,
    attachmentId: row.attachmentId, familySnapshot: row.familySnapshot,
    acceptedChannel: row.acceptedChannel, acceptedComment: row.acceptedComment,
  };
}

export async function familyCoachingStageHandoffs(db: Db, me: FamilyUser, caseId: number) {
  if (me.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "请以学员或监护人账号查看" });
  const [coachingCase] = await db.select().from(coachingCases).where(eq(coachingCases.id, caseId)).limit(1);
  if (!coachingCase) throw new TRPCError({ code: "NOT_FOUND", message: "陪跑主档不存在" });
  await assertFamilyRecipients(db, coachingCase, [me.id]);
  const rows = await db.select().from(coachingHandoffs).where(and(eq(coachingHandoffs.caseId, caseId),
    eq(coachingHandoffs.type, "H5"), isNull(coachingHandoffs.nextSupervisorId), eq(coachingHandoffs.toUserId, me.id)))
    .orderBy(desc(coachingHandoffs.id)).limit(50);
  return (await accessibleFamilyHandoffs(db, coachingCase, rows, me.id)).map(publicFamilyHandoff);
}

export async function acceptFamilyCoachingStageHandoff(db: Db, me: FamilyUser, input: { handoffId: number; comment?: string }) {
  if (me.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "请以学员或监护人本人账号确认" });
  const [original] = await db.select().from(coachingHandoffs).where(eq(coachingHandoffs.id, input.handoffId)).limit(1);
  assertFamilyStage(original);
  if (original.toUserId !== me.id) throw new TRPCError({ code: "FORBIDDEN", message: "只能由指定接收人本人账号确认，不能代办或代签" });
  if (original.status !== "pending") throw new TRPCError({ code: "CONFLICT", message: "该阶段交接已确认或已取消，请勿重复操作" });
  const [coachingCase] = await db.select().from(coachingCases).where(eq(coachingCases.id, original.caseId)).limit(1);
  if (!coachingCase) throw new TRPCError({ code: "NOT_FOUND", message: "陪跑主档不存在" });
  await assertFamilyRecipients(db, coachingCase, [me.id]);

  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(coachingHandoffs).where(eq(coachingHandoffs.id, input.handoffId)).limit(1).for("update");
    assertFamilyStage(current);
    if (current.toUserId !== me.id) throw new TRPCError({ code: "FORBIDDEN", message: "只能由指定接收人本人账号确认" });
    if (current.status !== "pending") throw new TRPCError({ code: "CONFLICT", message: "交接状态已变化，请刷新后再操作" });
    if (!linkedMaterialsComplete(current)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "交接材料不完整，请联系管理员重新发起" });
    await assertFamilyRecipients(tx, coachingCase, [me.id]);
    const accessible = await accessibleFamilyHandoffs(tx, coachingCase, [current], me.id);
    if (!accessible.length) throw new TRPCError({ code: "FORBIDDEN", message: "交接材料授权已撤销或失效，请联系伴学师重新推送" });
    const now = new Date();
    const result = await tx.update(coachingHandoffs).set({
      status: "accepted", acceptedAt: now, acceptedChannel: "in_app", acceptedComment: input.comment?.trim() ?? "",
    }).where(and(eq(coachingHandoffs.id, current.id), eq(coachingHandoffs.toUserId, me.id), eq(coachingHandoffs.status, "pending")));
    if (changedRows(result) !== 1) throw new TRPCError({ code: "CONFLICT", message: "交接状态已变化，请刷新后再操作" });
    await tx.insert(coachingEvents).values({ caseId: current.caseId, actorUserId: me.id, type: "stage_handoff_accepted",
      content: `H5 家庭阶段交接 #${current.id} 已由指定接收人本人账号站内确认；不代替家庭行动提交或计划会签`, visibility: "internal" });
    return { ok: true as const, status: "accepted" as const, acceptedAt: now };
  });
}
