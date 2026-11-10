import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNotNull, isNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import {
  assessmentResults, coachingCases, coachingCaseScenarios, coachingCheckins, coachingDeliverableRecipients, coachingDeliverables, coachingEvents, coachingGuardianGrants, coachingHandoffs,
  coachingMonthlyReports, coachingPlans, coachingReviews, coachingSessionEvents, coachingTasks, coachingTaskVerifications, courseCatalog, courseParticipants, courseSessions, courseSessionUnits,
  studentProfile, studentTutor, studySupervisionRecords, users,
} from "@db/schema";
import { COURSE_CATALOG, HANDOFF_TYPES, LEARNING_TRACE_KEYS, TECHNIQUE_LESSONS, coachingScenarioLabel, normalizeCoachingScenarios, phaseForVisit,
  validateDailyCheckin, validateSessionPhase, type DailyCheckinRuleInput } from "@contracts/orgService";
import type { getDb } from "./queries/connection";
import { assertStudentAccess, requireOrgStaff, type StaffUser } from "./orgAccess";
import type { PointTx } from "./orgPoints";
import { assertAssessmentReportAccess, hasAssessmentReportAccess } from "./assessmentReports";
import { assertCaseAccess, type CoachingCaseRow } from "./coachingAccess";
import { listCoachingExceptions } from "./coachingExceptions";
import { getCoachingClosureReadiness } from "./coachingLifecycle";
import { queueCoachingNotification } from "./coachingNotifications";
import { coachingPlanningDetail, notifyPlanFamilyConfirmationTx, recordCoachPlanConfirmationTx } from "./coachingPlanning";
import { authorizedFamilyResources, familyRecipients, grantFamilyResourcesTx, queueFamilyResourceNotifications } from "./coachingRecipients";
import { listCoachingExtendedRecords } from "./coachingExtended";
import { validateCoachingMedia } from "./coachingMedia";
import { assertCoachingCapacity, getCoachingDeliverySettings, recordCapacityOverride } from "./coachingDelivery";

export { assertCaseAccess } from "./coachingAccess";
export { acceptHandoff, reassignCoachingCase, setCoachingStatus } from "./coachingLifecycle";

type Db = ReturnType<typeof getDb>;
type CaseRow = CoachingCaseRow;
export type SessionInput = {
  caseId: number; sessionId?: number; startAt: Date; format: "one_to_one" | "salon" | "workshop" | "mixed";
  status: "draft" | "scheduled" | "completed"; changeReason?: string; lateChangeConfirmed?: boolean; sharedSummary?: string;
  supervision: { selfStudyMinutes?: number; alignment?: string; checks?: string; exitCheck?: string; followUp?: string;
    signInAt?: Date | null; signOutAt?: Date | null; timeBlocks?: Record<string, unknown>[]; leaveReason?: string; makeupPlan?: string; handoffNote?: string };
  units: { courseKey: string; lessonNo?: number | null; title: string; learningPoints?: string; practiceEvidence?: string }[];
  participants: { studentUserId: number; guardianLabel?: string; guardianUserId?: number | null; attendance?: string; personalObservation?: string; privateNote?: string; feedbackText?: string;
    action?: { title: string; detail?: string; dueDate: string } }[];
};

function required(value: string | undefined, message: string): string {
  const text = value?.trim() ?? "";
  if (!text) throw new TRPCError({ code: "BAD_REQUEST", message });
  return text;
}

async function event(tx: PointTx, caseId: number, actorUserId: number, type: string, content: string, visibility = "internal") {
  await tx.insert(coachingEvents).values({ caseId, actorUserId, type, content, visibility });
}

export async function ensureCourseCatalog(db: Db, orgId: number) {
  for (const course of COURSE_CATALOG) {
    await db.insert(courseCatalog).values({ orgId, courseKey: course.key, version: "1.0", title: course.title,
      audience: course.audience, purpose: course.purpose, description: course.description, rhythm: course.rhythm,
      outline: course.key === "method" ? TECHNIQUE_LESSONS.map(([lessonNo, title, content]) => ({ lessonNo, title, content })) : [] })
      .onDuplicateKeyUpdate({ set: { version: "1.0", title: course.title, audience: course.audience, purpose: course.purpose,
        description: course.description, rhythm: course.rhythm,
        outline: course.key === "method" ? TECHNIQUE_LESSONS.map(([lessonNo, title, content]) => ({ lessonNo, title, content })) : [] } });
  }
}

export async function listCoachingCases(db: Db, me: StaffUser) {
  const orgId = requireOrgStaff(me);
  const rows = await db.select({ coachingCase: coachingCases, studentName: users.name, grade: studentProfile.grade }).from(coachingCases)
    .leftJoin(users, eq(coachingCases.studentUserId, users.id)).leftJoin(studentProfile, eq(coachingCases.studentUserId, studentProfile.userId))
    .where(eq(coachingCases.orgId, orgId)).orderBy(desc(coachingCases.updatedAt)).limit(150);
  let visibleRows = rows;
  if (me.role !== "admin") {
    const [links, profiles] = await Promise.all([
      db.select({ studentUserId: studentTutor.studentUserId }).from(studentTutor).where(eq(studentTutor.tutorUserId, me.id)),
      db.select({ userId: studentProfile.userId }).from(studentProfile).where(eq(studentProfile.tutorId, me.id)),
    ]);
    const allowed = new Set([...links.map((l) => l.studentUserId), ...profiles.map((p) => p.userId)]);
    visibleRows = rows.filter((r) => r.coachingCase.coachId === me.id || r.coachingCase.supervisorId === me.id || allowed.has(r.coachingCase.studentUserId));
  }
  const caseIds = visibleRows.map((row) => row.coachingCase.id);
  const scenarioRows = caseIds.length ? await db.select({ caseId: coachingCaseScenarios.caseId, scenario: coachingCaseScenarios.scenario })
    .from(coachingCaseScenarios).where(and(inArray(coachingCaseScenarios.caseId, caseIds), eq(coachingCaseScenarios.orgId, orgId), isNull(coachingCaseScenarios.endedAt))) : [];
  const grouped = new Map<number, string[]>();
  for (const row of scenarioRows) grouped.set(row.caseId, [...(grouped.get(row.caseId) ?? []), row.scenario]);
  return visibleRows.map((row) => ({ ...row, serviceScenarios: normalizeCoachingScenarios(grouped.get(row.coachingCase.id) ?? []) }));
}

