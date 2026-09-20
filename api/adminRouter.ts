import { and, desc, eq, sql } from "drizzle-orm";
import { createRouter, authedQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { attempts, dailyPlans, errorLogs, moodEntries, papers, previewSessions, studentProfile, studentTutor, users } from "@db/schema";
import { getStudentDetail, listStudents } from "./studentDetail";

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

  /** 把某个用户设为/取消角色（仅管理员）。 */
  setRole: adminQuery
    .input((v: unknown) => v as { userId: number; role: "user" | "tutor" | "admin" })
    .mutation(async ({ input }) => {
      const db = getDb();
      await db.update(users).set({ role: input.role }).where(eq(users.id, input.userId));
      return { ok: true };
    }),

  /** 学员列表：档案 + 测评标签 + 学习概览 + 已分配伴学师。 */
  students: adminQuery.query(async () => {
    return listStudents(getDb());
  }),

  /** 学员详情：档案 + 学业目标 + 全部测评（含答题明细）+ 学习数据。 */
  studentDetail: adminQuery
    .input((v: unknown) => v as { userId: number })
    .query(async ({ input }) => {
      return getStudentDetail(getDb(), input.userId);
    }),

  /** 伴学师列表：每人名下学员数与学员活跃度（V56：含多对多分配，去重）。 */
  tutors: adminQuery.query(async () => {
    const db = getDb();
    const tutors = await db.select().from(users).where(eq(users.role, "tutor"));
    const profiles = await db.select().from(studentProfile);
    const links = await db.select().from(studentTutor);
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

  /** 给学员分配/更换/解除伴学师（tutorId=null 解除）。V56：同步写入多对多分配表。 */
  assignTutor: adminQuery
    .input((v: unknown) => v as { studentUserId: number; tutorId: number | null })
    .mutation(async ({ input }) => {
      const db = getDb();
      if (input.tutorId != null) {
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

  /** V56：给一个学员分配多位伴学师（全量替换）。第一位写入 tutor_id 作为主管（兼容旧逻辑）。 */
  setStudentTutors: adminQuery
    .input((v: unknown) => v as { studentUserId: number; tutorIds: number[] })
    .mutation(async ({ input }) => {
      const db = getDb();
      const ids = [...new Set(input.tutorIds ?? [])];
      for (const id of ids) {
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

  /** 全局总览：用户数与关键业务量。 */
  overview: adminQuery.query(async () => {
    const db = getDb();
    const count = async <T>(table: T): Promise<number> => {
      const rows = await db.select({ c: sql<number>`count(*)` }).from(table as never);
      return Number((rows[0] as { c: number }).c ?? 0);
    };
    const [userCount, attemptCount, errorCount, paperCount, moodCount, previewCount] = await Promise.all([
      count(users),
      count(attempts),
      count(errorLogs),
      count(papers),
      count(moodEntries),
      db
        .select({ c: sql<number>`count(*)` })
        .from(previewSessions)
        .where(eq(previewSessions.completed, true))
        .then((r) => Number((r[0] as { c: number }).c ?? 0)),
    ]);
    return { userCount, attemptCount, errorCount, paperCount, moodCount, previewCount };
  }),

  /** 用户列表：每人一行的学习概览。 */
  users: adminQuery.query(async () => {
    const db = getDb();
    const allUsers = await db.select().from(users).orderBy(desc(users.createdAt));
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

  /** 单个用户详情：基础信息 + 最近动态（仅聚合，不看树洞内容，保护隐私）。 */
  userDetail: adminQuery
    .input((v: unknown) => v as { userId: number })
    .query(async ({ input }) => {
      const db = getDb();
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
