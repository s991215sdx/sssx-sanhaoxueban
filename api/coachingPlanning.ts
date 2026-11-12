import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { assessmentResults, coachingCases, coachingDeliverableRecipients, coachingEvents, coachingGrowProfiles, coachingGrowReportLinks,
  coachingGuardianGrants, coachingHandoffs, coachingPlanConfirmations, coachingPlans, coachingTasks, users } from "@db/schema";
import type { getDb } from "./queries/connection";
import type { PointTx } from "./orgPoints";
import { assertCaseAccess, type CoachingCaseRow } from "./coachingAccess";
import type { StaffUser } from "./orgAccess";
import { assertAssessmentReportAccess } from "./assessmentReports";
import { grantFamilyResourcesTx, queueFamilyResourceNotifications } from "./coachingRecipients";

type Db = ReturnType<typeof getDb>;
type QueryDb = Db | PointTx;

export type GrowProfileInput = {
  caseId: number; studentGoal: string; parentExpectation: string; targetSchool?: string; targetDate?: string | null;
  targetSubjects: { subject: string; baseline: string; target: string }[]; currentSituation: string; evidence: string;
  followUpActions: string; nextContactAt?: Date | null; retestDueAt?: Date | null; changeReason?: string;
  reportLinks: { resultId: number; conclusion: string; evidence: string; trainingSuggestion: string; cycle: string; ownerId: number; reviewAt: Date }[];
};
const required = (value: string | undefined, label: string) => {
  const text = value?.trim() ?? "";
  if (text.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: `请填写${label}` });
  return text;
};

export async function saveCoachingGrowProfile(db: Db, me: StaffUser, input: GrowProfileInput) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  const studentGoal = required(input.studentGoal, "学生自己的目标");
  const parentExpectation = required(input.parentExpectation, "家长期待，不能用学生目标代替");
  const currentSituation = required(input.currentSituation, "现状评估");
  const evidence = required(input.evidence, "现状证据");
  const followUpActions = required(input.followUpActions, "后续沟通与行动");
  if (input.targetSubjects.some((row) => !row.subject.trim() || !row.baseline.trim() || !row.target.trim())) throw new TRPCError({ code: "BAD_REQUEST", message: "学科目标须同时填写学科、起点与目标" });
  const links = input.reportLinks ?? [];
  if (new Set(links.map((row) => row.resultId)).size !== links.length) throw new TRPCError({ code: "BAD_REQUEST", message: "同一份测评不能重复关联" });
  for (const link of links) {
    required(link.conclusion, "测评结论"); required(link.evidence, "结论依据"); required(link.trainingSuggestion, "训练建议"); required(link.cycle, "训练周期");
    if (![coachingCase.coachId, coachingCase.supervisorId].includes(link.ownerId)) throw new TRPCError({ code: "BAD_REQUEST", message: "依据跟进责任人须为本主档当前主教或督学" });
    const [result] = await db.select({ userId: assessmentResults.userId }).from(assessmentResults).where(eq(assessmentResults.id, link.resultId)).limit(1);
    if (result?.userId !== coachingCase.studentUserId) throw new TRPCError({ code: "FORBIDDEN", message: "不能关联其他学员的测评结果" });
  }
  if (links.length) await assertAssessmentReportAccess(db, me, coachingCase.studentUserId);
  return db.transaction(async (tx) => {
    const [previous] = await tx.select().from(coachingGrowProfiles).where(and(eq(coachingGrowProfiles.caseId, input.caseId), eq(coachingGrowProfiles.orgId, coachingCase.orgId)))
      .orderBy(desc(coachingGrowProfiles.version)).limit(1).for("update");
    if (previous && (input.changeReason?.trim().length ?? 0) < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "更正结构化 GROW 须填写修改原因" });
    const version = (previous?.version ?? 0) + 1;
    const [{ id: profileId }] = await tx.insert(coachingGrowProfiles).values({ orgId: coachingCase.orgId, caseId: input.caseId, version,
      previousId: previous?.id ?? null, studentGoal, parentExpectation, targetSchool: input.targetSchool?.trim() ?? "", targetDate: input.targetDate || null,
      targetSubjects: input.targetSubjects, currentSituation, evidence, followUpActions, nextContactAt: input.nextContactAt ?? null,
      retestDueAt: input.retestDueAt ?? null, changeReason: input.changeReason?.trim() ?? "", createdBy: me.id }).$returningId();
    for (const link of links) {
      await tx.insert(coachingGrowReportLinks).values({ orgId: coachingCase.orgId, caseId: input.caseId, profileId, resultId: link.resultId,
        conclusion: link.conclusion.trim(), evidence: link.evidence.trim(), trainingSuggestion: link.trainingSuggestion.trim(), cycle: link.cycle.trim(),
        ownerId: link.ownerId, reviewAt: link.reviewAt, createdBy: me.id });
    }
    await tx.update(coachingCases).set({ goal: studentGoal, currentSituation }).where(and(eq(coachingCases.id, input.caseId), eq(coachingCases.orgId, coachingCase.orgId)));
    await tx.insert(coachingEvents).values({ caseId: input.caseId, actorUserId: me.id, type: "structured_grow_saved",
      content: `学生目标、家长期待与 ${links.length} 份测评依据已保存为 V${version}`, visibility: "internal" });
    return { id: profileId, version };
  });
}

