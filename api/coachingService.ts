import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull, ne, or } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import {
  assessmentResults, coachingCases, coachingCaseScenarios, coachingCheckins, coachingDeliverables, coachingEvents, coachingGuardianGrants, coachingHandoffs,
  coachingPlans, coachingReviews, coachingTasks, coachingTaskVerifications, courseCatalog, courseParticipants, courseSessions, courseSessionUnits,
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

export { assertCaseAccess } from "./coachingAccess";

type Db = ReturnType<typeof getDb>;
type CaseRow = CoachingCaseRow;
type SessionInput = {
  caseId: number; startAt: Date; format: "one_to_one" | "salon" | "workshop" | "mixed";
  status: "draft" | "completed"; changeReason?: string; lateChangeConfirmed?: boolean; sharedSummary?: string;
  supervision: { selfStudyMinutes?: number; alignment?: string; checks?: string; exitCheck?: string; followUp?: string };
  units: { courseKey: string; lessonNo?: number | null; title: string; learningPoints?: string; practiceEvidence?: string }[];
  participants: { studentUserId: number; guardianLabel?: string; attendance?: string; personalObservation?: string; privateNote?: string; feedbackText?: string;
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
      pushedAt: coachingDeliverables.pushedAt, createdAt: coachingDeliverables.createdAt })
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
  const [reportAllowed, verificationHistory, scenarioHistory, exceptions] = await Promise.all([
    hasAssessmentReportAccess(db, me, coachingCase.studentUserId),
    db.select().from(coachingTaskVerifications).where(eq(coachingTaskVerifications.caseId, caseId)).orderBy(asc(coachingTaskVerifications.taskId), desc(coachingTaskVerifications.version)),
    db.select().from(coachingCaseScenarios).where(eq(coachingCaseScenarios.caseId, caseId)).orderBy(desc(coachingCaseScenarios.startedAt), desc(coachingCaseScenarios.id)),
    listCoachingExceptions(db, me, coachingCase),
  ]);
  const serviceScenarios = normalizeCoachingScenarios(scenarioHistory.filter((item) => !item.endedAt).map((item) => item.scenario));
  return { coachingCase, serviceScenarios, scenarioHistory, plans, tasks, reviews, checkins, handoffs, events, exceptions, supervisions,
    sessions: sessions.map((session) => ({ ...session, units: units.filter((u) => u.sessionId === session.id),
      participants: participants.filter((p) => p.participant.sessionId === session.id) })),
    deliverables, guardians, results: reportAllowed ? results : [], reportAllowed, verificationHistory, catalog };
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

export async function createCoachingCase(db: Db, me: StaffUser, input: { studentUserId: number; scenarios: string[]; goal: string; currentSituation: string; planSummary: string; serviceStart: string; serviceEnd: string }) {
  const orgId = requireOrgStaff(me);
  await assertStudentAccess(db, me, input.studentUserId);
  if (Date.parse(input.serviceEnd) < Date.parse(input.serviceStart)) throw new TRPCError({ code: "BAD_REQUEST", message: "结束日期不能早于开始日期" });
  await ensureCourseCatalog(db, orgId);
  const [old] = await db.select({ id: coachingCases.id }).from(coachingCases).where(and(eq(coachingCases.orgId, orgId), eq(coachingCases.studentUserId, input.studentUserId))).limit(1);
  if (old) return { caseId: old.id, duplicate: true as const };
  return db.transaction(async (tx) => {
    const [{ id }] = await tx.insert(coachingCases).values({ orgId, studentUserId: input.studentUserId, coachId: me.id, supervisorId: me.id,
      scenario: "新生接手", goal: required(input.goal, "请先明确陪跑目标"), currentSituation: required(input.currentSituation, "请评估学员现状"),
      planSummary: required(input.planSummary, "请定制陪跑计划"), serviceStart: input.serviceStart, serviceEnd: input.serviceEnd }).$returningId();
    await syncCoachingScenariosTx(tx, { caseId: id, orgId, actorUserId: me.id, scenarios: input.scenarios, reason: "建立陪跑主档" });
    await tx.insert(coachingPlans).values({ caseId: id, level: "term", title: "学期陪跑方案", content: input.planSummary,
      startDate: input.serviceStart, endDate: input.serviceEnd, status: "confirmed", confirmedBy: me.id, confirmedAt: new Date(), createdBy: me.id });
    await tx.insert(coachingHandoffs).values({ caseId: id, type: "H1", fromUserId: me.id, toUserId: me.id,
      title: "新生接手：目标、现状与方案交接", content: `目标：${input.goal}\n现状：${input.currentSituation}\n计划：${input.planSummary}` });
    await event(tx, id, me.id, "case_created", `创建陪跑主档（${input.scenarios.map(coachingScenarioLabel).join("＋")}），目标、现状与学期计划已确认`);
    return { caseId: id, duplicate: false as const };
  });
}

type SaveCoachingPlanInput = { caseId: number; level: "term" | "month" | "week" | "day"; parentId?: number | null; title: string; content: string; startDate: string; endDate: string; sourceResultId?: number | null; confirmed: boolean };

async function saveCoachingPlanTx(tx: PointTx, me: StaffUser, coachingCase: CaseRow, input: SaveCoachingPlanInput) {
  const previous = await tx.select({ version: coachingPlans.version }).from(coachingPlans)
    .where(and(eq(coachingPlans.caseId, input.caseId), eq(coachingPlans.level, input.level))).orderBy(desc(coachingPlans.version)).limit(1).for("update");
  const version = (previous[0]?.version ?? 0) + 1;
  const [{ id }] = await tx.insert(coachingPlans).values({ caseId: input.caseId, parentId: input.parentId ?? null, level: input.level,
    title: required(input.title, "请填写计划名称"), content: input.content, startDate: input.startDate, endDate: input.endDate,
    sourceResultId: input.sourceResultId ?? null, version, status: input.confirmed ? "confirmed" : "draft",
    confirmedBy: input.confirmed ? me.id : null, confirmedAt: input.confirmed ? new Date() : null, createdBy: me.id }).$returningId();
  if (input.level === "term") {
    await tx.update(coachingCases).set({ planSummary: input.content, scenario: version > 1 ? "方案调整" : coachingCase.scenario, version: coachingCase.version + 1 }).where(eq(coachingCases.id, input.caseId));
  }
  await event(tx, input.caseId, me.id, "plan_version", `${input.title} V${version}${input.confirmed ? " 已确认" : " 保存草稿"}`);
  return { id, version };
}

async function assertPlanInCase(db: Db, caseId: number, planId: number) {
  const [plan] = await db.select({ id: coachingPlans.id, caseId: coachingPlans.caseId }).from(coachingPlans).where(eq(coachingPlans.id, planId)).limit(1);
  if (plan?.caseId !== caseId) throw new TRPCError({ code: "BAD_REQUEST", message: "关联计划与当前陪跑主档不匹配" });
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

export async function updateGrow(db: Db, me: StaffUser, input: { caseId: number; goal: string; currentSituation: string; planSummary: string; scenarios: string[]; scenarioChangeReason?: string; serviceStart: string; serviceEnd: string }) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  required(input.goal, "目标不能为空"); required(input.currentSituation, "现状评估不能为空"); required(input.planSummary, "计划不能为空");
  if (input.serviceEnd < input.serviceStart) throw new TRPCError({ code: "BAD_REQUEST", message: "结束日期不能早于开始日期" });
  return db.transaction(async (tx) => {
    await tx.update(coachingCases).set({ goal: input.goal.trim(), currentSituation: input.currentSituation.trim(),
      serviceStart: input.serviceStart, serviceEnd: input.serviceEnd, scenario: "方案调整", version: coachingCase.version + 1 }).where(eq(coachingCases.id, input.caseId));
    await syncCoachingScenariosTx(tx, { caseId: input.caseId, orgId: coachingCase.orgId, actorUserId: me.id,
      scenarios: input.scenarios, reason: input.scenarioChangeReason });
    return saveCoachingPlanTx(tx, me, coachingCase, { caseId: input.caseId, level: "term", title: "GROW·学期方案", content: input.planSummary,
      startDate: input.serviceStart, endDate: input.serviceEnd, confirmed: true });
  });
}

export async function addCoachingTask(db: Db, me: StaffUser, input: { caseId: number; planId?: number | null; title: string; detail?: string; dueDate: string }) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  if (input.planId != null) await assertPlanInCase(db, input.caseId, input.planId);
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
  if (!(HANDOFF_TYPES as readonly string[]).includes(input.type)) throw new TRPCError({ code: "BAD_REQUEST", message: "交接类型必须为 H1—H5" });
  await assertStaffRecipient(db, coachingCase.orgId, input.toUserId);
  const [{ id }] = await db.insert(coachingHandoffs).values({ caseId: input.caseId, type: input.type, fromUserId: me.id, toUserId: input.toUserId,
    title: required(input.title, "交接标题不能为空"), content: required(input.content, "交接内容不能为空"), dueAt: input.dueAt ?? null }).$returningId();
  await db.insert(coachingEvents).values({ caseId: input.caseId, actorUserId: me.id, type: "handoff_created", content: `${input.type} ${input.title}` });
  return { id };
}

