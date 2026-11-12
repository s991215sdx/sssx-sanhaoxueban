import { TRPCError } from "@trpc/server";
import { and, eq } from "drizzle-orm";
import { coachingCaseStaff, coachingCases, users } from "@db/schema";
import type { getDb } from "./queries/connection";
import { canAccessUser } from "./tenant";

export type StaffUser = Pick<typeof users.$inferSelect, "id" | "orgId" | "role">;
type Db = ReturnType<typeof getDb>;

export function requireOrgStaff(user: StaffUser): number {
  if (!["tutor", "admin"].includes(user.role) || user.orgId == null) {
    throw new TRPCError({ code: "FORBIDDEN", message: "请以机构伴学师或管理员身份进入" });
  }
  return user.orgId;
}

/** 当前机构、当前主档、当前员工且 active 的团队关系才可访问该学员完整服务资料。 */
export async function hasCoachingTeamStudentAccess(db: Db, me: StaffUser, studentUserId: number): Promise<boolean> {
  const orgId = requireOrgStaff(me);
  const [membership] = await db.select({ id: coachingCaseStaff.id }).from(coachingCaseStaff)
    .innerJoin(coachingCases, eq(coachingCaseStaff.caseId, coachingCases.id))
    .where(and(eq(coachingCaseStaff.orgId, orgId), eq(coachingCases.orgId, orgId),
      eq(coachingCaseStaff.userId, me.id), eq(coachingCaseStaff.active, true), eq(coachingCases.studentUserId, studentUserId))).limit(1);
  return Boolean(membership);
}

/** 新服务失败关闭：优先名下关系，其次本主档有效团队关系；不允许跨机构串联。 */
export async function assertStudentAccess(db: Db, me: StaffUser, studentUserId: number): Promise<void> {
  requireOrgStaff(me);
  const [student] = await db.select({ id: users.id, orgId: users.orgId, role: users.role, deletedAt: users.deletedAt }).from(users).where(eq(users.id, studentUserId)).limit(1);
  if (!student || student.deletedAt || student.role !== "user") throw new TRPCError({ code: "NOT_FOUND", message: "学员不存在或已停用" });
  if (!(await canAccessUser(db, me, studentUserId))) {
    if (student.orgId != null && student.orgId !== me.orgId) throw new TRPCError({ code: "FORBIDDEN", message: "不能访问其他机构的学员" });
    if (!(await hasCoachingTeamStudentAccess(db, me, studentUserId))) {
      throw new TRPCError({ code: "FORBIDDEN", message: me.role === "tutor" ? "这位学员不在你的伴学名单或服务团队中" : "不能访问其他机构的学员" });
    }
  }
}
