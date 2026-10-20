/**
 * v229：机构功能权限（services）生效值读取。
 * 规则：settings.services 未配置的 key = 开启（默认全开，存量零行为变化）；
 * 职员取本人 orgId，学生取最新注册渠道所属机构；无机构归属（平台超管）一律放行。
 */
import { desc, eq } from "drizzle-orm";
import { inviteChannels, inviteRegistrations, organizations } from "@db/schema";
import { resolveServices } from "@contracts/edition";
import type { OrgServiceKey, OrgServices } from "@contracts/edition";
import { getDb } from "./queries/connection";

type Db = ReturnType<typeof getDb>;

/** 用户生效机构 id：职员=本人 orgId；学生=最新注册渠道机构；都没有=null。 */
export async function effectiveOrgId(db: Db, user: { id: number; orgId: number | null }): Promise<number | null> {
  if (user.orgId != null) return user.orgId;
  const [reg] = await db
    .select({ channelId: inviteRegistrations.channelId })
    .from(inviteRegistrations)
    .where(eq(inviteRegistrations.userId, user.id))
    .orderBy(desc(inviteRegistrations.id))
    .limit(1);
  if (!reg) return null;
  const [ch] = await db
    .select({ orgId: inviteChannels.orgId })
    .from(inviteChannels)
    .where(eq(inviteChannels.id, reg.channelId))
    .limit(1);
  return ch?.orgId ?? null;
}

/** 机构功能包生效值（默认全开覆盖存储配置）；orgId=null 返回默认全开。 */
export async function servicesForOrg(db: Db, orgId: number | null): Promise<OrgServices> {
  if (orgId == null) return resolveServices("org", null);
  const [org] = await db
    .select({ edition: organizations.edition, settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  if (!org) return resolveServices("org", null);
  const stored = (org.settings ?? null) as { services?: Partial<OrgServices> } | null;
  return resolveServices(org.edition === "school" ? "school" : "org", stored?.services);
}

/** 某用户的某功能是否开通。 */
export async function serviceEnabledFor(
  db: Db,
  user: { id: number; orgId: number | null },
  key: OrgServiceKey,
): Promise<boolean> {
  return (await servicesForOrg(db, await effectiveOrgId(db, user)))[key];
}
