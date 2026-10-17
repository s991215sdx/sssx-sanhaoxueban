import { eq, isNull, or } from "drizzle-orm";
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
 * v179：不再对 org_id 为 NULL 的账号放行——新机构管理员绝不可见其他机构/平台直客数据。
 * v190：无机构（org_id IS NULL）的账号改为对本机构管理员可见——公开邀请码注册的学员
 * 不分机构，若继续隐藏会导致机构管理员「学生做了测评却在列表消失」；
 * 其他机构的账号仍严格隔离，不受影响。
 */
export async function sameOrg(db: ReturnType<typeof getDb>, me: Pick<User, "orgId">, targetUserId: number): Promise<boolean> {
  if (me.orgId == null) return true;
  const t = (await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, targetUserId)).limit(1))[0];
  return !!t && (t.orgId === me.orgId || t.orgId == null);
}

/**
 * v190：机构管理员的数据范围 SQL 条件 = 本机构 + 无机构（org_id IS NULL）用户。
 * 用法：db.select().from(users).where(orgScope(orgId))，或 and(orgScope(orgId), 其它条件)。
 * 仅适用机构管理员分支；平台超管（orgId=null）直接不加条件（全量）。
 */
export function orgScope(orgId: number) {
  return or(eq(users.orgId, orgId), isNull(users.orgId));
}