export async function acceptHandoff(db: Db, me: StaffUser, handoffId: number) {
  const [row] = await db.select().from(coachingHandoffs).where(eq(coachingHandoffs.id, handoffId)).limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "交接记录不存在" });
  await assertCaseAccess(db, me, row.caseId);
  if (row.toUserId !== me.id || row.status !== "pending") throw new TRPCError({ code: "FORBIDDEN", message: "只能接收分配给自己的待交接事项" });
  await db.update(coachingHandoffs).set({ status: "accepted", acceptedAt: new Date() }).where(eq(coachingHandoffs.id, row.id));
  await db.insert(coachingEvents).values({ caseId: row.caseId, actorUserId: me.id, type: "handoff_accepted", content: `${row.type} ${row.title}` });
  return { ok: true as const };
}

export async function setCoachingStatus(db: Db, me: StaffUser, input: { caseId: number; status: "active" | "paused" | "closed" | "archived"; reason: string }) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  if (input.status === "archived" && me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "仅机构管理员可归档" });
  await db.transaction(async (tx) => {
    await tx.update(coachingCases).set({ status: input.status, scenario: input.status === "closed" ? "结课复盘" : coachingCase.scenario }).where(eq(coachingCases.id, input.caseId));
    if (input.status === "closed") await tx.insert(coachingHandoffs).values({ caseId: input.caseId, type: "H4", fromUserId: me.id, toUserId: coachingCase.supervisorId,
      title: "结课复盘与后续回访交接", content: required(input.reason, "请填写状态变更原因") });
    await event(tx, input.caseId, me.id, "case_status", `${coachingCase.status} → ${input.status}：${input.reason}`);
  });
  return { ok: true as const };
}

