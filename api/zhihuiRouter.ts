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
import { sameOrg } from "./tenant";
import { assessmentResults, studentExpectations, studentProfile, users } from "../db/schema";
import { gdScores, majorLib, universityLib, careerLib } from "../db/schema";
import { inviteChannels, inviteRegistrations, organizations } from "../db/schema";
import { like, or, asc, sql } from "drizzle-orm";

/** 查看/代编他人数据须为伴学师或管理员；v179：且目标学员须在本机构内
 *  （平台超管 orgId=null 放行；机构管理员/伴学师跨机构一律拒绝）。 */
async function assertStaffIfOther(
  ctx: { user: { id: number; role: string; orgId: number | null } },
  studentId: number | undefined,
) {
  if (studentId != null && studentId !== ctx.user.id) {
    if (ctx.user.role !== "tutor" && ctx.user.role !== "admin") {
      throw new TRPCError({ code: "FORBIDDEN", message: "无权查看其他学员的数据" });
    }
    const db = getDb();
    if (!(await sameOrg(db, ctx.user, studentId))) {
      throw new TRPCError({ code: "FORBIDDEN", message: "该学员不在你的机构内" });
    }
  }
}

export const zhihuiRouter = createRouter({
  /** 未来期望：学员本人 / 伴学师 / 管理员可读。 */
  expectationsGet: authedQuery
    .input(z.object({ studentId: z.number().int().optional() }))
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await assertStaffIfOther(ctx, input.studentId);
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
      await assertStaffIfOther(ctx, input.studentId);
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
    .input(
      z.object({
        studentId: z.number().int().optional(),
        /* v217：首选科目（物理/历史）。文科首选时专业推荐过滤要求物理+化学的理工农医硬核门类 */
        firstTrack: z.enum(["物理", "历史"]).optional(),
      }),
    )
    .query(async ({ ctx, input }) => {
      const db = getDb();
      await assertStaffIfOther(ctx, input.studentId);
      const sid = input.studentId ?? ctx.user.id;

      const [user] = await db.select({ name: users.name, phone: users.phone }).from(users).where(eq(users.id, sid)).limit(1);
      const profile = await db.query.studentProfile.findFirst({ where: eq(studentProfile.userId, sid) });

      /* v206：学生归属的校园渠道信息（报告封面「学校/班级/校徽」用，伴学师内嵌查看同样生效；非校园渠道学生不受影响） */
      const reg = (
        await db
          .select({ channelId: inviteRegistrations.channelId })
          .from(inviteRegistrations)
          .where(eq(inviteRegistrations.userId, sid))
          .orderBy(desc(inviteRegistrations.id))
          .limit(1)
      )[0];
      let stuCampus = false;
      let schoolName: string | null = null;
      let schoolBrand: string | null = null;
      let schoolLogo: string | null = null;
      if (reg) {
        const ch = (
          await db
            .select({ campus: inviteChannels.campus, orgName: organizations.name, brandName: organizations.brandName, logo: organizations.logoUrl })
            .from(inviteChannels)
            .leftJoin(organizations, eq(organizations.id, inviteChannels.orgId))
            .where(eq(inviteChannels.id, reg.channelId))
            .limit(1)
        )[0];
        if (ch?.campus) {
          stuCampus = true;
          schoolName = ch.orgName ?? null;
          schoolBrand = ch.brandName || ch.orgName || null;
          schoolLogo = ch.logo ?? null;
        }
      }

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

      // 最近一次多元智能五项（v178：生涯报告参考图数据源）
      const [m5] = await db
        .select()
        .from(assessmentResults)
        .where(and(eq(assessmentResults.userId, sid), eq(assessmentResults.kind, "multi5")))
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
        // 期望专业类 → 该类专业名关键词，直接并入 SQL 条件（先筛后取，避免截断漏行）
        const conds = [like(gdScores.school, `%${kw}%`)];
        let majorKws: string[] = [];
        if (exp?.majorCat) {
          const mkw = exp.majorCat.replace(/类$/, "");
          const majorsInCat = await db
            .select({ name: majorLib.name })
            .from(majorLib)
            .where(like(majorLib.cat, `%${mkw}%`))
            .limit(15);
          majorKws = [...new Set(majorsInCat.map((m) => m.name).filter((n) => n.length >= 2))];
          if (majorKws.length) {
            conds.push(
              or(
                ...majorKws.map((k) =>
                  or(like(gdScores.majorFull, `%${k}%`), like(gdScores.major, `%${k}%`)),
                ),
              )!,
            );
          }
        }
        gdResults = await db
          .select()
          .from(gdScores)
          .where(and(...conds))
          .orderBy(asc(sql`CASE WHEN ${gdScores.y1Min} IS NULL THEN 1 ELSE 0 END`), asc(gdScores.y1Min))
          .limit(60);
        // 双学位等交叉专业（如「金融学+计算机」）不算该类专业，按精确专业名再过滤一次
        if (majorKws.length && gdResults.length) {
          const matched = gdResults.filter((r) => {
            const t = `${r.majorFull ?? ""}${r.major ?? ""}`;
            return majorKws.some((k) => t.includes(k));
          });
          if (matched.length >= 2) gdResults = matched;
        }
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

      // 推荐专业类 Top5（v217 修复：文科生被拼音序工科刷屏的系统性错误）
      const catRows = await db
        .selectDistinct({ cat: majorLib.cat, menlei: majorLib.menlei })
        .from(majorLib);
      /* 学科四维 → 门类匹配度（潜力指数 0–5 归一到 0–1，取映射学科里的最高值）。
         注意与前端 SUBJECT_MENLEI 保持一致。 */
      const SUBJECT_MENLEI_MAP: Record<string, string[]> = {
        语文: ["文学", "教育学"],
        数学: ["理学", "工学"],
        英语: ["文学", "经济学", "管理学"],
        物理: ["工学", "理学"],
        化学: ["理学", "医学", "工学"],
        生物: ["医学", "农学", "理学"],
        历史: ["历史学", "哲学", "文学"],
        政治: ["法学", "教育学"],
        地理: ["理学", "工学"],
      };
      const s4Subjects = (s4d?.result as { subjects?: Record<string, { 潜力指数?: number }> } | null)?.subjects ?? {};
      const menleiFit: Record<string, number> = {};
      for (const [subj, menleis] of Object.entries(SUBJECT_MENLEI_MAP)) {
        const p = s4Subjects[subj]?.潜力指数;
        if (typeof p !== "number") continue;
        const f = Math.max(0, Math.min(1, p / 5));
        for (const m of menleis) menleiFit[m] = Math.max(menleiFit[m] ?? 0, f);
      }
      /* 首选历史：硬核理工农医在新高考下多要求物理+化学，历史生报不了——剔除；理学降权保留。
         前端未传 firstTrack 时（首屏），按学科四维物理/历史潜力兜底判定 */
      const histPot = s4Subjects["历史"]?.潜力指数 ?? 3;
      const physPot = s4Subjects["物理"]?.潜力指数 ?? 3;
      const histFirst = input.firstTrack ? input.firstTrack === "历史" : histPot > physPot;
      const HIST_HARD_EXCLUDE = new Set(["工学", "医学", "农学"]);
      const fitOf = (menlei: string) => menleiFit[menlei] ?? 0;
      const catRanked = catRows
        .map((c) => {
          const base = menleiW[c.menlei] ?? 0;
          /* 霍兰德门类权重 × 学科四维匹配度（0.6–1.4 调节带）；权重为 0 的门类不进推荐 */
          let w = base > 0 ? base * (0.6 + 0.8 * fitOf(c.menlei)) : 0;
          if (histFirst) {
            if (HIST_HARD_EXCLUDE.has(c.menlei)) w = 0;
            else if (c.menlei === "理学") w *= 0.35;
          }
          return { ...c, w, fit: fitOf(c.menlei) };
        })
        .filter((c) => c.w > 0)
        .sort((a, b) => b.w - a.w || b.fit - a.fit || a.cat.localeCompare(b.cat, "zh"));
      let pickedCats = catRanked.slice(0, 5);
      /* 兜底：霍兰德未做或全部被过滤时，按学科四维匹配度补位，保证有推荐 */
      if (pickedCats.length === 0) {
        pickedCats = catRows
          .map((c) => ({ ...c, w: 0, fit: fitOf(c.menlei) }))
          .filter((c) => c.fit > 0 && !(histFirst && HIST_HARD_EXCLUDE.has(c.menlei)))
          .sort((a, b) => b.fit - a.fit || a.cat.localeCompare(b.cat, "zh"))
          .slice(0, 5);
      }
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

      // 推荐职业 Top5（v218：同步专业推荐口径——学科四维加权 + 首选历史过滤硬核工科职业）
      const CAREER_MENLEI: Record<string, string[]> = {
        智能制造: ["工学"], 工程技术: ["工学"], 建筑工程: ["工学"],
        信息技术: ["工学", "理学"], 能源环保: ["工学", "理学", "农学"],
        交通物流: ["工学", "管理学"], 农林牧渔: ["农学"],
        教育科研: ["教育学", "理学"], 医疗健康: ["医学"],
        文化传媒: ["文学", "艺术学"], 现代服务: ["管理学"],
        金融财会: ["经济学", "管理学"], 法律政务: ["法学"],
      };
      /* 首选历史：硬工科/农林职业直接不报（读不了对应专业）；医/信息/能源/交通降权 */
      const CAREER_HARD = new Set(["智能制造", "工程技术", "建筑工程", "农林牧渔"]);
      const CAREER_DEMOTE = new Set(["信息技术", "能源环保", "交通物流", "医疗健康"]);
      const careerFit = (top: string) => {
        const mapped = CAREER_MENLEI[top] ?? [];
        return mapped.length ? Math.max(...mapped.map((m) => menleiFit[m] ?? 0)) : 0.5;
      };
      const careerScored = careers.map((c) => {
        const top = c.category.split("·")[0]?.trim() ?? "";
        let w = (careerW[top] ?? 0) * (0.6 + 0.8 * careerFit(top));
        if (histFirst) {
          if (CAREER_HARD.has(top)) w = 0;
          else if (CAREER_DEMOTE.has(top)) w *= 0.35;
        }
        return { ...c, w };
      });
      let careerPicks = careerScored
        .filter((c) => c.w > 0)
        .sort((a, b) => b.w - a.w || a.id - b.id)
        .slice(0, 5);
      /* 兜底：霍兰德权重全被过滤时，按学科四维匹配度补位 */
      if (careerPicks.length === 0) {
        careerPicks = careerScored
          .map((c) => ({ ...c, w: careerFit(c.category.split("·")[0]?.trim() ?? "") }))
          .filter((c) => c.w > 0)
          .sort((a, b) => b.w - a.w || a.id - b.id)
          .slice(0, 5);
      }

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

      // 12 门类图：每门类下设专业类清单（门类卡展开用）
      const menleiCatsMap = new Map<string, string[]>();
      for (const c of catRows) {
        const arr = menleiCatsMap.get(c.menlei) ?? [];
        arr.push(c.cat);
        menleiCatsMap.set(c.menlei, arr);
      }
      const menleiCats = [...menleiCatsMap.entries()]
        .map(([menlei, cats]) => ({ menlei, cats: cats.sort((a, b) => a.localeCompare(b, "zh")) }))
        .sort((a, b) => a.menlei.localeCompare(b.menlei, "zh"));

      return {
        student: { id: sid, name: profile?.name || user?.name || "", grade: (profile?.grade as string | null) ?? null, className: profile?.className ?? null, campus: stuCampus, schoolName, schoolBrand, schoolLogo },
        subject4d: s4d ? { result: s4d.result, answers: s4d.answers, createdAt: s4d.createdAt } : null,
        holland: hol ? { result: hol.result, createdAt: hol.createdAt } : null,
        multi5: m5 ? { result: m5.result, createdAt: m5.createdAt } : null,
        academics,
        expectations: exp ?? null,
        targetSchool,
        targetMajor,
        targetUniversity,
        majorCats,
        careerPicks,
        menleiW,
        menleiCats,
      };
    }),
});
