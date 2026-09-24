import { eq } from "drizzle-orm";
import { users, type User } from "@db/schema";
import { getDb } from "./queries/connection";

/**
 * V59/V60 SaaS 租户隔离约定：
 * - users.orgId = null → 平台超管（总系统）：可管理任意账号、查看全部机构数据（god mode）；
 * - 机构内所有账号（admin/tutor/student）共享同一 orgId，跨用户访问限本机构；
 * - 跨用户查询（学员列表、伴学师列表、统计、分配）按 orgId 过滤：number=本机构，null/undefined=全量（超管）；
 *   ctx.user.id 自用范围查询天然隔离，无需改动。
 */

/** 机构 ID：null 表示平台超管（无机构）。 */
export type OrgId = number | null;

/** 当前用户所属机构。 */
export function orgOf(user: Pick<User, "orgId">): OrgId {
  return user.orgId ?? null;
}

/** 是否平台超管（总系统账号）。 */
export function isPlatformAdmin(user: Pick<User, "role" | "orgId">): boolean {
  return user.role === "admin" && (user.orgId ?? null) === null;
}

/**
 * 目标用户是否在当前用户可管理范围内：
 * - 平台超管（orgId=null）可管理任意账号（全系统 god mode）；
 * - 机构管理员/伴学师只能管理本机构账号。
 * 用于学员详情、AI 问诊带学员、分配校验、角色设置等跨用户访问点。
 */
export async function sameOrg(db: ReturnType<typeof getDb>, me: Pick<User, "orgId">, targetUserId: number): Promise<boolean> {
  if (me.orgId == null) return true;
  const t = (await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, targetUserId)).limit(1))[0];
  return !!t && t.orgId === me.orgId;
}
