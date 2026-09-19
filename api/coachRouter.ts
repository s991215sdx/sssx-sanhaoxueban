import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, tutorQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { studentProfile, users } from "@db/schema";
import { hashPassword } from "./auth-router";
import { ACADEMIC_SUBJECTS, type AcademicsData } from "@contracts/academics";
import { sanitizeModules } from "@contracts/studentModules";
import { getStudentDetail, listStudents } from "./studentDetail";

/** 伴学师工作台：只能看到分配给自己的学员（管理员可看全部）。 */
export const coachRouter = createRouter({
  /** 我名下的学员列表。 */
  myStudents: tutorQuery.query(async ({ ctx }) => {
    const all = await listStudents(getDb());
    if (ctx.user.role === "admin") return all;
    return all.filter((s) => s.tutorId === ctx.user.id);
  }),

  /** 学员详情（伴学师仅可查自己名下学员）。 */
  studentDetail: tutorQuery
    .input((v: unknown) => v as { userId: number })
    .query(async ({ input, ctx }) => {
      const db = getDb();
      if (ctx.user.role !== "admin") {
        const p = (
          await db.select().from(studentProfile).where(eq(studentProfile.userId, input.userId)).limit(1)
        )[0];
        if (!p || p.tutorId !== ctx.user.id) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      }
      return getStudentDetail(db, input.userId);
    }),

  /** 伴学师代学员填写成绩与目标（校验规则与学生端 profileRouter.saveAcademics 一致）。 */
  saveAcademics: tutorQuery
    .input(
      z.object({
        userId: z.number().int(),
        examName: z.string().max(64).default(""),
        subjects: z
          .array(
            z.object({
              name: z.enum(ACADEMIC_SUBJECTS),
              selfLevel: z.number().int().min(1).max(5).nullable(),
              fullScore: z.number().min(1).max(1500).nullable(),
              lastScore: z.number().min(0).max(1500).nullable(),
              targetScore: z.number().min(0).max(1500).nullable(),
            }),
          )
          .min(1),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = (
        await db.select().from(studentProfile).where(eq(studentProfile.userId, input.userId)).limit(1)
      )[0];
      if (ctx.user.role !== "admin") {
        if (!existing || existing.tutorId !== ctx.user.id) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      }
      const data: AcademicsData = { examName: input.examName, subjects: input.subjects, updatedAt: Date.now() };
      const value = data as unknown as Record<string, unknown>;
      if (existing) {
        await db.update(studentProfile).set({ academics: value }).where(eq(studentProfile.id, existing.id));
      } else {
        // 目标学员尚无档案记录时也允许创建（仅 admin 会走到这里）
        await db.insert(studentProfile).values({ userId: input.userId, academics: value });
      }
      return { ok: true as const };
    }),

  /** 开启/关闭学员端功能模块（测评中心恒可用；传空数组=恢复全功能）。伴学师只能管自己名下的学员。 */
  /** V53：伴学师/管理员帮学员重置登录密码（重置后为默认密码 123456，学员登录后应自行修改）。伴学师只能重置自己名下的学员。 */
  resetStudentPassword: tutorQuery
    .input((v: unknown) => v as { userId: number })
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const target = (
        await db.select().from(studentProfile).where(eq(studentProfile.userId, input.userId)).limit(1)
      )[0];
      if (ctx.user.role !== "admin") {
        if (!target || target.tutorId !== ctx.user.id) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      }
      const userRow = (await db.select({ id: users.id }).from(users).where(eq(users.id, input.userId)).limit(1))[0];
      if (!userRow) throw new Error("学员账号不存在");
      await db.update(users).set({ passwordHash: hashPassword("123456") }).where(eq(users.id, input.userId));
      return { ok: true as const, password: "123456" };
    }),

  /** V54：推送/收回学员报告。released=true 家长可直接查看全部报告；false 由伴学师把关（默认）。伴学师只能操作名下学员。 */
  setReportAccess: tutorQuery
    .input((v: unknown) => v as { userId: number; released: boolean })
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = (
        await db.select().from(studentProfile).where(eq(studentProfile.userId, input.userId)).limit(1)
      )[0];
      if (ctx.user.role !== "admin") {
        if (!existing || existing.tutorId !== ctx.user.id) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      }
      if (existing) {
        await db.update(studentProfile).set({ reportReleased: !!input.released }).where(eq(studentProfile.id, existing.id));
      } else {
        await db.insert(studentProfile).values({ userId: input.userId, reportReleased: !!input.released });
      }
      return { ok: true as const, released: !!input.released };
    }),

  setStudentModules: tutorQuery
    .input((v: unknown) => v as { userId: number; modules: string[] })
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = (
        await db.select().from(studentProfile).where(eq(studentProfile.userId, input.userId)).limit(1)
      )[0];
      if (ctx.user.role !== "admin") {
        if (!existing || existing.tutorId !== ctx.user.id) {
          throw new Error("这位同学不在你的伴学名单里");
        }
      }
      const modules = sanitizeModules(input.modules);
      /* 只存「被关掉的之外、明确开启的」模块；传空数组表示恢复全功能（存 null） */
      const value = modules.length === 0 ? null : modules;
      if (existing) {
        await db.update(studentProfile).set({ enabledModules: value }).where(eq(studentProfile.id, existing.id));
      } else {
        await db.insert(studentProfile).values({ userId: input.userId, enabledModules: value });
      }
      return { ok: true as const, modules: value };
    }),
});