export async function reassignCoachingCase(db: Db, me: StaffUser, input: { caseId: number; coachId: number; supervisorId: number; reason: string }) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "仅机构管理员可改派人员" });
  await assertStaffRecipient(db, coachingCase.orgId, input.coachId);
  await assertStaffRecipient(db, coachingCase.orgId, input.supervisorId);
  await db.update(coachingCases).set({ coachId: input.coachId, supervisorId: input.supervisorId }).where(eq(coachingCases.id, input.caseId));
  await db.insert(coachingHandoffs).values({ caseId: input.caseId, type: "H5", fromUserId: me.id, toUserId: input.coachId,
    title: "人员改派与回访交接", content: required(input.reason, "请填写改派原因") });
  await db.insert(coachingEvents).values({ caseId: input.caseId, actorUserId: me.id, type: "case_reassigned", content: input.reason });
  return { ok: true as const };
}

async function insertSupervision(tx: PointTx, coachingCase: CaseRow, me: StaffUser, input: SessionInput["supervision"] & { visitAt: Date; format: SessionInput["format"] | "supervision"; status: "draft" | "completed"; hasCoachUnit: boolean }) {
  const phase = phaseForVisit(coachingCase.serviceStart, input.visitAt);
  const error = validateSessionPhase({ phase, hasCoachUnit: input.hasCoachUnit, hasSupervision: true, format: input.format,
    lateChangeReason: input.format === "supervision" ? "" : "已在课堂变更记录中确认", lateChangeConfirmedBy: input.format === "supervision" ? null : me.id });
  if (error) throw new TRPCError({ code: "BAD_REQUEST", message: error });
  if (input.status === "completed") {
    required(input.alignment, "请填写本次任务对齐"); required(input.checks, "请填写督学检查记录"); required(input.exitCheck, "离店前必须完成验收");
  }
  const [{ id }] = await tx.insert(studySupervisionRecords).values({ caseId: coachingCase.id, studentUserId: coachingCase.studentUserId,
    supervisorId: me.id, visitAt: input.visitAt, phase, mode: input.hasCoachUnit ? "mixed" : "direct", signInAt: input.visitAt,
    selfStudyMinutes: input.selfStudyMinutes ?? 0, alignment: input.alignment?.trim() ?? "", checks: input.checks?.trim() ?? "",
    exitCheck: input.exitCheck?.trim() ?? "", followUp: input.followUp?.trim() ?? "", status: input.status }).$returningId();
  return { id, phase };
}

