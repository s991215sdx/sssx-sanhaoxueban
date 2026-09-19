import { z } from "zod";
import { eq } from "drizzle-orm";
import { createRouter, tutorQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { studentProfile } from "@db/schema";
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