export async function coachingCaseDetail(db: Db, me: StaffUser, caseId: number) {
  const coachingCase = await assertCaseAccess(db, me, caseId);
  const [plans, tasks, reviews, checkins, handoffs, events, supervisions, sessions, deliverables, guardians, results, catalog] = await Promise.all([
    db.select().from(coachingPlans).where(eq(coachingPlans.caseId, caseId)).orderBy(desc(coachingPlans.id)),
    db.select().from(coachingTasks).where(eq(coachingTasks.caseId, caseId)).orderBy(asc(coachingTasks.dueDate), desc(coachingTasks.id)),
    db.select().from(coachingReviews).where(eq(coachingReviews.caseId, caseId)).orderBy(desc(coachingReviews.id)),
    db.select().from(coachingCheckins).where(and(eq(coachingCheckins.caseId, caseId), eq(coachingCheckins.orgId, coachingCase.orgId)))
      .orderBy(desc(coachingCheckins.checkDate), desc(coachingCheckins.version), desc(coachingCheckins.id)),
    db.select().from(coachingHandoffs).where(eq(coachingHandoffs.caseId, caseId)).orderBy(desc(coachingHandoffs.id)),
    db.select().from(coachingEvents).where(eq(coachingEvents.caseId, caseId)).orderBy(desc(coachingEvents.id)).limit(150),
    db.select().from(studySupervisionRecords).where(eq(studySupervisionRecords.caseId, caseId)).orderBy(desc(studySupervisionRecords.visitAt)),
    (async () => {
      const [own, joined] = await Promise.all([
        db.select().from(courseSessions).where(eq(courseSessions.caseId, caseId)),
        db.select({ session: courseSessions }).from(courseSessions)
          .innerJoin(courseParticipants, eq(courseParticipants.sessionId, courseSessions.id))
          .where(and(eq(courseParticipants.studentUserId, coachingCase.studentUserId), eq(courseSessions.orgId, coachingCase.orgId))),
      ]);
      const unique = new Map<number, typeof courseSessions.$inferSelect>();
      for (const row of own) unique.set(row.id, row);
      for (const row of joined) unique.set(row.session.id, row.session);
      return [...unique.values()].sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
    })(),
    db.select({ id: coachingDeliverables.id, caseId: coachingDeliverables.caseId, sessionId: coachingDeliverables.sessionId,
      participantId: coachingDeliverables.participantId, taskId: coachingDeliverables.taskId, kind: coachingDeliverables.kind,
      body: coachingDeliverables.body, mimeType: coachingDeliverables.mimeType, sizeBytes: coachingDeliverables.sizeBytes,
      visibility: coachingDeliverables.visibility, version: coachingDeliverables.version, previousId: coachingDeliverables.previousId,
      pushedAt: coachingDeliverables.pushedAt, disposedAt: coachingDeliverables.disposedAt, createdAt: coachingDeliverables.createdAt })
      .from(coachingDeliverables).where(eq(coachingDeliverables.caseId, caseId)).orderBy(desc(coachingDeliverables.id)),
    db.select({ grant: coachingGuardianGrants, name: users.name }).from(coachingGuardianGrants)
      .leftJoin(users, eq(coachingGuardianGrants.guardianUserId, users.id)).where(eq(coachingGuardianGrants.caseId, caseId)),
    db.select({ id: assessmentResults.id, kind: assessmentResults.kind, createdAt: assessmentResults.createdAt })
      .from(assessmentResults).where(eq(assessmentResults.userId, coachingCase.studentUserId)).orderBy(desc(assessmentResults.id)),
    db.select().from(courseCatalog).where(and(eq(courseCatalog.orgId, coachingCase.orgId), eq(courseCatalog.active, true))),
  ]);
  const sessionIds = sessions.map((s) => s.id);
  const [units, participants] = sessionIds.length ? await Promise.all([
    db.select().from(courseSessionUnits).where(inArray(courseSessionUnits.sessionId, sessionIds)),
    db.select({ participant: courseParticipants, studentName: users.name }).from(courseParticipants)
      .leftJoin(users, eq(courseParticipants.studentUserId, users.id))
      .where(and(inArray(courseParticipants.sessionId, sessionIds), eq(courseParticipants.studentUserId, coachingCase.studentUserId))),
  ]) : [[], []];
  const [reportAllowed, verificationHistory, scenarioHistory, exceptions, closureReadiness, planning, extendedRecords, recipients, resourceRecipients] = await Promise.all([
    hasAssessmentReportAccess(db, me, coachingCase.studentUserId),
    db.select().from(coachingTaskVerifications).where(eq(coachingTaskVerifications.caseId, caseId)).orderBy(asc(coachingTaskVerifications.taskId), desc(coachingTaskVerifications.version)),
    db.select().from(coachingCaseScenarios).where(eq(coachingCaseScenarios.caseId, caseId)).orderBy(desc(coachingCaseScenarios.startedAt), desc(coachingCaseScenarios.id)),
    listCoachingExceptions(db, me, coachingCase),
    getCoachingClosureReadiness(db, me, caseId),
    coachingPlanningDetail(db, me, caseId),
    listCoachingExtendedRecords(db, me, caseId),
    familyRecipients(db, coachingCase),
    db.select().from(coachingDeliverableRecipients).where(and(eq(coachingDeliverableRecipients.orgId, coachingCase.orgId), eq(coachingDeliverableRecipients.caseId, caseId))),
  ]);
  const serviceScenarios = normalizeCoachingScenarios(scenarioHistory.filter((item) => !item.endedAt).map((item) => item.scenario));
  return { coachingCase, serviceScenarios, scenarioHistory, plans, tasks, reviews, checkins, handoffs, events, exceptions, supervisions,
    sessions: sessions.map((session) => ({ ...session, units: units.filter((u) => u.sessionId === session.id),
      participants: participants.filter((p) => p.participant.sessionId === session.id) })),
    deliverables, guardians, results: reportAllowed ? results : [], reportAllowed, verificationHistory, catalog, closureReadiness,
    planning, extendedRecords, recipients,
    resourceRecipients: resourceRecipients.filter((grant) => plans.some((plan) => plan.id === grant.resourceId && grant.resourceType === "plan")
      || deliverables.some((file) => file.id === grant.resourceId && grant.resourceType === "deliverable")
      || participants.some((entry) => entry.participant.id === grant.resourceId && grant.resourceType === "session_feedback")
      || extendedRecords.some((record) => record.id === grant.resourceId && grant.resourceType === "family_action")
      || grant.resourceType === "monthly_report") };
}

export async function syncCoachingScenariosTx(tx: PointTx, input: { caseId: number; orgId: number; actorUserId: number; scenarios: string[]; reason?: string }) {
  let next: string[];
  try {
    next = normalizeCoachingScenarios(input.scenarios);
  } catch {
    throw new TRPCError({ code: "BAD_REQUEST", message: "陪跑服务场景无效" });
  }
  if (!next.length) throw new TRPCError({ code: "BAD_REQUEST", message: "请至少选择一种陪跑服务场景" });
  const currentRows = await tx.select().from(coachingCaseScenarios)
    .where(and(eq(coachingCaseScenarios.caseId, input.caseId), isNull(coachingCaseScenarios.endedAt))).for("update");
  const current = new Set(currentRows.map((row) => row.scenario));
  const desired = new Set(next);
  const removedRows = currentRows.filter((row) => !desired.has(row.scenario));
  const added = next.filter((scenario) => !current.has(scenario));
  const reason = input.reason?.trim() ?? "";
  if (removedRows.length && reason.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "停用已有服务场景须填写调整原因" });
  if (!removedRows.length && !added.length) return { active: next, added: [], removed: [] };
  const now = new Date();
  for (const row of removedRows) {
    await tx.update(coachingCaseScenarios).set({ activeKey: null, endedAt: now, endedBy: input.actorUserId, changeReason: reason })
      .where(and(eq(coachingCaseScenarios.id, row.id), isNull(coachingCaseScenarios.endedAt)));
  }
  for (const scenario of added) {
    await tx.insert(coachingCaseScenarios).values({ caseId: input.caseId, orgId: input.orgId, scenario, activeKey: `${input.caseId}:${scenario}`,
      startedAt: now, createdBy: input.actorUserId, changeReason: reason, createdAt: now });
  }
  const removed = removedRows.map((row) => row.scenario);
  const changes = [added.length ? `新增 ${added.map(coachingScenarioLabel).join("、")}` : "", removed.length ? `停用 ${removed.map(coachingScenarioLabel).join("、")}` : ""].filter(Boolean).join("；");
  await event(tx, input.caseId, input.actorUserId, "scenario_changed", `${changes}${reason ? `；原因：${reason}` : ""}`);
  return { active: next, added, removed };
}

/** 结束场景是结课前的独立动作；可逐个或全部结束，不伪造成仍有一种在服务。 */
export async function endCoachingScenarios(db: Db, me: StaffUser, input: { caseId: number; scenarios: string[]; reason: string }) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  let selected: string[];
  try { selected = normalizeCoachingScenarios(input.scenarios); }
  catch { throw new TRPCError({ code: "BAD_REQUEST", message: "要结束的服务场景无效" }); }
  if (!selected.length || input.reason.trim().length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "请选择服务场景并填写结束原因" });
  return db.transaction(async (tx) => {
    const active = await tx.select().from(coachingCaseScenarios)
      .where(and(eq(coachingCaseScenarios.caseId, input.caseId), eq(coachingCaseScenarios.orgId, coachingCase.orgId), isNull(coachingCaseScenarios.endedAt))).for("update");
    const ending = active.filter((row) => selected.includes(row.scenario));
    if (!ending.length) throw new TRPCError({ code: "CONFLICT", message: "所选服务场景已经结束，请刷新后再操作" });
    const now = new Date();
    for (const row of ending) {
      await tx.update(coachingCaseScenarios).set({ activeKey: null, endedAt: now, endedBy: me.id, changeReason: input.reason.trim() })
        .where(and(eq(coachingCaseScenarios.id, row.id), isNull(coachingCaseScenarios.endedAt)));
    }
    await event(tx, input.caseId, me.id, "scenario_ended", `结束 ${ending.map((row) => coachingScenarioLabel(row.scenario)).join("、")}；原因：${input.reason.trim()}`);
    return { ended: ending.map((row) => row.scenario) };
  });
}

