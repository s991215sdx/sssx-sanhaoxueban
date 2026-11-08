import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { coachingCases, coachingEvents, coachingQualityReviews, users } from "@db/schema";
import { COACHING_QUALITY_FRAMEWORK, coachingQualityLevel, type CoachingQualityScores } from "@contracts/orgService";
import type { getDb } from "./queries/connection";
import type { PointTx } from "./orgPoints";
import { requireOrgStaff, type StaffUser } from "./orgAccess";
import { assertCaseAccess } from "./coachingAccess";
import { queueCoachingNotification } from "./coachingNotifications";

type Db = ReturnType<typeof getDb>;
export type CoachingReviewType = "self" | "peer" | "supervisor";
type QualityInput = {
  scores: CoachingQualityScores;
  findings: string;
  improvementActions: string;
};
type QualityRow = typeof coachingQualityReviews.$inferSelect;

const TYPE_LABEL: Record<CoachingReviewType, string> = { self: "质量自查", peer: "同伴互查", supervisor: "主管抽查" };

function required(value: string | undefined, message: string): string {
  const text = value?.trim() ?? "";
  if (text.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message });
  return text;
}

function changedRows(result: unknown): number | null {
  return typeof result === "object" && result !== null && "affectedRows" in result ? Number(result.affectedRows) : null;
}
function assertAffected(result: unknown, message: string) {
  const count = changedRows(result);
  if (count !== null && count !== 1) throw new TRPCError({ code: "CONFLICT", message });
}

/** 服务端独立按共享框架复核；不能依赖页面上的分数范围限制。 */
export function validateQualityScores(scores: CoachingQualityScores): CoachingQualityScores {
  const normalized = {} as CoachingQualityScores;
  for (const module of COACHING_QUALITY_FRAMEWORK.modules) {
    const value = scores[module.key];
    if (!Number.isInteger(value) || value < 0 || value > module.maxScore) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `${module.label}须为 0—${module.maxScore} 的整数` });
    }
    normalized[module.key] = value;
  }
  return normalized;
}

export function qualityScoreTotal(scores: CoachingQualityScores): number {
  return COACHING_QUALITY_FRAMEWORK.modules.reduce((sum, module) => sum + scores[module.key], 0);
}

function scoreColumns(scores: CoachingQualityScores) {
  return {
    planScore: scores.plan,
    executionScore: scores.execution,
    archiveScore: scores.archive,
    familyScore: scores.family,
    reviewScore: scores.review,
  };
}

function validateQualityInput(input: QualityInput) {
  return {
    ...scoreColumns(validateQualityScores(input.scores)),
    findings: required(input.findings, "请填写检查发现与事实依据"),
    improvementActions: required(input.improvementActions, "请填写具体整改动作"),
  };
}

async function staffRecipient(db: Db, orgId: number, userId: number) {
  const [person] = await db.select({ id: users.id, role: users.role }).from(users)
    .where(and(eq(users.id, userId), eq(users.orgId, orgId), inArray(users.role, ["tutor", "admin"]), isNull(users.deletedAt))).limit(1);
  if (!person) throw new TRPCError({ code: "FORBIDDEN", message: "检查人必须是本机构有效伴学师或管理员" });
  return person;
}

function assertReviewerRole(type: CoachingReviewType, reviewer: { id: number; role: string }, coachingCase: typeof coachingCases.$inferSelect) {
  if (type === "self" && coachingCase.coachId !== reviewer.id && coachingCase.supervisorId !== reviewer.id) {
    throw new TRPCError({ code: "FORBIDDEN", message: "自查人必须是该主档当前主教或督学" });
  }
  if (type === "peer" && (coachingCase.coachId === reviewer.id || coachingCase.supervisorId === reviewer.id)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "互查人不能是该主档当前主教或督学" });
  }
  if (type === "supervisor" && reviewer.role !== "admin") {
    throw new TRPCError({ code: "FORBIDDEN", message: "主管抽查人必须是本机构管理员" });
  }
}

async function event(db: Db | PointTx, caseId: number, actorUserId: number, type: string, content: string) {
  await db.insert(coachingEvents).values({ caseId, actorUserId, type, content, visibility: "internal" });
}

