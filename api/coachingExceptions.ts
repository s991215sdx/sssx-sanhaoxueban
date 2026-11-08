import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { coachingEvents, coachingExceptionActions, coachingExceptions, users } from "@db/schema";
import { COACHING_EXCEPTION_CATEGORIES, COACHING_EXCEPTION_SEVERITIES, coachingExceptionSensitive,
  type CoachingExceptionCategory, type CoachingExceptionSeverity } from "@contracts/orgService";
import type { getDb } from "./queries/connection";
import { requireOrgStaff, type StaffUser } from "./orgAccess";
import { assertCaseAccess, type CoachingCaseRow } from "./coachingAccess";

type Db = ReturnType<typeof getDb>;
type ExceptionRow = typeof coachingExceptions.$inferSelect;
type ActionRow = typeof coachingExceptionActions.$inferSelect;
type ExceptionWithName = { exception: ExceptionRow; assigneeName: string | null };
type ActionWithName = { action: ActionRow; actorName: string | null };

function required(value: string | undefined, message: string): string {
  const text = value?.trim() ?? "";
  if (!text) throw new TRPCError({ code: "BAD_REQUEST", message });
  return text;
}

async function recipient(db: Db, orgId: number, userId: number) {
  const [user] = await db.select({ id: users.id, role: users.role }).from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, orgId), inArray(users.role, ["tutor", "admin"]), isNull(users.deletedAt))).limit(1);
  if (!user) throw new TRPCError({ code: "FORBIDDEN", message: "接收人必须是本机构伴学师或管理员" });
  return user;
}

/**
 * 默认投影对管理员也只给敏感元数据。敏感正文只能经 revealCoachingException
 * 单独获取并写审计，避免普通详情、时间线或家庭端意外带出敏感内容。
 */
export function projectCoachingException(row: ExceptionWithName, actions: ActionWithName[], reveal = false) {
  const item = row.exception;
  const restricted = item.sensitive && !reveal;
  return {
    id: item.id, caseId: item.caseId, severity: item.severity, status: item.status, sensitive: item.sensitive,
    category: restricted ? "restricted" : item.category, title: restricted ? "敏感异常 · 需管理员授权查看" : item.title,
    detail: restricted ? "" : item.detail, closeEvidence: restricted ? "" : item.closeEvidence,
    assigneeId: item.assigneeId, assigneeName: row.assigneeName, dueAt: item.dueAt,
    createdBy: item.createdBy, createdAt: item.createdAt, updatedAt: item.updatedAt,
    closedBy: item.closedBy, closedAt: item.closedAt, restricted,
    actions: actions.filter((entry) => entry.action.exceptionId === item.id && entry.action.caseId === item.caseId)
      .map((entry) => ({
        id: entry.action.id, action: entry.action.action, actorUserId: entry.action.actorUserId,
        actorName: entry.actorName, createdAt: entry.action.createdAt,
        note: restricted ? "" : entry.action.note, evidence: restricted ? "" : entry.action.evidence,
      })),
  };
}

export async function listCoachingExceptions(db: Db, me: StaffUser, coachingCase: CoachingCaseRow) {
  requireOrgStaff(me);
  const rows = await db.select({ exception: coachingExceptions, assigneeName: users.name }).from(coachingExceptions)
    .leftJoin(users, eq(coachingExceptions.assigneeId, users.id))
    .where(and(eq(coachingExceptions.caseId, coachingCase.id), eq(coachingExceptions.orgId, coachingCase.orgId)))
    .orderBy(desc(coachingExceptions.id)).limit(100);
  const ids = rows.map((row) => row.exception.id);
  const actions = ids.length ? await db.select({ action: coachingExceptionActions, actorName: users.name }).from(coachingExceptionActions)
    .leftJoin(users, eq(coachingExceptionActions.actorUserId, users.id))
    .where(and(eq(coachingExceptionActions.caseId, coachingCase.id), inArray(coachingExceptionActions.exceptionId, ids)))
    .orderBy(asc(coachingExceptionActions.id)) : [];
  return rows.map((row) => projectCoachingException(row, actions));
}

async function findException(db: Db, me: StaffUser, exceptionId: number) {
  const [row] = await db.select().from(coachingExceptions).where(eq(coachingExceptions.id, exceptionId)).limit(1);
  if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "异常记录不存在" });
  const coachingCase = await assertCaseAccess(db, me, row.caseId);
  if (row.orgId !== coachingCase.orgId || row.caseId !== coachingCase.id) throw new TRPCError({ code: "NOT_FOUND", message: "异常记录不存在" });
  return { row, coachingCase };
}