export async function coachingPlanningDetail(db: Db, me: StaffUser, caseId: number) {
  const coachingCase = await assertCaseAccess(db, me, caseId);
  const [growProfiles, growReportLinks, planConfirmations] = await Promise.all([
    db.select().from(coachingGrowProfiles).where(and(eq(coachingGrowProfiles.caseId, caseId), eq(coachingGrowProfiles.orgId, coachingCase.orgId))).orderBy(desc(coachingGrowProfiles.version)),
    db.select().from(coachingGrowReportLinks).where(and(eq(coachingGrowReportLinks.caseId, caseId), eq(coachingGrowReportLinks.orgId, coachingCase.orgId))).orderBy(desc(coachingGrowReportLinks.id)),
    db.select({ confirmation: coachingPlanConfirmations, name: users.name }).from(coachingPlanConfirmations)
      .leftJoin(users, eq(coachingPlanConfirmations.userId, users.id)).where(and(eq(coachingPlanConfirmations.caseId, caseId), eq(coachingPlanConfirmations.orgId, coachingCase.orgId))),
  ]);
  return { growProfiles, growReportLinks, planConfirmations };
}

export async function recordCoachPlanConfirmationTx(tx: PointTx, me: StaffUser, coachingCase: Pick<CoachingCaseRow, "id" | "orgId">, planId: number) {
  await tx.insert(coachingPlanConfirmations).values({ orgId: coachingCase.orgId, caseId: coachingCase.id, planId, role: "coach", userId: me.id, comment: "教练已核对目标、行动、责任人与复盘节点" });
}

export async function notifyPlanFamilyConfirmationTx(tx: PointTx, coachingCase: Pick<CoachingCaseRow, "id" | "orgId" | "studentUserId">, planId: number, actorUserId: number) {
  const recipients = [coachingCase.studentUserId, ...(await tx.select({ guardianUserId: coachingGuardianGrants.guardianUserId }).from(coachingGuardianGrants)
    .where(and(eq(coachingGuardianGrants.caseId, coachingCase.id), eq(coachingGuardianGrants.active, true)))).map((row) => row.guardianUserId)];
  const { queueCoachingNotification } = await import("./coachingNotifications");
  for (const recipientUserId of new Set(recipients)) {
    await queueCoachingNotification(tx, { orgId: coachingCase.orgId, caseId: coachingCase.id, recipientId: recipientUserId,
      type: "plan_confirmation", title: "有一份陪跑计划待你确认", body: "请进入陪跑反馈核对目标、行动和复盘节点，并完成本人确认。",
      idempotencyKey: `plan-confirm:${planId}:recipient:${recipientUserId}`, createdBy: actorUserId });
  }
}

export async function confirmCoachingPlan(db: Db, me: StaffUser, planId: number) {
  const [plan] = await db.select().from(coachingPlans).where(eq(coachingPlans.id, planId)).limit(1);
  if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "计划不存在" });
  const coachingCase = await assertCaseAccess(db, me, plan.caseId);
  if (plan.level === "month" ? me.role !== "admin" : ![coachingCase.coachId, coachingCase.supervisorId].includes(me.id)) {
    throw new TRPCError({ code: "FORBIDDEN", message: plan.level === "month" ? "下月计划仅管理员可提交家庭会签" : "只有本主档负责人可代表教练确认" });
  }
  return db.transaction(async (tx) => {
    const [current] = await tx.select().from(coachingPlans).where(eq(coachingPlans.id, planId)).limit(1).for("update");
    if (!current || current.status !== "draft") throw new TRPCError({ code: "CONFLICT", message: "该计划已提交确认，不能再代表家庭完成会签" });
    await recordCoachPlanConfirmationTx(tx, me, coachingCase, planId);
    await tx.update(coachingPlans).set({ status: "awaiting_family", confirmedBy: me.id, confirmedAt: new Date() }).where(eq(coachingPlans.id, planId));
    await tx.insert(coachingEvents).values({ caseId: plan.caseId, actorUserId: me.id, type: "plan_coach_confirmed", content: `计划 #${planId} 已教练确认，等待学生与家长会签`, visibility: "internal" });
    await notifyPlanFamilyConfirmationTx(tx, coachingCase, planId, me.id);
    return { id: planId, status: "awaiting_family" as const };
  });
}