/** 管理员只创建待办；互查任务不向检查人开放完整主档或敏感正文。 */
export async function assignQualityReview(db: Db, me: StaffUser, input: {
  caseId: number;
  reviewType: CoachingReviewType;
  reviewerId: number;
  periodKey: string;
  dueAt: Date;
}) {
  if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "仅机构管理员可安排质量检查" });
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  const reviewer = await staffRecipient(db, coachingCase.orgId, input.reviewerId);
  assertReviewerRole(input.reviewType, reviewer, coachingCase);
  const periodKey = required(input.periodKey, "请填写检查周期");
  return db.transaction(async (tx) => {
    const duplicate = await tx.select({ id: coachingQualityReviews.id }).from(coachingQualityReviews)
      .where(and(eq(coachingQualityReviews.caseId, input.caseId), eq(coachingQualityReviews.reviewType, input.reviewType),
        eq(coachingQualityReviews.reviewerId, input.reviewerId), eq(coachingQualityReviews.periodKey, periodKey),
        eq(coachingQualityReviews.status, "pending"))).limit(1).for("update");
    if (duplicate.length) throw new TRPCError({ code: "CONFLICT", message: "同一检查人该周期已有待完成任务" });
    const latest = await tx.select().from(coachingQualityReviews)
      .where(and(eq(coachingQualityReviews.caseId, input.caseId), eq(coachingQualityReviews.reviewType, input.reviewType),
        eq(coachingQualityReviews.reviewerId, input.reviewerId), eq(coachingQualityReviews.periodKey, periodKey)))
      .orderBy(desc(coachingQualityReviews.version)).limit(1).for("update");
    const version = (latest[0]?.version ?? 0) + 1;
    const [{ id }] = await tx.insert(coachingQualityReviews).values({
      caseId: input.caseId, orgId: coachingCase.orgId, reviewType: input.reviewType, reviewerId: input.reviewerId,
      periodKey, frameworkVersion: COACHING_QUALITY_FRAMEWORK.version, version, previousId: latest[0]?.id ?? null,
      status: "pending", dueAt: input.dueAt, assignedBy: me.id,
    }).$returningId();
    await event(tx, input.caseId, me.id, "quality_review_assigned", `${TYPE_LABEL[input.reviewType]} ${periodKey} 已安排，任务 #${id} V${version}`);
    await queueCoachingNotification(tx, { orgId: coachingCase.orgId, caseId: input.caseId, recipientId: input.reviewerId,
      type: "quality_assigned", title: "新的质量检查待办", body: `你有一项${TYPE_LABEL[input.reviewType]}待完成，检查周期 ${periodKey}。请进入伴学工作台处理。`,
      idempotencyKey: `quality:${id}:recipient:${input.reviewerId}`, createdBy: me.id });
    return { id, version, status: "pending" as const };
  });
}

async function latestVersion(tx: PointTx, row: QualityRow) {
  const rows = await tx.select().from(coachingQualityReviews)
    .where(and(eq(coachingQualityReviews.caseId, row.caseId), eq(coachingQualityReviews.reviewType, row.reviewType),
      eq(coachingQualityReviews.reviewerId, row.reviewerId), eq(coachingQualityReviews.periodKey, row.periodKey)))
    .orderBy(desc(coachingQualityReviews.version)).limit(1).for("update");
  return rows[0] ?? row;
}