export async function saveSupervision(db: Db, me: StaffUser, input: { caseId: number; visitAt: Date; status: "draft" | "completed" } & SessionInput["supervision"]) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  return db.transaction(async (tx) => {
    const result = await insertSupervision(tx, coachingCase, me, { ...input, format: "supervision", hasCoachUnit: false });
    await event(tx, input.caseId, me.id, "supervision", `到店督学：${input.exitCheck || "已签到，待完成离店验收"}`);
    return result;
  });
}

export async function saveCourseSession(db: Db, me: StaffUser, input: SessionInput) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  if (!input.units.length || input.units.length > 5) throw new TRPCError({ code: "BAD_REQUEST", message: "教练课堂须包含 1～5 个内容单元；纯督学请走到店督学" });
  if (input.units.some((u) => u.courseKey === "supervision")) throw new TRPCError({ code: "BAD_REQUEST", message: "督学是独立主线，不作为混合课程内容单元" });
  if (input.format === "one_to_one" && input.participants.length !== 1) throw new TRPCError({ code: "BAD_REQUEST", message: "一对一课堂只能有一位学员" });
  if (!input.participants.length || input.participants.length > 30 || !input.participants.some((p) => p.studentUserId === coachingCase.studentUserId)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "请填写课堂参与人，并包含主档学员" });
  }
  const phase = phaseForVisit(coachingCase.serviceStart, input.startAt);
  const error = validateSessionPhase({ phase, hasCoachUnit: true, hasSupervision: true, format: input.format,
    lateChangeReason: input.changeReason, lateChangeConfirmedBy: input.lateChangeConfirmed ? me.id : null });
  if (error) throw new TRPCError({ code: "BAD_REQUEST", message: error });
  if (input.status === "completed") {
    required(input.sharedSummary, "请填写课堂总结");
    for (const unit of input.units) { required(unit.learningPoints, `${unit.title}须记录学习要点`); required(unit.practiceEvidence, `${unit.title}须记录现场练习证据`); }
    for (const participant of input.participants) {
      if (participant.attendance !== "absent" && participant.attendance !== "leave") {
        required(participant.action?.title, `学员 ${participant.studentUserId} 出席课堂后必须有独立的可验证行动`);
      }
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
  await ensureCourseCatalog(db, coachingCase.orgId);
  const catalog = await db.select().from(courseCatalog).where(eq(courseCatalog.orgId, coachingCase.orgId));
  return db.transaction(async (tx) => {
    const supervision = await insertSupervision(tx, coachingCase, me, { ...input.supervision, visitAt: input.startAt, format: input.format,
      status: input.status, hasCoachUnit: true });
    const [{ id: sessionId }] = await tx.insert(courseSessions).values({ caseId: input.caseId, orgId: coachingCase.orgId, supervisionId: supervision.id,
      coachId: me.id, startAt: input.startAt, phase, format: input.format, status: input.status,
      changeReason: input.changeReason?.trim() ?? "", changeConfirmedBy: input.lateChangeConfirmed ? me.id : null, sharedSummary: input.sharedSummary?.trim() ?? "" }).$returningId();
    for (let index = 0; index < input.units.length; index++) {
      const unit = input.units[index];
      const course = catalog.find((c) => c.courseKey === unit.courseKey && c.active);
      if (!course) throw new TRPCError({ code: "BAD_REQUEST", message: "课程内容不在本机构目录中" });
      if (unit.lessonNo != null && (unit.courseKey !== "method" || unit.lessonNo < 1 || unit.lessonNo > 12)) throw new TRPCError({ code: "BAD_REQUEST", message: "技法课节次须为 1～12" });
      await tx.insert(courseSessionUnits).values({ sessionId, courseKey: unit.courseKey, lessonNo: unit.lessonNo ?? null, title: required(unit.title, "内容单元标题不能为空"),
        snapshot: { version: course.version, title: course.title, purpose: course.purpose, outline: course.outline },
        learningPoints: unit.learningPoints?.trim() ?? "", practiceEvidence: unit.practiceEvidence?.trim() ?? "", sortOrder: index });
    }
    for (const participant of input.participants) {
      const ownerCase = cases.get(participant.studentUserId)!;
      if (ownerCase.id !== coachingCase.id) {
        await insertSupervision(tx, ownerCase, me, { ...input.supervision, visitAt: input.startAt, format: input.format,
          status: input.status, hasCoachUnit: true });
      }
      let taskId: number | null = null;
      if (participant.action && participant.attendance !== "absent" && participant.attendance !== "leave") {
        const [{ id }] = await tx.insert(coachingTasks).values({ caseId: ownerCase.id, title: required(participant.action.title, "每位出席学员都需要一个可验证行动"),
          detail: participant.action.detail?.trim() ?? "", ownerId: participant.studentUserId, verifierId: me.id, dueDate: participant.action.dueDate,
          evidence: "", result: "", createdBy: me.id }).$returningId();
        taskId = id;
      }
      await tx.insert(courseParticipants).values({ sessionId, studentUserId: participant.studentUserId, guardianLabel: participant.guardianLabel?.trim() ?? "",
        attendance: participant.attendance ?? "present", personalObservation: participant.personalObservation?.trim() ?? "", privateNote: participant.privateNote?.trim() ?? "",
        actionTaskId: taskId, feedbackText: participant.feedbackText?.trim() ?? "" });
      if (taskId) await event(tx, ownerCase.id, me.id, "course_action", participant.action!.title);
      if (ownerCase.id !== coachingCase.id) {
        await tx.insert(coachingHandoffs).values({ caseId: ownerCase.id, type: "H3", fromUserId: me.id, toUserId: ownerCase.supervisorId,
          title: "小组课后督学交接", content: input.sharedSummary?.trim() || input.units.map((u) => u.title).join("、") });
        await event(tx, ownerCase.id, me.id, "course_session", `${input.units.map((u) => u.title).join("＋")}＋督学（小组课堂 #${sessionId}）`);
      }
    }
    if (input.units.some((u) => u.courseKey === "parent")) {
      for (const p of input.participants) required(p.guardianLabel, "亲子美言课须逐位填写监护人身份");
    }
    if (phase === "late" && input.format !== "one_to_one") {
      await tx.update(coachingCases).set({ phaseMode: input.format, phaseChangeReason: input.changeReason!.trim(), phaseChangeConfirmedBy: me.id }).where(eq(coachingCases.id, input.caseId));
    }
    await tx.insert(coachingHandoffs).values({ caseId: input.caseId, type: "H3", fromUserId: me.id, toUserId: coachingCase.supervisorId,
      title: "课后督学交接", content: input.sharedSummary?.trim() || input.units.map((u) => u.title).join("、") });
    await event(tx, input.caseId, me.id, "course_session", `${input.units.map((u) => u.title).join("＋")}＋督学`);
    return { sessionId, supervisionId: supervision.id, phase };
  });
}

export async function pushParticipantFeedback(db: Db, me: StaffUser, input: { participantId: number; feedbackText: string }) {
  const [participant] = await db.select().from(courseParticipants).where(eq(courseParticipants.id, input.participantId)).limit(1);
  if (!participant) throw new TRPCError({ code: "NOT_FOUND", message: "课堂参与记录不存在" });
  const [session] = await db.select().from(courseSessions).where(eq(courseSessions.id, participant.sessionId)).limit(1);
  if (!session) throw new TRPCError({ code: "NOT_FOUND", message: "课堂不存在" });
  if (session.status !== "completed") throw new TRPCError({ code: "CONFLICT", message: "签到草稿尚未完成，不能正式推送家长反馈" });
  await assertCaseAccess(db, me, session.caseId);
  await assertStudentAccess(db, me, participant.studentUserId);
  const [ownerCase] = await db.select().from(coachingCases)
    .where(and(eq(coachingCases.orgId, session.orgId), eq(coachingCases.studentUserId, participant.studentUserId))).limit(1);
  if (!ownerCase) throw new TRPCError({ code: "NOT_FOUND", message: "参与学员的陪跑主档不存在" });
  return db.transaction(async (tx) => {
    const locked = (await tx.select().from(courseParticipants).where(eq(courseParticipants.id, input.participantId)).limit(1).for("update"))[0]!;
    const attachments = await tx.select({ id: coachingDeliverables.id }).from(coachingDeliverables).where(eq(coachingDeliverables.participantId, participant.id));
    const text = input.feedbackText.trim();
    if (!text && !attachments.length) throw new TRPCError({ code: "BAD_REQUEST", message: "请填写文字反馈或上传录音／图片" });
    const [previous] = await tx.select({ id: coachingDeliverables.id, version: coachingDeliverables.version }).from(coachingDeliverables)
      .where(and(eq(coachingDeliverables.participantId, participant.id), eq(coachingDeliverables.kind, "feedback"))).orderBy(desc(coachingDeliverables.version)).limit(1);
    const version = (previous?.version ?? 0) + 1;
    await tx.insert(coachingDeliverables).values({ caseId: ownerCase.id, sessionId: session.id, participantId: participant.id, kind: "feedback",
      body: text, visibility: "family", version, previousId: previous?.id ?? null, uploadedBy: me.id, pushedAt: new Date() });
    await tx.update(coachingDeliverables).set({ visibility: "family", pushedAt: new Date() }).where(eq(coachingDeliverables.participantId, participant.id));
    await tx.update(courseParticipants).set({ feedbackText: text, feedbackVersion: version, feedbackAt: new Date() }).where(eq(courseParticipants.id, locked.id));
    await event(tx, ownerCase.id, me.id, "feedback_pushed", `家长反馈 V${version} 已推送`);
    return { ok: true as const, version };
  });
}

export async function uploadCoachingDeliverable(db: Db, me: StaffUser, input: { caseId: number; sessionId?: number | null; participantId?: number | null; taskId?: number | null; kind: "text" | "audio" | "image"; body?: string; mediaData?: string; mimeType?: string }) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  const mediaData = input.mediaData?.trim() || null;
  if (input.kind !== "text" && !mediaData) throw new TRPCError({ code: "BAD_REQUEST", message: "请上传录音或图片" });
  if (input.kind === "text" && !input.body?.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "文字附件不能为空" });
  if (mediaData && mediaData.length > 5_600_000) throw new TRPCError({ code: "PAYLOAD_TOO_LARGE", message: "单个附件不能超过约 4 MB" });
  const allowed = ["image/jpeg", "image/png", "image/webp", "audio/mpeg", "audio/mp4", "audio/wav", "audio/webm", "audio/ogg"];
  if (mediaData && (!input.mimeType || !allowed.includes(input.mimeType))) throw new TRPCError({ code: "BAD_REQUEST", message: "附件仅支持常见图片或录音格式" });
  if (input.kind === "image" && !input.mimeType?.startsWith("image/")) throw new TRPCError({ code: "BAD_REQUEST", message: "图片格式不符" });
  if (input.kind === "audio" && !input.mimeType?.startsWith("audio/")) throw new TRPCError({ code: "BAD_REQUEST", message: "录音格式不符" });
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
    mediaData, mimeType: mediaData ? input.mimeType! : null, sizeBytes: mediaData ? Math.floor(mediaData.length * 3 / 4) : 0,
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
  await db.update(coachingGuardianGrants).set({ active: false }).where(eq(coachingGuardianGrants.id, grantId));
  await db.insert(coachingEvents).values({ caseId: grant.caseId, actorUserId: me.id, type: "guardian_revoked", content: `已撤销${grant.label}授权` });
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
  const [plans, tasks, sessions, attachments] = await Promise.all([
    db.select({ level: coachingPlans.level, title: coachingPlans.title, content: coachingPlans.content, version: coachingPlans.version,
      startDate: coachingPlans.startDate, endDate: coachingPlans.endDate }).from(coachingPlans)
      .where(and(eq(coachingPlans.caseId, coachingCase.id), eq(coachingPlans.status, "confirmed"))).orderBy(desc(coachingPlans.id)),
    db.select({ id: coachingTasks.id, title: coachingTasks.title, detail: coachingTasks.detail, dueDate: coachingTasks.dueDate,
      status: coachingTasks.status, result: coachingTasks.result }).from(coachingTasks)
      .where(and(eq(coachingTasks.caseId, coachingCase.id), eq(coachingTasks.ownerId, coachingCase.studentUserId))),
    (async () => {
      const fields = { id: courseSessions.id, startAt: courseSessions.startAt, sharedSummary: courseSessions.sharedSummary, format: courseSessions.format };
      const [own, joined] = await Promise.all([
        db.select(fields).from(courseSessions).where(and(eq(courseSessions.caseId, coachingCase.id), eq(courseSessions.status, "completed"))),
        db.select(fields).from(courseSessions).innerJoin(courseParticipants, eq(courseParticipants.sessionId, courseSessions.id))
          .where(and(eq(courseParticipants.studentUserId, coachingCase.studentUserId), eq(courseSessions.status, "completed"))),
      ]);
      const unique = new Map<number, (typeof own)[number]>();
      for (const row of [...own, ...joined]) unique.set(row.id, row);
      return [...unique.values()].sort((a, b) => b.startAt.getTime() - a.startAt.getTime());
    })(),
    db.select({ id: coachingDeliverables.id, sessionId: coachingDeliverables.sessionId, kind: coachingDeliverables.kind,
      mimeType: coachingDeliverables.mimeType, version: coachingDeliverables.version, createdAt: coachingDeliverables.createdAt })
      .from(coachingDeliverables).where(and(eq(coachingDeliverables.caseId, coachingCase.id), eq(coachingDeliverables.visibility, "family"), isNull(coachingDeliverables.disposedAt))),
  ]);
  const sessionIds = sessions.map((s) => s.id);
  const feedback = sessionIds.length ? await db.select({ sessionId: courseParticipants.sessionId, feedbackText: courseParticipants.feedbackText,
    feedbackVersion: courseParticipants.feedbackVersion, feedbackAt: courseParticipants.feedbackAt }).from(courseParticipants)
    .where(and(inArray(courseParticipants.sessionId, sessionIds), eq(courseParticipants.studentUserId, coachingCase.studentUserId))) : [];
  return { coachingCase: { id: coachingCase.id, goal: coachingCase.goal, planSummary: coachingCase.planSummary, serviceStart: coachingCase.serviceStart, serviceEnd: coachingCase.serviceEnd },
    plans, tasks, sessions: sessions.map((s) => ({ ...s, feedback: feedback.filter((f) => f.sessionId === s.id && f.feedbackVersion > 0) })),
    attachments: attachments.filter((a) => a.kind === "feedback" || sessions.some((s) => s.id === a.sessionId)) };
}