export async function createCoachingCase(db: Db, me: StaffUser, input: { studentUserId: number; scenarios: string[]; goal: string; currentSituation: string; planSummary: string; growForm?: Record<string, unknown> | null; serviceStart: string; serviceEnd: string; capacityOverrideReason?: string }) {
  const orgId = requireOrgStaff(me);
  await assertStudentAccess(db, me, input.studentUserId);
  if (Date.parse(input.serviceEnd) < Date.parse(input.serviceStart)) throw new TRPCError({ code: "BAD_REQUEST", message: "结束日期不能早于开始日期" });
  await ensureCourseCatalog(db, orgId);
  await assertCoachingCapacity(db, { orgId, staffIds: [me.id], actor: me, overrideReason: input.capacityOverrideReason });
  const [old] = await db.select({ id: coachingCases.id }).from(coachingCases).where(and(eq(coachingCases.orgId, orgId), eq(coachingCases.studentUserId, input.studentUserId))).limit(1);
  if (old) return { caseId: old.id, duplicate: true as const };
  return db.transaction(async (tx) => {
    await assertCoachingCapacity(tx, { orgId, staffIds: [me.id], actor: me, overrideReason: input.capacityOverrideReason });
    const [{ id }] = await tx.insert(coachingCases).values({ orgId, studentUserId: input.studentUserId, coachId: me.id, supervisorId: me.id,
      scenario: "新生接手", goal: required(input.goal, "请先明确陪跑目标"), currentSituation: required(input.currentSituation, "请评估学员现状"),
      planSummary: required(input.planSummary, "请定制陪跑计划"), growForm: input.growForm ?? null,
      serviceStart: input.serviceStart, serviceEnd: input.serviceEnd }).$returningId();
    await syncCoachingScenariosTx(tx, { caseId: id, orgId, actorUserId: me.id, scenarios: input.scenarios, reason: "建立陪跑主档" });
    const [plan] = await tx.insert(coachingPlans).values({ caseId: id, level: "term", title: "学期陪跑方案", content: input.planSummary,
      startDate: input.serviceStart, endDate: input.serviceEnd, status: "awaiting_family", confirmedBy: me.id, confirmedAt: new Date(), createdBy: me.id }).$returningId();
    await recordCoachPlanConfirmationTx(tx, me, { id, orgId } as CaseRow, plan.id);
    await notifyPlanFamilyConfirmationTx(tx, { id, orgId, studentUserId: input.studentUserId } as CaseRow, plan.id, me.id);
    await tx.insert(coachingHandoffs).values({ caseId: id, type: "H1", fromUserId: me.id, toUserId: me.id,
      title: "新生接手：目标、现状与方案交接", content: `目标：${input.goal}\n现状：${input.currentSituation}\n计划：${input.planSummary}` });
    await event(tx, id, me.id, "case_created", `创建陪跑主档（${input.scenarios.map(coachingScenarioLabel).join("＋")}），学期计划已教练确认，等待学生与家长会签`);
    await recordCapacityOverride(tx, id, me.id, input.capacityOverrideReason);
    return { caseId: id, duplicate: false as const };
  });
}

type SaveCoachingPlanInput = { caseId: number; level: "term" | "month" | "week" | "day"; parentId?: number | null; title: string; content: string; startDate: string; endDate: string; sourceResultId?: number | null; confirmed: boolean };

async function saveCoachingPlanTx(tx: PointTx, me: StaffUser, coachingCase: CaseRow, input: SaveCoachingPlanInput) {
  if (input.confirmed && ![coachingCase.coachId, coachingCase.supervisorId].includes(me.id)) throw new TRPCError({ code: "FORBIDDEN", message: "只有本主档负责人可提交教练确认；管理员可先保存草稿" });
  const previous = await tx.select({ version: coachingPlans.version }).from(coachingPlans)
    .where(and(eq(coachingPlans.caseId, input.caseId), eq(coachingPlans.level, input.level))).orderBy(desc(coachingPlans.version)).limit(1).for("update");
  const version = (previous[0]?.version ?? 0) + 1;
  const [{ id }] = await tx.insert(coachingPlans).values({ caseId: input.caseId, parentId: input.parentId ?? null, level: input.level,
    title: required(input.title, "请填写计划名称"), content: input.content, startDate: input.startDate, endDate: input.endDate,
    sourceResultId: input.sourceResultId ?? null, version, status: input.confirmed ? "awaiting_family" : "draft",
    confirmedBy: input.confirmed ? me.id : null, confirmedAt: input.confirmed ? new Date() : null, issuedAt: null, createdBy: me.id }).$returningId();
  if (input.confirmed) {
    await recordCoachPlanConfirmationTx(tx, me, coachingCase, id);
    await notifyPlanFamilyConfirmationTx(tx, coachingCase, id, me.id);
  }
  if (input.level === "term") {
    await tx.update(coachingCases).set({ planSummary: input.content, scenario: version > 1 ? "方案调整" : coachingCase.scenario, version: coachingCase.version + 1 }).where(eq(coachingCases.id, input.caseId));
  }
  await event(tx, input.caseId, me.id, "plan_version", `${input.title} V${version}${input.confirmed ? " 已教练确认，待家庭会签" : " 保存草稿"}`);
  return { id, version, status: input.confirmed ? "awaiting_family" as const : "draft" as const };
}

async function assertPlanInCase(db: Db, caseId: number, planId: number, issuedOnly = false) {
  const [plan] = await db.select({ id: coachingPlans.id, caseId: coachingPlans.caseId, status: coachingPlans.status, issuedAt: coachingPlans.issuedAt }).from(coachingPlans).where(eq(coachingPlans.id, planId)).limit(1);
  if (plan?.caseId !== caseId) throw new TRPCError({ code: "BAD_REQUEST", message: "关联计划与当前陪跑主档不匹配" });
  if (issuedOnly && (plan.status !== "confirmed" || !plan.issuedAt)) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "行动任务只能关联三方会签后正式生效的计划" });
}

export async function saveCoachingPlan(db: Db, me: StaffUser, input: SaveCoachingPlanInput) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  required(input.content, "计划内容不能为空");
  if (input.endDate < input.startDate) throw new TRPCError({ code: "BAD_REQUEST", message: "计划结束日期不能早于开始日期" });
  if (input.parentId != null) await assertPlanInCase(db, input.caseId, input.parentId);
  if (input.sourceResultId) {
    const [result] = await db.select({ userId: assessmentResults.userId }).from(assessmentResults).where(eq(assessmentResults.id, input.sourceResultId)).limit(1);
    if (result?.userId !== coachingCase.studentUserId) throw new TRPCError({ code: "FORBIDDEN", message: "不能关联其他学员的测评结果" });
    await assertAssessmentReportAccess(db, me, coachingCase.studentUserId);
  }
  return db.transaction((tx) => saveCoachingPlanTx(tx, me, coachingCase, input));
}

export async function updateGrow(db: Db, me: StaffUser, input: { caseId: number; goal: string; currentSituation: string; planSummary: string; growForm?: Record<string, unknown> | null; scenarios: string[]; scenarioChangeReason?: string; serviceStart: string; serviceEnd: string }) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  required(input.goal, "目标不能为空"); required(input.currentSituation, "现状评估不能为空"); required(input.planSummary, "计划不能为空");
  if (input.serviceEnd < input.serviceStart) throw new TRPCError({ code: "BAD_REQUEST", message: "结束日期不能早于开始日期" });
  return db.transaction(async (tx) => {
    await tx.update(coachingCases).set({ goal: input.goal.trim(), currentSituation: input.currentSituation.trim(),
      growForm: input.growForm ?? null,
      serviceStart: input.serviceStart, serviceEnd: input.serviceEnd, scenario: "方案调整", version: coachingCase.version + 1 }).where(eq(coachingCases.id, input.caseId));
    await syncCoachingScenariosTx(tx, { caseId: input.caseId, orgId: coachingCase.orgId, actorUserId: me.id,
      scenarios: input.scenarios, reason: input.scenarioChangeReason });
    return saveCoachingPlanTx(tx, me, coachingCase, { caseId: input.caseId, level: "term", title: "GROW·学期方案", content: input.planSummary,
      startDate: input.serviceStart, endDate: input.serviceEnd, confirmed: false });
  });
}

export async function addCoachingTask(db: Db, me: StaffUser, input: { caseId: number; planId?: number | null; title: string; detail?: string; dueDate: string }) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  if (input.planId != null) await assertPlanInCase(db, input.caseId, input.planId, true);
  const [{ id }] = await db.insert(coachingTasks).values({ caseId: input.caseId, planId: input.planId ?? null, title: required(input.title, "请填写可验证行动"),
    detail: input.detail?.trim() ?? "", ownerId: coachingCase.studentUserId, verifierId: me.id, dueDate: input.dueDate, evidence: "", result: "", createdBy: me.id }).$returningId();
  await db.insert(coachingEvents).values({ caseId: input.caseId, actorUserId: me.id, type: "task_created", content: input.title });
  return { id };
}

export async function verifyCoachingTask(db: Db, me: StaffUser, input: { taskId: number; evidence: string; result: string }) {
  const [existing] = await db.select().from(coachingTasks).where(eq(coachingTasks.id, input.taskId)).limit(1);
  if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "行动任务不存在" });
  await assertCaseAccess(db, me, existing.caseId);
  const evidence = required(input.evidence, "请填写行动证据，签到不等于掌握");
  const result = required(input.result, "请填写验收结果");
  return db.transaction(async (tx) => {
    const [task] = await tx.select().from(coachingTasks).where(eq(coachingTasks.id, input.taskId)).limit(1).for("update");
    if (!task) throw new TRPCError({ code: "NOT_FOUND", message: "行动任务不存在" });
    const history = await tx.select().from(coachingTaskVerifications).where(eq(coachingTaskVerifications.taskId, task.id)).orderBy(desc(coachingTaskVerifications.version)).for("update");
    let previous = history[0] ?? null;
    /* 兼容 0046 已验收但迁移补录尚未可见的数据：先保存原始版本，再新增更正。 */
    if (!previous && task.status === "verified") {
      const [{ id }] = await tx.insert(coachingTaskVerifications).values({ taskId: task.id, caseId: task.caseId, version: 1,
        evidence: task.evidence, result: task.result, verifierId: task.verifierId, createdAt: task.completedAt ?? task.updatedAt }).$returningId();
      previous = { id, taskId: task.id, caseId: task.caseId, version: 1, previousId: null, evidence: task.evidence,
        result: task.result, verifierId: task.verifierId, createdAt: task.completedAt ?? task.updatedAt };
    }
    const version = (previous?.version ?? 0) + 1;
    const [{ id }] = await tx.insert(coachingTaskVerifications).values({ taskId: task.id, caseId: task.caseId, version,
      previousId: previous?.id ?? null, evidence, result, verifierId: me.id }).$returningId();
    /* 首次验收兼容旧字段；后续只追加版本，绝不覆盖首次证据和结果。 */
    if (task.status !== "verified") await tx.update(coachingTasks).set({ status: "verified", evidence, result, verifierId: me.id, completedAt: new Date() })
      .where(and(eq(coachingTasks.id, task.id), ne(coachingTasks.status, "verified")));
    await event(tx, task.caseId, me.id, "task_verified", `${task.title} V${version}：${result}`);
    return { ok: true as const, id, version };
  });
}

