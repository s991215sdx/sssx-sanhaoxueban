import { TRPCError } from "@trpc/server";
import { and, eq, inArray } from "drizzle-orm";
import { inviteChannels, inviteRegistrations, studentProfile, studentTutor, users } from "@db/schema";
import type { getDb } from "./queries/connection";

export type StaffUser = Pick<typeof users.$inferSelect, "id" | "orgId" | "role">;
type Db = ReturnType<typeof getDb>;

export function requireOrgStaff(user: StaffUser): number {
  if (!["tutor", "admin"].includes(user.role) || user.orgId == null) {
    throw new TRPCError({ code: "FORBIDDEN", message: "请以机构伴学师或管理员身份进入" });
  }
  return user.orgId;
}

/** 新服务失败关闭：不使用旧读取接口的异常放行兼容逻辑。 */
export async function assertStudentAccess(db: Db, me: StaffUser, studentUserId: number): Promise<void> {
  const orgId = requireOrgStaff(me);
  const [student] = await db.select({ id: users.id, orgId: users.orgId, role: users.role, deletedAt: users.deletedAt }).from(users).where(eq(users.id, studentUserId)).limit(1);
  if (!student || student.deletedAt || student.role !== "user") throw new TRPCError({ code: "NOT_FOUND", message: "学员不存在或已停用" });
  if (me.role === "admin" && (student.orgId === orgId || student.orgId == null)) return;
  /* 机构边界先于历史分配关系，异常的旧 tutor_id／关联记录不能跨机构放行。 */
  if (student.orgId != null && student.orgId !== orgId) throw new TRPCError({ code: "FORBIDDEN", message: "不能访问其他机构的学员" });
  const [profile] = await db.select({ tutorId: studentProfile.tutorId }).from(studentProfile).where(eq(studentProfile.userId, studentUserId)).limit(1);
  if (profile?.tutorId === me.id) return;
  const [link] = await db.select({ id: studentTutor.id }).from(studentTutor)
    .where(and(eq(studentTutor.studentUserId, studentUserId), eq(studentTutor.tutorUserId, me.id))).limit(1);
  if (link) return;
  const channels = await db.select({ id: inviteChannels.id }).from(inviteChannels).where(eq(inviteChannels.tutorId, me.id));
  if (channels.length) {
    const [registration] = await db.select({ id: inviteRegistrations.id }).from(inviteRegistrations)
      .where(and(eq(inviteRegistrations.userId, studentUserId), inArray(inviteRegistrations.channelId, channels.map((c) => c.id)))).limit(1);
    if (registration) return;
  }
  throw new TRPCError({ code: "FORBIDDEN", message: "这位学员不在你的伴学名单中" });
}
