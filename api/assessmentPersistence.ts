import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { assessmentActivities, assessmentActivityItems, assessmentAssignments, assessmentResults, organizations, orgPointAccounts, studentProfile, studentTutor, users } from "@db/schema";
import { assessmentCredits } from "@contracts/orgService";
import { getDb } from "./queries/connection";
import { debitPoints, type PointTx } from "./orgPoints";

type Db = ReturnType<typeof getDb>;
type Outcome = { kind: (typeof assessmentResults.$inferInsert)["kind"]; result: Record<string, unknown> };

function duplicateError(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } };
  return e?.code === "ER_DUP_ENTRY" || e?.cause?.code === "ER_DUP_ENTRY";
}

async function existingSubmission(tx: PointTx, key: string) {
  return (await tx.select().from(assessmentResults).where(eq(assessmentResults.submissionKey, key)).limit(1))[0];
}

/** 先找已开始任务；没有开始标记时仅在唯一待做任务可确定时关联，避免错绑活动。 */
async function resolveAssignment(tx: PointTx, userId: number, kind: string, assignmentId?: number | null) {
  if (assignmentId != null) {
    return (await tx.select({ assignment: assessmentAssignments, item: assessmentActivityItems, activity: assessmentActivities })
      .from(assessmentAssignments).innerJoin(assessmentActivityItems, eq(assessmentAssignments.activityItemId, assessmentActivityItems.id))
      .innerJoin(assessmentActivities, eq(assessmentActivityItems.activityId, assessmentActivities.id))
      .where(eq(assessmentAssignments.id, assignmentId)).limit(1).for("update"))[0];
  }
  const rows = await tx.select({ assignment: assessmentAssignments, item: assessmentActivityItems, activity: assessmentActivities })
    .from(assessmentAssignments).innerJoin(assessmentActivityItems, eq(assessmentAssignments.activityItemId, assessmentActivityItems.id))
    .innerJoin(assessmentActivities, eq(assessmentActivityItems.activityId, assessmentActivities.id))
    .where(and(eq(assessmentAssignments.studentUserId, userId), eq(assessmentAssignments.kind, kind), inArray(assessmentAssignments.status, ["in_progress", "pending"]), eq(assessmentActivities.status, "open")))
    .orderBy(desc(assessmentAssignments.id)).for("update");
  const started = rows.filter((r) => r.assignment.status === "in_progress");
  if (started.length > 1) throw new TRPCError({ code: "CONFLICT", message: "有多个进行中的同类测评，请从我的测评任务进入" });
  if (started[0]) return started[0];
  if (rows.length > 1) throw new TRPCError({ code: "CONFLICT", message: "有多个待做任务，请从我的测评任务进入，不要直接重测" });
  return rows[0];
}

/** 旧入口的兼容收费：只从学员主管伴学师的钱包扣费，绝不使用机构未分配池。 */
async function legacyPayer(tx: PointTx, studentUserId: number) {
  const [student] = await tx.select({ orgId: users.orgId }).from(users).where(eq(users.id, studentUserId)).limit(1);
  const [profile] = await tx.select({ tutorId: studentProfile.tutorId }).from(studentProfile).where(eq(studentProfile.userId, studentUserId)).limit(1);
  let tutorId = profile?.tutorId ?? null;
  if (tutorId == null) {
    const [link] = await tx.select({ tutorId: studentTutor.tutorUserId }).from(studentTutor).where(eq(studentTutor.studentUserId, studentUserId)).orderBy(studentTutor.id).limit(1);
    tutorId = link?.tutorId ?? null;
  }
  if (tutorId == null) return null;
  const [tutor] = await tx.select({ orgId: users.orgId }).from(users).where(eq(users.id, tutorId)).limit(1);
  const orgId = student?.orgId ?? tutor?.orgId ?? null;
  if (orgId == null) return null;
  const [pool] = await tx.select().from(orgPointAccounts).where(and(eq(orgPointAccounts.orgId, orgId), eq(orgPointAccounts.ownerUserId, 0))).limit(1).for("update");
  return pool?.initialized ? { orgId, tutorId } : null;
}

/**
 * 所有有效结果的唯一持久化入口。任务、结果、原始终端键和积分在同一事务提交。
 * 未初始化的存量机构维持旧流程；初始化后旧式单独作答按单项价格扣主管伴学师积分。
 */
