import { and, desc, eq } from "drizzle-orm";
import { assessmentResults, coachingCaseProfiles, coachingEvents } from "@db/schema";
import type { getDb } from "./queries/connection";
import type { StaffUser } from "./orgAccess";
import { assertCaseAccess, type CoachingCaseRow } from "./coachingAccess";
import { hasAssessmentReportAccess } from "./assessmentReports";

type Db = ReturnType<typeof getDb>;
export type CoachingProfileInput = {
  caseId: number;
  birthDate?: string | null;
  studentInfo: string;
  threeParty: string;
  parentProfile: string;
  attention: string;
  commAdvice: string;
};

/** 仅教练端主档详情调用；家庭端不得复用此读取函数。 */
export async function getCoachingCaseProfile(db: Db, coachingCase: CoachingCaseRow) {
  const [profile] = await db.select().from(coachingCaseProfiles)
    .where(and(eq(coachingCaseProfiles.caseId, coachingCase.id), eq(coachingCaseProfiles.orgId, coachingCase.orgId))).limit(1);
  return profile ?? null;
}

export async function saveCoachingCaseProfile(db: Db, me: StaffUser, input: CoachingProfileInput) {
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  const values = {
    orgId: coachingCase.orgId,
    caseId: coachingCase.id,
    birthDate: input.birthDate || null,
    studentInfo: input.studentInfo,
    threeParty: input.threeParty,
    parentProfile: input.parentProfile,
    attention: input.attention,
    commAdvice: input.commAdvice,
    updatedBy: me.id,
    updatedAt: new Date(),
  };
  await db.transaction(async (tx) => {
    await tx.insert(coachingCaseProfiles).values(values).onDuplicateKeyUpdate({ set: values });
    await tx.insert(coachingEvents).values({ caseId: coachingCase.id, actorUserId: me.id, type: "profile_updated",
      content: "画像档案已更新（内部资料，不自动推送家庭）", visibility: "internal" });
  });
  return { ok: true as const };
}

/** E3 报告结果不含原始作答；旧版保留查看，但复测对比在前端仅采用 V3.7。 */
export async function coachingE3Results(db: Db, me: StaffUser, coachingCase: CoachingCaseRow) {
  if (!(await hasAssessmentReportAccess(db, me, coachingCase.studentUserId))) return [];
  return db.select({ id: assessmentResults.id, kind: assessmentResults.kind, result: assessmentResults.result, createdAt: assessmentResults.createdAt })
    .from(assessmentResults).where(and(eq(assessmentResults.userId, coachingCase.studentUserId), eq(assessmentResults.kind, "e3")))
    .orderBy(desc(assessmentResults.id)).limit(8);
}
