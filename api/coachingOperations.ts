import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  coachingCases, coachingCrisisFollowups, coachingExceptions, coachingExtendedRecords, coachingHandoffs, coachingPlans,
  coachingQualityReviews, coachingTasks, courseSessions, studySupervisionRecords, users,
} from "@db/schema";
import {
  coachingLoadWarning, coachingOperationCategory, shanghaiDate, shiftShanghaiDate,
  type CoachingOperationItem,
} from "@contracts/orgService";
import type { getDb } from "./queries/connection";
import { listCoachingCases } from "./coachingService";
import { getCoachingNotificationSettings, queueCoachingNotification } from "./coachingNotifications";
import { requireOrgStaff, type StaffUser } from "./orgAccess";

type Db = ReturnType<typeof getDb>;
type OperationCase = typeof coachingCases.$inferSelect & { studentName: string };
export type CoachingOperationSource = {
  cases: OperationCase[];
  tasks: (typeof coachingTasks.$inferSelect)[];
  handoffs: (typeof coachingHandoffs.$inferSelect)[];
  quality: (typeof coachingQualityReviews.$inferSelect)[];
  exceptions: Pick<typeof coachingExceptions.$inferSelect, "id" | "caseId" | "severity" | "category" | "sensitive" | "status" | "assigneeId" | "dueAt" | "createdAt">[];
  sessions: Pick<typeof courseSessions.$inferSelect, "id" | "caseId" | "coachId" | "startAt" | "status" | "format">[];
  supervisions: Pick<typeof studySupervisionRecords.$inferSelect, "id" | "caseId" | "supervisorId" | "visitAt" | "status">[];
  records?: Pick<typeof coachingExtendedRecords.$inferSelect, "id" | "caseId" | "recordType" | "title" | "sensitive" | "status" | "ownerId" | "dueAt" | "createdAt">[];
  plans?: Pick<typeof coachingPlans.$inferSelect, "id" | "caseId" | "title" | "status" | "endDate" | "createdBy">[];
  crisisFollowups?: Pick<typeof coachingCrisisFollowups.$inferSelect, "id" | "caseId" | "exceptionId" | "kind" | "status" | "ownerId" | "dueAt">[];
};

function endOfShanghaiDate(date: string): string {
  return new Date(`${date}T23:59:59+08:00`).toISOString();
}

