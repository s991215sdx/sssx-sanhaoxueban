import { and, asc, count, eq, like, or, sql } from "drizzle-orm";
import { z } from "zod";
import { createRouter, tutorQuery, adminQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  majorLib,
  careerLib,
  gdScores,
  gradePlans,
  studentAspirations,
  universityLib,
} from "@db/schema";

/** 智慧生涯规划 · 数据底座三库：伴学师/管理员查询 + 管理员导入维护。 */

const pageInput = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(200).default(20),
});

/* ---------------------------------- 专业库 ---------------------------------- */

export const libraryRouter = createRouter({
  /** 专业库分页查询：门类/专业类/关键词过滤。 */
  majors: tutorQuery
    .input(
      pageInput.extend({
        menlei: z.string().optional(),
        cat: z.string().optional(),
        keyword: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conds = [];
      if (input.menlei) conds.push(eq(majorLib.menlei, input.menlei));
      if (input.cat) conds.push(eq(majorLib.cat, input.cat));
      if (input.keyword) {
        const kw = `%${input.keyword}%`;
        conds.push(or(like(majorLib.name, kw), like(majorLib.code, kw), like(majorLib.oneLiner, kw)));
      }
      const where = conds.length ? and(...conds) : undefined;
      const [{ total }] = await db.select({ total: count() }).from(majorLib).where(where);
      const rows = await db
        .select()
        .from(majorLib)
        .where(where)
        .orderBy(asc(majorLib.code))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      return { rows, total };
    }),

  /** 专业库门类/专业类导航（去重列表）。 */
  majorNav: tutorQuery.query(async () => {
    const db = getDb();
    const cats = await db
      .select({ menlei: majorLib.menlei, cat: majorLib.cat })
      .from(majorLib)
      .groupBy(majorLib.menlei, majorLib.cat)
      .orderBy(asc(majorLib.menlei), asc(majorLib.cat));
    const menleis = await db
      .select({ menlei: majorLib.menlei, n: count() })
      .from(majorLib)
      .groupBy(majorLib.menlei)
      .orderBy(asc(majorLib.menlei));
    return {
      menleis: menleis.filter((r) => r.menlei).map((r) => ({ menlei: r.menlei, n: r.n })),
      cats: cats.filter((r) => r.menlei && r.cat),
    };
  }),

  /** 某门类下全部专业按专业类分组（查专业左侧导航展开用，无分页）。 */
  majorsByMenlei: tutorQuery
    .input(z.object({ menlei: z.string().min(1) }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db
        .select({
          id: majorLib.id,
          code: majorLib.code,
          name: majorLib.name,
          cat: majorLib.cat,
          oneLiner: majorLib.oneLiner,
        })
        .from(majorLib)
        .where(eq(majorLib.menlei, input.menlei))
        .orderBy(asc(majorLib.catCode), asc(majorLib.code));
      const cats = new Map<string, { cat: string; majors: { id: number; code: string; name: string; oneLiner: string | null }[] }>();
      for (const r of rows) {
        if (!cats.has(r.cat)) cats.set(r.cat, { cat: r.cat, majors: [] });
        cats.get(r.cat)!.majors.push({ id: r.id, code: r.code, name: r.name, oneLiner: r.oneLiner });
      }
      return { menlei: input.menlei, total: rows.length, cats: [...cats.values()] };
    }),

  /** 专业详情（按 id，查专业点开专业卡片用）。 */
  major: tutorQuery.input(z.object({ id: z.number().int() })).query(async ({ input }) => {
    const db = getDb();
    const row = await db.query.majorLib.findFirst({ where: eq(majorLib.id, input.id) });
    if (!row) throw new Error("专业不存在");
    return row;
  }),

  /** 专业库分块导入（后台上传 JSON，每块 ≤2000 行，按 code upsert）。 */
  majorsImport: adminQuery
    .input(z.object({ rows: z.array(z.record(z.string(), z.unknown())).max(2000) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      let n = 0;
      for (const r of input.rows) {
        const str = (v: unknown) => (v == null ? "" : String(v));
        const vals = {
          menleiCode: str(r.menlei_code),
          menlei: str(r.menlei),
          catCode: str(r.cat_code),
          cat: str(r.cat),
          code: str(r.code),
          name: str(r.name),
          level: str(r.level) || "本科",
          addedYear: str(r.added_year),
          oneLiner: str(r.one_liner) || null,
          jobs: str(r.jobs) || null,
          intro: str(r.intro) || null,
          goal: str(r.goal) || null,
          require: str(r.require) || null,
          knowledge: str(r.knowledge) || null,
          kaoyan: str(r.kaoyan) || null,
          courses: str(r.courses) || null,
          famous: str(r.famous) || null,
          employment: str(r.employment) || null,
          malePct: str(r.male_pct) || null,
          femalePct: str(r.female_pct) || null,
          degree: str(r.degree) || null,
          regions: str(r.regions) || null,
          industries: str(r.industries) || null,
          occupations: str(r.occupations) || null,
          salary: str(r.salary) || null,
          schools: str(r.schools) || null,
          internship: str(r.internship) || null,
          certs: str(r.certs) || null,
        };
        if (!vals.code || !vals.name) continue;
        await db
          .insert(majorLib)
          .values(vals)
          .onDuplicateKeyUpdate({
            set: { ...vals, code: sql`${majorLib.code}` },
          });
        n++;
      }
      return { imported: n };
    }),

  /* ---------------------------------- 职业库 ---------------------------------- */

  /** 职业库分页查询。 */
  careers: tutorQuery
    .input(pageInput.extend({ keyword: z.string().optional(), category: z.string().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const conds = [];
      if (input.keyword) {
        conds.push(or(like(careerLib.name, `%${input.keyword}%`), like(careerLib.category, `%${input.keyword}%`)));
      }
      if (input.category) {
        // 前缀匹配「大类」或「大类 · 细分」，配合前端一级分类 chips
        conds.push(like(careerLib.category, `${input.category}%`));
      }
      const where = conds.length ? and(...conds) : undefined;
      const [{ total }] = await db.select({ total: count() }).from(careerLib).where(where);
      const rows = await db
        .select()
        .from(careerLib)
        .where(where)
        .orderBy(asc(careerLib.id))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      return { rows, total };
    }),

  /** 职业库单条新增/更新（后台编辑）。 */
  careersUpsert: adminQuery
    .input(
      z.object({
        id: z.number().int().optional(),
        name: z.string().min(1),
        category: z.string().default(""),
        duties: z.array(z.string()).optional(),
        content: z.string().optional(),
        skillsPro: z.array(z.string()).optional(),
        skillsGen: z.array(z.string()).optional(),
        prospect: z.string().optional(),
        path: z.string().optional(),
        trend: z.string().optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const vals = {
        name: input.name,
        category: input.category,
        duties: input.duties ?? [],
        content: input.content ?? null,
        skillsPro: input.skillsPro ?? [],
        skillsGen: input.skillsGen ?? [],
        prospect: input.prospect ?? null,
        path: input.path ?? null,
        trend: input.trend ?? null,
      };
      if (input.id) {
        await db.update(careerLib).set(vals).where(eq(careerLib.id, input.id));
        return { id: input.id };
      }
      const [{ id }] = await db.insert(careerLib).values(vals).$returningId();
      return { id };
    }),

  /* -------------------------------- 院校专业分数库 -------------------------------- */

  /** 广东院校专业分数分页查询。 */
  gdScores: tutorQuery
    .input(
      pageInput.extend({
        school: z.string().optional(),
        major: z.string().optional(),
        menlei: z.string().optional(),
        minRank: z.number().int().optional(),
        maxRank: z.number().int().optional(),
        /** 排序：2026预估位次(默认) / 2025最低分 / 2025最低位次 / 2024最低分 / 2023最低分，均从低到高 */
        sort: z.enum(["est26", "y1Min", "y1Rank", "y2Min", "y3Min"]).default("est26"),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conds = [];
      if (input.school) conds.push(like(gdScores.school, `%${input.school}%`));
      if (input.major) conds.push(like(gdScores.major, `%${input.major}%`));
      if (input.menlei) conds.push(eq(gdScores.menlei, input.menlei));
      if (input.minRank != null) conds.push(sql`${gdScores.estRank26} >= ${input.minRank}`);
      if (input.maxRank != null) conds.push(sql`${gdScores.estRank26} <= ${input.maxRank}`);
      const where = conds.length ? and(...conds) : undefined;
      const sortCol =
        input.sort === "y1Min" ? gdScores.y1Min
        : input.sort === "y1Rank" ? gdScores.y1Rank
        : input.sort === "y2Min" ? gdScores.y2Min
        : input.sort === "y3Min" ? gdScores.y3Min
        : gdScores.estRank26;
      const [{ total }] = await db.select({ total: count() }).from(gdScores).where(where);
      const rows = await db
        .select()
        .from(gdScores)
        .where(where)
        .orderBy(
          sql`CASE WHEN ${sortCol} IS NULL THEN 1 ELSE 0 END`,
          asc(sortCol),
          asc(gdScores.school),
          asc(gdScores.majorCode),
        )
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      return { rows, total };
    }),

  /** 分数库分块导入（首次导入可 clear 清空；按院校+专业代码+年份 upsert 前先删旧）。 */
  gdScoresImport: adminQuery
    .input(
      z.object({
        clear: z.boolean().default(false),
        rows: z.array(z.record(z.string(), z.unknown())).max(2000),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      if (input.clear) await db.delete(gdScores);
      let n = 0;
      for (const r of input.rows) {
        const str = (v: unknown) => (v == null ? "" : String(v));
        const num = (v: unknown) => {
          const x = Number(v);
          return Number.isFinite(x) && v !== "" && v != null ? Math.trunc(x) : null;
        };
        const vals = {
          year: num(r.year) ?? 2025,
          kelei: str(r.kelei),
          batch: str(r.batch),
          schoolCode: str(r.school_code),
          school: str(r.school),
          groupCode: str(r.group_code),
          groupName: str(r.group_name),
          majorCode: str(r.major_code),
          majorFull: str(r.major_full),
          major: str(r.major),
          req: str(r.req),
          plan: num(r.plan),
          years: str(r.years),
          fee: str(r.fee),
          menlei: str(r.menlei),
          cat: str(r.cat),
          gCount: num(r.g_count),
          gMin: num(r.g_min),
          gRank: num(r.g_rank),
          y1Count: num(r.y1_count),
          y1Min: num(r.y1_min),
          y1Rank: num(r.y1_rank),
          y1Batch: str(r.y1_batch),
          y1Plan: num(r.y1_plan),
          y2Count: num(r.y2_count),
          y2Min: num(r.y2_min),
          y2Rank: num(r.y2_rank),
          y2Batch: str(r.y2_batch),
          y2Plan: num(r.y2_plan),
          y3Count: num(r.y3_count),
          y3Min: num(r.y3_min),
          y3Rank: num(r.y3_rank),
          y3Max: num(r.y3_max),
          y3MaxRank: num(r.y3_max_rank),
          y3Batch: str(r.y3_batch),
          y3Plan: num(r.y3_plan),
          estRank26: num(r.est_rank26),
          city: str(r.city),
          tier: str(r.tier),
          tags: str(r.tags),
        };
        if (!vals.school || !vals.major) continue;
        await db.insert(gdScores).values(vals);
        n++;
      }
      return { imported: n };
    }),

  /* ------------------------------- 分年级规划模板 ------------------------------- */

  /** 分年级条件准备规划：按分数段/年级/路径查询（报告生成时底层调用）。 */
  gradePlans: tutorQuery
    .input(
      z.object({
        band: z.string().optional(),
        grade: z.string().optional(),
        path: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conds = [];
      if (input.band) conds.push(eq(gradePlans.band, input.band));
      if (input.grade) conds.push(eq(gradePlans.grade, input.grade));
      if (input.path) conds.push(eq(gradePlans.path, input.path));
      return db
        .select()
        .from(gradePlans)
        .where(conds.length ? and(...conds) : undefined)
        .orderBy(asc(gradePlans.sort), asc(gradePlans.id));
    }),

  gradePlansUpsert: adminQuery
    .input(
      z.object({
        id: z.number().int().optional(),
        band: z.string().default(""),
        grade: z.string().default(""),
        path: z.string().default(""),
        title: z.string().min(1),
        content: z.string().optional(),
        sort: z.number().int().default(0),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const vals = {
        band: input.band,
        grade: input.grade,
        path: input.path,
        title: input.title,
        content: input.content ?? null,
        sort: input.sort,
      };
      if (input.id) {
        await db.update(gradePlans).set(vals).where(eq(gradePlans.id, input.id));
        return { id: input.id };
      }
      const [{ id }] = await db.insert(gradePlans).values(vals).$returningId();
      return { id };
    }),

  gradePlansDelete: adminQuery.input(z.object({ id: z.number().int() })).mutation(async ({ input }) => {
    const db = getDb();
    await db.delete(gradePlans).where(eq(gradePlans.id, input.id));
    return { ok: true };
  }),

  /* -------------------------------- 学员未来期望 -------------------------------- */

  /** 读取某学员的未来期望（伴学师/管理员）。 */
  aspirationGet: tutorQuery.input(z.object({ userId: z.number().int() })).query(async ({ input }) => {
    const db = getDb();
    const row = await db.query.studentAspirations.findFirst({
      where: eq(studentAspirations.userId, input.userId),
    });
    return row ?? null;
  }),

  /** 伴学师/管理员代编学员未来期望；source 记 tutor。 */
  aspirationSet: tutorQuery
    .input(
      z.object({
        userId: z.number().int(),
        school: z.string().nullable().optional(),
        major: z.string().nullable().optional(),
        career: z.string().nullable().optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const existing = await db.query.studentAspirations.findFirst({
        where: eq(studentAspirations.userId, input.userId),
      });
      const vals = {
        school: input.school ?? null,
        major: input.major ?? null,
        career: input.career ?? null,
        source: "tutor" as const,
        updatedBy: ctx.user.id,
      };
      if (existing) {
        await db.update(studentAspirations).set(vals).where(eq(studentAspirations.id, existing.id));
        return { id: existing.id };
      }
      const [{ id }] = await db
        .insert(studentAspirations)
        .values({ userId: input.userId, ...vals })
        .$returningId();
      return { id };
    }),

  /* ---------------------------------- 院校库 ---------------------------------- */

  /** 院校库分页查询：省份/关键词/层次/性质/特色标签过滤（查大学，按省份归类）。 */
  universities: tutorQuery
    .input(
      pageInput.extend({
        province: z.string().optional(),
        keyword: z.string().optional(),
        level: z.string().optional(),
        nature: z.string().optional(),
        tag: z.string().optional(),
      }),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const conds = [];
      if (input.province) conds.push(eq(universityLib.province, input.province));
      if (input.level) conds.push(eq(universityLib.level, input.level));
      if (input.nature) conds.push(eq(universityLib.nature, input.nature));
      if (input.tag) conds.push(like(universityLib.tags, `%${input.tag}%`));
      if (input.keyword) {
        const kw = `%${input.keyword}%`;
        conds.push(
          or(
            like(universityLib.name, kw),
            like(universityLib.alias, kw),
            like(universityLib.formerNames, kw),
            like(universityLib.city, kw),
            like(universityLib.province, kw),
          ),
        );
      }
      const where = conds.length ? and(...conds) : undefined;
      const [{ total }] = await db.select({ total: count() }).from(universityLib).where(where);
      const rows = await db
        .select()
        .from(universityLib)
        .where(where)
        .orderBy(asc(universityLib.province), asc(universityLib.name))
        .limit(input.pageSize)
        .offset((input.page - 1) * input.pageSize);
      return { rows, total };
    }),

  /** 院校库省份导航（去重 + 各校数）。 */
  universityProvinces: tutorQuery.query(async () => {
    const db = getDb();
    const rows = await db
      .select({ province: universityLib.province, n: count() })
      .from(universityLib)
      .groupBy(universityLib.province)
      .orderBy(asc(universityLib.province));
    return rows.filter((r) => r.province);
  }),

  /** 院校库单条详情（详情弹窗）。 */
  university: tutorQuery.input(z.object({ id: z.number().int() })).query(async ({ input }) => {
    const db = getDb();
    const row = await db.query.universityLib.findFirst({ where: eq(universityLib.id, input.id) });
    if (!row) throw new Error("院校不存在");
    return row;
  }),

  /** 院校库分块导入（后台上传 JSON，每块 ≤300 行，按院校名 upsert）。 */
  universitiesImport: adminQuery
    .input(z.object({ clear: z.boolean().default(false), rows: z.array(z.record(z.string(), z.unknown())).max(300) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      if (input.clear) await db.delete(universityLib);
      const str = (v: unknown) => (v == null ? "" : String(v));
      let n = 0;
      for (const r of input.rows) {
        const vals = {
          zsId: str(r.zs_id),
          name: str(r.name),
          province: str(r.province),
          city: str(r.city),
          district: str(r.district),
          schoolType: str(r.school_type),
          level: str(r.level),
          nature: str(r.nature),
          tags: str(r.tags),
          pageTags: str(r.page_tags),
          foundYear: str(r.found_year),
          area: str(r.area),
          supervisor: str(r.supervisor),
          zsWebsite: str(r.zs_website),
          zsPhone: str(r.zs_phone),
          website: str(r.website),
          motto: str(r.motto),
          alias: str(r.alias),
          formerNames: str(r.former_names),
          intro: str(r.intro) || null,
          introShort: str(r.intro_short) || null,
          doctor: str(r.doctor),
          doctorDetail: str(r.doctor_detail) || null,
          master: str(r.master),
          masterDetail: str(r.master_detail) || null,
          keyDisciplines: str(r.key_disciplines),
          dfc: str(r.dfc) || null,
          departments: str(r.departments) || null,
          campus: str(r.campus) || null,
          canteen: str(r.canteen) || null,
          dorm: str(r.dorm) || null,
          scholarship: str(r.scholarship) || null,
          aid: str(r.aid) || null,
          malePct: str(r.male_pct),
          femalePct: str(r.female_pct),
          logoUrl: str(r.logo_url),
          campusPhotos: str(r.campus_photos) || null,
          dormPhotos: str(r.dorm_photos) || null,
          history: str(r.history) || null,
          ranking: str(r.ranking),
          subjectEval: str(r.subject_eval),
          academicians: str(r.academicians),
          libraryBooks: str(r.library_books),
          labs: str(r.labs),
          baoyan: str(r.baoyan),
          videoUrl: str(r.video_url),
          address: str(r.address),
          zsCode: str(r.zs_code),
          detailUrl: str(r.detail_url),
        };
        if (!vals.name) continue;
        await db
          .insert(universityLib)
          .values(vals)
          .onDuplicateKeyUpdate({ set: { ...vals, name: sql`${universityLib.name}` } });
        n++;
      }
      return { imported: n };
    }),
});
