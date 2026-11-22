import { and, eq, isNull } from "drizzle-orm";
import { inviteChannels, inviteRegistrations, studentProfile, studentTutor, users, type User } from "@db/schema";
import { getDb } from "./queries/connection";

type Db = ReturnType<typeof getDb>;

/**
 * SaaS 租户隔离约定：同手机号的每个机构身份是独立 users 行。
 * 机构身份只能访问当前 orgId 的学员，历史跨机构分配记录不能突破这个边界。
 * orgId = null 的学员只有在存在本机构邀请或分配关系时才可见；平台超管不受此限。
 */
export type OrgId = number | null;

export function orgOf(user: Pick<User, "orgId">): OrgId {
  return user.orgId ?? null;
}

export function isPlatformAdmin(user: Pick<User, "role" | "orgId">): boolean {
  return user.role === "admin" && (user.orgId ?? null) === null;
}

/**
 * 找出通过本机构渠道注册、或分配给本机构伴学师的无机构旧学员。
 * 只用于兼容历史空 org_id，不修改旧数据归属，也不把其他机构学员带入。
 */
export async function listUnboundOrgStudentIds(db: Db, orgId: number): Promise<Set<number>> {
  const [invited, assigned, primary] = await Promise.all([
    db.select({ userId: inviteRegistrations.userId }).from(inviteRegistrations)
      .innerJoin(inviteChannels, eq(inviteChannels.id, inviteRegistrations.channelId))
      .where(eq(inviteChannels.orgId, orgId)),
    db.select({ userId: studentTutor.studentUserId }).from(studentTutor)
      .innerJoin(users, eq(users.id, studentTutor.tutorUserId))
      .where(eq(users.orgId, orgId)),
    db.select({ userId: studentProfile.userId }).from(studentProfile)
      .innerJoin(users, eq(users.id, studentProfile.tutorId))
      .where(eq(users.orgId, orgId)),
  ]);
  return new Set([...invited, ...assigned, ...primary].map((row) => row.userId));
}

/** 当前机构可见学员 ID；平台超管传 null 时不设限制。 */
export async function listOrgStudentIds(db: Db, orgId: number | null): Promise<Set<number> | null> {
  if (orgId == null) return null;
  const [members, unboundCandidates] = await Promise.all([
    db.select({ id: users.id }).from(users).where(and(eq(users.orgId, orgId), eq(users.role, "user"), isNull(users.deletedAt))),
    listUnboundOrgStudentIds(db, orgId),
  ]);
  const ids = new Set(members.map((user) => user.id));
  if (unboundCandidates.size) {
    const legacy = await db.select({ id: users.id }).from(users)
      .where(and(isNull(users.orgId), eq(users.role, "user"), isNull(users.deletedAt)));
    for (const user of legacy) if (unboundCandidates.has(user.id)) ids.add(user.id);
  }
  return ids;
}

/** 本机构账号；历史无机构学员必须另有本机构邀请／分配关系。 */
export async function sameOrg(db: Db, me: Pick<User, "orgId">, targetUserId: number): Promise<boolean> {
  if (me.orgId == null) return true;
  const target = (await db.select({ orgId: users.orgId, role: users.role }).from(users).where(eq(users.id, targetUserId)).limit(1))[0];
  if (!target) return false;
  if (target.orgId != null) return target.orgId === me.orgId;
  if (target.role !== "user") return false;
  return (await listUnboundOrgStudentIds(db, me.orgId)).has(targetUserId);
}

/** 管理员限本机构；伴学师还必须是学员的当前身份名下关系。 */
export async function canAccessUser(
  db: Db,
  me: Pick<User, "id" | "orgId"> & { role: string },
  targetUserId: number,
): Promise<boolean> {
  if (me.role === "tutor") {
    const { isMyStudent } = await import("./tutorAccess");
    return isMyStudent(db, me, targetUserId);
  }
  return sameOrg(db, me, targetUserId);
}

/** 普通职员／账号列表只取当前机构，不再把全体无机构账号混入。 */
export function orgScope(orgId: number) {
  return eq(users.orgId, orgId);
}

/** 手机号脱敏：保留前 3 + 后 4，中间打码。 */
export function maskPhone(phone: string | null): string | null {
  if (!phone) return phone;
  if (phone.length <= 6) return phone[0] + "****";
  return phone.slice(0, 3) + "****" + phone.slice(-4);
}