/** 纯聚合：负责人待办、未来交付与风险统一口径；暂停／结课／归档不进入常规分母。 */
export function buildCoachingOperations(source: CoachingOperationSource, recipientId: number | undefined, now = new Date()) {
  const today = shanghaiDate(now);
  const activeIds = new Set(source.cases.filter((row) => row.status === "active").map((row) => row.id));
  const names = new Map(source.cases.map((row) => [row.id, row.studentName || `学员 #${row.studentUserId}`]));
  const items: CoachingOperationItem[] = [];
  const add = (item: Omit<CoachingOperationItem, "studentName" | "category"> & { risk?: boolean }) => {
    if (!activeIds.has(item.caseId) || (recipientId != null && item.recipientId !== recipientId)) return;
    items.push({ ...item, studentName: names.get(item.caseId) ?? "学员", category: item.risk ? "risk" : coachingOperationCategory(item.dueDate, today) });
  };
  for (const row of source.tasks) {
    if (row.status === "verified") continue;
    add({ key: `task:${row.id}`, kind: "task", title: row.title, caseId: row.caseId,
      recipientId: row.verifierId, dueDate: row.dueDate, dueAt: endOfShanghaiDate(row.dueDate), sensitive: false });
  }
  for (const row of source.handoffs) {
    if (row.status !== "pending") continue;
    const dueDate = row.dueAt ? shanghaiDate(row.dueAt) : today;
    add({ key: `handoff:${row.id}`, kind: "handoff", title: `${row.type} 服务交接待接收`, caseId: row.caseId,
      recipientId: row.toUserId, dueDate, dueAt: row.dueAt?.toISOString() ?? null, sensitive: false });
  }
  for (const row of source.quality) {
    if (row.status !== "pending") continue;
    const dueDate = row.dueAt ? shanghaiDate(row.dueAt) : today;
    const label = row.reviewType === "self" ? "质量自查" : row.reviewType === "peer" ? "同伴互查" : "主管抽查";
    add({ key: `quality:${row.id}`, kind: "quality", title: `${label} · ${row.periodKey}`, caseId: row.caseId,
      recipientId: row.reviewerId, dueDate, dueAt: row.dueAt?.toISOString() ?? null, sensitive: false });
  }
  for (const row of source.exceptions) {
    if (row.status === "closed") continue;
    const title = row.severity === "S4" ? "需要立即处理的服务异常" : row.sensitive ? "敏感服务异常待处理" : "服务异常待处理";
    add({ key: `exception:${row.id}`, kind: "exception", title, caseId: row.caseId,
      recipientId: row.assigneeId, dueDate: shanghaiDate(row.dueAt), dueAt: row.dueAt.toISOString(), sensitive: row.sensitive, risk: true });
  }
  for (const row of source.sessions) {
    if (row.status === "cancelled") continue;
    const dueDate = shanghaiDate(row.startAt);
    if (row.status === "completed" && dueDate < today) continue;
    add({ key: `session:${row.id}`, kind: "session", title: row.status === "draft" ? "课堂草稿与交付待完成" : "近期课堂交付", caseId: row.caseId,
      recipientId: row.coachId, dueDate, dueAt: row.startAt.toISOString(), sensitive: false });
  }
  for (const row of source.supervisions) {
    if (row.status === "cancelled") continue;
    const dueDate = shanghaiDate(row.visitAt);
    if (row.status === "completed" && dueDate < today) continue;
    add({ key: `supervision:${row.id}`, kind: "supervision", title: row.status === "draft" ? "督学草稿与离店验收待完成" : "到店督学交付", caseId: row.caseId,
      recipientId: row.supervisorId, dueDate, dueAt: row.visitAt.toISOString(), sensitive: false });
  }
  const caseCoaches = new Map(source.cases.map((row) => [row.id, row.coachId]));
  for (const row of source.records ?? []) {
    const awaitingVerification = row.recordType === "family_action" && row.status === "completed";
    if (!awaitingVerification && ["completed", "verified", "closed", "cancelled"].includes(row.status)) continue;
    const dueAt = row.dueAt ?? row.createdAt;
    add({ key: `record:${row.id}`, kind: "record", title: row.sensitive ? "敏感过程记录待办理" : awaitingVerification ? `家庭行动待核验 · ${row.title}` : `${row.recordType} · ${row.title}`,
      caseId: row.caseId, recipientId: row.ownerId, dueDate: shanghaiDate(dueAt), dueAt: dueAt.toISOString(), sensitive: row.sensitive });
  }
  for (const row of source.plans ?? []) {
    if (row.status !== "awaiting_family") continue;
    add({ key: `plan:${row.id}`, kind: "plan", title: `计划待学生与至少一位监护人会签 · ${row.title}`, caseId: row.caseId,
      recipientId: caseCoaches.get(row.caseId) ?? row.createdBy, dueDate: row.endDate, dueAt: endOfShanghaiDate(row.endDate), sensitive: false });
  }
  for (const row of source.crisisFollowups ?? []) {
    if (row.status === "completed") continue;
    add({ key: `crisis:${row.id}`, kind: "crisis", title: "S4 危机后续待闭环", caseId: row.caseId,
      recipientId: row.ownerId, dueDate: shanghaiDate(row.dueAt), dueAt: row.dueAt.toISOString(), sensitive: true, risk: true });
  }
  const rank = { overdue: 0, risk: 1, today: 2, upcoming: 3 };
  items.sort((a, b) => rank[a.category] - rank[b.category] || a.dueDate.localeCompare(b.dueDate) || a.key.localeCompare(b.key));
  const nextDeliveries = items.filter((row) => row.category === "upcoming").sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 5);
  return {
    today, generatedAt: now.toISOString(), items, nextDeliveries,
    summary: {
      today: items.filter((row) => row.dueDate === today).length,
      overdue: items.filter((row) => row.dueDate < today).length,
      upcoming: items.filter((row) => row.dueDate > today && row.dueDate <= shiftShanghaiDate(today, 7)).length,
      risks: items.filter((row) => row.category === "risk").length,
    },
  };
}