type DailyCheckinInput = Omit<DailyCheckinRuleInput, "hasPreviousVersion"> & { caseId: number; supervisionId?: number | null };

export async function assertCheckinSupervision(db: Db, coachingCase: CaseRow, supervisionId?: number | null) {
  if (supervisionId == null) return;
  const [record] = await db.select({ id: studySupervisionRecords.id, caseId: studySupervisionRecords.caseId, studentUserId: studySupervisionRecords.studentUserId })
    .from(studySupervisionRecords).where(eq(studySupervisionRecords.id, supervisionId)).limit(1);
  if (!record || record.caseId !== coachingCase.id || record.studentUserId !== coachingCase.studentUserId) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "关联督学记录与当前陪跑主档或学员不匹配" });
  }
}

export async function appendDailyCheckinTx(tx: PointTx, me: StaffUser, coachingCase: CaseRow, input: DailyCheckinInput) {
  const [previous] = await tx.select({ id: coachingCheckins.id, version: coachingCheckins.version }).from(coachingCheckins)
    .where(and(eq(coachingCheckins.caseId, coachingCase.id), eq(coachingCheckins.orgId, coachingCase.orgId), eq(coachingCheckins.checkDate, input.checkDate)))
    .orderBy(desc(coachingCheckins.version)).limit(1).for("update");
  const version = (previous?.version ?? 0) + 1;
  const validationError = validateDailyCheckin({ ...input, hasPreviousVersion: Boolean(previous) });
  if (validationError) throw new TRPCError({ code: "BAD_REQUEST", message: validationError });
  const text = (value?: string | null) => value?.trim() ?? "";
  const traces = LEARNING_TRACE_KEYS.filter((key) => input.traces.includes(key));
  const [{ id }] = await tx.insert(coachingCheckins).values({
    caseId: coachingCase.id, orgId: coachingCase.orgId, supervisionId: input.supervisionId ?? null,
    checkDate: input.checkDate, version, previousId: previous?.id ?? null, changeReason: previous ? text(input.changeReason) : "",
    completionRate: input.completionRate, accuracyRate: input.accuracyRate,
    actualCompletion: text(input.actualCompletion), evidence: text(input.evidence), tomorrowFirst: text(input.tomorrowFirst),
    gapReason: text(input.gapReason), errorCause: text(input.errorCause), correction: text(input.correction),
    followUp: text(input.followUp), followUpDate: input.completionRate < 100 ? input.followUpDate : null,
    feynmanConcept: input.feynmanEnabled ? text(input.feynmanConcept) : "", feynmanOutput: input.feynmanEnabled ? text(input.feynmanOutput) : "",
    feynmanGrade: input.feynmanEnabled ? input.feynmanGrade! : "", feynmanStuck: input.feynmanEnabled ? text(input.feynmanStuck) : "",
    feynmanQuestion: input.feynmanEnabled ? text(input.feynmanQuestion) : "", retestDate: input.feynmanEnabled ? input.retestDate || null : null,
    traces, traceEvidence: text(input.traceEvidence), traceFollowUp: text(input.traceFollowUp), createdBy: me.id,
  }).$returningId();
  await event(tx, coachingCase.id, me.id, "daily_checkin", `日检验 ${input.checkDate} V${version}：完成 ${input.completionRate}%，准确 ${input.accuracyRate}%；明日第一件事：${text(input.tomorrowFirst)}`);
  return { id, version };
}

export async function saveDailyCheckin(db: Db, me: StaffUser, input: DailyCheckinInput) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  await assertCheckinSupervision(db, coachingCase, input.supervisionId);
  return db.transaction((tx) => appendDailyCheckinTx(tx, me, coachingCase, input));
}

export async function addCoachingReview(db: Db, me: StaffUser, input: { caseId: number; period: "day" | "week" | "month" | "term"; periodKey: string; content: string; nextActions: string }) {
  await assertCaseAccess(db, me, input.caseId);
  return db.transaction(async (tx) => {
    const previous = await tx.select({ version: coachingReviews.version }).from(coachingReviews)
      .where(and(eq(coachingReviews.caseId, input.caseId), eq(coachingReviews.period, input.period), eq(coachingReviews.periodKey, input.periodKey)))
      .orderBy(desc(coachingReviews.version)).limit(1).for("update");
    const version = (previous[0]?.version ?? 0) + 1;
    const [{ id }] = await tx.insert(coachingReviews).values({ caseId: input.caseId, period: input.period, periodKey: input.periodKey,
      content: required(input.content, "复盘内容不能为空"), nextActions: required(input.nextActions, "请填写下一步行动"), version, createdBy: me.id }).$returningId();
    await event(tx, input.caseId, me.id, "review", `${input.periodKey} 复盘 V${version}`);
    return { id, version };
  });
}

async function assertStaffRecipient(db: Db, orgId: number, userId: number) {
  const [user] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.orgId, orgId), inArray(users.role, ["tutor", "admin"]), isNull(users.deletedAt))).limit(1);
  if (!user) throw new TRPCError({ code: "FORBIDDEN", message: "接收人必须是本机构伴学师或管理员" });
}

export async function addHandoff(db: Db, me: StaffUser, input: { caseId: number; type: string; toUserId: number; title: string; content: string; dueAt?: Date | null }) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  if (!(HANDOFF_TYPES as readonly string[]).includes(input.type)) throw new TRPCError({ code: "BAD_REQUEST", message: "交接类型必须为 H1—H4 或 REASSIGN" });
  if (input.type === "H5") throw new TRPCError({ code: "BAD_REQUEST", message: "H5 不能从普通交接入口创建：家庭阶段交接须走家庭交接入口；人员改派须由管理员从改派入口发起，两者不能混用" });
  if (input.type === "REASSIGN") throw new TRPCError({ code: "BAD_REQUEST", message: "人员改派须由管理员从改派入口发起，并在新督学接收后生效" });
  await assertStaffRecipient(db, coachingCase.orgId, input.toUserId);
  const title = required(input.title, "交接标题不能为空");
  const content = required(input.content, "交接内容不能为空");
  const settings = input.type === "H3" && input.dueAt == null ? await getCoachingDeliverySettings(db, me) : null;
  const dueAt = input.dueAt ?? (settings ? new Date(Date.now() + settings.h3Hours * 60 * 60 * 1000) : null);
  return db.transaction(async (tx) => {
    const [{ id }] = await tx.insert(coachingHandoffs).values({ caseId: input.caseId, type: input.type, fromUserId: me.id, toUserId: input.toUserId,
      title, content, dueAt }).$returningId();
    await tx.insert(coachingEvents).values({ caseId: input.caseId, actorUserId: me.id, type: "handoff_created", content: `${input.type} ${title}` });
    await queueCoachingNotification(tx, { orgId: coachingCase.orgId, caseId: input.caseId, recipientId: input.toUserId,
      type: "handoff_assigned", title: "新的服务交接待接收", body: `你有一项 ${input.type} 服务交接待接收，请进入伴学工作台及时核对并处理。`,
      idempotencyKey: `handoff:${id}:recipient:${input.toUserId}`, createdBy: me.id });
    return { id };
  });
}