/** 当前负责人可直接自查；已有关键安排则完成该待办，更正追加版本，关闭后不再修改。 */
export async function submitSelfQualityReview(db: Db, me: StaffUser, input: QualityInput & { caseId: number; periodKey: string }) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  assertReviewerRole("self", me, coachingCase);
  const fields = validateQualityInput(input);
  const periodKey = required(input.periodKey, "请填写自查周期");
  return db.transaction(async (tx) => {
    const existing = await tx.select().from(coachingQualityReviews)
      .where(and(eq(coachingQualityReviews.caseId, input.caseId), eq(coachingQualityReviews.reviewType, "self"),
        eq(coachingQualityReviews.reviewerId, me.id), eq(coachingQualityReviews.periodKey, periodKey)))
      .orderBy(desc(coachingQualityReviews.version)).limit(1).for("update");
    const current = existing[0];
    if (current?.status === "closed") throw new TRPCError({ code: "CONFLICT", message: "该周期自查已整改关闭，不能再修改" });
    const now = new Date();
    if (current?.status === "pending") {
      const result = await tx.update(coachingQualityReviews).set({ ...fields, status: "submitted", submittedAt: now })
        .where(and(eq(coachingQualityReviews.id, current.id), eq(coachingQualityReviews.status, "pending")));
      assertAffected(result, "自查状态已变化，请刷新");
      await event(tx, input.caseId, me.id, "quality_review_submitted", `质量自查 ${periodKey} V${current.version} 已提交`);
      return { id: current.id, version: current.version, status: "submitted" as const };
    }
    const version = (current?.version ?? 0) + 1;
    const [{ id }] = await tx.insert(coachingQualityReviews).values({
      caseId: input.caseId, orgId: coachingCase.orgId, reviewType: "self", reviewerId: me.id, periodKey,
      frameworkVersion: COACHING_QUALITY_FRAMEWORK.version, version, previousId: current?.id ?? null,
      ...fields, status: "submitted", submittedAt: now, assignedBy: me.id,
    }).$returningId();
    await event(tx, input.caseId, me.id, "quality_review_submitted", `质量自查 ${periodKey} V${version} 已提交`);
    return { id, version, status: "submitted" as const };
  });
}

async function assignedReview(db: Db, me: StaffUser, reviewId: number): Promise<QualityRow> {
  const orgId = requireOrgStaff(me);
  const [row] = await db.select().from(coachingQualityReviews).where(eq(coachingQualityReviews.id, reviewId)).limit(1);
  if (!row || row.orgId !== orgId) throw new TRPCError({ code: "NOT_FOUND", message: "质量检查任务不存在" });
  if (row.reviewerId !== me.id) throw new TRPCError({ code: "FORBIDDEN", message: "只能提交分配给自己的质量检查" });
  return row;
}

/** 被指派检查人可完成原待办；已提交内容更正时追加版本，不覆盖历史。 */
export async function submitQualityReview(db: Db, me: StaffUser, input: QualityInput & { reviewId: number }) {
  const review = await assignedReview(db, me, input.reviewId);
  if (review.status === "closed") throw new TRPCError({ code: "CONFLICT", message: "已整改关闭的检查不能再修改" });
  const fields = validateQualityInput(input);
  return db.transaction(async (tx) => {
    const [locked] = await tx.select().from(coachingQualityReviews).where(eq(coachingQualityReviews.id, review.id)).limit(1).for("update");
    if (!locked || locked.reviewerId !== me.id) throw new TRPCError({ code: "NOT_FOUND", message: "质量检查任务不存在" });
    if (locked.status === "closed") throw new TRPCError({ code: "CONFLICT", message: "已整改关闭的检查不能再修改" });
    const now = new Date();
    if (locked.status === "pending") {
      const result = await tx.update(coachingQualityReviews).set({ ...fields, status: "submitted", submittedAt: now })
        .where(and(eq(coachingQualityReviews.id, locked.id), eq(coachingQualityReviews.status, "pending")));
      assertAffected(result, "检查状态已变化，请刷新");
      await event(tx, locked.caseId, me.id, "quality_review_submitted", `${TYPE_LABEL[locked.reviewType as CoachingReviewType] ?? "质量检查"} ${locked.periodKey} V${locked.version} 已提交`);
      return { id: locked.id, version: locked.version, status: "submitted" as const };
    }
    const latest = await latestVersion(tx, locked);
    if (latest.status === "closed") throw new TRPCError({ code: "CONFLICT", message: "该检查的最新版本已整改关闭" });
    const version = latest.version + 1;
    const [{ id }] = await tx.insert(coachingQualityReviews).values({
      caseId: latest.caseId, orgId: latest.orgId, reviewType: latest.reviewType, reviewerId: latest.reviewerId,
      periodKey: latest.periodKey, frameworkVersion: COACHING_QUALITY_FRAMEWORK.version, version, previousId: latest.id,
      ...fields, status: "submitted", dueAt: latest.dueAt, submittedAt: now, assignedBy: latest.assignedBy,
    }).$returningId();
    await event(tx, latest.caseId, me.id, "quality_review_corrected", `质量检查 ${latest.periodKey} 已更正并追加 V${version}`);
    return { id, version, status: "submitted" as const };
  });
}

