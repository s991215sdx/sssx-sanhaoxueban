import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { coachingCases, coachingEvents, coachingExtendedRecords, coachingGuardianGrants, users } from "@db/schema";
import type { getDb } from "./queries/connection";
import { assertCaseAccess, type CoachingCaseRow } from "./coachingAccess";
import type { StaffUser } from "./orgAccess";
import type { PointTx } from "./orgPoints";
import { decryptCoachingText, encryptCoachingText } from "./coachingCrypto";
import { assertFamilyRecipients, authorizedFamilyResources, familyRecipients, grantFamilyResourcesTx, queueFamilyResourceNotifications } from "./coachingRecipients";

type Db = ReturnType<typeof getDb>;
const short = z.string().trim().min(2).max(4000);
const long = z.string().trim().min(2).max(15000);
const optional = z.string().trim().max(15000).default("");
const id = z.number().int().positive();
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const recordStatus = z.enum(["draft", "pending", "completed", "verified", "missed", "closed", "cancelled"]);

export const PLANNING_STEPS = ["服务启动与资料核对", "学生目标访谈", "家长期待访谈", "全科成绩与排名口径", "选科与升学政策核对", "目标院校与专业初探", "综合测评结论核对", "优势与可用资源", "学习现状与关键卡点", "目标差距量化", "学期总目标", "学科分目标", "学习路径与课程组合", "前三个月一对一与督学", "后三个月形式评估", "家庭配合与沟通机制", "风险预案与复测节点", "三方确认与滚动复盘"] as const;

const fulltimeBlock = z.object({ taskFocus: short, studied: short, difficulty: short, blankFilling: short, previewHomework: short, timeBudget: short, keyTasks: short, tomorrowFirst: short });
const payloadSchemas = {
  planning: z.object({ steps: z.array(z.object({ no: z.number().int().min(1).max(18), done: z.boolean(), evidence: z.string().max(6000), nextAction: z.string().max(6000) })).length(18), studentGoal: short, parentExpectation: short, academicBaseline: long, pathway: long, reviewDate: date }).superRefine((value, ctx) => {
    value.steps.forEach((step, index) => { if (step.no !== index + 1) ctx.addIssue({ code: "custom", message: `规划课第 ${index + 1} 步编号不连续` }); if (step.done && step.evidence.trim().length < 2) ctx.addIssue({ code: "custom", message: `规划课第 ${index + 1} 步须记录完成依据` }); });
  }),
  parent_cycle: z.object({ guardianUserId: id, cycleStart: date, sessions: z.array(z.object({ topic: short, occurredAt: date, practice: short, observation: optional, nextAction: short })).min(1).max(8), relationshipGoal: short, familyFeedback: optional }),
  family_action: z.object({ guardianUserId: id.nullable(), responsibleUserId: id, action: short, evidence: optional, result: optional, verifiedBy: id.nullable() }),
  home_visit: z.object({ guardianUserId: id, address: short, contact: z.string().trim().min(5).max(120), participants: z.array(id).min(1).max(12), guardianConfirmed: z.literal(true), purpose: long, observations: long, nextActions: long }),
  fulltime: z.object({ blocks: z.tuple([fulltimeBlock, fulltimeBlock, fulltimeBlock]), signInAt: z.string().datetime(), signOutAt: z.string().datetime().nullable(), leaveReason: optional, makeupPlan: optional, handoffNote: optional }),
  holiday: z.object({ theme: short, overallPlan: long, dailyCheckins: z.array(z.object({ day: date, task: short, completed: z.boolean(), evidence: short })).min(1).max(92), familyFeedback: optional, outcome: optional, schoolHandoff: optional }),
  subject_review: z.object({ subject: short, examName: short, scoreFacts: short, knowledgeGap: long, methodGap: long, executionGap: long, correction: long, nextCheckDate: date }),
  four_line_review: z.object({ goalLine: long, academicLine: long, executionLine: long, familyLine: long, nextPhase: long, familyCommunicated: z.boolean() }),
  mindset_action: z.object({ growthTheme: short, studentReflection: long, action: short, evidence: short, nextStep: short }),
  pause: z.object({ effectiveDate: date, reason: long, resumeCondition: long, familyCommunicated: z.literal(true) }),
  resume: z.object({ effectiveDate: date, reason: long, catchUpPlan: long, familyCommunicated: z.literal(true) }),
  renewal: z.object({ nextStart: date, nextEnd: date, scope: long, feeAgreement: optional, familyConfirmed: z.literal(true) }),
  termination: z.object({ effectiveDate: date, reason: long, outstandingItems: optional, familyCommunicated: z.literal(true) }),
  closure_assessment: z.object({ beforeAfter: long, nextSteps: long, familyCommunication: long, continuationIntent: z.enum(["renew", "transfer", "stop"]), outcomeEvidence: long }),
  closure_interview: z.object({ interviewedAt: z.string().datetime(), participants: z.array(id).min(1), conclusion: long, handoffMaterials: long, familyQuestions: optional }),
  transfer_export: z.object({ destination: short, scope: z.array(z.enum(["plans", "sessions", "reports", "tasks"])).min(1), reason: long, familyAuthorized: z.literal(true) }),
  disposal: z.object({ deliverableId: id, reason: long, retentionChecked: z.literal(true) }),
} as const;

