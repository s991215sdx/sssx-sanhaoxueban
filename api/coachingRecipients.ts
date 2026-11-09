import { TRPCError } from "@trpc/server";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { coachingCases, coachingDeliverableRecipients, coachingDeliverables, coachingEvents, coachingExtendedRecords,
  coachingGuardianGrants, coachingMonthlyReports, coachingPlans, courseParticipants, courseSessions, users } from "@db/schema";
import type { getDb } from "./queries/connection";
import type { PointTx } from "./orgPoints";
import { assertCaseAccess, type CoachingCaseRow } from "./coachingAccess";
import type { StaffUser } from "./orgAccess";
import { queueCoachingNotification } from "./coachingNotifications";

type Db = ReturnType<typeof getDb>;
type QueryDb = Db | PointTx;
export type FamilyResourceType = "plan" | "session_feedback" | "deliverable" | "monthly_report" | "family_action";

export async function familyRecipients(db: QueryDb, coachingCase: CoachingCaseRow) {
  const [student, grants] = await Promise.all([
    db.select({ id: users.id, name: users.name }).from(users).where(and(eq(users.id, coachingCase.studentUserId), isNull(users.deletedAt))).limit(1),
    db.select({ id: users.id, name: users.name, label: coachingGuardianGrants.label }).from(coachingGuardianGrants)
      .innerJoin(users, eq(coachingGuardianGrants.guardianUserId, users.id))
      .where(and(eq(coachingGuardianGrants.caseId, coachingCase.id), eq(coachingGuardianGrants.active, true), isNull(users.deletedAt))),
  ]);
  if (!student[0]) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "学员账号已停用，暂不能推送家庭内容" });
  return [{ ...student[0], label: "学生" }, ...grants];
}

export async function assertFamilyRecipients(db: QueryDb, coachingCase: CoachingCaseRow, recipientUserIds: number[]) {
  const ids = [...new Set(recipientUserIds)];
  if (!ids.length) throw new TRPCError({ code: "BAD_REQUEST", message: "请至少选择一位学生或监护人接收人；系统不会默认发给全家" });
  const allowed = new Set((await familyRecipients(db, coachingCase)).map((row) => row.id));
  if (ids.some((id) => !allowed.has(id))) throw new TRPCError({ code: "FORBIDDEN", message: "接收人必须是本主档学员或当前有效监护人" });
  return ids;
}

async function assertResourceBelongsToCase(db: QueryDb, coachingCase: CoachingCaseRow, resourceType: FamilyResourceType, resourceId: number) {
  let owned = false;
  if (resourceType === "plan") {
    const [row] = await db.select({ caseId: coachingPlans.caseId }).from(coachingPlans).where(eq(coachingPlans.id, resourceId)).limit(1);
    owned = row?.caseId === coachingCase.id;
  } else if (resourceType === "deliverable") {
    const [row] = await db.select({ caseId: coachingDeliverables.caseId }).from(coachingDeliverables).where(eq(coachingDeliverables.id, resourceId)).limit(1);
    owned = row?.caseId === coachingCase.id;
  } else if (resourceType === "monthly_report") {
    const [row] = await db.select({ caseId: coachingMonthlyReports.caseId }).from(coachingMonthlyReports).where(eq(coachingMonthlyReports.id, resourceId)).limit(1);
    owned = row?.caseId === coachingCase.id;
  } else if (resourceType === "family_action") {
    const [row] = await db.select({ caseId: coachingExtendedRecords.caseId, type: coachingExtendedRecords.recordType }).from(coachingExtendedRecords).where(eq(coachingExtendedRecords.id, resourceId)).limit(1);
    owned = row?.caseId === coachingCase.id && row.type === "family_action";
  } else {
    const [row] = await db.select({ caseId: coachingCases.id }).from(courseParticipants)
      .innerJoin(courseSessions, eq(courseParticipants.sessionId, courseSessions.id))
      .innerJoin(coachingCases, and(eq(coachingCases.orgId, courseSessions.orgId), eq(coachingCases.studentUserId, courseParticipants.studentUserId)))
      .where(and(eq(courseParticipants.id, resourceId), eq(courseSessions.orgId, coachingCase.orgId))).limit(1);
    owned = row?.caseId === coachingCase.id;
  }
  if (!owned) throw new TRPCError({ code: "FORBIDDEN", message: "不能授权其他学员或其他主档的内容" });
}