/** 只返回当前账号待办及学员姓名，不借互查开放 GROW、异常或内部附件正文。 */
export async function qualityInbox(db: Db, me: StaffUser) {
  const orgId = requireOrgStaff(me);
  return db.select({ review: coachingQualityReviews, studentName: users.name }).from(coachingQualityReviews)
    .innerJoin(coachingCases, eq(coachingQualityReviews.caseId, coachingCases.id))
    .innerJoin(users, eq(coachingCases.studentUserId, users.id))
    .where(and(eq(coachingQualityReviews.reviewerId, me.id), eq(coachingQualityReviews.orgId, orgId),
      eq(coachingQualityReviews.status, "pending"), eq(coachingCases.orgId, orgId)))
    .orderBy(desc(coachingQualityReviews.id)).limit(100);
}

export async function qualityReviews(db: Db, me: StaffUser, caseId: number) {
  const coachingCase = await assertCaseAccess(db, me, caseId);
  return db.select({ review: coachingQualityReviews, reviewerName: users.name }).from(coachingQualityReviews)
    .leftJoin(users, eq(coachingQualityReviews.reviewerId, users.id))
    .where(and(eq(coachingQualityReviews.caseId, caseId), eq(coachingQualityReviews.orgId, coachingCase.orgId)))
    .orderBy(desc(coachingQualityReviews.id)).limit(120);
}

/** 管理员或检查人均可提交整改关闭证据；只读历史版本不能绕过状态限制。 */
export async function closeQualityReview(db: Db, me: StaffUser, input: { reviewId: number; closeEvidence: string }) {
  const orgId = requireOrgStaff(me);
  const evidence = required(input.closeEvidence, "请填写整改结果与可核验关闭证据");
  const [review] = await db.select().from(coachingQualityReviews).where(eq(coachingQualityReviews.id, input.reviewId)).limit(1);
  if (!review || review.orgId !== orgId) throw new TRPCError({ code: "NOT_FOUND", message: "质量检查不存在" });
  if (me.role !== "admin" && review.reviewerId !== me.id) throw new TRPCError({ code: "FORBIDDEN", message: "仅管理员或该检查人可关闭" });
  if (review.status !== "submitted") throw new TRPCError({ code: "PRECONDITION_FAILED", message: "只有已提交的检查才能整改关闭" });
  return db.transaction(async (tx) => {
    const [locked] = await tx.select().from(coachingQualityReviews).where(eq(coachingQualityReviews.id, review.id)).limit(1).for("update");
    if (!locked || locked.status !== "submitted") throw new TRPCError({ code: "CONFLICT", message: "检查状态已变化，请刷新" });
    const now = new Date();
    const result = await tx.update(coachingQualityReviews).set({ status: "closed", closedBy: me.id, closedAt: now, closeEvidence: evidence })
      .where(and(eq(coachingQualityReviews.id, locked.id), eq(coachingQualityReviews.status, "submitted")));
    assertAffected(result, "检查状态已变化，请刷新");
    await event(tx, locked.caseId, me.id, "quality_review_closed", `质量检查 ${locked.periodKey} V${locked.version} 已核验整改并关闭`);
    return { id: locked.id, status: "closed" as const };
  });
}

export function qualitySummary(row: Pick<QualityRow, "planScore" | "executionScore" | "archiveScore" | "familyScore" | "reviewScore">) {
  if ([row.planScore, row.executionScore, row.archiveScore, row.familyScore, row.reviewScore].some((score) => score == null)) return null;
  const scores: CoachingQualityScores = { plan: row.planScore!, execution: row.executionScore!, archive: row.archiveScore!, family: row.familyScore!, review: row.reviewScore! };
  const total = qualityScoreTotal(scores);
  return { total, level: coachingQualityLevel(total) };
}
