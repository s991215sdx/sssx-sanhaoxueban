/**
 * V175 智慧生涯：未来期望读写 + 智慧生涯规划报告数据组装。
 * 报告页（客户端测评报告区「智慧生涯规划报告」卡片）调用 reportData：
 * 汇总学科四维测评、霍兰德、成绩档案、未来期望，并从资料库取目标院校/专业数据。
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { assessmentResults, studentExpectations, studentProfile, users } from "../db/schema";
import { gdScores, majorLib, universityLib, careerLib } from "../db/schema";
import { like, or, asc, sql } from "drizzle-orm";

/** 查看/代编他人数据须为伴学师或管理员。 */
function assertStaffIfOther(ctx: { user: { id: number; role: string } }, studentId: number | undefined) {
  if (studentId != null && studentId !== ctx.user.id) {
    if (ctx.user.role !== "tutor" && ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "无权查看其他学员的数据" });
    }
  }
}

export const zhihuiRouter = createRouter({
  /** 未来期望：学员本人 / 伴学师 / 管理员可读。 */
  expectationsGet: authedQuery
    .input(z.object({ studentId: z.number().int().optional() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      assertStaffIfOther(ctx, input.studentId);
      const sid = input.studentId ?? ctx.user.id;
      const [row] = await db
        .select()
        .from(studentExpectations)
        .where(eq(studentExpectations.studentId, sid))
        .limit(1);
      return row ?? null;
    }),

  /** 未来期望保存：学员本人保存 source=student；伴学师/管理员代编 source=tutor。 */
  expectationsSet: authedQuery
    .input(
      z.object({
        studentId: z.number().int().optional(),
        school: z.string().max(128).default(""),
        majorCat: z.string().max(64).default(""),
        careers: z.string().max(255).default(""),
        note: z.string().max(500).default(""),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      assertStaffIfOther(ctx, input.studentId);
      const sid = input.studentId ?? ctx.user.id;
      const isStaff = ctx.user.role === "tutor" || ctx.user.role === "admin";
      const source = isStaff ? "tutor" : "student";
      const [existing] = await db
        .select({ id: studentExpectations.id })
        .from(studentExpectations)
        .where(eq(studentExpectations.studentId, sid))
        .limit(1);
      if (existing) {
        await db
          .update(studentExpectations)
          .set({
            school: input.school,
            majorCat: input.majorCat,
            careers: input.careers,
            note: input.note,
            source,
            updatedBy: ctx.user.id,
          })
          .where(eq(studentExpectations.id, existing.id));
      } else {
        await db.insert(studentExpectations).values({
          studentId: sid,
          school: input.school,
          majorCat: input.majorCat,
          careers: input.careers,
          note: input.note,
          source,
          updatedBy: ctx.user.id,
        });
      }
      const [row] = await db.select().from(studentExpectations).where(eq(studentExpectations.studentId, sid)).limit(1);
      return row ?? null;
    }),

  /** 智慧生涯规划报告数据：学员本人 / 伴学师 / 管理员。 */
  reportData: authedQuery
    .input(z.object({ studentId: z.number().int().optional() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      assertStaffIfOther(ctx, input.studentId);
      const sid = input.studentId ?? ctx.user.id;

      const [user] = await db.select({ name: users.name, phone: users.phone }).from(users).where(eq(users.id, sid)).limit(1);
      const profile = await db.query.studentProfile.findFirst({ where: eq(studentProfile.userId, sid) });

      // 最近一次学科四维测评
      const [s4d] = await db
        .select()
        .from(assessmentResults)
        .where(and(eq(assessmentResults.userId, sid), eq(assessmentResults.kind, "subject4d")))
        .orderBy(desc(assessmentResults.createdAt), desc(assessmentResults.id))
        .limit(1);

      // 最近一次霍兰德
      const [hol] = await db
        .select()
        .from(assessmentResults)
        .where(and(eq(assessmentResults.userId, sid), eq(assessmentResults.kind, "holland")))
        .orderBy(desc(assessmentResults.createdAt), desc(assessmentResults.id))
        .limit(1);

      // 未来期望
      const [exp] = await db.select().from(studentExpectations).where(eq(studentExpectations.studentId, sid)).limit(1);

      // 成绩档案（contracts/academics 结构：subjects: [{name,lastScore,targetScore,...}]）
      const academics = (profile?.academics ?? null) as { subjects?: { name?: string; lastScore?: number | null; targetScore?: number | null }[] } | null;

      // 目标院校近三年数据（期望院校匹配）
      let gdResults: (typeof gdScores.$inferSelect)[] = [];
      let targetSchool: { school: string; rows: (typeof gdScores.$inferSelect)[] } | null = null;
      if (exp?.school) {
        const kw = exp.school.replace(/[（(].*$/, "").slice(0, 12);
        gdResults = await db
          .select()
          .from(gdScores)
          .where(like(gdScores.school, `%${kw}%`))
          .orderBy(asc(sql`CASE WHEN ${gdScores.y1Min} IS NULL THEN 1 ELSE 0 END`), asc(gdScores.y1Min))
          .limit(60);
        if (gdResults.length) {
          targetSchool = { school: gdResults[0]!.school, rows: gdResults };
        }
      }

      // 期望专业类（如「计算机类」）的专业库数据
      let targetMajor: (typeof majorLib.$inferSelect) | null = null;
      if (exp?.majorCat) {
        const kw = exp.majorCat.replace(/类$/, "");
        const majors = await db
          .select()
          .from(majorLib)
          .where(like(majorLib.cat, `%${kw}%`))
          .orderBy(asc(majorLib.code))
          .limit(1);
        targetMajor = majors[0] ?? null;
      }

      // 推荐职业（按职业库前 6，霍兰德映射留待下版细化）
      const careers = await db.select().from(careerLib).orderBy(asc(careerLib.id)).limit(200);

      /* 霍兰德 → 门类/职业大类权重（报告推荐引擎 v1） */
      const HOLLAND_MENLEI_W: Record<string, Record<string, number>> = {
        R: { 工学: 3, 理学: 2, 农学: 1 },
        I: { 理学: 3, 工学: 2, 医学: 1 },
        A: { 艺术学: 3, 文学: 2, 教育学: 1 },
        S: { 教育学: 3, 医学: 2, 法学: 1, 文学: 1 },
        E: { 管理学: 3, 经济学: 2, 法学: 1 },
        C: { 经济学: 3, 管理学: 2, 法学: 1 },
      };
      const HOLLAND_CAREER_W: Record<string, Record<string, number>> = {
        R: { 智能制造: 3, 工程技术: 3, 建筑工程: 2, 能源环保: 2, 交通物流: 1, 农林牧渔: 1 },
        I: { 信息技术: 3, 教育科研: 2, 医疗健康: 2, 能源环保: 1, 工程技术: 1 },
        A: { 文化传媒: 3, 现代服务: 1 },
        S: { 教育科研: 3, 医疗健康: 3, 现代服务: 1, 文化传媒: 1 },
        E: { 现代服务: 3, 金融财会: 2, 法律政务: 1 },
        C: { 金融财会: 3, 法律政务: 2, 交通物流: 1 },
      };
      const holResult = hol?.result as { top3?: string[] } | null;
      const top3 = holResult?.top3 ?? [];
      const menleiW: Record<string, number> = {};
      const careerW: Record<string, number> = {};
      for (const h of top3) {
        for (const [m, w] of Object.entries(HOLLAND_MENLEI_W[h] ?? {})) menleiW[m] = (menleiW[m] ?? 0) + w;
        for (const [c, w] of Object.entries(HOLLAND_CAREER_W[h] ?? {})) careerW[c] = (careerW[c] ?? 0) + w;
      }

      // 推荐专业类 Top5：按门类权重取该门类下代表专业（含课程/就业等字段）
      const catRows = await db
        .selectDistinct({ cat: majorLib.cat, menlei: majorLib.menlei })
        .from(majorLib);
      const catRanked = catRows
        .map((c) => ({ ...c, w: menleiW[c.menlei] ?? 0 }))
        .sort((a, b) => b.w - a.w || a.cat.localeCompare(b.cat, "zh"));
      const pickedCats = catRanked.slice(0, 5);
      const majorCats = [];
      for (const c of pickedCats) {
        const reps = await db
          .select()
          .from(majorLib)
          .where(and(eq(majorLib.cat, c.cat), eq(majorLib.menlei, c.menlei)))
          .orderBy(asc(majorLib.code))
          .limit(8);
        // 代表专业优先取介绍完整的行（intro/courses/jobs 非空），报告内容更充实
        const rep =
          reps.find((r) => r.intro && r.courses && r.jobs) ?? reps.find((r) => r.intro) ?? reps[0];
        if (rep) majorCats.push(rep);
      }

      // 期望专业类优先：与「未来期望」一致的专业排在推荐首位（学员认知闭环）
      if (targetMajor && !majorCats.some((m) => m.cat === targetMajor.cat)) {
        majorCats.unshift(targetMajor);
        majorCats.pop();
      }

      // 推荐职业 Top5
      const careerPicks = careers
        .map((c) => {
          const top = c.category.split("·")[0]?.trim() ?? "";
          return { ...c, w: careerW[top] ?? 0 };
        })
        .sort((a, b) => b.w - a.w || a.id - b.id)
        .filter((c) => c.w > 0)
        .slice(0, 5);

      // 院校库目标校详情（掌上高考链接）
      let targetUniversity: (typeof universityLib.$inferSelect) | null = null;
      if (exp?.school) {
        const kw = exp.school.replace(/[（(].*$/, "").slice(0, 12);
        const us = await db
          .select()
          .from(universityLib)
          .where(or(like(universityLib.name, `%${kw}%`), like(universityLib.alias, `%${kw}%`)))
          .limit(1);
        targetUniversity = us[0] ?? null;
      }

      return {
        student: { id: sid, name: user?.name ?? "", grade: (profile?.grade as string | null) ?? null },
        subject4d: s4d ? { result: s4d.result, answers: s4d.answers, createdAt: s4d.createdAt } : null,
        holland: hol ? { result: hol.result, createdAt: hol.createdAt } : null,
        academics,
        expectations: exp ?? null,
        targetSchool,
        targetMajor,
        targetUniversity,
        majorCats,
        careerPicks,
      };
    }),
});