async function operationSource(db: Db, cases: OperationCase[]): Promise<CoachingOperationSource> {
  const caseIds = cases.map((row) => row.id);
  if (!caseIds.length) return { cases, tasks: [], handoffs: [], quality: [], exceptions: [], sessions: [], supervisions: [], records: [], plans: [], crisisFollowups: [] };
  const [tasks, handoffs, quality, exceptions, sessions, supervisions, records, plans, crisisFollowups] = await Promise.all([
    db.select().from(coachingTasks).where(inArray(coachingTasks.caseId, caseIds)),
    db.select().from(coachingHandoffs).where(inArray(coachingHandoffs.caseId, caseIds)),
    db.select().from(coachingQualityReviews).where(inArray(coachingQualityReviews.caseId, caseIds)),
    db.select({ id: coachingExceptions.id, caseId: coachingExceptions.caseId, severity: coachingExceptions.severity,
      category: coachingExceptions.category, sensitive: coachingExceptions.sensitive, status: coachingExceptions.status,
      assigneeId: coachingExceptions.assigneeId, dueAt: coachingExceptions.dueAt, createdAt: coachingExceptions.createdAt })
      .from(coachingExceptions).where(inArray(coachingExceptions.caseId, caseIds)),
    db.select({ id: courseSessions.id, caseId: courseSessions.caseId, coachId: courseSessions.coachId,
      startAt: courseSessions.startAt, status: courseSessions.status, format: courseSessions.format })
      .from(courseSessions).where(inArray(courseSessions.caseId, caseIds)),
    db.select({ id: studySupervisionRecords.id, caseId: studySupervisionRecords.caseId, supervisorId: studySupervisionRecords.supervisorId,
      visitAt: studySupervisionRecords.visitAt, status: studySupervisionRecords.status })
      .from(studySupervisionRecords).where(inArray(studySupervisionRecords.caseId, caseIds)),
    db.select({ id: coachingExtendedRecords.id, caseId: coachingExtendedRecords.caseId, recordType: coachingExtendedRecords.recordType,
      title: coachingExtendedRecords.title, sensitive: coachingExtendedRecords.sensitive, status: coachingExtendedRecords.status,
      ownerId: coachingExtendedRecords.ownerId, dueAt: coachingExtendedRecords.dueAt, createdAt: coachingExtendedRecords.createdAt })
      .from(coachingExtendedRecords).where(inArray(coachingExtendedRecords.caseId, caseIds)),
    db.select({ id: coachingPlans.id, caseId: coachingPlans.caseId, title: coachingPlans.title, status: coachingPlans.status,
      endDate: coachingPlans.endDate, createdBy: coachingPlans.createdBy }).from(coachingPlans).where(inArray(coachingPlans.caseId, caseIds)),
    db.select({ id: coachingCrisisFollowups.id, caseId: coachingCrisisFollowups.caseId, exceptionId: coachingCrisisFollowups.exceptionId,
      kind: coachingCrisisFollowups.kind, status: coachingCrisisFollowups.status, ownerId: coachingCrisisFollowups.ownerId, dueAt: coachingCrisisFollowups.dueAt })
      .from(coachingCrisisFollowups).where(inArray(coachingCrisisFollowups.caseId, caseIds)),
  ]);
  return { cases, tasks, handoffs, quality, exceptions, sessions, supervisions, records, plans, crisisFollowups };
}