export const coachingRecordTypes = Object.keys(payloadSchemas) as (keyof typeof payloadSchemas)[];
export type CoachingRecordType = keyof typeof payloadSchemas;
export const coachingRecordInput = z.object({
  caseId: id, recordType: z.enum(coachingRecordTypes as [CoachingRecordType, ...CoachingRecordType[]]),
  periodKey: z.string().trim().min(2).max(32), title: z.string().trim().min(2).max(180),
  payload: z.record(z.string(), z.unknown()), status: recordStatus.default("completed"),
  ownerId: id.optional(), dueAt: z.date().nullable().optional(), changeReason: z.string().trim().max(500).optional(),
  recipientUserIds: z.array(id).max(30).optional(),
});

export function parseCoachingRecordPayload(recordType: CoachingRecordType, payload: unknown) {
  const parsed = payloadSchemas[recordType].safeParse(payload);
  if (!parsed.success) throw new TRPCError({ code: "BAD_REQUEST", message: parsed.error.issues[0]?.message ?? "结构化记录不完整" });
  if (recordType === "fulltime") {
    const typed = parsed.data as z.infer<typeof payloadSchemas.fulltime>;
    const missing = typed.blocks.some((block) => Object.values(block).some((value) => value.trim().length < 2));
    if (missing) throw new TRPCError({ code: "BAD_REQUEST", message: "全日制上午／下午／晚上三时段均须填写任务、学习、困难、补漏、预习作业、时间预算、重点与明日第一件事" });
  }
  return parsed.data as Record<string, unknown>;
}

function assertOwner(coachingCase: CoachingCaseRow, ownerId: number) {
  if (![coachingCase.coachId, coachingCase.supervisorId].includes(ownerId)) throw new TRPCError({ code: "BAD_REQUEST", message: "负责人须为本主档当前主教或督学" });
}

async function validateFamilyActors(db: Db, coachingCase: CoachingCaseRow, payload: Record<string, unknown>) {
  const ids = [payload.guardianUserId, payload.responsibleUserId, ...(Array.isArray(payload.participants) ? payload.participants : [])].filter((value): value is number => typeof value === "number" && value > 0);
  for (const userId of [...new Set(ids)]) {
    const [person] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, userId), isNull(users.deletedAt))).limit(1);
    const student = userId === coachingCase.studentUserId;
    const staff = person && [coachingCase.coachId, coachingCase.supervisorId].includes(userId);
    const [grant] = student || staff ? [] : await db.select({ id: coachingGuardianGrants.id }).from(coachingGuardianGrants)
      .where(and(eq(coachingGuardianGrants.caseId, coachingCase.id), eq(coachingGuardianGrants.guardianUserId, userId), eq(coachingGuardianGrants.active, true))).limit(1);
    if (!person || (!student && !staff && !grant)) throw new TRPCError({ code: "FORBIDDEN", message: "家庭行动参与人须为本主档学生、负责人或有效监护人" });
  }
}