async function insertSupervision(tx: PointTx, coachingCase: CaseRow, me: StaffUser, input: SessionInput["supervision"] & { supervisionId?: number | null; visitAt: Date; format: SessionInput["format"] | "supervision"; status: "draft" | "scheduled" | "completed"; hasCoachUnit: boolean }) {
  const phase = phaseForVisit(coachingCase.serviceStart, input.visitAt);
  const error = validateSessionPhase({ phase, hasCoachUnit: input.hasCoachUnit, hasSupervision: true, format: input.format,
    lateChangeReason: input.format === "supervision" ? "" : "已在课堂变更记录中确认", lateChangeConfirmedBy: input.format === "supervision" ? null : me.id });
  if (error) throw new TRPCError({ code: "BAD_REQUEST", message: error });
  if (input.status === "completed") {
    required(input.alignment, "请填写本次任务对齐"); required(input.checks, "请填写督学检查记录"); required(input.exitCheck, "离店前必须完成验收");
  }
  if (input.signInAt && input.signOutAt && input.signOutAt < input.signInAt) throw new TRPCError({ code: "BAD_REQUEST", message: "离店时间不能早于到店时间" });
  const values = { caseId: coachingCase.id, studentUserId: coachingCase.studentUserId,
    supervisorId: me.id, visitAt: input.visitAt, phase, mode: input.hasCoachUnit ? "mixed" : "direct", signInAt: input.signInAt ?? input.visitAt,
    signOutAt: input.signOutAt ?? null, timeBlocks: input.timeBlocks ?? [], leaveReason: input.leaveReason?.trim() || null,
    makeupPlan: input.makeupPlan?.trim() || null, handoffNote: input.handoffNote?.trim() || null,
    selfStudyMinutes: input.selfStudyMinutes ?? 0, alignment: input.alignment?.trim() ?? "", checks: input.checks?.trim() ?? "",
    exitCheck: input.exitCheck?.trim() ?? "", followUp: input.followUp?.trim() ?? "", status: input.status };
  if (input.supervisionId) {
    const [existing] = await tx.select().from(studySupervisionRecords).where(eq(studySupervisionRecords.id, input.supervisionId)).limit(1).for("update");
    if (!existing || existing.caseId !== coachingCase.id) throw new TRPCError({ code: "NOT_FOUND", message: "督学记录不存在或与主档不匹配" });
    if (["completed", "cancelled"].includes(existing.status)) throw new TRPCError({ code: "CONFLICT", message: "已完成或已取消的督学不能直接覆盖，请通过改期保留历史" });
    await tx.update(studySupervisionRecords).set(values).where(eq(studySupervisionRecords.id, existing.id));
    return { id: existing.id, phase };
  }
  const [{ id }] = await tx.insert(studySupervisionRecords).values(values).$returningId();
  return { id, phase };
}

export async function saveSupervision(db: Db, me: StaffUser, input: { caseId: number; supervisionId?: number; visitAt: Date; status: "draft" | "scheduled" | "completed" } & SessionInput["supervision"]) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  return db.transaction(async (tx) => {
    if (input.supervisionId) {
      const [linked] = await tx.select({ id: courseSessions.id }).from(courseSessions).where(and(eq(courseSessions.supervisionId, input.supervisionId), ne(courseSessions.status, "cancelled"))).limit(1);
      if (linked) throw new TRPCError({ code: "BAD_REQUEST", message: "该督学属于教练课堂，请在课堂记录中续写或改期" });
    }
    const result = await insertSupervision(tx, coachingCase, me, { ...input, format: "supervision", hasCoachUnit: false });
    await event(tx, input.caseId, me.id, "supervision", `${input.supervisionId ? "续写" : "新增"}到店督学：${input.exitCheck || input.status === "scheduled" ? "已安排，待完成离店验收" : "已签到，待完成离店验收"}`);
    return result;
  });
}

/** 课堂行动续写只改计划字段；缺席或清空页面行动不会删除历史任务，更不会伪造验收。 */
export async function persistCourseActionTx(tx: PointTx, coachingCase: CaseRow, me: StaffUser,
  participant: SessionInput["participants"][number], existingTaskId: number | null) {
  const excused = ["absent", "leave", "never", "on_leave", "withdrawn"];
  const present = !excused.includes(participant.attendance ?? "present");
  let taskId = existingTaskId;
  if (taskId) {
    const [task] = await tx.select().from(coachingTasks).where(and(eq(coachingTasks.id, taskId), eq(coachingTasks.caseId, coachingCase.id))).limit(1).for("update");
    if (!task || task.ownerId !== participant.studentUserId) throw new TRPCError({ code: "CONFLICT", message: "课堂行动与参与学员主档不匹配，请先核对历史数据" });
    if (participant.action && present) {
      await tx.update(coachingTasks).set({ title: required(participant.action.title, "每位出席学员都需要一个可验证行动"),
        detail: participant.action.detail?.trim() ?? "", dueDate: participant.action.dueDate })
        .where(and(eq(coachingTasks.id, task.id), eq(coachingTasks.caseId, coachingCase.id)));
    }
  } else if (participant.action && present) {
    const [{ id }] = await tx.insert(coachingTasks).values({ caseId: coachingCase.id, title: required(participant.action.title, "每位出席学员都需要一个可验证行动"),
      detail: participant.action.detail?.trim() ?? "", ownerId: participant.studentUserId, verifierId: me.id, dueDate: participant.action.dueDate,
      evidence: "", result: "", createdBy: me.id }).$returningId();
    taskId = id;
  }
  if (taskId) await event(tx, coachingCase.id, me.id, "course_action", participant.action && present
    ? `${existingTaskId ? "续写" : "创建"}行动任务 #${taskId}：${participant.action.title}`
    : `保留历史行动任务 #${taskId}；清空页面行动或标记缺席不会删除任务，也不代表已验收`);
  return taskId;
}

