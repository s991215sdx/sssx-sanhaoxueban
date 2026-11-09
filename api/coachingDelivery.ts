import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { coachingCases, coachingDeliverySettings, coachingEvents, coachingNotificationSettings } from "@db/schema";
import type { getDb } from "./queries/connection";
import type { PointTx } from "./orgPoints";
import { requireOrgStaff, type StaffUser } from "./orgAccess";

type Db = ReturnType<typeof getDb>;
type QueryDb = Db | PointTx;

export const DEFAULT_COACHING_DELIVERY_SETTINGS = {
  h3Hours: 24, weeklyPlanDay: 1, weeklyReviewDay: 0, qualityVersion: "1.0", retentionDays: 365,
  hardCaseLimit: 0, s1Hours: 8, s2Hours: 2, s3Hours: 24,
} as const;

export type CoachingDeliverySettingsInput = {
  h3Hours: number; weeklyPlanDay: number; weeklyReviewDay: number; qualityVersion: string;
  retentionDays: number; hardCaseLimit: number; s1Hours: number; s2Hours: number; s3Hours: number;
};

export async function getCoachingDeliverySettings(db: QueryDb, me: StaffUser) {
  const orgId = requireOrgStaff(me);
  const [row] = await db.select().from(coachingDeliverySettings).where(eq(coachingDeliverySettings.orgId, orgId)).limit(1);
  return row ? { ...row, s4Hours: 0 } : { orgId, ...DEFAULT_COACHING_DELIVERY_SETTINGS, s4Hours: 0 };
}

export async function saveCoachingDeliverySettings(db: Db, me: StaffUser, input: CoachingDeliverySettingsInput) {
  const orgId = requireOrgStaff(me);
  if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "仅机构管理员可调整交付节奏、质量版本和容量上限" });
  if (!/^\d+\.\d+$/.test(input.qualityVersion)) throw new TRPCError({ code: "BAD_REQUEST", message: "质量框架版本格式须为 1.0 这类版本号" });
  if (input.qualityVersion !== "1.0") throw new TRPCError({ code: "BAD_REQUEST", message: "当前已发布质量框架为 1.0；新版本须先发布对应评分规则，不能只修改版本号" });
  await db.insert(coachingDeliverySettings).values({ orgId, ...input, updatedBy: me.id })
    .onDuplicateKeyUpdate({ set: { ...input, updatedBy: me.id, updatedAt: new Date() } });
  return getCoachingDeliverySettings(db, me);
}

/** 同一老师在不同机构的在读主档分开计数；同一人的主教和督学身份只计一次。 */
export async function coachingCaseLoad(db: QueryDb, orgId: number, userId: number, excludeCaseId?: number) {
  const rows = await db.select({ id: coachingCases.id, coachId: coachingCases.coachId, supervisorId: coachingCases.supervisorId })
    .from(coachingCases).where(and(eq(coachingCases.orgId, orgId), inArray(coachingCases.status, ["active", "paused"])));
  return rows.filter((row) => row.id !== excludeCaseId && (row.coachId === userId || row.supervisorId === userId)).length;
}

export async function assertCoachingCapacity(db: QueryDb, input: {
  orgId: number; staffIds: number[]; actor: StaffUser; excludeCaseId?: number; additionalCases?: number; overrideReason?: string;
}) {
  const settings = await getCoachingDeliverySettings(db, input.actor);
  const [notification] = await db.select({ suggestedCaseLoad: coachingNotificationSettings.suggestedCaseLoad })
    .from(coachingNotificationSettings).where(eq(coachingNotificationSettings.orgId, input.orgId)).limit(1);
  const softLimit = notification?.suggestedCaseLoad ?? 20;
  const hardLimit = settings.hardCaseLimit > 0 ? settings.hardCaseLimit : softLimit;
  for (const staffId of [...new Set(input.staffIds)]) {
    const next = await coachingCaseLoad(db, input.orgId, staffId, input.excludeCaseId) + (input.additionalCases ?? 1);
    if (next <= hardLimit) continue;
    if (input.actor.role !== "admin") throw new TRPCError({ code: "PRECONDITION_FAILED", message: `负责人 #${staffId} 的在读主档将达到 ${next} 人，超过容量 ${hardLimit} 人；请联系管理员调整或改派` });
    if (settings.hardCaseLimit > 0) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `负责人 #${staffId} 的在读主档将达到 ${next} 人，已超过机构硬容量 ${hardLimit} 人；请先调整容量或改派` });
    if ((input.overrideReason?.trim().length ?? 0) < 2) throw new TRPCError({ code: "PRECONDITION_FAILED", message: `负责人 #${staffId} 超过建议负荷 ${hardLimit} 人，管理员超额接收须填写原因` });
  }
  return { hardLimit, softLimit };
}

export async function recordCapacityOverride(db: QueryDb, caseId: number, actorUserId: number, reason?: string) {
  if (reason?.trim()) await db.insert(coachingEvents).values({ caseId, actorUserId, type: "capacity_override",
    content: `管理员核验服务安排后超额接收；原因：${reason.trim()}`, visibility: "internal" });
}