export async function saveCoachingExtendedRecord(db: Db, me: StaffUser, raw: z.infer<typeof coachingRecordInput>) {
  const input = coachingRecordInput.parse(raw);
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  const payload = parseCoachingRecordPayload(input.recordType, input.payload);
  const ownerId = input.ownerId ?? me.id;
  assertOwner(coachingCase, ownerId);
  await validateFamilyActors(db, coachingCase, payload);
  if (["disposal", "transfer_export"].includes(input.recordType) && me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "数据转交与销毁仅本机构管理员可办理" });
  const sensitive = input.recordType === "home_visit";
  const recipients = input.recipientUserIds ? await assertFamilyRecipients(db, coachingCase, input.recipientUserIds) : [];
  if (sensitive && recipients.length) throw new TRPCError({ code: "FORBIDDEN", message: "家访地址、联系方式与记录不进入家庭公开内容" });
  if (input.recordType === "family_action" && !["draft", "pending"].includes(input.status)) throw new TRPCError({ code: "BAD_REQUEST", message: "家庭行动只能先保存为草稿或待办；须由责任人提交证据，再由伴学师从核验入口验收" });
  const now = new Date();
  return db.transaction(async (tx) => {
    if (input.recordType === "disposal") await disposeCoachingDeliverable(tx, coachingCase, Number(payload.deliverableId), me);
    const [previous] = await tx.select().from(coachingExtendedRecords)
      .where(and(eq(coachingExtendedRecords.caseId, input.caseId), eq(coachingExtendedRecords.orgId, coachingCase.orgId),
        eq(coachingExtendedRecords.recordType, input.recordType), eq(coachingExtendedRecords.periodKey, input.periodKey)))
      .orderBy(desc(coachingExtendedRecords.version)).limit(1).for("update");
    if (previous && (input.changeReason?.trim().length ?? 0) < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "同周期更正须填写原因，原版本不会覆盖" });
    const version = (previous?.version ?? 0) + 1;
    const [{ id }] = await tx.insert(coachingExtendedRecords).values({ orgId: coachingCase.orgId, caseId: input.caseId,
      recordType: input.recordType, periodKey: input.periodKey, title: input.title, payload: sensitive ? null : payload,
      payloadCiphertext: sensitive ? encryptCoachingText(JSON.stringify(payload)) : null, sensitive,
      status: input.status, version, previousId: previous?.id ?? null, ownerId, dueAt: input.dueAt ?? null,
      changeReason: input.changeReason?.trim() ?? "", createdBy: me.id, createdAt: now, updatedAt: now }).$returningId();
    if (recipients.length) {
      await grantFamilyResourcesTx(tx, { coachingCase, resourceType: "family_action", resourceIds: [id], recipientUserIds: recipients, actorUserId: me.id });
      await queueFamilyResourceNotifications(tx, { coachingCase, resourceType: "family_action", resourceId: id,
        recipientUserIds: recipients, type: "family_action_assigned", title: "新的家庭行动", body: "你有一项家庭行动待反馈，请进入陪跑反馈查看。",
        idempotencyKey: `family-action:${id}:v${version}`, createdBy: me.id });
    }
    if (input.recordType === "pause") await tx.update(coachingCases).set({ status: "paused" }).where(and(eq(coachingCases.id, input.caseId), eq(coachingCases.orgId, coachingCase.orgId)));
    if (input.recordType === "resume" || input.recordType === "renewal") await tx.update(coachingCases).set({ status: "active" }).where(and(eq(coachingCases.id, input.caseId), eq(coachingCases.orgId, coachingCase.orgId)));
    await tx.insert(coachingEvents).values({ caseId: input.caseId, actorUserId: me.id, type: `record_${input.recordType}`,
      content: `${input.title} V${version} · ${input.status}`, visibility: "internal" });
    return { id, version, status: input.status };
  });
}