export async function saveCourseSession(db: Db, me: StaffUser, input: SessionInput) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  if (!input.units.length || input.units.length > 5) throw new TRPCError({ code: "BAD_REQUEST", message: "教练课堂须包含 1～5 个内容单元；纯督学请走到店督学" });
  if (input.units.some((u) => u.courseKey === "supervision")) throw new TRPCError({ code: "BAD_REQUEST", message: "督学是独立主线，不作为混合课程内容单元" });
  if (input.format === "one_to_one" && input.participants.length !== 1) throw new TRPCError({ code: "BAD_REQUEST", message: "一对一课堂只能有一位学员" });
  if (!input.participants.length || input.participants.length > 30 || !input.participants.some((p) => p.studentUserId === coachingCase.studentUserId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "请填写课堂参与人，并包含主档学员" });
  }
  const excused = new Set(["absent", "leave", "never", "on_leave", "withdrawn"]);
  const phase = phaseForVisit(coachingCase.serviceStart, input.startAt);
  const error = validateSessionPhase({ phase, hasCoachUnit: true, hasSupervision: true, format: input.format,
    lateChangeReason: input.changeReason, lateChangeConfirmedBy: input.lateChangeConfirmed ? me.id : null });
  if (error) throw new TRPCError({ code: "BAD_REQUEST", message: error });
  if (input.status === "completed") {
    required(input.sharedSummary, "请填写课堂总结");
    for (const unit of input.units) { required(unit.learningPoints, `${unit.title}须记录学习要点`); required(unit.practiceEvidence, `${unit.title}须记录现场练习证据`); }
    for (const participant of input.participants) if (!excused.has(participant.attendance ?? "present")) {
      required(participant.action?.title, `学员 ${participant.studentUserId} 出席课堂后必须有独立的可验证行动`);
    }
  }
  const studentIds = [...new Set(input.participants.map((p) => p.studentUserId))];
  if (studentIds.length !== input.participants.length) throw new TRPCError({ code: "BAD_REQUEST", message: "同一学员不能重复加入课堂" });
  const cases = new Map<number, CaseRow>();
  for (const studentId of studentIds) {
    await assertStudentAccess(db, me, studentId);
    const [row] = await db.select().from(coachingCases).where(and(eq(coachingCases.orgId, coachingCase.orgId), eq(coachingCases.studentUserId, studentId))).limit(1);
    if (!row) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "每位参与学员须先建立陪跑主档" });
    cases.set(studentId, row);
  }
  if (input.units.some((unit) => unit.courseKey === "parent")) {
    for (const participant of input.participants) {
      required(participant.guardianLabel, "亲子美言课须逐位填写监护人身份");
      if (!participant.guardianUserId) throw new TRPCError({ code: "BAD_REQUEST", message: "亲子美言课须选择本主档已授权的监护人账号" });
      const [grant] = await db.select({ id: coachingGuardianGrants.id }).from(coachingGuardianGrants)
        .where(and(eq(coachingGuardianGrants.caseId, cases.get(participant.studentUserId)!.id), eq(coachingGuardianGrants.guardianUserId, participant.guardianUserId), eq(coachingGuardianGrants.active, true))).limit(1);
      if (!grant) throw new TRPCError({ code: "FORBIDDEN", message: "亲子课监护人账号不属于该学员主档或授权已失效" });
    }
  }
  await ensureCourseCatalog(db, coachingCase.orgId);
  const catalog = await db.select().from(courseCatalog).where(eq(courseCatalog.orgId, coachingCase.orgId));
  return db.transaction(async (tx) => {
    let previous: typeof courseSessions.$inferSelect | null = null;
    let oldParticipants: (typeof courseParticipants.$inferSelect)[] = [];
    if (input.sessionId) {
      const [row] = await tx.select().from(courseSessions).where(eq(courseSessions.id, input.sessionId)).limit(1).for("update");
      if (!row || row.caseId !== input.caseId || row.orgId !== coachingCase.orgId) throw new TRPCError({ code: "NOT_FOUND", message: "课堂不存在或与主档不匹配" });
      if (["completed", "cancelled"].includes(row.status)) throw new TRPCError({ code: "CONFLICT", message: "已完成或已取消课堂不能直接覆盖，历史记录会保留" });
      previous = row;
      const [units, participants] = await Promise.all([
        tx.select().from(courseSessionUnits).where(eq(courseSessionUnits.sessionId, row.id)),
        tx.select().from(courseParticipants).where(eq(courseParticipants.sessionId, row.id)),
      ]);
      oldParticipants = participants;
      if (input.status === "completed" && !input.changeReason?.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "草稿或预约课堂完成归档时须填写本次交付说明" });
      await tx.insert(coachingSessionEvents).values({ orgId: row.orgId, caseId: row.caseId, sessionId: row.id, action: input.status === "completed" ? "completed" : "revised",
        previousStartAt: row.startAt, nextStartAt: input.startAt, previousStatus: row.status, nextStatus: input.status,
        snapshot: { session: row, units, participants } as unknown as Record<string, unknown>, reason: required(input.changeReason, "续写或完成课堂须填写变更说明"), actorUserId: me.id });
    }
    const groupSupervisions = previous ? await tx.select().from(studySupervisionRecords).where(and(
      inArray(studySupervisionRecords.caseId, [...cases.values()].map((row) => row.id)),
      eq(studySupervisionRecords.visitAt, previous.startAt), eq(studySupervisionRecords.mode, "mixed"),
    )).for("update") : [];
    for (const removed of oldParticipants.filter((row) => !studentIds.includes(row.studentUserId))) {
      const ownerCase = cases.get(removed.studentUserId);
      // 已被移出小组的学员不在本次提交名单中，保留其原督学事实，不静默删除。
      if (ownerCase) await event(tx, ownerCase.id, me.id, "course_participant_removed", `从小组课堂草稿 #${previous!.id} 移出，原督学记录保留`);
    }
    const supervision = await insertSupervision(tx, coachingCase, me, { ...input.supervision, supervisionId: previous?.supervisionId,
      visitAt: input.startAt, format: input.format, status: input.status, hasCoachUnit: true });
    const sessionValues = { caseId: input.caseId, orgId: coachingCase.orgId, supervisionId: supervision.id,
      coachId: me.id, startAt: input.startAt, phase, format: input.format, status: input.status,
      changeReason: input.changeReason?.trim() ?? "", changeConfirmedBy: input.lateChangeConfirmed ? me.id : null, sharedSummary: input.sharedSummary?.trim() ?? "" };
    let sessionId: number;
    if (previous) {
      sessionId = previous.id;
      await tx.update(courseSessions).set(sessionValues).where(eq(courseSessions.id, sessionId));
      await tx.delete(courseSessionUnits).where(eq(courseSessionUnits.sessionId, sessionId));
    } else {
      const [{ id }] = await tx.insert(courseSessions).values(sessionValues).$returningId();
      sessionId = id;
    }
    const h3DueAt = previous ? null : new Date(Date.now() + (await getCoachingDeliverySettings(tx, me)).h3Hours * 60 * 60 * 1000);
    for (let index = 0; index < input.units.length; index++) {
      const unit = input.units[index]!;
      const course = catalog.find((c) => c.courseKey === unit.courseKey && c.active);
      if (!course) throw new TRPCError({ code: "BAD_REQUEST", message: "课程内容不在本机构目录中" });
      if (unit.lessonNo != null && (unit.courseKey !== "method" || unit.lessonNo < 1 || unit.lessonNo > 12)) throw new TRPCError({ code: "BAD_REQUEST", message: "技法课节次须为 1～12" });
      await tx.insert(courseSessionUnits).values({ sessionId, courseKey: unit.courseKey, lessonNo: unit.lessonNo ?? null, title: required(unit.title, "内容单元标题不能为空"),
        snapshot: { version: course.version, title: course.title, purpose: course.purpose, outline: course.outline },
        learningPoints: unit.learningPoints?.trim() ?? "", practiceEvidence: unit.practiceEvidence?.trim() ?? "", sortOrder: index });
    }
    for (const old of oldParticipants.filter((row) => !studentIds.includes(row.studentUserId))) {
      const [file] = await tx.select({ id: coachingDeliverables.id }).from(coachingDeliverables).where(eq(coachingDeliverables.participantId, old.id)).limit(1);
      if (file || old.feedbackVersion > 0) throw new TRPCError({ code: "CONFLICT", message: "已有附件或反馈的参与人不能从草稿中移除" });
      await tx.delete(courseParticipants).where(eq(courseParticipants.id, old.id));
    }
    for (const participant of input.participants) {
      const ownerCase = cases.get(participant.studentUserId)!;
      if (ownerCase.id !== coachingCase.id) {
        const linked = previous ? groupSupervisions.filter((row) => row.caseId === ownerCase.id) : [];
        if (linked.length > 1) throw new TRPCError({ code: "CONFLICT", message: `学员 ${ownerCase.studentUserId} 的原督学记录不唯一，请先核对历史数据` });
        await insertSupervision(tx, ownerCase, me, { ...input.supervision, supervisionId: linked[0]?.id,
          visitAt: input.startAt, format: input.format, status: input.status, hasCoachUnit: true });
      }
      const old = oldParticipants.find((row) => row.studentUserId === participant.studentUserId);
      const taskId = await persistCourseActionTx(tx, ownerCase, me, participant, old?.actionTaskId ?? null);
      const participantValues = { sessionId, studentUserId: participant.studentUserId, guardianLabel: participant.guardianLabel?.trim() ?? "",
        guardianUserId: participant.guardianUserId ?? null, attendance: participant.attendance ?? "present", personalObservation: participant.personalObservation?.trim() ?? "",
        privateNote: participant.privateNote?.trim() ?? "", actionTaskId: taskId, feedbackText: participant.feedbackText?.trim() ?? old?.feedbackText ?? "" };
      let participantId = old?.id;
      if (old) await tx.update(courseParticipants).set(participantValues).where(eq(courseParticipants.id, old.id));
      else [{ id: participantId }] = await tx.insert(courseParticipants).values(participantValues).$returningId();
      if (ownerCase.id !== coachingCase.id && !previous) {
        await tx.insert(coachingHandoffs).values({ caseId: ownerCase.id, type: "H3", fromUserId: me.id, dueAt: h3DueAt, toUserId: ownerCase.supervisorId,
          title: "小组课后督学交接", content: input.sharedSummary?.trim() || input.units.map((u) => u.title).join("、") });
        await event(tx, ownerCase.id, me.id, "course_session", `${input.units.map((u) => u.title).join("＋")}＋督学（小组课堂 #${sessionId}）`);
      }
      void participantId;
    }
    if (phase === "late" && input.format !== "one_to_one") {
      await tx.update(coachingCases).set({ phaseMode: input.format, phaseChangeReason: input.changeReason!.trim(), phaseChangeConfirmedBy: me.id }).where(eq(coachingCases.id, input.caseId));
    }
    if (!previous) await tx.insert(coachingHandoffs).values({ caseId: input.caseId, type: "H3", fromUserId: me.id, dueAt: h3DueAt, toUserId: coachingCase.supervisorId,
      title: "课后督学交接", content: input.sharedSummary?.trim() || input.units.map((u) => u.title).join("、") });
    await event(tx, input.caseId, me.id, "course_session", `${previous ? `续写课堂 #${sessionId}` : "新增课堂"}：${input.units.map((u) => u.title).join("＋")}＋督学`);
    return { sessionId, supervisionId: supervision.id, phase };
  });
}

