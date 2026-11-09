import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { coachingCrisisFollowups, coachingEvents, coachingExceptionActions, coachingExceptions, users } from "@db/schema";
import { COACHING_EXCEPTION_CATEGORIES, COACHING_EXCEPTION_SEVERITIES, coachingExceptionSensitive,
  type CoachingExceptionCategory, type CoachingExceptionSeverity } from "@contracts/orgService";
import type { getDb } from "./queries/connection";
import { requireOrgStaff, type StaffUser } from "./orgAccess";
import { assertCaseAccess, type CoachingCaseRow } from "./coachingAccess";
import { queueCoachingNotification } from "./coachingNotifications";
import { encryptCoachingText, revealCoachingText } from "./coachingCrypto";
import { getCoachingDeliverySettings } from "./coachingDelivery";

type Db = ReturnType<typeof getDb>;
type ExceptionRow = typeof coachingExceptions.$inferSelect;
type ActionRow = typeof coachingExceptionActions.$inferSelect;
type ExceptionWithName = { exception: ExceptionRow; assigneeName: string | null };
type ActionWithName = { action: ActionRow; actorName: string | null };
export const CRISIS_FOLLOWUP_KINDS = ["guardian_notified", "emergency_contacted", "professional_review", "follow_up"] as const;
export type CrisisFollowupKind = typeof CRISIS_FOLLOWUP_KINDS[number];

function required(value: string | undefined, message: string): string {
  const text = value?.trim() ?? "";
  if (text.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message });
  return text;
}

async function recipient(db: Db, orgId: number, userId: number) {
  const [user] = await db.select({ id: users.id, role: users.role }).from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, orgId), inArray(users.role, ["tutor", "admin"]), isNull(users.deletedAt))).limit(1);
  if (!user) throw new TRPCError({ code: "FORBIDDEN", message: "接收人必须是本机构伴学师或管理员" });
  return user;
}

function decrypted(plain: string | null, encrypted: string | null, restricted: boolean, reveal: boolean) {
  if (restricted || !reveal || !encrypted) return plain ?? "";
  return revealCoachingText(plain, encrypted);
}

