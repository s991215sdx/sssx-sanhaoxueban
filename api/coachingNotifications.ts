import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, lte } from "drizzle-orm";
import { coachingCases, coachingGuardianGrants, coachingNotifications, coachingNotificationSettings } from "@db/schema";
import { DEFAULT_COACHING_NOTIFICATION_SETTINGS, isShanghaiQuietTime, nextShanghaiOpening } from "@contracts/orgService";
import type { getDb } from "./queries/connection";
import type { PointTx } from "./orgPoints";
import { requireOrgStaff, type StaffUser } from "./orgAccess";

type Db = ReturnType<typeof getDb>;
type QueryDb = Db | PointTx;
type Recipient = { id: number; role: string; orgId?: number | null };
type NotificationInput = {
  orgId: number;
  caseId?: number | null;
  recipientId: number;
  type: string;
  title: string;
  body: string;
  priority?: "normal" | "urgent";
  idempotencyKey: string;
  createdBy?: number | null;
  now?: Date;
};

export const COACHING_NOTIFICATION_STATUS: Record<string, string> = {
  pending: "待发送", sent: "已发送", delivered: "已送达", failed: "发送失败", manual: "已转人工",
};

/** timestamp 未声明小数秒；先截断毫秒，避免数据库四舍五入到下一秒而让已发送通知暂不可投递。 */
export function coachingNotificationTime(value = new Date()): Date {
  return new Date(Math.floor(value.getTime() / 1000) * 1000);
}

async function settingsFor(db: QueryDb, orgId: number) {
  const [row] = await db.select().from(coachingNotificationSettings).where(eq(coachingNotificationSettings.orgId, orgId)).limit(1);
  return row ?? { ...DEFAULT_COACHING_NOTIFICATION_SETTINGS };
}

/** 在业务事务内写入站内通知；唯一键保证交接、月报与反馈重试不重复提醒。 */
export async function queueCoachingNotification(db: QueryDb, input: NotificationInput) {
  const now = coachingNotificationTime(input.now);
  const [existing] = await db.select({ id: coachingNotifications.id, status: coachingNotifications.status })
    .from(coachingNotifications).where(eq(coachingNotifications.idempotencyKey, input.idempotencyKey)).limit(1);
  if (existing) return { id: existing.id, status: existing.status, duplicate: true as const };
  const settings = await settingsFor(db, input.orgId);
  const urgent = input.priority === "urgent";
  const notBefore = urgent ? now : nextShanghaiOpening(now, settings.quietStart, settings.quietEnd);
  const sendNow = notBefore.getTime() <= now.getTime();
  const values = {
    orgId: input.orgId, caseId: input.caseId ?? null, recipientId: input.recipientId, type: input.type,
    channel: "in_app", title: input.title.trim().slice(0, 180), body: input.body.trim().slice(0, 1000),
    priority: urgent ? "urgent" : "normal", status: sendNow ? "sent" : "pending", notBefore,
    sentAt: sendNow ? now : null, idempotencyKey: input.idempotencyKey, createdBy: input.createdBy ?? null,
    createdAt: now, updatedAt: now,
  };
  try {
    const [{ id }] = await db.insert(coachingNotifications).values(values).$returningId();
    return { id, status: values.status, duplicate: false as const };
  } catch (error) {
    /* 并发下唯一键是最终幂等边界；已存在时读取原记录，不重复发送。 */
    if (!String(error).includes("1062") && !String(error).toLowerCase().includes("duplicate")) throw error;
    const [row] = await db.select({ id: coachingNotifications.id, status: coachingNotifications.status })
      .from(coachingNotifications).where(eq(coachingNotifications.idempotencyKey, input.idempotencyKey)).limit(1);
    if (!row) throw error;
    return { id: row.id, status: row.status, duplicate: true as const };
  }
}

/** 家庭通知只含通用提示；学员本人和当前有效监护人分别接收，不能共享账号。 */
export async function queueFamilyCoachingNotification(db: QueryDb, input: Omit<NotificationInput, "recipientId" | "orgId" | "studentUserId"> & { studentUserId?: number }) {
  const [owner] = await db.select({ orgId: coachingCases.orgId, studentUserId: coachingCases.studentUserId })
    .from(coachingCases).where(eq(coachingCases.id, input.caseId!)).limit(1);
  if (!owner) throw new TRPCError({ code: "NOT_FOUND", message: "陪跑主档不存在" });
  const studentUserId = input.studentUserId ?? owner.studentUserId;
  const grants = await db.select({ guardianUserId: coachingGuardianGrants.guardianUserId }).from(coachingGuardianGrants)
    .where(and(eq(coachingGuardianGrants.caseId, input.caseId!), eq(coachingGuardianGrants.active, true)));
  const recipients = [...new Set([studentUserId, ...grants.map((row) => row.guardianUserId)])];
  const results = [];
  for (const recipientId of recipients) {
    results.push(await queueCoachingNotification(db, { ...input, orgId: owner.orgId, recipientId,
      idempotencyKey: `${input.idempotencyKey}:recipient:${recipientId}` }));
  }
  return results;
}