async function disposeCoachingDeliverable(db: PointTx, coachingCase: CoachingCaseRow, deliverableId: number, me: StaffUser) {
  const { coachingDeliverables, coachingDeliverableRecipients } = await import("@db/schema");
  const [file] = await db.select().from(coachingDeliverables).where(eq(coachingDeliverables.id, deliverableId)).limit(1).for("update");
  if (!file || file.caseId !== coachingCase.id) throw new TRPCError({ code: "NOT_FOUND", message: "附件与当前主档不匹配" });
  if (file.disposedAt) throw new TRPCError({ code: "CONFLICT", message: "附件已销毁，请勿重复操作" });
  await db.update(coachingDeliverables).set({ mediaData: null, body: "", sizeBytes: 0, mimeType: null,
    disposedAt: new Date(), disposalReason: "管理员核验保留期限后销毁，保留最小审计索引", disposedBy: me.id }).where(eq(coachingDeliverables.id, file.id));
  await db.update(coachingDeliverableRecipients).set({ active: false, revokedAt: new Date(), revokedBy: me.id })
    .where(and(eq(coachingDeliverableRecipients.orgId, coachingCase.orgId), eq(coachingDeliverableRecipients.caseId, coachingCase.id),
      eq(coachingDeliverableRecipients.resourceType, "deliverable"), eq(coachingDeliverableRecipients.resourceId, file.id)));
}

export async function listCoachingExtendedRecords(db: Db, me: StaffUser, caseId: number, reveal = false) {
  const coachingCase = await assertCaseAccess(db, me, caseId);
  const rows = await db.select().from(coachingExtendedRecords).where(and(eq(coachingExtendedRecords.caseId, caseId), eq(coachingExtendedRecords.orgId, coachingCase.orgId)))
    .orderBy(asc(coachingExtendedRecords.recordType), desc(coachingExtendedRecords.periodKey), desc(coachingExtendedRecords.version)).limit(500);
  return projectCoachingRecords(rows, me.role === "admin" && reveal);
}

export function projectCoachingRecords(rows: (typeof coachingExtendedRecords.$inferSelect)[], reveal = false) {
  return rows.map((row) => {
    const { payloadCiphertext, ...safe } = row;
    let payload: Record<string, unknown> | null = row.sensitive ? null : row.payload;
    if (row.sensitive && reveal && payloadCiphertext) {
      try { payload = JSON.parse(decryptCoachingText(payloadCiphertext)) as Record<string, unknown>; }
      catch { throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "敏感记录无法解密，请由管理员检查数据保护配置" }); }
    }
    return { ...safe, payload, restricted: row.sensitive && !reveal };
  });
}

export async function revealCoachingExtendedRecords(db: Db, me: StaffUser, caseId: number) {
  if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "敏感记录仅本机构管理员可查看" });
  await assertCaseAccess(db, me, caseId);
  await db.insert(coachingEvents).values({ caseId, actorUserId: me.id, type: "sensitive_record_revealed", content: "管理员授权查看家访等敏感结构化记录", visibility: "internal" });
  return listCoachingExtendedRecords(db, me, caseId, true);
}

export async function familyCoachingActions(db: Db, me: { id: number; role: string }, caseId: number) {
  if (me.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "请以学员或监护人账号访问" });
  const [coachingCase] = await db.select().from(coachingCases).where(and(eq(coachingCases.id, caseId), inArray(coachingCases.status, ["active", "paused"]))).limit(1);
  if (!coachingCase) throw new TRPCError({ code: "NOT_FOUND", message: "陪跑主档不存在或已结课" });
  if (me.id !== coachingCase.studentUserId) {
    const [grant] = await db.select({ id: coachingGuardianGrants.id }).from(coachingGuardianGrants)
      .innerJoin(users, eq(coachingGuardianGrants.guardianUserId, users.id))
      .where(and(eq(coachingGuardianGrants.caseId, caseId), eq(coachingGuardianGrants.guardianUserId, me.id), eq(coachingGuardianGrants.active, true), isNull(users.deletedAt))).limit(1);
    if (!grant) throw new TRPCError({ code: "FORBIDDEN", message: "主档授权已失效" });
  } else {
    const [student] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, me.id), isNull(users.deletedAt))).limit(1);
    if (!student) throw new TRPCError({ code: "FORBIDDEN", message: "学员账号已停用" });
  }
  const rows = await db.select().from(coachingExtendedRecords).where(and(eq(coachingExtendedRecords.caseId, caseId), eq(coachingExtendedRecords.orgId, coachingCase.orgId), eq(coachingExtendedRecords.recordType, "family_action"))).orderBy(desc(coachingExtendedRecords.id));
  const allowed = await authorizedFamilyResources(db, coachingCase, "family_action", rows.map((row) => row.id), me.id);
  return rows.filter((row) => allowed.has(row.id)).map((row) => {
    const { payloadCiphertext, ...safe } = row;
    void payloadCiphertext;
    return safe;
  });
}