/** 普通列表永不返回密文；敏感正文仅在管理员 reveal 后解密并写审计。 */
export function projectCoachingException(row: ExceptionWithName, actions: ActionWithName[], reveal = false) {
  const item = row.exception;
  const restricted = item.sensitive && !reveal;
  return {
    id: item.id, caseId: item.caseId, severity: item.severity, status: item.status, sensitive: item.sensitive,
    category: restricted ? "restricted" : item.category, title: restricted ? "敏感异常 · 需管理员授权查看" : item.title,
    detail: restricted ? "" : decrypted(item.detail, item.detailCiphertext, false, reveal),
    closeEvidence: restricted ? "" : decrypted(item.closeEvidence, item.closeEvidenceCiphertext, false, reveal),
    assigneeId: item.assigneeId, assigneeName: row.assigneeName, dueAt: item.dueAt,
    createdBy: item.createdBy, createdAt: item.createdAt, updatedAt: item.updatedAt,
    closedBy: item.closedBy, closedAt: item.closedAt, restricted,
    actions: actions.filter((entry) => entry.action.exceptionId === item.id && entry.action.caseId === item.caseId)
      .map((entry) => ({
        id: entry.action.id, action: entry.action.action, actorUserId: entry.action.actorUserId,
        actorName: entry.actorName, createdAt: entry.action.createdAt,
        note: restricted ? "" : decrypted(entry.action.note, entry.action.noteCiphertext, false, reveal),
        evidence: restricted ? "" : decrypted(entry.action.evidence, entry.action.evidenceCiphertext, false, reveal),
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

function defaultDueAt(severity: CoachingExceptionSeverity, settings: { s1Hours: number; s2Hours: number; s3Hours: number }) {
  if (severity === "S4") return new Date();
  const hours = severity === "S1" ? settings.s1Hours : severity === "S2" ? settings.s2Hours : settings.s3Hours;
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

export async function createCoachingException(db: Db, me: StaffUser, input: {
  caseId: number; severity: CoachingExceptionSeverity; category: CoachingExceptionCategory;
  title: string; detail: string; sensitive?: boolean; assigneeId: number; dueAt?: Date;
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
  const settings = await getCoachingDeliverySettings(db, me);
  const dueAt = input.severity === "S4" ? new Date() : input.dueAt ?? defaultDueAt(input.severity, settings);
  return db.transaction(async (tx) => {
    const [{ id }] = await tx.insert(coachingExceptions).values({ orgId: coachingCase.orgId, caseId: coachingCase.id,
      severity: input.severity, category: input.category, title: sensitive ? "敏感服务异常" : title,
      detail: sensitive ? "" : detail, detailCiphertext: sensitive ? encryptCoachingText(detail) : null,
      sensitive, assigneeId: input.assigneeId, dueAt, createdBy: me.id, status: "open" }).$returningId();
    await tx.insert(coachingExceptionActions).values({ exceptionId: id, caseId: coachingCase.id, action: "created",
      note: sensitive ? "" : "登记异常，等待接收人处理", noteCiphertext: sensitive ? encryptCoachingText("登记异常，等待接收人处理") : null,
      evidence: "", actorUserId: me.id });
    if (input.severity === "S4") {
      for (const kind of CRISIS_FOLLOWUP_KINDS) {
        await tx.insert(coachingCrisisFollowups).values({ orgId: coachingCase.orgId, caseId: coachingCase.id, exceptionId: id,
          kind, detailCiphertext: encryptCoachingText("待处理"), evidenceCiphertext: encryptCoachingText("待处理"),
          status: "pending", ownerId: input.assigneeId, dueAt, createdBy: me.id });
      }
    }
    const categoryLabel = COACHING_EXCEPTION_CATEGORIES.find((item) => item.key === input.category)?.label ?? "服务";
    await tx.insert(coachingEvents).values({ caseId: coachingCase.id, actorUserId: me.id,
      type: "exception_created", visibility: "internal",
      content: `登记 ${input.severity} ${sensitive ? "敏感" : categoryLabel}异常 #${id}${input.severity === "S4" ? "，立即升级应急流程" : ""}` });
    const urgent = input.severity === "S4" || input.category === "wellbeing" || input.category === "safety";
    await queueCoachingNotification(tx, { orgId: coachingCase.orgId, caseId: coachingCase.id, recipientId: input.assigneeId,
      type: "exception_assigned", title: urgent ? "需要立即处理的服务异常" : "新的服务异常待处理",
      body: urgent ? "有一项需要立即处理的服务异常，请进入工作台按应急流程处理。通知不包含异常详情。" : "有一项服务异常待处理，请进入工作台查看权限范围内的内容并按期办结。",
      priority: urgent ? "urgent" : "normal", idempotencyKey: `exception:${id}:recipient:${input.assigneeId}`, createdBy: me.id });
    return { id, sensitive, status: "open" as const, dueAt };
  });
}

function projectCrisis(row: typeof coachingCrisisFollowups.$inferSelect, reveal: boolean) {
  return { id: row.id, exceptionId: row.exceptionId, caseId: row.caseId, kind: row.kind, status: row.status,
    ownerId: row.ownerId, dueAt: row.dueAt, completedAt: row.completedAt, createdAt: row.createdAt, updatedAt: row.updatedAt,
    detail: reveal ? revealCoachingText("", row.detailCiphertext) : "", evidence: reveal ? revealCoachingText("", row.evidenceCiphertext) : "", restricted: !reveal };
}

export async function listCoachingCrisisFollowups(db: Db, me: StaffUser, exceptionId: number, reveal = false) {
  const { row } = await findException(db, me, exceptionId);
  if (row.severity !== "S4") return [];
  if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "S4 危机跟进仅本机构管理员可查看与处理" });
  const rows = await db.select().from(coachingCrisisFollowups).where(and(eq(coachingCrisisFollowups.exceptionId, exceptionId), eq(coachingCrisisFollowups.caseId, row.caseId))).orderBy(asc(coachingCrisisFollowups.id));
  return rows.map((item) => projectCrisis(item, reveal));
}

export async function recordCoachingCrisisFollowup(db: Db, me: StaffUser, input: {
  followupId: number; kind?: CrisisFollowupKind; detail: string; evidence: string; status: "pending" | "completed";
}) {
  if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "S4 危机跟进仅本机构管理员可处理" });
  const [existing] = await db.select().from(coachingCrisisFollowups).where(eq(coachingCrisisFollowups.id, input.followupId)).limit(1);
  if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "危机跟进事项不存在" });
  const { row } = await findException(db, me, existing.exceptionId);
  if (row.severity !== "S4" || row.status === "closed") throw new TRPCError({ code: "CONFLICT", message: "异常已关闭或不属于 S4" });
  const detail = required(input.detail, "请填写本次危机处理事实");
  const evidence = required(input.evidence, "请填写可核验的处理证据");
  if (input.kind && input.kind !== existing.kind) throw new TRPCError({ code: "BAD_REQUEST", message: "不能改变危机跟进事项类型" });
  await db.transaction(async (tx) => {
    await tx.update(coachingCrisisFollowups).set({ detailCiphertext: encryptCoachingText(detail), evidenceCiphertext: encryptCoachingText(evidence),
      status: input.status, completedAt: input.status === "completed" ? new Date() : null }).where(and(eq(coachingCrisisFollowups.id, existing.id), eq(coachingCrisisFollowups.exceptionId, row.id)));
    await tx.insert(coachingEvents).values({ caseId: row.caseId, actorUserId: me.id, type: "crisis_followup_updated",
      content: `S4 异常 #${row.id} 的 ${existing.kind} 跟进已${input.status === "completed" ? "完成并留存证据" : "更新"}`, visibility: "internal" });
  });
  return { id: existing.id, status: input.status };
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
    if (row.severity === "S4" && input.action === "closed") {
      const followups = await tx.select().from(coachingCrisisFollowups).where(eq(coachingCrisisFollowups.exceptionId, row.id)).for("update");
      const kinds = new Set(followups.filter((item) => item.status === "completed" && item.completedAt).map((item) => item.kind));
      if (CRISIS_FOLLOWUP_KINDS.some((kind) => !kinds.has(kind))) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "S4 须先完成监护人通知、紧急联系人联系、专业复核／转介与后续跟进，并分别留存证据" });
      }
    }
    const now = new Date();
    await tx.insert(coachingExceptionActions).values({ exceptionId: row.id, caseId: row.caseId, action: input.action,
      note: row.sensitive ? "" : note, noteCiphertext: row.sensitive ? encryptCoachingText(note) : null,
      evidence: row.sensitive ? "" : evidence, evidenceCiphertext: row.sensitive && evidence ? encryptCoachingText(evidence) : null,
      actorUserId: me.id, createdAt: now });
    const result = await tx.update(coachingExceptions).set({ status: input.action === "closed" ? "closed" : "processing",
      updatedAt: now, closedBy: input.action === "closed" ? me.id : null,
      closedAt: input.action === "closed" ? now : null, closeEvidence: input.action === "closed" && !row.sensitive ? evidence : null,
      closeEvidenceCiphertext: input.action === "closed" && row.sensitive ? encryptCoachingText(evidence) : null })
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
  if (!withName || withName.exception.orgId !== row.orgId || withName.exception.caseId !== row.caseId) throw new TRPCError({ code: "NOT_FOUND", message: "异常记录不存在" });
  const actions = await db.select({ action: coachingExceptionActions, actorName: users.name }).from(coachingExceptionActions)
    .leftJoin(users, eq(coachingExceptionActions.actorUserId, users.id))
    .where(and(eq(coachingExceptionActions.caseId, row.caseId), eq(coachingExceptionActions.exceptionId, row.id))).orderBy(asc(coachingExceptionActions.id));
  await db.insert(coachingEvents).values({ caseId: row.caseId, actorUserId: me.id,
    type: "sensitive_exception_revealed", visibility: "internal", content: `管理员查看敏感异常 #${row.id} 详情与处理记录` });
  const crisisFollowups = row.severity === "S4" ? await listCoachingCrisisFollowups(db, me, row.id, true) : [];
  return { ...projectCoachingException(withName, actions, true), crisisFollowups };
}