/** 打开工作台或家庭通知中心时投递到期的站内通知，不伪造微信或短信送达。 */
export async function deliverDueCoachingNotifications(db: Db, me: Recipient, at = new Date()) {
  const now = coachingNotificationTime(at);
  const base = [eq(coachingNotifications.recipientId, me.id), lte(coachingNotifications.notBefore, now)] as const;
  const pending = await db.select({ id: coachingNotifications.id }).from(coachingNotifications)
    .where(and(...base, eq(coachingNotifications.status, "pending"))).limit(200);
  const sent = await db.select({ id: coachingNotifications.id }).from(coachingNotifications)
    .where(and(...base, eq(coachingNotifications.status, "sent"))).limit(200);
  if (pending.length) await db.update(coachingNotifications).set({ status: "delivered", sentAt: now, deliveredAt: now, updatedAt: now })
    .where(and(eq(coachingNotifications.recipientId, me.id), inArray(coachingNotifications.id, pending.map((row) => row.id)), eq(coachingNotifications.status, "pending")));
  if (sent.length) await db.update(coachingNotifications).set({ status: "delivered", deliveredAt: now, updatedAt: now })
    .where(and(eq(coachingNotifications.recipientId, me.id), inArray(coachingNotifications.id, sent.map((row) => row.id)), eq(coachingNotifications.status, "sent")));
  return { delivered: pending.length + sent.length };
}

export async function coachingNotificationInbox(db: Db, me: Recipient) {
  await deliverDueCoachingNotifications(db, me);
  const items = await db.select().from(coachingNotifications).where(eq(coachingNotifications.recipientId, me.id))
    .orderBy(desc(coachingNotifications.id)).limit(100);
  return { items, unread: items.filter((row) => row.status === "delivered" && !row.readAt).length,
    channelNote: "当前仅提供站内通知，不代表已发送微信或短信。待发送通知会在静默时段结束后、打开通知中心时投递。" };
}

export async function markCoachingNotificationRead(db: Db, me: Recipient, notificationId: number) {
  await deliverDueCoachingNotifications(db, me);
  const [row] = await db.select().from(coachingNotifications).where(eq(coachingNotifications.id, notificationId)).limit(1);
  if (!row || row.recipientId !== me.id) throw new TRPCError({ code: "NOT_FOUND", message: "通知不存在" });
  if (row.status !== "delivered") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "通知尚未送达，不能提前标记已读" });
  if (!row.readAt) await db.update(coachingNotifications).set({ readAt: new Date(), updatedAt: new Date() })
    .where(and(eq(coachingNotifications.id, row.id), eq(coachingNotifications.recipientId, me.id)));
  return { ok: true as const };
}

async function manageableNotification(db: Db, me: StaffUser, notificationId: number) {
  const orgId = requireOrgStaff(me);
  const [row] = await db.select().from(coachingNotifications).where(eq(coachingNotifications.id, notificationId)).limit(1);
  if (!row || row.orgId !== orgId || (me.role !== "admin" && row.recipientId !== me.id)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "通知不存在" });
  }
  return row;
}

export async function retryCoachingNotification(db: Db, me: StaffUser, notificationId: number) {
  const row = await manageableNotification(db, me, notificationId);
  if (row.status !== "failed") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "只有发送失败的通知可以重试" });
  const now = coachingNotificationTime();
  const settings = await settingsFor(db, row.orgId);
  const notBefore = row.priority === "urgent" ? now : nextShanghaiOpening(now, settings.quietStart, settings.quietEnd);
  const sendNow = notBefore.getTime() <= now.getTime();
  const retryCount = row.retryCount + 1;
  await db.update(coachingNotifications).set({ status: sendNow ? "sent" : "pending", notBefore,
    sentAt: sendNow ? now : null, deliveredAt: null, readAt: null, failedAt: null, failureReason: "",
    retryCount, updatedAt: now })
    .where(and(eq(coachingNotifications.id, row.id), eq(coachingNotifications.status, "failed")));
  return { ok: true as const, status: sendNow ? "sent" as const : "pending" as const, retryCount };
}

export async function transferCoachingNotificationManual(db: Db, me: StaffUser, input: { notificationId: number; reason: string }) {
  const row = await manageableNotification(db, me, input.notificationId);
  if (row.status !== "failed") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "只有发送失败的通知需要转人工" });
  const reason = input.reason.trim();
  if (reason.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "请填写转人工原因与后续联系方式" });
  await db.update(coachingNotifications).set({ status: "manual", manualReason: reason.slice(0, 500), manualAt: new Date(), updatedAt: new Date() })
    .where(and(eq(coachingNotifications.id, row.id), eq(coachingNotifications.status, "failed")));
  return { ok: true as const };
}

export async function getCoachingNotificationSettings(db: Db, me: StaffUser) {
  const orgId = requireOrgStaff(me);
  return { ...(await settingsFor(db, orgId)), orgId };
}

export async function saveCoachingNotificationSettings(db: Db, me: StaffUser, input: { quietStart: string; quietEnd: string; suggestedCaseLoad: number }) {
  const orgId = requireOrgStaff(me);
  if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "仅机构管理员可修改通知与负荷设置" });
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(input.quietStart) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(input.quietEnd)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "静默时间须为 HH:mm" });
  }
  if (!Number.isInteger(input.suggestedCaseLoad) || input.suggestedCaseLoad < 1 || input.suggestedCaseLoad > 200) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "建议在读负荷须为 1—200 人" });
  }
  /* 调用一次校验跨午夜配置；开始与结束相同表示关闭静默。 */
  isShanghaiQuietTime(new Date(), input.quietStart, input.quietEnd);
  await db.insert(coachingNotificationSettings).values({ orgId, ...input, updatedBy: me.id })
    .onDuplicateKeyUpdate({ set: { ...input, updatedBy: me.id, updatedAt: new Date() } });
  return { ok: true as const };
}