export async function coachingOperations(db: Db, me: StaffUser) {
  const orgId = requireOrgStaff(me);
  const visible = await listCoachingCases(db, me);
  const cases = visible.map((row) => ({ ...row.coachingCase, studentName: row.studentName ?? `学员 #${row.coachingCase.studentUserId}` }));
  /* 新接收人尚未进入主档名单，也必须看到分配给自己的交接；只补聚合范围，不开放主档权限。 */
  const incoming = await db.select({ coachingCase: coachingCases, studentName: users.name }).from(coachingHandoffs)
    .innerJoin(coachingCases, eq(coachingHandoffs.caseId, coachingCases.id))
    .leftJoin(users, eq(coachingCases.studentUserId, users.id))
    .where(and(eq(coachingHandoffs.toUserId, me.id), eq(coachingHandoffs.status, "pending"), eq(coachingCases.orgId, orgId)));
  const caseMap = new Map(cases.map((row) => [row.id, row]));
  for (const row of incoming) {
    if (!caseMap.has(row.coachingCase.id)) caseMap.set(row.coachingCase.id, { ...row.coachingCase, studentName: row.studentName ?? `学员 #${row.coachingCase.studentUserId}` });
  }
  const source = await operationSource(db, [...caseMap.values()]);
  return { ...buildCoachingOperations(source, me.id), accessibleCaseIds: cases.map((row) => row.id) };
}

export function buildCoachingStaffLoads(source: CoachingOperationSource, staff: { id: number; name: string | null; role: string }[], suggestedCaseLoad: number, now = new Date()) {
  const all = buildCoachingOperations(source, undefined, now).items;
  return staff.map((person) => {
    const activeCases = source.cases.filter((row) => row.status === "active" && (row.coachId === person.id || row.supervisorId === person.id)).length;
    const pausedCases = source.cases.filter((row) => row.status === "paused" && (row.coachId === person.id || row.supervisorId === person.id)).length;
    const own = all.filter((row) => row.recipientId === person.id);
    const todayTodos = own.filter((row) => row.dueDate === shanghaiDate(now)).length;
    const overdueTodos = own.filter((row) => row.dueDate < shanghaiDate(now)).length;
    const openRisks = own.filter((row) => row.category === "risk").length;
    return { userId: person.id, name: person.name ?? `员工 #${person.id}`, role: person.role,
      activeCases, pausedCases, todayTodos, overdueTodos, openRisks, suggestedCaseLoad,
      ...coachingLoadWarning(activeCases, overdueTodos, suggestedCaseLoad) };
  }).sort((a, b) => Number(b.overdue) - Number(a.overdue) || b.overdueTodos - a.overdueTodos || b.activeCases - a.activeCases || a.userId - b.userId);
}

export async function coachingStaffWorkloads(db: Db, me: StaffUser) {
  const orgId = requireOrgStaff(me);
  if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "仅机构管理员可查看全机构人员负荷" });
  const [staff, caseRows, settings] = await Promise.all([
    db.select({ id: users.id, name: users.name, role: users.role }).from(users)
      .where(and(eq(users.orgId, orgId), or(eq(users.role, "tutor"), eq(users.role, "admin")), isNull(users.deletedAt))).orderBy(users.id),
    db.select({ coachingCase: coachingCases, studentName: users.name }).from(coachingCases)
      .leftJoin(users, eq(coachingCases.studentUserId, users.id)).where(eq(coachingCases.orgId, orgId)).orderBy(desc(coachingCases.updatedAt)),
    getCoachingNotificationSettings(db, me),
  ]);
  const cases = caseRows.map((row) => ({ ...row.coachingCase, studentName: row.studentName ?? `学员 #${row.coachingCase.studentUserId}` }));
  const source = await operationSource(db, cases);
  return { staff: buildCoachingStaffLoads(source, staff, settings.suggestedCaseLoad), settings };
}

export async function remindCoachingOperation(db: Db, me: StaffUser, itemKey: string) {
  const operations = await coachingOperations(db, me);
  const item = operations.items.find((row) => row.key === itemKey);
  if (!item) throw new TRPCError({ code: "NOT_FOUND", message: "待办不存在、已办结或不属于当前账号" });
  const orgId = requireOrgStaff(me);
  return queueCoachingNotification(db, {
    orgId, caseId: item.caseId, recipientId: me.id, type: "operation_reminder",
    title: item.kind === "exception" && item.sensitive ? "服务异常处理提醒" : "陪跑运营待办提醒",
    body: `你有一项${item.title}，期限 ${item.dueDate}。请进入伴学工作台及时处理。`,
    priority: item.kind === "exception" && item.title.includes("立即") ? "urgent" : "normal",
    idempotencyKey: `operation-reminder:${orgId}:${me.id}:${item.key}:${operations.today}`, createdBy: me.id,
  });
}