async function familyPlanCase(db: QueryDb, userId: number, caseId: number) {
  const [coachingCase] = await db.select().from(coachingCases).where(eq(coachingCases.id, caseId)).limit(1);
  if (!coachingCase) throw new TRPCError({ code: "NOT_FOUND", message: "陪跑主档不存在" });
  if (userId === coachingCase.studentUserId) return coachingCase;
  const [grant] = await db.select().from(coachingGuardianGrants).where(and(eq(coachingGuardianGrants.caseId, caseId), eq(coachingGuardianGrants.guardianUserId, userId), eq(coachingGuardianGrants.active, true))).limit(1);
  if (!grant) throw new TRPCError({ code: "FORBIDDEN", message: "当前账号没有该主档的有效家庭授权" });
  return coachingCase;
}

export async function familyPendingPlans(db: Db, me: { id: number; role: string }, caseId: number) {
  if (me.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "请以学员或监护人账号确认计划" });
  await familyPlanCase(db, me.id, caseId);
  const plans = await db.select({ id: coachingPlans.id, level: coachingPlans.level, title: coachingPlans.title, content: coachingPlans.content,
    startDate: coachingPlans.startDate, endDate: coachingPlans.endDate, version: coachingPlans.version, createdAt: coachingPlans.createdAt }).from(coachingPlans)
    .where(and(eq(coachingPlans.caseId, caseId), eq(coachingPlans.status, "awaiting_family"))).orderBy(desc(coachingPlans.id));
  const confirmations = plans.length ? await db.select().from(coachingPlanConfirmations).where(and(eq(coachingPlanConfirmations.caseId, caseId), inArray(coachingPlanConfirmations.planId, plans.map((row) => row.id)))) : [];
  return plans.filter((plan) => confirmations.some((row) => row.planId === plan.id && row.role === "coach"))
    .map((plan) => ({ ...plan, myConfirmed: confirmations.some((row) => row.planId === plan.id && row.userId === me.id),
      studentConfirmed: confirmations.some((row) => row.planId === plan.id && row.role === "student"),
      guardianConfirmed: confirmations.some((row) => row.planId === plan.id && row.role === "guardian") }));
}