export async function submitFamilyActionFeedback(db: Db, me: { id: number; role: string }, input: { recordId: number; evidence: string; result: string }) {
  if (me.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "请以学员或监护人账号反馈" });
  const [record] = await db.select().from(coachingExtendedRecords).where(eq(coachingExtendedRecords.id, input.recordId)).limit(1);
  if (!record || record.recordType !== "family_action" || !record.payload) throw new TRPCError({ code: "NOT_FOUND", message: "家庭行动不存在" });
  const authorized = (await familyCoachingActions(db, me, record.caseId)).find((row) => row.id === record.id);
  if (!authorized) throw new TRPCError({ code: "FORBIDDEN", message: "该份家庭行动未授权给当前账号" });
  if (!["draft", "pending"].includes(record.status)) throw new TRPCError({ code: "CONFLICT", message: "结果已提交；如需更正，请联系伴学师追加新版本" });
  const payload = record.payload as { responsibleUserId?: number };
  if (payload.responsibleUserId !== me.id) throw new TRPCError({ code: "FORBIDDEN", message: "只有本行动的责任人可提交结果" });
  const evidence = input.evidence.trim(); const result = input.result.trim();
  if (evidence.length < 2 || result.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "请填写实际证据与结果，完成不等于伴学师已验收" });
  const nextPayload = { ...record.payload, evidence, result, submittedAt: new Date().toISOString() };
  await db.update(coachingExtendedRecords).set({ payload: nextPayload, status: "completed", updatedAt: new Date() }).where(eq(coachingExtendedRecords.id, record.id));
  await db.insert(coachingEvents).values({ caseId: record.caseId, actorUserId: me.id, type: "family_action_feedback", content: `家庭行动 #${record.id} 已提交结果，等待伴学师核验`, visibility: "internal" });
  return { ok: true as const, status: "completed" as const };
}

export async function verifyFamilyAction(db: Db, me: StaffUser, input: { recordId: number; verificationNote: string }) {
  const [record] = await db.select().from(coachingExtendedRecords).where(eq(coachingExtendedRecords.id, input.recordId)).limit(1);
  if (!record || record.recordType !== "family_action") throw new TRPCError({ code: "NOT_FOUND", message: "家庭行动不存在" });
  const coachingCase = await assertCaseAccess(db, me, record.caseId);
  if (![coachingCase.coachId, coachingCase.supervisorId].includes(me.id)) throw new TRPCError({ code: "FORBIDDEN", message: "仅本主档当前负责人可核验家庭行动" });
  if (record.status !== "completed" || !record.payload) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "责任人尚未提交完成证据，不能提前验收" });
  const payload = record.payload as { evidence?: string; result?: string };
  if ((payload.evidence?.trim().length ?? 0) < 2 || (payload.result?.trim().length ?? 0) < 2) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "家庭行动证据与结果不完整" });
  const note = input.verificationNote.trim();
  if (note.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "请填写核验结论" });
  await db.update(coachingExtendedRecords).set({ status: "verified", payload: { ...record.payload, verifiedBy: me.id, verificationNote: note, verifiedAt: new Date().toISOString() }, updatedAt: new Date() })
    .where(and(eq(coachingExtendedRecords.id, record.id), eq(coachingExtendedRecords.caseId, coachingCase.id), eq(coachingExtendedRecords.status, "completed")));
  await db.insert(coachingEvents).values({ caseId: record.caseId, actorUserId: me.id, type: "family_action_verified", content: `家庭行动 #${record.id} 已由伴学师核验`, visibility: "internal" });
  return { id: record.id, status: "verified" as const };
}

export { familyRecipients };