export async function pushParticipantFeedback(db: Db, me: StaffUser, input: { participantId: number; feedbackText: string; recipientUserIds: number[] }) {
  const [participant] = await db.select().from(courseParticipants).where(eq(courseParticipants.id, input.participantId)).limit(1);
  if (!participant) throw new TRPCError({ code: "NOT_FOUND", message: "课堂参与记录不存在" });
  const [session] = await db.select().from(courseSessions).where(eq(courseSessions.id, participant.sessionId)).limit(1);
  if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "课堂不存在" });
  if (session.status !== "completed") throw new TRPCError({ code: "CONFLICT", message: "预约或草稿尚未完成，不能正式推送家长反馈" });
  await assertCaseAccess(db, me, session.caseId);
  await assertStudentAccess(db, me, participant.studentUserId);
  const [ownerCase] = await db.select().from(coachingCases)
    .where(and(eq(coachingCases.orgId, session.orgId), eq(coachingCases.studentUserId, participant.studentUserId))).limit(1);
  if (!ownerCase) throw new TRPCError({ code: "NOT_FOUND", message: "参与学员的陪跑主档不存在" });
  return db.transaction(async (tx) => {
    const locked = (await tx.select().from(courseParticipants).where(eq(courseParticipants.id, input.participantId)).limit(1).for("update"))[0]!;
    if (!locked || locked.sessionId !== session.id) throw new TRPCError({ code: "CONFLICT", message: "课堂参与记录已变化，请刷新" });
    const attachments = await tx.select({ id: coachingDeliverables.id }).from(coachingDeliverables)
      .where(and(eq(coachingDeliverables.participantId, participant.id), eq(coachingDeliverables.caseId, ownerCase.id), isNull(coachingDeliverables.disposedAt)));
    const text = input.feedbackText.trim();
    if (!text && !attachments.length) throw new TRPCError({ code: "BAD_REQUEST", message: "请填写文字反馈或上传录音／图片" });
    const [previous] = await tx.select({ id: coachingDeliverables.id, version: coachingDeliverables.version }).from(coachingDeliverables)
      .where(and(eq(coachingDeliverables.participantId, participant.id), eq(coachingDeliverables.kind, "feedback"))).orderBy(desc(coachingDeliverables.version)).limit(1);
    const version = (previous?.version ?? 0) + 1;
    const [feedbackFile] = await tx.insert(coachingDeliverables).values({ caseId: ownerCase.id, sessionId: session.id, participantId: participant.id, kind: "feedback",
      body: text, visibility: "family", version, previousId: previous?.id ?? null, uploadedBy: me.id, pushedAt: new Date() }).$returningId();
    await tx.update(coachingDeliverables).set({ visibility: "family", pushedAt: new Date() }).where(eq(coachingDeliverables.participantId, participant.id));
    await tx.update(courseParticipants).set({ feedbackText: text, feedbackVersion: version, feedbackAt: new Date() }).where(eq(courseParticipants.id, locked.id));
    // 同一参与记录保存的是“当前最新反馈”，再次推送时必须收回上一批接收人的读取权，
    // 否则旧接收人仍能读取 participant.feedbackText 的最新版本。
    await tx.update(coachingDeliverableRecipients).set({ active: false, revokedAt: new Date(), revokedBy: me.id })
      .where(and(eq(coachingDeliverableRecipients.orgId, ownerCase.orgId), eq(coachingDeliverableRecipients.caseId, ownerCase.id),
        eq(coachingDeliverableRecipients.resourceType, "session_feedback"), eq(coachingDeliverableRecipients.resourceId, participant.id), eq(coachingDeliverableRecipients.active, true)));
    await grantFamilyResourcesTx(tx, { coachingCase: ownerCase, resourceType: "session_feedback", resourceIds: [participant.id], recipientUserIds: input.recipientUserIds, actorUserId: me.id });
    await grantFamilyResourcesTx(tx, { coachingCase: ownerCase, resourceType: "deliverable", resourceIds: [feedbackFile.id, ...attachments.map((file) => file.id)], recipientUserIds: input.recipientUserIds, actorUserId: me.id });
    await event(tx, ownerCase.id, me.id, "feedback_pushed", `课堂反馈 V${version} 已按 ${new Set(input.recipientUserIds).size} 位指定接收人推送`);
    await queueFamilyResourceNotifications(tx, { coachingCase: ownerCase, resourceType: "session_feedback", resourceId: participant.id,
      type: "feedback_pushed", title: "新的课堂反馈", body: "伴学师已推送新的课堂反馈，请在陪跑反馈中查看文字、录音或图片。",
      idempotencyKey: `feedback:${participant.id}:v${version}`, createdBy: me.id });
    return { ok: true as const, version };
  });
}

export async function uploadCoachingDeliverable(db: Db, me: StaffUser, input: { caseId: number; sessionId?: number | null; participantId?: number | null; taskId?: number | null; kind: "text" | "audio" | "image"; body?: string; mediaData?: string; mimeType?: string }) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  const rawMedia = input.mediaData?.trim() || null;
  if (input.kind !== "text" && !rawMedia) throw new TRPCError({ code: "BAD_REQUEST", message: "请上传录音或图片" });
  if (input.kind === "text" && !input.body?.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "文字附件不能为空" });
  const validatedMedia = rawMedia && input.kind !== "text" ? validateCoachingMedia(rawMedia, input.mimeType, input.kind) : null;
  const mediaData = validatedMedia?.mediaData ?? null;
  let sessionId = input.sessionId ?? null;
  if (input.participantId) {
    const [participant] = await db.select().from(courseParticipants).where(eq(courseParticipants.id, input.participantId)).limit(1);
    if (!participant || (sessionId != null && participant.sessionId !== sessionId)) throw new TRPCError({ code: "BAD_REQUEST", message: "附件与课堂参与记录不匹配" });
    await assertStudentAccess(db, me, participant.studentUserId);
    const [session] = await db.select().from(courseSessions).where(eq(courseSessions.id, participant.sessionId)).limit(1);
    if (!session || session.orgId !== coachingCase.orgId) throw new TRPCError({ code: "BAD_REQUEST", message: "附件与课堂不匹配" });
    const [ownerCase] = await db.select({ id: coachingCases.id }).from(coachingCases)
      .where(and(eq(coachingCases.orgId, session.orgId), eq(coachingCases.studentUserId, participant.studentUserId))).limit(1);
    if (ownerCase?.id !== input.caseId) throw new TRPCError({ code: "FORBIDDEN", message: "附件必须归入参与学员自己的陪跑主档" });
    sessionId = session.id;
  } else if (sessionId != null) {
    const [session] = await db.select({ caseId: courseSessions.caseId }).from(courseSessions).where(eq(courseSessions.id, sessionId)).limit(1);
    if (session?.caseId !== input.caseId) throw new TRPCError({ code: "BAD_REQUEST", message: "附件与课堂主档不匹配" });
  }
  if (input.taskId != null) {
    const [task] = await db.select({ caseId: coachingTasks.caseId }).from(coachingTasks).where(eq(coachingTasks.id, input.taskId)).limit(1);
    if (task?.caseId !== input.caseId) throw new TRPCError({ code: "BAD_REQUEST", message: "附件与行动任务不匹配" });
  }
  const [{ id }] = await db.insert(coachingDeliverables).values({ caseId: input.caseId, sessionId,
    participantId: input.participantId ?? null, taskId: input.taskId ?? null, kind: input.kind, body: input.body?.trim() ?? "",
    mediaData, mimeType: validatedMedia ? input.mimeType! : null, sizeBytes: validatedMedia?.bytes ?? 0,
    visibility: "internal", uploadedBy: me.id }).$returningId();
  await db.insert(coachingEvents).values({ caseId: input.caseId, actorUserId: me.id, type: "deliverable_uploaded", content: `上传${input.kind === "audio" ? "录音" : input.kind === "image" ? "图片" : "文字"}附件` });
  return { id };
}

export async function grantGuardian(db: Db, me: StaffUser, input: { caseId: number; guardianUserId: number; label: string }) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  if (input.guardianUserId === coachingCase.studentUserId) throw new TRPCError({ code: "BAD_REQUEST", message: "学员本人无需监护人授权" });
  const [guardian] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, input.guardianUserId), eq(users.role, "user"), isNull(users.deletedAt), or(eq(users.orgId, coachingCase.orgId), isNull(users.orgId)))).limit(1);
  if (!guardian) throw new TRPCError({ code: "NOT_FOUND", message: "监护人账号不存在、已停用或不属于可授权范围" });
  await db.insert(coachingGuardianGrants).values({ caseId: input.caseId, guardianUserId: input.guardianUserId, label: required(input.label, "请填写监护人身份"), createdBy: me.id })
    .onDuplicateKeyUpdate({ set: { active: true, label: input.label.trim() } });
  await db.insert(coachingEvents).values({ caseId: input.caseId, actorUserId: me.id, type: "guardian_granted", content: `已授权${input.label}` });
  return { ok: true as const };
}

export async function revokeGuardian(db: Db, me: StaffUser, grantId: number) {
  const [grant] = await db.select().from(coachingGuardianGrants).where(eq(coachingGuardianGrants.id, grantId)).limit(1);
  if (!grant) throw new TRPCError({ code: "NOT_FOUND", message: "授权不存在" });
  await assertCaseAccess(db, me, grant.caseId);
  await db.transaction(async (tx) => {
    await tx.update(coachingGuardianGrants).set({ active: false }).where(eq(coachingGuardianGrants.id, grantId));
    await tx.update(coachingDeliverableRecipients).set({ active: false, revokedAt: new Date(), revokedBy: me.id })
      .where(and(eq(coachingDeliverableRecipients.caseId, grant.caseId), eq(coachingDeliverableRecipients.recipientUserId, grant.guardianUserId), eq(coachingDeliverableRecipients.active, true)));
    await tx.insert(coachingEvents).values({ caseId: grant.caseId, actorUserId: me.id, type: "guardian_revoked", content: `已撤销${grant.label}授权及本主档逐份接收权限` });
  });
  return { ok: true as const };
}