export async function grantFamilyResourcesTx(db: QueryDb, input: {
  coachingCase: CoachingCaseRow; resourceType: FamilyResourceType; resourceIds: number[]; recipientUserIds: number[]; actorUserId: number;
}) {
  const resourceIds = [...new Set(input.resourceIds)];
  if (!resourceIds.length) throw new TRPCError({ code: "BAD_REQUEST", message: "请选择需要授权的内容" });
  const recipientIds = await assertFamilyRecipients(db, input.coachingCase, input.recipientUserIds);
  for (const resourceId of resourceIds) {
    await assertResourceBelongsToCase(db, input.coachingCase, input.resourceType, resourceId);
    for (const recipientUserId of recipientIds) {
      await db.insert(coachingDeliverableRecipients).values({ orgId: input.coachingCase.orgId, caseId: input.coachingCase.id, resourceType: input.resourceType,
        resourceId, recipientUserId, scope: "read", active: true, createdBy: input.actorUserId, revokedAt: null, revokedBy: null })
        .onDuplicateKeyUpdate({ set: { caseId: input.coachingCase.id, active: true, scope: "read", createdBy: input.actorUserId, revokedAt: null, revokedBy: null, updatedAt: new Date() } });
    }
  }
  return recipientIds;
}

export async function authorizedFamilyResources(db: QueryDb, coachingCase: CoachingCaseRow, resourceType: FamilyResourceType, resourceIds: number[], userId: number) {
  if (!resourceIds.length) return new Set<number>();
  const rows = await db.select({ resourceId: coachingDeliverableRecipients.resourceId }).from(coachingDeliverableRecipients)
    .where(and(eq(coachingDeliverableRecipients.orgId, coachingCase.orgId), eq(coachingDeliverableRecipients.caseId, coachingCase.id),
      eq(coachingDeliverableRecipients.resourceType, resourceType), inArray(coachingDeliverableRecipients.resourceId, resourceIds),
      eq(coachingDeliverableRecipients.recipientUserId, userId), eq(coachingDeliverableRecipients.active, true)));
  return new Set(rows.map((row) => row.resourceId));
}

export async function listFamilyResourceRecipients(db: Db, coachingCase: CoachingCaseRow, resourceType: FamilyResourceType, resourceIds: number[]) {
  if (!resourceIds.length) return [];
  return db.select({ grant: coachingDeliverableRecipients, name: users.name }).from(coachingDeliverableRecipients)
    .innerJoin(users, eq(coachingDeliverableRecipients.recipientUserId, users.id))
    .where(and(eq(coachingDeliverableRecipients.orgId, coachingCase.orgId), eq(coachingDeliverableRecipients.caseId, coachingCase.id),
      eq(coachingDeliverableRecipients.resourceType, resourceType), inArray(coachingDeliverableRecipients.resourceId, resourceIds)));
}

/** 通知与读取共用同一份逐人授权，不再按主档默认广播给所有监护人。 */
export async function queueFamilyResourceNotifications(db: QueryDb, input: {
  coachingCase: CoachingCaseRow; resourceType: FamilyResourceType; resourceId: number; recipientUserIds?: number[];
  type: string; title: string; body: string; idempotencyKey: string; createdBy: number;
}) {
  let ids = input.recipientUserIds ?? [];
  if (!input.recipientUserIds) {
    const rows = await db.select({ recipientUserId: coachingDeliverableRecipients.recipientUserId }).from(coachingDeliverableRecipients)
      .where(and(eq(coachingDeliverableRecipients.orgId, input.coachingCase.orgId), eq(coachingDeliverableRecipients.caseId, input.coachingCase.id),
        eq(coachingDeliverableRecipients.resourceType, input.resourceType), eq(coachingDeliverableRecipients.resourceId, input.resourceId), eq(coachingDeliverableRecipients.active, true)));
    ids = rows.map((row) => row.recipientUserId);
  }
  const result = [];
  for (const recipientId of [...new Set(ids)]) {
    await assertFamilyRecipients(db, input.coachingCase, [recipientId]);
    result.push(await queueCoachingNotification(db, { orgId: input.coachingCase.orgId, caseId: input.coachingCase.id, recipientId,
      type: input.type, title: input.title, body: input.body, idempotencyKey: `${input.idempotencyKey}:recipient:${recipientId}`, createdBy: input.createdBy }));
  }
  return result;
}

export async function revokeFamilyResourceAccess(db: Db, me: StaffUser, input: { caseId: number; resourceType: FamilyResourceType; resourceId: number; recipientUserId: number }) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  await db.transaction(async (tx) => {
    await assertResourceBelongsToCase(tx, coachingCase, input.resourceType, input.resourceId);
    await tx.update(coachingDeliverableRecipients).set({ active: false, revokedBy: me.id, revokedAt: new Date() })
      .where(and(eq(coachingDeliverableRecipients.orgId, coachingCase.orgId), eq(coachingDeliverableRecipients.caseId, coachingCase.id),
        eq(coachingDeliverableRecipients.resourceType, input.resourceType), eq(coachingDeliverableRecipients.resourceId, input.resourceId),
        eq(coachingDeliverableRecipients.recipientUserId, input.recipientUserId), eq(coachingDeliverableRecipients.active, true)));
    await tx.insert(coachingEvents).values({ caseId: coachingCase.id, actorUserId: me.id,
      type: "family_resource_revoked", content: `撤销一份${input.resourceType}内容的指定接收权限 #${input.resourceId}`, visibility: "internal" });
  });
  return { ok: true as const };
}
