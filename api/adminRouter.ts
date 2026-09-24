import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { attempts, dailyPlans, errorLogs, moodEntries, papers, previewSessions, studentProfile, studentTutor, users } from "@db/schema";
import { getStudentDetail, listStudents } from "./studentDetail";
import { isPlatformAdmin, sameOrg } from "./tenant";

export const adminRouter = createRouter({
  /**
   *  bootstrap：当系统还没有任何管理员时，当前登录用户可自任管理员。
   *  一旦已有管理员，此接口永远拒绝（后续管理员由现有管理员在后台设置）。
   */
  claimAdmin: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    const admins = await db.select({ id: users.id }).from(users).where(eq(users.role, "admin")).limit(1);
    if (admins.length > 0) throw new Error("已有管理员，请让管理员在后台为你开通");
    await db.update(users).set({ role: "admin" }).where(eq(users.id, ctx.user.id));
    return { ok: true };
  }),

  /**
   *  V59 平台超管自举：当不存在任何平台超管（orgId IS NULL 的 admin）时，
   *  当前机构管理员可把自己升级为平台超管（总系统），用于开通/管理机构。
   *  一旦已有平台超管，此接口永远拒绝。
   */
  claimPlatformAdmin: adminQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    const platformAdmins = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "admin"), isNull(users.orgId)))
      .limit(1);
    if (platformAdmins.length > 0) throw new Error("已有平台超管");
    await db.update(users).set({ orgId: null }).where(eq(users.id, ctx.user.id));
    return { ok: true };
  }),

  /** 把某个用户设为/取消角色（仅管理员；机构内不能设置 admin——管理员由平台超管在机构管理中开通）。 */
  setRole: adminQuery
    .input((v: unknown) => v as { userId: number; role: "user" | "tutor" | "admin" })
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (input.role === "admin" && !isPlatformAdmin(ctx.user)) {
        throw new Error("仅平台超管可设置管理员");
      }
      if (!(await sameOrg(db, ctx.user, input.userId))) throw new Error("该用户不在你的机构内");
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      return { ok: true };
    }),

  /** 学员列表：档案 + 测评标签 + 学习概览 + 已分配伴学师（V59：限本机构）。 */
  students: adminQuery.query(async ({ ctx }) => {
    return listStudents(getDb(), ctx.user.orgId);
  }),

  /** 学员详情：档案 + 学业目标 + 全部测评（含答题明细）+ 学习数据（V59：限本机构）。 */
  studentDetail: adminQuery
    .input((v: unknown) => v as { userId: number })
    .query(async ({ ctx, input }) => {
      return getStudentDetail(getDb(), input.userId, ctx.user.orgId);
    }),

  /** 伴学师列表：每人名下学员数与学员活跃度（V56：含多对多分配，去重；V59：限本机构）。 */
  tutors: adminQuery.query(async ({ ctx }) => {
    const db = getDb();
    const orgId = ctx.user.orgId;
    const tutors =
      orgId == null
        ? [] // 平台超管无机构数据权限
        : await db.select().from(users).where(and(eq(users.role, "tutor"), eq(users.orgId, orgId)));
    const profiles = await db.select().from(studentProfile);
    const { listStudentTutorLinks } = await import("./tutorAccess");
    const links = await listStudentTutorLinks(db);
    const attRows = await db
      .select({ userId: attempts.userId, c: sql<number>`count(*)` })
      .from(attempts)
      .groupBy(attempts.userId);
    const attMap = new Map(attRows.map((r) => [r.userId, Number(r.c)]));
    return tutors.map((t) => {
      const ids = new Set<number>();
      for (const p of profiles) if (p.tutorId === t.id) ids.add(p.userId);
      for (const l of links) if (l.tutorUserId === t.id) ids.add(l.studentUserId);
      const mine = profiles.filter((p) => ids.has(p.userId));
      return {
        id: t.id,
        name: t.name ?? `伴学师${t.id}`,
        createdAt: t.createdAt,
        lastSignInAt: t.lastSignInAt,
        studentCount: mine.length,
        students: mine.map((p) => ({ userId: p.userId, name: p.name, grade: p.grade })),
        totalAttempts: mine.reduce((s, p) => s + (attMap.get(p.userId) ?? 0), 0),
      };
    });
  }),

  /** 给学员分配/更换/解除伴学师（tutorId=null 解除）。V56：同步写入多对多分配表。V59：双方须同机构。 */
  assignTutor: adminQuery
    .input((v: unknown) => v as { studentUserId: number; tutorId: number | null })
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (!(await sameOrg(db, ctx.user, input.studentUserId))) throw new Error("该学员不在你的机构内");
      if (input.tutorId != null) {
        if (!(await sameOrg(db, ctx.user, input.tutorId))) throw new Error("该伴学师不在你的机构内");
        const t = await db.query.users.findFirst({ where: eq(users.id, input.tutorId) });
        if (!t || (t.role !== "tutor" && t.role !== "admin")) throw new Error("对方不是伴学师");
      }
      await db
        .update(studentProfile)
        .set({ tutorId: input.tutorId })
        .where(eq(studentProfile.userId, input.studentUserId));
      // 多对多表同步：单选分配 = 全量替换为该伴学师一人（解除 = 清空）
      await db.delete(studentTutor).where(eq(studentTutor.studentUserId, input.studentUserId));
      if (input.tutorId != null) {
        await db.insert(studentTutor).values({ studentUserId: input.studentUserId, tutorUserId: input.tutorId });
      }
      return { ok: true };
    }),

  /** V56：给一个学员分配多位伴学师（全量替换）。第一位写入 tutor_id 作为主管（兼容旧逻辑）。V59：双方须同机构。 */
  setStudentTutors: adminQuery
    .input((v: unknown) => v as { studentUserId: number; tutorIds: number[] })
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      if (!(await sameOrg(db, ctx.user, input.studentUserId))) throw new Error("该学员不在你的机构内");
      const ids = [...new Set(input.tutorIds ?? [])];
      for (const id of ids) {
        if (!(await sameOrg(db, ctx.user, id))) throw new Error(`用户 ${id} 不在你的机构内`);
        const t = await db.query.users.findFirst({ where: eq(users.id, id) });
        if (!t || (t.role !== "tutor" && t.role !== "admin")) throw new Error(`用户 ${id} 不是伴学师`);
      }
      await db.delete(studentTutor).where(eq(studentTutor.studentUserId, input.studentUserId));
      if (ids.length > 0) {
        await db.insert(studentTutor).values(ids.map((tutorUserId) => ({ studentUserId: input.studentUserId, tutorUserId })));
      }
      await db
        .update(studentProfile)
        .set({ tutorId: ids[0] ?? null })
        .where(eq(studentProfile.userId, input.studentUserId));
      return { ok: true, tutorIds: ids };
    }),

  /** 全局总览：用户数与关键业务量（V59：限本机构；平台超管见总系统面板——此处返回 0，机构管理另有统计）。 */
  overview: adminQuery.query(async ({ ctx }) => {
    const db = getDb();
    const orgId = ctx.user.orgId;
    if (orgId == null) {
      return { userCount: 0, attemptCount: 0, errorCount: 0, paperCount: 0, moodCount: 0, previewCount: 0 };
    }
    /* 业务量按用户归属机构统计：业务表 inner join users 过滤 orgId */
    const joinCount = async (table: never, col: never): Promise<number> => {
      const rows = await db
        .select({ c: sql<number>`count(*)` })
        .from(table as never)
        .innerJoin(users, eq(col as never, users.id))
        .where(eq(users.orgId, orgId));
      return Number((rows[0] as { c: number }).c ?? 0);
    };
    const [userRows, attemptCount, errorCount, paperCount, moodCount, previewRows] = await Promise.all([
      db.select({ c: sql<number>`count(*)` }).from(users).where(eq(users.orgId, orgId)),
      joinCount(attempts as never, attempts.userId as never),
      joinCount(errorLogs as never, errorLogs.userId as never),
      joinCount(papers as never, papers.userId as never),
      joinCount(moodEntries as never, moodEntries.userId as never),
      db
        .select({ c: sql<number>`count(*)` })
        .from(previewSessions)
        .innerJoin(users, eq(previewSessions.userId, users.id))
        .where(and(eq(previewSessions.completed, true), eq(users.orgId, orgId))),
    ]);
    return {
      userCount: Number((userRows[0] as { c: number }).c ?? 0),
      attemptCount,
      errorCount,
      paperCount,
      moodCount,
      previewCount: Number((previewRows[0] as { c: number }).c ?? 0),
    };
  }),

  /** 用户列表：每人一行的学习概览（V59：限本机构）。 */
  users: adminQuery.query(async ({ ctx }) => {
    const db = getDb();
    const orgId = ctx.user.orgId;
    const allUsers =
      orgId == null
        ? await db.select().from(users).where(isNull(users.orgId)).orderBy(desc(users.createdAt))
        : await db.select().from(users).where(eq(users.orgId, orgId)).orderBy(desc(users.createdAt));
    const [errRows, attRows, planRows] = await Promise.all([
      db.select({ userId: errorLogs.userId, c: sql<number>`count(*)` }).from(errorLogs).groupBy(errorLogs.userId),
      db.select({ userId: attempts.userId, c: sql<number>`count(*)` }).from(attempts).groupBy(attempts.userId),
      db.select({ userId: dailyPlans.userId, c: sql<number>`count(*)` }).from(dailyPlans).groupBy(dailyPlans.userId),
    ]);
    const errMap = new Map(errRows.map((r) => [r.userId, Number(r.c)]));
    const attMap = new Map(attRows.map((r) => [r.userId, Number(r.c)]));
    const planMap = new Map(planRows.map((r) => [r.userId, Number(r.c)]));
    return allUsers.map((u) => ({
      id: u.id,
      name: u.name ?? "未命名",
      email: u.email,
      role: u.role,
      createdAt: u.createdAt,
      lastSignInAt: u.lastSignInAt,
      errors: errMap.get(u.id) ?? 0,
      attempts: attMap.get(u.id) ?? 0,
      plans: planMap.get(u.id) ?? 0,
    }));
  }),

  /** 单个用户详情：基础信息 + 最近动态（仅聚合，不看树洞内容，保护隐私）。V59：限本机构。 */
  userDetail: adminQuery
    .input((v: unknown) => v as { userId: number })
    .query(async ({ ctx, input }) => {
      const db = getDb();
      if (!(await sameOrg(db, ctx.user, input.userId))) throw new Error("该用户不在你的机构内");
      const u = await db.query.users.findFirst({ where: eq(users.id, input.userId) });
      if (!u) throw new Error("用户不存在");
      const recentAttempts = await db
        .select({ createdAt: attempts.createdAt, correct: attempts.correct, stage: attempts.stage })
        .from(attempts)
        .where(eq(attempts.userId, input.userId))
        .orderBy(desc(attempts.createdAt))
        .limit(20);
      const moodRecent = await db
        .select({ mood: moodEntries.mood, createdAt: moodEntries.createdAt })
        .from(moodEntries)
        .where(eq(moodEntries.userId, input.userId))
        .orderBy(desc(moodEntries.createdAt))
        .limit(7);
      const previews = await db
        .select({ id: previewSessions.id })
        .from(previewSessions)
        .where(and(eq(previewSessions.userId, input.userId), eq(previewSessions.completed, true)));
      return {
        user: { id: u.id, name: u.name, email: u.email, role: u.role, createdAt: u.createdAt, lastSignInAt: u.lastSignInAt },
        recentAttempts,
        moodRecent,
        previewsDone: previews.length,
      };
    }),
});