export async function createCoachingException(db: Db, me: StaffUser, input: {
  caseId: number; severity: CoachingExceptionSeverity; category: CoachingExceptionCategory;
  title: string; detail: string; sensitive?: boolean; assigneeId: number; dueAt: Date;
}) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  if (!(COACHING_EXCEPTION_SEVERITIES as readonly string[]).includes(input.severity)
    || !COACHING_EXCEPTION_CATEGORIES.some((item) => item.key === input.category)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "异常等级或类别无效" });
  }
  const title = required(input.title, "请填写异常标题");
  const detail = required(input.detail, "请填写异常事实与影响");
  const sensitive = coachingExceptionSensitive(input.severity, input.category, input.sensitive);
  const assignee = await recipient(db, coachingCase.orgId, input.assigneeId);
  if (sensitive && assignee.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "敏感异常必须由本机构管理员接收" });
  return db.transaction(async (tx) => {
    const [{ id }] = await tx.insert(coachingExceptions).values({ orgId: coachingCase.orgId, caseId: coachingCase.id,
      severity: input.severity, category: input.category, title, detail, sensitive, assigneeId: input.assigneeId,
      dueAt: input.dueAt, createdBy: me.id, status: "open" }).$returningId();
    await tx.insert(coachingExceptionActions).values({ exceptionId: id, caseId: coachingCase.id, action: "created",
      note: "登记异常，等待接收人处理", evidence: "", actorUserId: me.id });
    const categoryLabel = COACHING_EXCEPTION_CATEGORIES.find((item) => item.key === input.category)?.label ?? "服务";
    await tx.insert(coachingEvents).values({ caseId: coachingCase.id, actorUserId: me.id,
      type: "exception_created", visibility: "internal",
      content: `登记 ${input.severity} ${sensitive ? "敏感" : categoryLabel}异常 #${id}${input.severity === "S4" ? "，立即升级应急流程" : ""}` });
    return { id, sensitive, status: "open" as const };
  });
}

export async function recordCoachingException(db: Db, me: StaffUser, input: {
  exceptionId: number; action: "progress" | "closed"; note: string; evidence?: string;
}) {
  const found = await findException(db, me, input.exceptionId);
  if (found.row.sensitive && me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "敏感异常仅本机构管理员可查看与处理" });
  const note = required(input.note, input.action === "closed" ? "请填写处理结果" : "请填写本次处理进展");
  const evidence = input.evidence?.trim() ?? "";
  if (input.action === "closed" && evidence.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "关闭异常必须填写可核验的关闭证据" });
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(coachingExceptions).where(eq(coachingExceptions.id, found.row.id)).limit(1).for("update");
    if (!row || row.orgId !== found.coachingCase.orgId || row.caseId !== found.coachingCase.id) throw new TRPCError({ code: "NOT_FOUND", message: "异常记录不存在" });
    if (row.status === "closed") throw new TRPCError({ code: "CONFLICT", message: "异常已关闭，不能覆盖原处理与关闭证据" });
    const now = new Date();
    await tx.insert(coachingExceptionActions).values({ exceptionId: row.id, caseId: row.caseId, action: input.action,
      note, evidence, actorUserId: me.id, createdAt: now });
    const result = await tx.update(coachingExceptions).set({ status: input.action === "closed" ? "closed" : "processing",
      updatedAt: now, closedBy: input.action === "closed" ? me.id : null,
      closedAt: input.action === "closed" ? now : null, closeEvidence: input.action === "closed" ? evidence : null })
      .where(and(eq(coachingExceptions.id, row.id), ne(coachingExceptions.status, "closed")));
    if ("affectedRows" in result && result.affectedRows !== 1) throw new TRPCError({ code: "CONFLICT", message: "异常状态已变化，请刷新后再处理" });
    await tx.insert(coachingEvents).values({ caseId: row.caseId, actorUserId: me.id,
      type: input.action === "closed" ? "exception_closed" : "exception_progress", visibility: "internal",
      content: `${row.severity} ${row.sensitive ? "敏感" : "服务"}异常 #${row.id}${input.action === "closed" ? "已核验证据并关闭" : "已登记处理进展"}` });
    return { ok: true as const, status: input.action === "closed" ? "closed" as const : "processing" as const };
  });
}

export async function revealCoachingException(db: Db, me: StaffUser, exceptionId: number) {
  const { row } = await findException(db, me, exceptionId);
  if (!row.sensitive) throw new TRPCError({ code: "BAD_REQUEST", message: "普通异常无需单独授权查看" });
  if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "敏感异常仅本机构管理员可查看" });
  const [withName] = await db.select({ exception: coachingExceptions, assigneeName: users.name }).from(coachingExceptions)
    .leftJoin(users, eq(coachingExceptions.assigneeId, users.id)).where(eq(coachingExceptions.id, row.id)).limit(1);
  if (!withName || withName.exception.orgId !== row.orgId || withName.exception.caseId !== row.caseId) {
    throw new TRPCError({ code: "NOT_FOUND", message: "异常记录不存在" });
  }
  const actions = await db.select({ action: coachingExceptionActions, actorName: users.name }).from(coachingExceptionActions)
    .leftJoin(users, eq(coachingExceptionActions.actorUserId, users.id))
    .where(and(eq(coachingExceptionActions.caseId, row.caseId), eq(coachingExceptionActions.exceptionId, row.id))).orderBy(asc(coachingExceptionActions.id));
  await db.insert(coachingEvents).values({ caseId: row.caseId, actorUserId: me.id,
    type: "sensitive_exception_revealed", visibility: "internal", content: `管理员查看敏感异常 #${row.id} 详情与处理记录` });
  return projectCoachingException(withName, actions, true);
}