export async function persistAssessmentResult(
  db: Db,
  input: { userId: number; outcome: Outcome; answers: unknown; actorUserId?: number | null; submissionKey?: string | null; assignmentId?: number | null },
): Promise<Outcome & { resultId: number; assignmentId: number | null }> {
  const submissionKey = input.submissionKey?.trim() || `auto:${randomUUID()}`;
  try {
    return await db.transaction(async (tx) => {
      const previous = await existingSubmission(tx, submissionKey);
      if (previous) {
        if (previous.userId !== input.userId || previous.kind !== input.outcome.kind) throw new TRPCError({ code: "CONFLICT", message: "提交标识与答卷不一致，请刷新后重试" });
        return { kind: previous.kind, result: previous.result, resultId: previous.id, assignmentId: previous.assignmentId };
      }
      const hit = await resolveAssignment(tx, input.userId, input.outcome.kind, input.assignmentId);
      if (hit) {
        if (hit.assignment.studentUserId !== input.userId || hit.assignment.kind !== input.outcome.kind || !hit.item.includedKinds.includes(input.outcome.kind)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "这份答卷不属于该测评任务" });
        }
        if (hit.activity.status !== "open") throw new TRPCError({ code: "CONFLICT", message: "该测评活动已取消或过期，请让伴学师重新发起" });
        if (hit.activity.dueAt && hit.activity.dueAt.getTime() <= Date.now()) throw new TRPCError({ code: "CONFLICT", message: "该测评已超过完成期限，不能提交；请让伴学师处理到期任务" });
        if (hit.assignment.status === "completed" && hit.assignment.resultId) {
          const [old] = await tx.select().from(assessmentResults).where(eq(assessmentResults.id, hit.assignment.resultId)).limit(1);
          if (old) return { kind: old.kind, result: old.result, resultId: old.id, assignmentId: hit.assignment.id };
        }
        if (["cancelled", "completed", "expired"].includes(hit.assignment.status)) throw new TRPCError({ code: "CONFLICT", message: "该测评任务已结束，请让伴学师重新发起" });
      }
      const [student] = await tx.select({ orgId: users.orgId, edition: organizations.edition }).from(users)
        .leftJoin(organizations, eq(organizations.id, users.orgId)).where(eq(users.id, input.userId)).limit(1);
      const schoolEdition = student?.edition === "school";
      const price = hit ? 0 : assessmentCredits(input.outcome.kind);
      /* 校园版直接作答完全免费，不读取钱包，也不因未配置机构积分而拦截测评。 */
      const payer = !hit && price > 0 && !schoolEdition ? await legacyPayer(tx, input.userId) : null;
      if (!hit && price > 0 && !schoolEdition && student?.orgId != null && !payer) {
        const [pool] = await tx.select({ initialized: orgPointAccounts.initialized }).from(orgPointAccounts)
          .where(and(eq(orgPointAccounts.orgId, student.orgId), eq(orgPointAccounts.ownerUserId, 0))).limit(1);
        if (pool?.initialized) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "请联系伴学师先分配测评任务和积分" });
      }
      if (payer) {
        await debitPoints(tx, { orgId: payer.orgId, payerUserId: payer.tutorId, actorUserId: input.actorUserId ?? payer.tutorId,
          amount: price, eventKey: `assessment:submission:${submissionKey}`, studentUserId: input.userId, kind: input.outcome.kind, reason: "学员单独完成测评" });
      }
      const [{ id }] = await tx.insert(assessmentResults).values({ userId: input.userId, kind: input.outcome.kind,
        result: input.outcome.result, answers: input.answers as number[], submissionKey, assignmentId: hit?.assignment.id ?? null }).$returningId();
      if (hit) {
        await tx.update(assessmentAssignments).set({ status: "completed", resultId: id, completedAt: new Date() })
          .where(and(eq(assessmentAssignments.id, hit.assignment.id), inArray(assessmentAssignments.status, ["pending", "in_progress"])));
      }
      return { ...input.outcome, resultId: id, assignmentId: hit?.assignment.id ?? null };
    });
  } catch (error) {
    if (!duplicateError(error)) throw error;
    const old = (await db.select().from(assessmentResults).where(eq(assessmentResults.submissionKey, submissionKey)).limit(1))[0];
    if (!old || old.userId !== input.userId || old.kind !== input.outcome.kind) throw error;
    return { kind: old.kind, result: old.result, resultId: old.id, assignmentId: old.assignmentId };
  }
}
