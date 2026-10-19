import { eq } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { organizations } from "@db/schema";

/** 域名规范化：去协议/路径/端口，转小写；非法返回空串 */
export function normalizeHost(raw: string | null | undefined): string {
  return (raw ?? "")
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
}

const HOST_RE = /^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/;

/**
 * v224/v225：按入口域名查绑定的机构（organizations.portal_host）。
 * 未绑定/非法 host 返回 null。登录限制与登录页品牌化共用。
 */
export async function portalOrgByHost(rawHost: string | null | undefined) {
  const host = normalizeHost(rawHost);
  if (!host || !HOST_RE.test(host)) return null;
  const db = getDb();
  return (
    (await db.select().from(organizations).where(eq(organizations.portalHost, host)).limit(1))[0] ?? null
  );
}