async function familyCase(db: Db, userId: number, caseId?: number): Promise<CaseRow> {
  const ownConditions = [eq(coachingCases.studentUserId, userId), isNull(users.deletedAt)];
  if (caseId != null) ownConditions.push(eq(coachingCases.id, caseId));
  const [own] = await db.select({ coachingCase: coachingCases }).from(coachingCases)
    .innerJoin(users, eq(coachingCases.studentUserId, users.id)).where(and(...ownConditions)).limit(1);
  if (own) return own.coachingCase;
  const guardianUsers = alias(users, "guardian_users");
  const grantConditions = [eq(coachingGuardianGrants.guardianUserId, userId), eq(coachingGuardianGrants.active, true), isNull(guardianUsers.deletedAt)];
  if (caseId != null) grantConditions.push(eq(coachingCases.id, caseId));
  const [granted] = await db.select({ coachingCase: coachingCases }).from(coachingGuardianGrants)
    .innerJoin(coachingCases, eq(coachingGuardianGrants.caseId, coachingCases.id))
    .innerJoin(guardianUsers, eq(coachingGuardianGrants.guardianUserId, guardianUsers.id))
    .where(and(...grantConditions)).limit(1);
  if (!granted) throw new TRPCError({ code: "FORBIDDEN", message: "尚未获得该学员的陪跑反馈授权" });
  return granted.coachingCase;
}

export async function listFamilyCoachingCases(db: Db, me: { id: number; role: string }) {
  if (me.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "请以学员或监护人账号查看" });
  const guardianUsers = alias(users, "family_guardian_users");
  const [own, granted] = await Promise.all([
    db.select({ caseId: coachingCases.id, studentUserId: coachingCases.studentUserId, studentName: users.name, status: coachingCases.status })
      .from(coachingCases).innerJoin(users, eq(coachingCases.studentUserId, users.id))
      .where(and(eq(coachingCases.studentUserId, me.id), isNull(users.deletedAt))),
    db.select({ caseId: coachingCases.id, studentUserId: coachingCases.studentUserId, studentName: users.name, status: coachingCases.status })
      .from(coachingGuardianGrants).innerJoin(coachingCases, eq(coachingGuardianGrants.caseId, coachingCases.id))
      .innerJoin(users, eq(coachingCases.studentUserId, users.id))
      .innerJoin(guardianUsers, eq(coachingGuardianGrants.guardianUserId, guardianUsers.id))
      .where(and(eq(coachingGuardianGrants.guardianUserId, me.id), eq(coachingGuardianGrants.active, true), isNull(guardianUsers.deletedAt), isNull(users.deletedAt))),
  ]);
  const unique = new Map<number, { caseId: number; studentUserId: number; studentName: string | null; status: string }>();
  for (const row of [...own, ...granted]) unique.set(row.caseId, row);
  return [...unique.values()];
}

export async function familyCoachingFeedback(db: Db, me: { id: number; role: string }, caseId?: number) {
  if (me.role !== "user") throw new TRPCError({ code: "FORBIDDEN", message: "请以学员或监护人账号查看" });
  const coachingCase = await familyCase(db, me.id, caseId);
  const [planCandidates, tasks, participantCandidates, attachmentCandidates, monthlyCandidates] = await Promise.all([
    db.select({ id: coachingPlans.id, level: coachingPlans.level, title: coachingPlans.title, content: coachingPlans.content, version: coachingPlans.version,
      startDate: coachingPlans.startDate, endDate: coachingPlans.endDate }).from(coachingPlans)
      .where(and(eq(coachingPlans.caseId, coachingCase.id), eq(coachingPlans.status, "confirmed"), isNotNull(coachingPlans.issuedAt))).orderBy(desc(coachingPlans.id)),
    db.select({ id: coachingTasks.id, title: coachingTasks.title, detail: coachingTasks.detail, dueDate: coachingTasks.dueDate,
      status: coachingTasks.status, result: coachingTasks.result }).from(coachingTasks)
      .where(and(eq(coachingTasks.caseId, coachingCase.id), eq(coachingTasks.ownerId, coachingCase.studentUserId))),
    db.select({ participant: courseParticipants, session: courseSessions }).from(courseParticipants)
      .innerJoin(courseSessions, eq(courseParticipants.sessionId, courseSessions.id))
      .where(and(eq(courseParticipants.studentUserId, coachingCase.studentUserId), eq(courseSessions.orgId, coachingCase.orgId), eq(courseSessions.status, "completed"))),
    db.select({ id: coachingDeliverables.id, sessionId: coachingDeliverables.sessionId, kind: coachingDeliverables.kind,
      mimeType: coachingDeliverables.mimeType, version: coachingDeliverables.version, createdAt: coachingDeliverables.createdAt })
      .from(coachingDeliverables).where(and(eq(coachingDeliverables.caseId, coachingCase.id), eq(coachingDeliverables.visibility, "family"),
        isNotNull(coachingDeliverables.pushedAt), isNull(coachingDeliverables.disposedAt))),
    db.select({ id: coachingMonthlyReports.id, month: coachingMonthlyReports.month, version: coachingMonthlyReports.version,
      metricSnapshot: coachingMonthlyReports.metricSnapshot, goalProgress: coachingMonthlyReports.goalProgress,
      academicProgress: coachingMonthlyReports.academicProgress, taskExecution: coachingMonthlyReports.taskExecution,
      learningMethod: coachingMonthlyReports.learningMethod, habitFamily: coachingMonthlyReports.habitFamily,
      meetingNotes: coachingMonthlyReports.meetingNotes, nextActions: coachingMonthlyReports.nextActions,
      familyAction: coachingMonthlyReports.familyAction, pushedAt: coachingMonthlyReports.pushedAt }).from(coachingMonthlyReports)
      .where(and(eq(coachingMonthlyReports.caseId, coachingCase.id), isNotNull(coachingMonthlyReports.pushedAt)))
      .orderBy(desc(coachingMonthlyReports.month), desc(coachingMonthlyReports.version)),
  ]);
  const [planIds, feedbackIds, deliverableIds, monthlyIds] = await Promise.all([
    authorizedFamilyResources(db, coachingCase, "plan", planCandidates.map((row) => row.id), me.id),
    authorizedFamilyResources(db, coachingCase, "session_feedback", participantCandidates.map((row) => row.participant.id), me.id),
    authorizedFamilyResources(db, coachingCase, "deliverable", attachmentCandidates.map((row) => row.id), me.id),
    authorizedFamilyResources(db, coachingCase, "monthly_report", monthlyCandidates.map((row) => row.id), me.id),
  ]);
  const allowedParticipants = participantCandidates.filter((row) => feedbackIds.has(row.participant.id));
  const sessions = allowedParticipants.map(({ participant, session }) => ({ id: session.id, startAt: session.startAt, sharedSummary: session.sharedSummary,
    format: session.format, feedback: participant.feedbackVersion > 0 ? [{ sessionId: session.id, feedbackText: participant.feedbackText,
      feedbackVersion: participant.feedbackVersion, feedbackAt: participant.feedbackAt }] : [] }))
    .sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
  return { coachingCase: { id: coachingCase.id, goal: coachingCase.goal, planSummary: coachingCase.planSummary, serviceStart: coachingCase.serviceStart, serviceEnd: coachingCase.serviceEnd },
    plans: planCandidates.filter((row) => planIds.has(row.id)), tasks, sessions,
    attachments: attachmentCandidates.filter((row) => deliverableIds.has(row.id)), monthlyReports: monthlyCandidates.filter((row) => monthlyIds.has(row.id)) };
}

export async function downloadCoachingDeliverable(db: Db, me: { id: number; role: "tutor" | "user" | "admin" | "jiaowu"; orgId: number | null }, deliverableId: number) {
  const [row] = await db.select().from(coachingDeliverables).where(eq(coachingDeliverables.id, deliverableId)).limit(1);
  if (!row || row.disposedAt || (row.expiresAt && row.expiresAt.getTime() <= Date.now())) throw new TRPCError({ code: "NOT_FOUND", message: "附件不存在或已过期" });
  if (["tutor", "admin"].includes(me.role)) {
    await assertCaseAccess(db, me as StaffUser, row.caseId);
  } else {
    const coachingCase = await familyCase(db, me.id, row.caseId);
    if (coachingCase.id !== row.caseId || row.visibility !== "family" || !row.pushedAt) throw new TRPCError({ code: "FORBIDDEN", message: "附件尚未授权推送" });
    const allowed = await authorizedFamilyResources(db, coachingCase, "deliverable", [row.id], me.id);
    if (!allowed.has(row.id)) throw new TRPCError({ code: "FORBIDDEN", message: "该份附件未授权给当前账号或授权已撤销" });
  }
  await db.insert(coachingEvents).values({ caseId: row.caseId, actorUserId: me.id, type: "deliverable_downloaded", content: `下载附件 #${row.id}` });
  const ext = row.mimeType?.split("/")[1]?.replace("jpeg", "jpg") ?? "txt";
  return { fileName: `coaching-feedback-${row.id}.${ext}`, mimeType: row.mimeType ?? "text/plain;charset=utf-8", data: row.mediaData ?? row.body };
}
