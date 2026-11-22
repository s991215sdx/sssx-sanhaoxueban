import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { coachingCases } from "@db/schema";
import type { getDb } from "./queries/connection";
import { assertStudentAccess, requireOrgStaff, type StaffUser } from "./orgAccess";

type Db = ReturnType<typeof getDb>;
export type CoachingCaseRow = typeof coachingCases.$inferSelect;

/** 所有陪跑关联对象都必须先通过当前机构、当前主档与名下学员校验。 */
export async function assertCaseAccess(db: Db, me: StaffUser, caseId: number): Promise<CoachingCaseRow> {
  const orgId = requireOrgStaff(me);
  const [row] = await db.select().from(coachingCases).where(eq(coachingCases.id, caseId)).limit(1);
  if (!row || row.orgId !== orgId) throw new TRPCError({ code: "NOT_FOUND", message: "陪跑主档不存在" });
  if (me.role !== "admin" && row.coachId !== me.id && row.supervisorId !== me.id) await assertStudentAccess(db, me, row.studentUserId);
  return row;
}