export async function downloadCoachingDeliverable(db: Db, me: { id: number; role: "tutor" | "user" | "admin" | "jiaowu"; orgId: number | null }, deliverableId: number) {
  const [row] = await db.select().from(coachingDeliverables).where(eq(coachingDeliverables.id, deliverableId)).limit(1);
  if (!row || row.disposedAt || (row.expiresAt && row.expiresAt.getTime() <= Date.now())) throw new TRPCError({ code: "NOT_FOUND", message: "附件不存在或已过期" });
  if (["tutor", "admin"].includes(me.role)) {
    await assertCaseAccess(db, me as StaffUser, row.caseId);
  } else {
    const coachingCase = await familyCase(db, me.id, row.caseId);
    if (coachingCase.id !== row.caseId || row.visibility !== "family" || !row.pushedAt) throw new TRPCError({ code: "FORBIDDEN", message: "附件尚未授权推送" });
  }
  await db.insert(coachingEvents).values({ caseId: row.caseId, actorUserId: me.id, type: "deliverable_downloaded", content: `下载附件 #${row.id}` });
  const ext = row.mimeType?.split("/")[1]?.replace("jpeg", "jpg") ?? "txt";
  return { fileName: `coaching-feedback-${row.id}.${ext}`, mimeType: row.mimeType ?? "text/plain;charset=utf-8", data: row.mediaData ?? row.body };
}