export async function confirmFamilyCoachingPlan(db: Db, me: { id: number; role: string }, input: { planId: number; comment?: string }) {
  if (me.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "请以学员或监护人账号会签" });
  const [raw] = await db.select({ plan: coachingPlans, coachingCase: coachingCases }).from(coachingPlans).innerJoin(coachingCases, eq(coachingPlans.caseId, coachingCases.id)).where(eq(coachingPlans.id, input.planId)).limit(1);
  if (!raw) throw new TRPCError({ code: "NOT_FOUND", message: "计划不存在" });
  const coachingCase = await familyPlanCase(db, me.id, raw.coachingCase.id);
  const role = me.id === coachingCase.studentUserId ? "student" : "guardian";
  return db.transaction(async (tx) => {
    const [plan] = await tx.select().from(coachingPlans).where(eq(coachingPlans.id, input.planId)).limit(1).for("update");
    if (!plan || plan.caseId !== coachingCase.id || plan.status !== "awaiting_family") throw new TRPCError({ code: "CONFLICT", message: "计划已完成确认或已更换版本，请刷新" });
    await familyPlanCase(tx, me.id, coachingCase.id);
    const previous = await tx.select().from(coachingPlanConfirmations).where(eq(coachingPlanConfirmations.planId, plan.id)).for("update");
    if (!previous.some((row) => row.role === "coach")) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "教练尚未确认，暂不能家庭会签" });
    if (previous.some((row) => row.role === role && row.userId === me.id)) return { id: plan.id, duplicate: true as const };
    await tx.insert(coachingPlanConfirmations).values({ orgId: coachingCase.orgId, caseId: coachingCase.id, planId: plan.id, role, userId: me.id, comment: input.comment?.trim() ?? "本人已阅读并确认" });
    const signatures = [...previous, { role, userId: me.id }];
    const studentSigned = signatures.some((row) => row.role === "student");
    const guardianSigned = signatures.some((row) => row.role === "guardian");
    await grantFamilyResourcesTx(tx, { coachingCase, resourceType: "plan", resourceIds: [plan.id], recipientUserIds: [me.id], actorUserId: me.id });
    if (studentSigned && guardianSigned) {
      await tx.update(coachingPlans).set({ status: "confirmed", issuedAt: new Date() }).where(eq(coachingPlans.id, plan.id));
      await queueFamilyResourceNotifications(tx, { coachingCase, resourceType: "plan", resourceId: plan.id,
        type: "plan_issued", title: "陪跑计划已三方确认", body: "你确认的计划已正式生效，可在陪跑反馈中查看。",
        idempotencyKey: `plan-issued:${plan.id}`, createdBy: me.id });
    }
    await tx.insert(coachingEvents).values({ caseId: coachingCase.id, actorUserId: me.id, type: "plan_family_confirmed",
      content: `计划 #${plan.id} 已${role === "student" ? "学生" : "一位监护人"}会签${studentSigned && guardianSigned ? "，三方会签完成并正式生效" : "，等待其余家庭角色确认"}`, visibility: "internal" });
    return { id: plan.id, duplicate: false as const, status: studentSigned && guardianSigned ? "confirmed" as const : "awaiting_family" as const };
  });
}

/** 只允许删除没有任何下游依赖的内部草稿；历史会签、授权与交付关系一律失败关闭。 */
export async function deleteCoachingPlan(db: Db, me: StaffUser, input: { caseId: number; planId: number }) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  return db.transaction(async (tx) => {
    const [plan] = await tx.select().from(coachingPlans).where(eq(coachingPlans.id, input.planId)).limit(1).for("update");
    if (!plan || plan.caseId !== coachingCase.id) throw new TRPCError({ code: "NOT_FOUND", message: "计划不存在或与当前主档不匹配" });
    if (plan.status !== "draft" || plan.issuedAt) throw new TRPCError({ code: "CONFLICT", message: "仅未提交会签、未生效的内部草稿可以删除" });
    const [children, tasks, confirmations, handoffs, recipients] = await Promise.all([
      tx.select({ id: coachingPlans.id }).from(coachingPlans).where(eq(coachingPlans.parentId, plan.id)).limit(1),
      tx.select({ id: coachingTasks.id }).from(coachingTasks).where(eq(coachingTasks.planId, plan.id)).limit(1),
      tx.select({ id: coachingPlanConfirmations.id }).from(coachingPlanConfirmations).where(eq(coachingPlanConfirmations.planId, plan.id)).limit(1),
      tx.select({ id: coachingHandoffs.id }).from(coachingHandoffs).where(eq(coachingHandoffs.nextPlanId, plan.id)).limit(1),
      tx.select({ id: coachingDeliverableRecipients.id }).from(coachingDeliverableRecipients)
        .where(and(eq(coachingDeliverableRecipients.resourceType, "plan"), eq(coachingDeliverableRecipients.resourceId, plan.id))).limit(1),
    ]);
    if ([children, tasks, confirmations, handoffs, recipients].some((rows) => rows.length)) {
      throw new TRPCError({ code: "CONFLICT", message: "该草稿已有下级计划、行动、会签、交接或接收授权记录，不能删除" });
    }
    const result = await tx.delete(coachingPlans).where(and(eq(coachingPlans.id, plan.id), eq(coachingPlans.caseId, coachingCase.id),
      eq(coachingPlans.status, "draft"), isNull(coachingPlans.issuedAt)));
    const affectedRows = typeof result === "object" && result !== null && "affectedRows" in result ? Number(result.affectedRows) : 1;
    if (affectedRows !== 1) throw new TRPCError({ code: "CONFLICT", message: "草稿状态已变化，请刷新后再试" });
    await tx.insert(coachingEvents).values({ caseId: coachingCase.id, actorUserId: me.id, type: "plan_draft_deleted",
      content: `已删除无依赖内部草稿 #${plan.id}：${plan.title} V${plan.version}`, visibility: "internal" });
    return { id: plan.id, deleted: true as const };
  });
}
