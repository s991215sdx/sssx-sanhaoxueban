import { eq } from "drizzle-orm";
import { users, type User } from "@db/schema";
import { getDb } from "./queries/connection";

/**
 * V59 SaaS 租户隔离约定：
 * - users.orgId = null → 平台超管（总系统），只能看机构管理，看不到任何机构的学员/数据；
 * - 机构内所有账号（admin/tutor/student）共享同一 orgId；
 * - 跨用户查询（学员列表、伴学师列表、统计、分配）必须带 orgId 过滤；
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
 * 目标用户是否在当前用户同一机构内（平台超管对机构数据无访问权，恒 false）。
 * 用于学员详情、AI 问诊带学员、分配校验等跨用户访问点。
 */
export async function sameOrg(db: ReturnType<typeof getDb>, me: Pick<User, "orgId">, targetUserId: number): Promise<boolean> {
  if (me.orgId == null) return false;
  const t = (await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, targetUserId)).limit(1))[0];
  return !!t && t.orgId === me.orgId;
}
