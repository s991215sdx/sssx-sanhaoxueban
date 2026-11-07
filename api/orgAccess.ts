import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { users } from "@db/schema";
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

/** 新服务失败关闭：统一按当前身份机构与名下关系校验，不兼容旧跨机构关系。 */
export async function assertStudentAccess(db: Db, me: StaffUser, studentUserId: number): Promise<void> {
  requireOrgStaff(me);
  const [student] = await db.select({ id: users.id, orgId: users.orgId, role: users.role, deletedAt: users.deletedAt }).from(users).where(eq(users.id, studentUserId)).limit(1);
  if (!student || student.deletedAt || student.role !== "user") throw new TRPCError({ code: "NOT_FOUND", message: "学员不存在或已停用" });
  if (!(await canAccessUser(db, me, studentUserId))) {
    if (student.orgId != null && student.orgId !== me.orgId) throw new TRPCError({ code: "FORBIDDEN", message: "不能访问其他机构的学员" });
    throw new TRPCError({ code: "FORBIDDEN", message: me.role === "tutor" ? "这位学员不在你的伴学名单中" : "不能访问其他机构的学员" });
  }
}
