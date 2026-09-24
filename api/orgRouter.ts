import { and, eq, sql } from "drizzle-orm";
import { createRouter, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { organizations, studentProfile, users } from "@db/schema";
import { hashPassword } from "./auth-router";
import { isPlatformAdmin } from "./tenant";

/**
 * V59 SaaS 总系统：平台超管（role=admin 且 orgId IS NULL）专用——
 * 开通/管理合作机构的独立三好学伴系统。机构 admin 访问一律 403。
 */

const PHONE_RE = /^1[3-9]\d{9}$/;

function requirePlatformAdmin(user: Pick<typeof users.$inferSelect, "role" | "orgId">): void {
  if (!isPlatformAdmin(user)) throw new Error("仅平台超管可访问总系统");
}

/** 机构行 + 各角色人数 + 管理员账号（用于列表展示与找回）。 */
async function orgRow(db: ReturnType<typeof getDb>, org: typeof organizations.$inferSelect) {
  const [studentRows, tutorRows, adminRows] = await Promise.all([
    db
      .select({ c: sql<number>`count(*)` })
      .from(studentProfile)
      .innerJoin(users, eq(studentProfile.userId, users.id))
      .where(eq(users.orgId, org.id)),
    db.select({ c: sql<number>`count(*)` }).from(users).where(and(eq(users.orgId, org.id), eq(users.role, "tutor"))),
    db.select({ c: sql<number>`count(*)` }).from(users).where(and(eq(users.orgId, org.id), eq(users.role, "admin"))),
  ]);
  const admin = (
    await db
      .select({ id: users.id, phone: users.phone, name: users.name, lastSignInAt: users.lastSignInAt })
      .from(users)
      .where(and(eq(users.orgId, org.id), eq(users.role, "admin")))
      .limit(1)
  )[0];
  return {
    ...org,
    studentCount: Number((studentRows[0] as { c: number }).c ?? 0),
    tutorCount: Number((tutorRows[0] as { c: number }).c ?? 0),
    adminCount: Number((adminRows[0] as { c: number }).c ?? 0),
    admin: admin ?? null,
  };
}

export const orgRouter = createRouter({
  /** 机构列表（含人数统计与管理员账号）。 */
  list: adminQuery.query(async ({ ctx }) => {
    requirePlatformAdmin(ctx.user);
    const db = getDb();
    const orgs = await db.select().from(organizations).orderBy(organizations.id);
    return Promise.all(orgs.map((o) => orgRow(db, o)));
  }),

  /**
   * 开通机构：建机构（名称/商标/Logo）+ 机构管理员账号（手机号+密码）。
   * 机构 admin 登录后进后台就是一套完整独立的三好学伴（功能与总系统一致）。
   */
  create: adminQuery
    .input(
      (v: unknown) =>
        v as {
          name: string;
          brandName: string;
          logoUrl?: string;
          adminPhone: string;
          adminPassword: string;
          adminName?: string;
        },
    )
    .mutation(async ({ ctx, input }) => {
      requirePlatformAdmin(ctx.user);
      const db = getDb();
      const name = (input.name ?? "").trim();
      const brandName = (input.brandName ?? "").trim();
      const logoUrl = (input.logoUrl ?? "").trim() || null;
      const phone = (input.adminPhone ?? "").trim();
      const password = input.adminPassword ?? "";
      const adminName = (input.adminName ?? "").trim() || "机构管理员";
      if (name.length < 2 || name.length > 128) throw new Error("机构全称 2～128 个字");
      if (brandName.length < 2 || brandName.length > 128) throw new Error("品牌名（商标）2～128 个字");
      if (!PHONE_RE.test(phone)) throw new Error("管理员手机号格式不对");
      if (password.length < 6 || password.length > 64) throw new Error("管理员密码需要 6～64 个字符");
      const dup = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
      if (dup[0]) throw new Error("这个手机号已被占用，换一个");

      const [{ id }] = await db.insert(organizations).values({ name, brandName, logoUrl }).$returningId();
      const orgId = Number(id);
      await db.insert(users).values({
        unionId: `phone:${phone}`,
        phone,
        passwordHash: hashPassword(password),
        name: adminName,
        role: "admin",
        orgId,
      });
      const org = (await db.select().from(organizations).where(eq(organizations.id, orgId)).limit(1))[0];
      return { ok: true as const, org: org ? await orgRow(db, org) : null };
    }),

  /** 编辑机构资料（名称/商标/Logo）。 */
  update: adminQuery
    .input((v: unknown) => v as { id: number; name?: string; brandName?: string; logoUrl?: string | null })
    .mutation(async ({ ctx, input }) => {
      requirePlatformAdmin(ctx.user);
      const db = getDb();
      const org = (await db.select().from(organizations).where(eq(organizations.id, input.id)).limit(1))[0];
      if (!org) throw new Error("机构不存在");
      const patch: Partial<typeof organizations.$inferInsert> = {};
      if (input.name != null) {
        const name = input.name.trim();
        if (name.length < 2 || name.length > 128) throw new Error("机构全称 2～128 个字");
        patch.name = name;
      }
      if (input.brandName != null) {
        const brandName = input.brandName.trim();
        if (brandName.length < 2 || brandName.length > 128) throw new Error("品牌名（商标）2～128 个字");
        patch.brandName = brandName;
      }
      if (input.logoUrl !== undefined) patch.logoUrl = input.logoUrl?.trim() || null;
      if (Object.keys(patch).length > 0) {
        await db.update(organizations).set(patch).where(eq(organizations.id, input.id));
      }
      const fresh = (await db.select().from(organizations).where(eq(organizations.id, input.id)).limit(1))[0];
      return { ok: true as const, org: fresh ? await orgRow(db, fresh) : null };
    }),

  /** 停用/启用机构：停用后该机构所有账号登录即见停用提示，管理端置灰。 */
  setActive: adminQuery
    .input((v: unknown) => v as { id: number; active: boolean })
    .mutation(async ({ ctx, input }) => {
      requirePlatformAdmin(ctx.user);
      const db = getDb();
      const org = (await db.select().from(organizations).where(eq(organizations.id, input.id)).limit(1))[0];
      if (!org) throw new Error("机构不存在");
      await db.update(organizations).set({ active: !!input.active }).where(eq(organizations.id, input.id));
      return { ok: true as const };
    }),

  /** 重置机构管理员密码（默认不改账号本身）。 */
  resetAdminPassword: adminQuery
    .input((v: unknown) => v as { id: number; password: string })
    .mutation(async ({ ctx, input }) => {
      requirePlatformAdmin(ctx.user);
      const db = getDb();
      const password = input.password ?? "";
      if (password.length < 6 || password.length > 64) throw new Error("密码需要 6～64 个字符");
      const admin = (
        await db
          .select({ id: users.id })
          .from(users)
          .where(and(eq(users.orgId, input.id), eq(users.role, "admin")))
          .limit(1)
      )[0];
      if (!admin) throw new Error("该机构还没有管理员账号");
      await db.update(users).set({ passwordHash: hashPassword(password) }).where(eq(users.id, admin.id));
      return { ok: true as const };
    }),
});
