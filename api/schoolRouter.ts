/**
 * v220 学校版专版（粤华打样）——选科意向三轮 + 预警中心 + 一生一策成长档案
 * + 团体分析报告 + 未参测催办 + 心理测评学年合规。
 *
 * 权限约定（唐先生定）：
 * - 团体报告 / 意向分布 / 预警看板：聚合数据不点名；名单下钻按角色权限
 *   （机构 admin/jiaowu 看全校，tutor 只看自己名下学生，平台超管全量）；
 * - 意向提交：学生/家长本人；伴学师可代录（source=tutor）。
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, inArray } from "drizzle-orm";
import { createHash } from "crypto";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { isPlatformAdmin } from "./tenant";
import type { Subject4dResult } from "@contracts/subject4d";
import { defaultFullScore } from "@contracts/academics";
import {
  users,
  studentProfile,
  inviteChannels,
  inviteRegistrations,
  organizations,
  assessmentResults,
  academicRecords,
  guideSessions,
  subjectIntentions,
  intentionRounds,
  warningEvents,
  reminders,
  studentTutor,
} from "../db/schema";

/** 职员角色（可看聚合与名单）。 */
const STAFF_ROLES = ["tutor", "admin", "jiaowu"] as const;

function requireStaff(ctx: { user: { role: string } }) {
  if (!(STAFF_ROLES as readonly string[]).includes(ctx.user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "该功能仅对校内教职人员开放" });
  }
}

/** 前端 grade 取值兼容：junior/senior 等枚举值 → 中文年级标签。 */
function gradeLabel(grade: string | null | undefined): string {
  if (grade === "junior") return "初三";
  if (grade === "senior") return "高三";
  if (grade === "senior2") return "高二";
  return grade || "高一";
}

type CampusStudent = {
  userId: number;
  name: string;
  className: string | null;
  grade: string;
  phone: string | null;
  orgId: number | null;
};

/**
 * 校园学生范围：最新一次注册落在 campus=true 渠道的学生。
 * orgId=null（平台超管）→ 全部校园渠道；否则限本机构校园渠道。
 */
async function campusStudents(db: ReturnType<typeof getDb>, orgId: number | null): Promise<CampusStudent[]> {
  const conds = [eq(inviteChannels.campus, true)];
  if (orgId != null) conds.push(eq(inviteChannels.orgId, orgId));
  const rows = await db
    .select({
      regId: inviteRegistrations.id,
      userId: inviteRegistrations.userId,
      chOrgId: inviteChannels.orgId,
      userName: users.name,
      userPhone: users.phone,
      deletedAt: users.deletedAt,
      profileName: studentProfile.name,
      className: studentProfile.className,
      grade: studentProfile.grade,
    })
    .from(inviteRegistrations)
    .innerJoin(inviteChannels, eq(inviteChannels.id, inviteRegistrations.channelId))
    .leftJoin(users, eq(users.id, inviteRegistrations.userId))
    .leftJoin(studentProfile, eq(studentProfile.userId, inviteRegistrations.userId))
    .where(and(...conds))
    .orderBy(desc(inviteRegistrations.id));
  const seen = new Map<number, CampusStudent>();
  for (const r of rows) {
    if (!r.userId || r.deletedAt || seen.has(r.userId)) continue;
    seen.set(r.userId, {
      userId: r.userId,
      name: r.profileName || r.userName || "同学",
      className: r.className,
      grade: gradeLabel(r.grade),
      phone: r.userPhone,
      orgId: r.chOrgId ?? null,
    });
  }
  return [...seen.values()];
}

/** 学生本人是否校园生（家长端入口判定）。 */
async function myCampusInfo(db: ReturnType<typeof getDb>, userId: number) {
  const [reg] = await db
    .select({ channelId: inviteRegistrations.channelId })
    .from(inviteRegistrations)
    .where(eq(inviteRegistrations.userId, userId))
    .orderBy(desc(inviteRegistrations.id))
    .limit(1);
  if (!reg) return { campus: false as const, orgId: null as number | null };
  const [ch] = await db
    .select({ campus: inviteChannels.campus, orgId: inviteChannels.orgId })
    .from(inviteChannels)
    .where(eq(inviteChannels.id, reg.channelId))
    .limit(1);
  if (!ch?.campus) return { campus: false as const, orgId: null as number | null };
  return { campus: true as const, orgId: ch.orgId ?? null };
}

/** 职员当前机构是否校园机构（管理端 tab 判定）。 */
async function staffCampusContext(db: ReturnType<typeof getDb>, orgId: number | null) {
  if (orgId == null) {
    // 平台超管：任一 campus 渠道即为校园平台
    const [any] = await db.select({ id: inviteChannels.id }).from(inviteChannels).where(eq(inviteChannels.campus, true)).limit(1);
    return !!any;
  }
  const [ch] = await db.select({ id: inviteChannels.id }).from(inviteChannels).where(and(eq(inviteChannels.orgId, orgId), eq(inviteChannels.campus, true))).limit(1);
  return !!ch;
}

/* ------------------------------- 选科组合（与前端 ZhihuiReport 校园版同口径复刻） ------------------------------- */

const CAMPUS_CANDS = [
  { track: "物化" as const, subs: ["物理", "化学", "生物"] },
  { track: "物化" as const, subs: ["物理", "化学", "地理"] },
  { track: "物化" as const, subs: ["物理", "化学", "政治"] },
  { track: "史政" as const, subs: ["历史", "政治", "地理"] },
  { track: "史政" as const, subs: ["历史", "政治", "生物"] },
];

type AcademicsLite = { subjects?: { name?: string; lastScore?: number | null; fullScore?: number | null }[] } | null;

function campusCombos(s4d: Subject4dResult | null, academics: AcademicsLite, grade: string) {
  if (!s4d?.subjects) return null;
  const gradePct = (n: string): number | null => {
    const a = academics?.subjects?.find((x) => x.name === n || (n === "政治" && x.name === "道德与法治"));
    if (!a?.name || a.lastScore == null) return null;
    const full = a.fullScore ?? defaultFullScore(a.name, grade);
    return full > 0 ? Math.round((a.lastScore / full) * 100) : null;
  };
  const w = (n: string): number => {
    const pot = ((s4d.subjects[n as keyof typeof s4d.subjects]?.潜力指数 ?? 3) / 5) * 100;
    const g = gradePct(n);
    return Math.round(g == null ? pot : pot * 0.65 + g * 0.35);
  };
  const scored = CAMPUS_CANDS.map((c) => ({ ...c, score: Math.round(c.subs.reduce((s, n) => s + w(n), 0) / c.subs.length) }));
  const phys = scored.filter((c) => c.track === "物化").sort((a, b) => b.score - a.score);
  const hist = scored.filter((c) => c.track === "史政").sort((a, b) => b.score - a.score);
  const mathScore = academics?.subjects?.find((x) => x.name === "数学")?.lastScore ?? null;
  const winTrack =
    phys[0]!.score > hist[0]!.score ? "物化" : hist[0]!.score > phys[0]!.score ? "史政" : mathScore != null && mathScore >= 90 ? "物化" : "史政";
  const win = winTrack === "物化" ? phys : hist;
  const lose = winTrack === "物化" ? hist : phys;
  return {
    winTrack,
    tied: phys[0]!.score === hist[0]!.score,
    mathScore,
    rec1: win[0]!.subs,
    rec2: win[1]!.subs,
    rec3: lose[0]!.subs,
    scores: { rec1: win[0]!.score, rec2: win[1]!.score, rec3: lose[0]!.score },
  };
}

type Combo = NonNullable<ReturnType<typeof campusCombos>>;

/** 拉取某学生的学科四维 + 成绩 + 年级，返回组合（无四维返回 null）。 */
async function combosForStudent(db: ReturnType<typeof getDb>, userId: number): Promise<Combo | null> {
  const profile = await db.query.studentProfile.findFirst({ where: eq(studentProfile.userId, userId) });
  const [s4d] = await db
    .select()
    .from(assessmentResults)
    .where(and(eq(assessmentResults.userId, userId), eq(assessmentResults.kind, "subject4d")))
    .orderBy(desc(assessmentResults.createdAt), desc(assessmentResults.id))
    .limit(1);
  if (!s4d) return null;
  return campusCombos(s4d.result as unknown as Subject4dResult, (profile?.academics ?? null) as AcademicsLite, gradeLabel(profile?.grade));
}

/* ------------------------------- 预警规则 ------------------------------- */

const MENTAL_KINDS = ["mental", "mentalsdq", "mentalpa", "scl90"] as const;

/** 成绩得分率：总分/总分满分。 */
function academicsRate(subjects: { name?: string; lastScore?: number | null; fullScore?: number | null }[] | undefined, grade: string): number | null {
  if (!subjects?.length) return null;
  let got = 0;
  let full = 0;
  for (const s of subjects) {
    if (s.lastScore == null) continue;
    const f = s.fullScore ?? defaultFullScore(s.name ?? "", grade);
    if (f <= 0) continue;
    got += s.lastScore;
    full += f;
  }
  return full > 0 ? Math.round((got / full) * 1000) / 10 : null;
}

/* ------------------------------- 档案校验码 ------------------------------- */

function canonicalize(x: unknown): unknown {
  if (Array.isArray(x)) return x.map(canonicalize);
  if (x && typeof x === "object") {
    const o = x as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(o).sort()) {
      const v = o[k];
      if (v === undefined) continue;
      out[k] = canonicalize(v);
    }
    return out;
  }
  return x;
}

function checksum(x: unknown): string {
  return createHash("sha256").update(JSON.stringify(canonicalize(x))).digest("hex").slice(0, 12).toUpperCase();
}

/* ================================================ Router ================================================ */

export const schoolRouter = createRouter({
  /** 校园上下文：管理端 tab 显隐 + 学生端入口。 */
  context: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const role = ctx.user.role;
    if ((STAFF_ROLES as readonly string[]).includes(role)) {
      const campus = await staffCampusContext(db, ctx.user.orgId ?? null);
      let orgName: string | null = null;
      let logoUrl: string | null = null;
      if (ctx.user.orgId != null) {
        const [org] = await db.select({ name: organizations.name, brandName: organizations.brandName, logoUrl: organizations.logoUrl }).from(organizations).where(eq(organizations.id, ctx.user.orgId)).limit(1);
        orgName = org?.brandName || org?.name || null;
        logoUrl = org?.logoUrl ?? null;
      }
      return { role, campus, orgId: ctx.user.orgId ?? null, orgName, logoUrl };
    }
    const mine = await myCampusInfo(db, ctx.user.id);
    return { role, campus: mine.campus, orgId: mine.orgId, orgName: null, logoUrl: null };
  }),

  /* ------------------------------- 选科意向 ------------------------------- */

  intentions: createRouter({
    /** 我的（学生/家长端）：三大推荐 + 开放轮次 + 我已提交的意向。 */
    myOptions: authedQuery.query(async ({ ctx }) => {
      const db = getDb();
      const mine = await myCampusInfo(db, ctx.user.id);
      if (!mine.campus) throw new TRPCError({ code: "FORBIDDEN", message: "仅校园版学生可确认选科意向" });
      const combos = await combosForStudent(db, ctx.user.id);
      const rounds = await db.select().from(intentionRounds).where(eq(intentionRounds.orgId, mine.orgId ?? 0)).orderBy(intentionRounds.roundNo);
      const openRound = rounds.find((r) => r.status === "open") ?? null;
      const mineAll = await db
        .select()
        .from(subjectIntentions)
        .where(eq(subjectIntentions.userId, ctx.user.id))
        .orderBy(desc(subjectIntentions.createdAt));
      const mineLatest = new Map<number, (typeof mineAll)[number]>();
      for (const r of mineAll) if (!mineLatest.has(r.roundNo)) mineLatest.set(r.roundNo, r);
      return {
        combos,
        rounds: rounds.map((r) => ({ roundNo: r.roundNo, label: r.label, status: r.status })),
        openRoundNo: openRound?.roundNo ?? null,
        openRoundLabel: openRound?.label ?? null,
        mine: [...mineLatest.values()].map((r) => ({ roundNo: r.roundNo, choice: r.choice, subjects: r.subjects, reason: r.reason, createdAt: r.createdAt })),
      };
    }),

    /** 提交意向（本人/家长；伴学师可代录）。custom 必须填理由。 */
    submit: authedQuery
      .input(
        z.object({
          roundNo: z.number().int().min(1).max(9),
          choice: z.enum(["rec1", "rec2", "rec3", "custom"]),
          subjects: z.array(z.string()).min(3).max(3),
          reason: z.string().max(500).optional().default(""),
          source: z.enum(["parent", "student", "tutor"]).optional().default("parent"),
          studentId: z.number().int().optional(),
        }),
      )
      .mutation(async ({ ctx, input }) => {
        const db = getDb();
        let userId = ctx.user.id;
        let orgId: number | null;
        if (ctx.user.role === "tutor" || ctx.user.role === "admin" || ctx.user.role === "jiaowu") {
          if (input.studentId == null) throw new TRPCError({ code: "BAD_REQUEST", message: "代录须指定学生" });
          userId = input.studentId;
          const stu = await myCampusInfo(db, userId);
          if (!stu.campus) throw new TRPCError({ code: "FORBIDDEN", message: "该学生不是校园版学生" });
          orgId = stu.orgId;
          if (ctx.user.role !== "admin" || ctx.user.orgId != null) {
            // 机构职员限本机构；平台超管放行
            if (!isPlatformAdmin(ctx.user) && orgId !== (ctx.user.orgId ?? null)) {
              throw new TRPCError({ code: "FORBIDDEN", message: "该学生不在你的机构内" });
            }
          }
        } else {
          const mine = await myCampusInfo(db, userId);
          if (!mine.campus) throw new TRPCError({ code: "FORBIDDEN", message: "仅校园版学生可确认选科意向" });
          orgId = mine.orgId;
        }
        const [round] = await db
          .select()
          .from(intentionRounds)
          .where(and(eq(intentionRounds.orgId, orgId ?? 0), eq(intentionRounds.roundNo, input.roundNo)))
          .limit(1);
        if (!round) throw new TRPCError({ code: "BAD_REQUEST", message: "该意向轮次尚未开启，请联系管理员" });
        if (round.status !== "open") throw new TRPCError({ code: "BAD_REQUEST", message: "本轮意向已截止" });
        if (input.choice === "custom" && input.reason.trim().length < 5) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "自定义选科需要填写理由（至少 5 个字），便于老师跟进" });
        }
        // 同轮去重：先删后插
        await db.delete(subjectIntentions).where(and(eq(subjectIntentions.userId, userId), eq(subjectIntentions.roundNo, input.roundNo)));
        await db.insert(subjectIntentions).values({
          userId,
          orgId,
          roundNo: input.roundNo,
          choice: input.choice,
          subjects: input.subjects,
          reason: input.reason.trim(),
          source: input.source,
          term: round.label,
          createdBy: ctx.user.id,
        });
        return { ok: true as const, roundNo: input.roundNo };
      }),

    /** 轮次管理（机构 admin/jiaowu）：列表自动补第 1 轮。 */
    rounds: authedQuery.query(async ({ ctx }) => {
      requireStaff(ctx);
      const db = getDb();
      const orgId = ctx.user.orgId;
      if (orgId == null) throw new TRPCError({ code: "FORBIDDEN", message: "平台超管请在机构账号下操作" });
      let rounds = await db.select().from(intentionRounds).where(eq(intentionRounds.orgId, orgId)).orderBy(intentionRounds.roundNo);
      if (!rounds.length) {
        await db.insert(intentionRounds).values({ orgId, roundNo: 1, label: "第一轮意向", status: "open", createdBy: ctx.user.id });
        rounds = await db.select().from(intentionRounds).where(eq(intentionRounds.orgId, orgId)).orderBy(intentionRounds.roundNo);
      }
      const counts = await db.select({ roundNo: subjectIntentions.roundNo }).from(subjectIntentions).where(eq(subjectIntentions.orgId, orgId));
      const per = new Map<number, number>();
      for (const c of counts) per.set(c.roundNo, (per.get(c.roundNo) ?? 0) + 1);
      return rounds.map((r) => ({ roundNo: r.roundNo, label: r.label, status: r.status, count: per.get(r.roundNo) ?? 0 }));
    }),

    roundsSet: authedQuery
      .input(z.object({ roundNo: z.number().int().min(1).max(9), label: z.string().max(64).optional(), open: z.boolean() }))
      .mutation(async ({ ctx, input }) => {
        requireStaff(ctx);
        const db = getDb();
        const orgId = ctx.user.orgId;
        if (orgId == null || ctx.user.role === "tutor" || ctx.user.role === "jiaowu") {
          throw new TRPCError({ code: "FORBIDDEN", message: "仅机构管理员可管理意向轮次" });
        }
        const [round] = await db
          .select()
          .from(intentionRounds)
          .where(and(eq(intentionRounds.orgId, orgId), eq(intentionRounds.roundNo, input.roundNo)))
          .limit(1);
        if (round) {
          await db
            .update(intentionRounds)
            .set({ status: input.open ? "open" : "closed", ...(input.label ? { label: input.label } : {}) })
            .where(eq(intentionRounds.id, round.id));
        } else {
          await db.insert(intentionRounds).values({ orgId, roundNo: input.roundNo, label: input.label || `第${input.roundNo}轮意向`, status: input.open ? "open" : "closed", createdBy: ctx.user.id });
        }
        // 同时只保留一轮 open：开新轮自动关其他，再精确重开目标轮
        if (input.open) {
          await db
            .update(intentionRounds)
            .set({ status: "closed" })
            .where(and(eq(intentionRounds.orgId, orgId), eq(intentionRounds.status, "open")));
          const [target] = await db
            .select({ id: intentionRounds.id })
            .from(intentionRounds)
            .where(and(eq(intentionRounds.orgId, orgId), eq(intentionRounds.roundNo, input.roundNo)))
            .limit(1);
          if (target) await db.update(intentionRounds).set({ status: "open" }).where(eq(intentionRounds.id, target.id));
        }
        return { ok: true as const };
      }),

    /** 采纳率统计：最终意向 vs 系统三大推荐（rec1/rec2/rec3/custom/unset 占比 + 自定义理由名单）。 */
    adoption: authedQuery
      .input(z.object({ roundNo: z.number().int().min(1).max(9) }).optional())
      .query(async ({ ctx, input }) => {
        requireStaff(ctx);
        const db = getDb();
        const orgId = isPlatformAdmin(ctx.user) ? null : (ctx.user.orgId ?? null);
        if (orgId == null && !isPlatformAdmin(ctx.user)) {
          throw new TRPCError({ code: "FORBIDDEN", message: "机构未绑定" });
        }
        const students = await campusStudents(db, orgId);
        if (!students.length) return { total: 0, buckets: { rec1: 0, rec2: 0, rec3: 0, custom: 0, unset: 0 }, pct: null, customList: [], noCombo: 0 };
        // 伴学师只看自己名下
        let scoped = students;
        if (ctx.user.role === "tutor") {
          const mine = await db.select({ studentUserId: studentTutor.studentUserId }).from(studentTutor).where(eq(studentTutor.tutorUserId, ctx.user.id));
          const ids = new Set(mine.map((m) => m.studentUserId));
          scoped = students.filter((s) => ids.has(s.userId));
        }
        const ids = scoped.map((s) => s.userId);
        const roundNo = input?.roundNo;
        const allIntentions = roundNo
          ? await db.select().from(subjectIntentions).where(and(inArray(subjectIntentions.userId, ids), eq(subjectIntentions.roundNo, roundNo)))
          : await db.select().from(subjectIntentions).where(inArray(subjectIntentions.userId, ids));
        const latestByUser = new Map<number, (typeof allIntentions)[number]>();
        for (const r of allIntentions) {
          const prev = latestByUser.get(r.userId);
          if (!prev || r.createdAt > prev.createdAt) latestByUser.set(r.userId, r);
        }
        const buckets = { rec1: 0, rec2: 0, rec3: 0, custom: 0, unset: 0 };
        const customList: { userId: number; name: string; className: string | null; subjects: string[]; reason: string; createdAt: Date }[] = [];
        let noCombo = 0;
        for (const stu of scoped) {
          const it = latestByUser.get(stu.userId);
          if (!it) {
            buckets.unset++;
            continue;
          }
          if (it.choice === "custom") {
            buckets.custom++;
            customList.push({ userId: stu.userId, name: stu.name, className: stu.className, subjects: it.subjects, reason: it.reason, createdAt: it.createdAt });
          } else {
            // 校验是否与当前系统推荐一致（展示口径仍按提交时选择归类）
            const combos = await combosForStudent(db, stu.userId);
            if (!combos) noCombo++;
            buckets[it.choice]++;
          }
        }
        const decided = buckets.rec1 + buckets.rec2 + buckets.rec3 + buckets.custom;
        const total = scoped.length;
        const pct = decided > 0
          ? {
              rec1: Math.round((buckets.rec1 / decided) * 1000) / 10,
              rec2: Math.round((buckets.rec2 / decided) * 1000) / 10,
              rec3: Math.round((buckets.rec3 / decided) * 1000) / 10,
              custom: Math.round((buckets.custom / decided) * 1000) / 10,
              hitRate: Math.round(((buckets.rec1 + buckets.rec2 + buckets.rec3) / decided) * 1000) / 10,
            }
          : null;
        return { total, decided, buckets, pct, customList: customList.sort((a, b) => String(a.className).localeCompare(String(b.className))), noCombo };
      }),
  }),

  /* ------------------------------- 预警中心 ------------------------------- */

  warnings: createRouter({
    /** 预警名单（按职员范围过滤）。 */
    list: authedQuery
      .input(z.object({ status: z.enum(["open", "acknowledged", "resolved"]).optional(), className: z.string().optional() }).optional())
      .query(async ({ ctx, input }) => {
        requireStaff(ctx);
        const db = getDb();
        const orgId = isPlatformAdmin(ctx.user) ? null : (ctx.user.orgId ?? null);
        let scoped: CampusStudent[];
        if (ctx.user.role === "tutor") {
          const mine = await db.select({ studentUserId: studentTutor.studentUserId }).from(studentTutor).where(eq(studentTutor.tutorUserId, ctx.user.id));
          const ids = new Set(mine.map((m) => m.studentUserId));
          scoped = (await campusStudents(db, orgId)).filter((s) => ids.has(s.userId));
        } else {
          scoped = await campusStudents(db, orgId);
        }
        const byUser = new Map(scoped.map((s) => [s.userId, s]));
        const ids = [...byUser.keys()];
        if (!ids.length) return { events: [] };
        const conds = [inArray(warningEvents.userId, ids)];
        if (input?.status) conds.push(eq(warningEvents.status, input.status));
        const rows = await db.select().from(warningEvents).where(and(...conds)).orderBy(desc(warningEvents.createdAt)).limit(300);
        const events = rows
          .filter((r) => {
            if (!input?.className) return true;
            return (byUser.get(r.userId)?.className ?? "") === input.className;
          })
          .map((r) => {
            const stu = byUser.get(r.userId);
            return {
              id: r.id,
              userId: r.userId,
              name: stu?.name ?? "同学",
              className: stu?.className ?? null,
              type: r.type,
              level: r.level,
              status: r.status,
              detail: r.detail,
              handleNote: r.handleNote,
              handledAt: r.handledAt,
              createdAt: r.createdAt,
            };
          });
        return { events };
      }),

    /** 全量重扫：按规则生成预警（同类型有未结预警则跳过，幂等）。 */
    reevaluate: authedQuery.mutation(async ({ ctx }) => {
      requireStaff(ctx);
      const db = getDb();
      const orgId = isPlatformAdmin(ctx.user) ? null : (ctx.user.orgId ?? null);
      const students = await campusStudents(db, orgId);
      const ids = students.map((s) => s.userId);
      if (!ids.length) return { created: 0 };
      const results = await db.select().from(assessmentResults).where(inArray(assessmentResults.userId, ids)).orderBy(desc(assessmentResults.createdAt));
      const latest = new Map<string, (typeof results)[number]>();
      for (const r of results) {
        const k = `${r.userId}:${r.kind}`;
        if (!latest.has(k)) latest.set(k, r);
      }
      const openRows = await db.select().from(warningEvents).where(and(inArray(warningEvents.userId, ids), eq(warningEvents.status, "open")));
      const openKeys = new Set(openRows.map((e) => `${e.userId}:${e.type}`));
      const profiles = await db.select().from(studentProfile).where(inArray(studentProfile.userId, ids));
      const profByUser = new Map(profiles.map((p) => [p.userId, p]));
      const recs = await db.select().from(academicRecords).where(inArray(academicRecords.userId, ids)).orderBy(desc(academicRecords.createdAt));
      const recsByUser = new Map<number, typeof recs>();
      for (const r of recs) {
        const arr = recsByUser.get(r.userId) ?? [];
        arr.push(r);
        recsByUser.set(r.userId, arr);
      }
      let created = 0;
      for (const stu of students) {
        const key = (t: string) => `${stu.userId}:${t}`;
        // 心理红线
        if (!openKeys.has(key("mental_redline"))) {
          let hit: { kind: string; level: string; selfHarm: boolean; at: Date } | null = null;
          for (const kind of MENTAL_KINDS) {
            const r = latest.get(`${stu.userId}:${kind}`);
            if (!r) continue;
            const res = r.result as { level?: string; selfHarm?: boolean };
            if (res.selfHarm) {
              hit = { kind, level: res.level ?? "高风险", selfHarm: true, at: r.createdAt };
              break;
            }
            if (res.level === "预警" || res.level === "高风险") {
              hit = { kind, level: res.level, selfHarm: false, at: r.createdAt };
              break;
            }
          }
          const e3 = latest.get(`${stu.userId}:e3`);
          if (!hit && e3) {
            const res = e3.result as { lifeEventLevel?: string; redFlags?: string[] };
            if (res.lifeEventLevel === "警戒" || res.lifeEventLevel === "高风险" || (Array.isArray(res.redFlags) && res.redFlags.length > 0)) {
              hit = { kind: "e3", level: res.lifeEventLevel === "高风险" ? "高风险" : "预警", selfHarm: false, at: e3.createdAt };
            }
          }
          if (hit) {
            await db.insert(warningEvents).values({
              userId: stu.userId,
              orgId: stu.orgId,
              type: "mental_redline",
              level: hit.selfHarm ? "高风险" : hit.level === "高风险" ? "高风险" : "预警",
              detail: { kind: hit.kind, level: hit.level, selfHarm: hit.selfHarm, at: hit.at },
            });
            openKeys.add(key("mental_redline"));
            created++;
          }
        }
        // 动力预警：乐学 < 3.0
        if (!openKeys.has(key("low_motivation"))) {
          const e3 = latest.get(`${stu.userId}:e3`);
          if (e3) {
            const res = e3.result as { systems?: { core?: { label?: string; score?: number }[] } };
            const leXue = res.systems?.core?.find((c) => c.label === "乐学");
            if (leXue && typeof leXue.score === "number" && leXue.score < 3.0) {
              await db.insert(warningEvents).values({
                userId: stu.userId,
                orgId: stu.orgId,
                type: "low_motivation",
                level: "关注",
                detail: { score: leXue.score, kind: "e3", at: e3.createdAt },
              });
              openKeys.add(key("low_motivation"));
              created++;
            }
          }
        }
        // 学业下滑：最近两次得分率降幅 ≥ 10 个百分点
        if (!openKeys.has(key("academic_drop"))) {
          const prof = profByUser.get(stu.userId);
          const grade = gradeLabel(prof?.grade);
          const mine = recsByUser.get(stu.userId) ?? [];
          const rates = mine.map((r) => academicsRate((r.subjects ?? []) as { name?: string; lastScore?: number | null; fullScore?: number | null }[], grade)).filter((x): x is number => x != null);
          if (rates.length >= 2) {
            const [now, prev] = rates;
            if (now != null && prev != null && prev - now >= 10) {
              await db.insert(warningEvents).values({
                userId: stu.userId,
                orgId: stu.orgId,
                type: "academic_drop",
                level: now < 50 ? "预警" : "关注",
                detail: { from: prev, to: now, drop: Math.round((prev - now) * 10) / 10 },
              });
              openKeys.add(key("academic_drop"));
              created++;
            }
          }
        }
      }
      return { created };
    }),

    /** 处置：确认 / 办结 + 留痕。 */
    handle: authedQuery
      .input(z.object({ id: z.number().int(), action: z.enum(["acknowledge", "resolve"]), note: z.string().max(500).optional().default("") }))
      .mutation(async ({ ctx, input }) => {
        requireStaff(ctx);
        const db = getDb();
        const [row] = await db.select().from(warningEvents).where(eq(warningEvents.id, input.id)).limit(1);
        if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "预警不存在" });
        const status = input.action === "resolve" ? "resolved" : "acknowledged";
        await db
          .update(warningEvents)
          .set({ status, handledBy: ctx.user.id, handledAt: new Date(), handleNote: input.note })
          .where(eq(warningEvents.id, input.id));
        return { ok: true as const, status };
      }),
  }),

  /* ------------------------------- 团体统计 ------------------------------- */

  stats: createRouter({
    /** 参测完成统计：校园生 × 重点测评种类完成情况 + 班级分布（聚合不点名，缺测名单走 unassessed）。 */
    assessment: authedQuery.query(async ({ ctx }) => {
      requireStaff(ctx);
      const db = getDb();
      const orgId = isPlatformAdmin(ctx.user) ? null : (ctx.user.orgId ?? null);
      let students = await campusStudents(db, orgId);
      if (ctx.user.role === "tutor") {
        const mine = await db.select({ studentUserId: studentTutor.studentUserId }).from(studentTutor).where(eq(studentTutor.tutorUserId, ctx.user.id));
        const ids = new Set(mine.map((m) => m.studentUserId));
        students = students.filter((s) => ids.has(s.userId));
      }
      const ids = students.map((s) => s.userId);
      const total = students.length;
      const KINDS = [
        { kind: "subject4d", label: "学科四维" },
        { kind: "holland", label: "霍兰德职业兴趣" },
        { kind: "e3", label: "学习力诊断 E3" },
        { kind: "multi5", label: "多元智能五项" },
        { kind: "mentalsdq", label: "心理筛查 SDQ" },
      ] as const;
      const empty = { total, kinds: KINDS.map((k) => ({ ...k, done: 0 })), byClass: [] as { className: string; total: number; done4d: number; doneHolland: number }[] };
      if (!ids.length) return empty;
      const rows = await db.select({ userId: assessmentResults.userId, kind: assessmentResults.kind }).from(assessmentResults).where(inArray(assessmentResults.userId, ids));
      const doneByUser = new Map<number, Set<string>>();
      for (const r of rows) {
        const s = doneByUser.get(r.userId) ?? new Set<string>();
        s.add(r.kind);
        doneByUser.set(r.userId, s);
      }
      const kinds = KINDS.map((k) => ({ ...k, done: ids.filter((id) => doneByUser.get(id)?.has(k.kind)).length }));
      // 班级分布
      const classes = new Map<string, { total: number; done4d: number; doneHolland: number }>();
      for (const stu of students) {
        const cn = stu.className || "未分班";
        const c = classes.get(cn) ?? { total: 0, done4d: 0, doneHolland: 0 };
        c.total++;
        const set = doneByUser.get(stu.userId);
        if (set?.has("subject4d")) c.done4d++;
        if (set?.has("holland")) c.doneHolland++;
        classes.set(cn, c);
      }
      const byClass = [...classes.entries()]
        .sort(([a], [b]) => a.localeCompare(b, "zh-Hans-CN", { numeric: true }))
        .map(([className, c]) => ({ className, ...c }));
      return { ...empty, kinds, byClass };
    }),
  }),

  /* ------------------------------- 未参测催办 ------------------------------- */

  unassessed: createRouter({
    /** 缺测名单：按班级分组（职员范围内）。 */
    list: authedQuery.query(async ({ ctx }) => {
      requireStaff(ctx);
      const db = getDb();
      const orgId = isPlatformAdmin(ctx.user) ? null : (ctx.user.orgId ?? null);
      let students = await campusStudents(db, orgId);
      if (ctx.user.role === "tutor") {
        const mine = await db.select({ studentUserId: studentTutor.studentUserId }).from(studentTutor).where(eq(studentTutor.tutorUserId, ctx.user.id));
        const ids = new Set(mine.map((m) => m.studentUserId));
        students = students.filter((s) => ids.has(s.userId));
      }
      const ids = students.map((s) => s.userId);
      if (!ids.length) return { groups: [] };
      const rows = await db.select({ userId: assessmentResults.userId, kind: assessmentResults.kind }).from(assessmentResults).where(inArray(assessmentResults.userId, ids));
      const doneByUser = new Map<number, Set<string>>();
      for (const r of rows) {
        const s = doneByUser.get(r.userId) ?? new Set<string>();
        s.add(r.kind);
        doneByUser.set(r.userId, s);
      }
      const REQUIRED = ["subject4d", "holland"] as const;
      const groups = new Map<string, { className: string; items: { userId: number; name: string; missing: string[] }[] }>();
      for (const stu of students) {
        const set = doneByUser.get(stu.userId) ?? new Set<string>();
        const missing = REQUIRED.filter((k) => !set.has(k)).map((k) => (k === "subject4d" ? "学科四维" : "霍兰德"));
        if (!missing.length) continue;
        const cn = stu.className || "未分班";
        const g = groups.get(cn) ?? { className: cn, items: [] };
        g.items.push({ userId: stu.userId, name: stu.name, missing });
        groups.set(cn, g);
      }
      return {
        groups: [...groups.values()]
          .sort((a, b) => a.className.localeCompare(b.className, "zh-Hans-CN", { numeric: true }))
          .map((g) => ({ ...g, items: g.items.sort((a, b) => a.name.localeCompare(b.name, "zh-Hans-CN")) })),
      };
    }),

    /** 一键催办：为缺测学生生成系统提醒（audience=admin），并返回可复制给班主任的文本。 */
    remind: authedQuery.mutation(async ({ ctx }) => {
      requireStaff(ctx);
      const db = getDb();
      const orgId = ctx.user.orgId;
      if (orgId == null) throw new TRPCError({ code: "FORBIDDEN", message: "请在机构账号下操作" });
      const students = await campusStudents(db, orgId);
      const ids = students.map((s) => s.userId);
      if (!ids.length) return { reminded: 0, text: "" };
      const rows = await db.select({ userId: assessmentResults.userId, kind: assessmentResults.kind }).from(assessmentResults).where(inArray(assessmentResults.userId, ids));
      const doneByUser = new Map<number, Set<string>>();
      for (const r of rows) {
        const s = doneByUser.get(r.userId) ?? new Set<string>();
        s.add(r.kind);
        doneByUser.set(r.userId, s);
      }
      let reminded = 0;
      const lines: string[] = [];
      const byClass = new Map<string, string[]>();
      for (const stu of students) {
        const set = doneByUser.get(stu.userId) ?? new Set<string>();
        const missing: string[] = [];
        if (!set.has("subject4d")) missing.push("学科四维测评");
        if (!set.has("holland")) missing.push("霍兰德职业兴趣测评");
        if (!missing.length) continue;
        await db.insert(reminders).values({
          orgId,
          studentId: stu.userId,
          kind: "unassessed",
          message: `尚未完成：${missing.join("、")}，请尽快完成测评`,
          audience: "admin",
          audienceUserId: ctx.user.id,
        });
        reminded++;
        const cn = stu.className || "未分班";
        byClass.set(cn, [...(byClass.get(cn) ?? []), `${stu.name}（${missing.join("、")}）`]);
      }
      for (const [cn, items] of [...byClass.entries()].sort(([a], [b]) => a.localeCompare(b, "zh-Hans-CN", { numeric: true }))) {
        lines.push(`【${cn}】${items.join("；")}`);
      }
      return { reminded, text: lines.join("\n") };
    }),

    /** 我的提醒列表。 */
    my: authedQuery.query(async ({ ctx }) => {
      requireStaff(ctx);
      const db = getDb();
      const rows = await db
        .select({ id: reminders.id, message: reminders.message, read: reminders.read, createdAt: reminders.createdAt })
        .from(reminders)
        .where(and(eq(reminders.audienceUserId, ctx.user.id), eq(reminders.read, false)))
        .orderBy(desc(reminders.createdAt))
        .limit(100);
      return { reminders: rows };
    }),
  }),

  /* ------------------------------- 一生一策成长档案 ------------------------------- */

  archive: createRouter({
    /** 可选学生清单（职员范围内，供档案页选择器用）。 */
    students: authedQuery.query(async ({ ctx }) => {
      requireStaff(ctx);
      const db = getDb();
      const orgId = isPlatformAdmin(ctx.user) ? null : (ctx.user.orgId ?? null);
      let students = await campusStudents(db, orgId);
      if (ctx.user.role === "tutor") {
        const mine = await db.select({ studentUserId: studentTutor.studentUserId }).from(studentTutor).where(eq(studentTutor.tutorUserId, ctx.user.id));
        const ids = new Set(mine.map((m) => m.studentUserId));
        students = students.filter((s) => ids.has(s.userId));
      }
      return {
        students: students
          .map((s) => ({ userId: s.userId, name: s.name, className: s.className, grade: s.grade }))
          .sort((a, b) => String(a.className).localeCompare(String(b.className), "zh-Hans-CN", { numeric: true }) || a.name.localeCompare(b.name, "zh-Hans-CN")),
      };
    }),

    /** 学生完整档案（读时聚合：测评+成绩+预警+指导记录），附校验码可导出校验。 */
    portfolio: authedQuery
      .input(z.object({ studentId: z.number().int() }))
      .query(async ({ ctx, input }) => {
        requireStaff(ctx);
        const db = getDb();
        const stu = await campusStudents(db, isPlatformAdmin(ctx.user) ? null : (ctx.user.orgId ?? null));
        const me = stu.find((s) => s.userId === input.studentId);
        if (!me) throw new TRPCError({ code: "FORBIDDEN", message: "该学生不在你的校园范围内" });
        if (ctx.user.role === "tutor") {
          const assigned = await db
            .select({ id: studentTutor.id })
            .from(studentTutor)
            .where(and(eq(studentTutor.tutorUserId, ctx.user.id), eq(studentTutor.studentUserId, input.studentId)))
            .limit(1);
          if (!assigned.length) throw new TRPCError({ code: "FORBIDDEN", message: "该学生未分配给你" });
        }
        const sid = input.studentId;
        const profile = await db.query.studentProfile.findFirst({ where: eq(studentProfile.userId, sid) });
        const results = await db.select().from(assessmentResults).where(eq(assessmentResults.userId, sid)).orderBy(desc(assessmentResults.createdAt));
        const recs = await db.select().from(academicRecords).where(eq(academicRecords.userId, sid)).orderBy(desc(academicRecords.createdAt));
        const warns = await db.select().from(warningEvents).where(eq(warningEvents.userId, sid)).orderBy(desc(warningEvents.createdAt));
        const guides = await db.select().from(guideSessions).where(eq(guideSessions.userId, sid)).orderBy(desc(guideSessions.createdAt));
        const portfolio = {
          student: { userId: sid, name: me.name, className: me.className, grade: me.grade, school: profile?.school ?? null },
          assessments: results.map((r) => ({ kind: r.kind, createdAt: r.createdAt, result: r.result })),
          academics: recs.map((r) => ({ examName: r.examName, subjects: r.subjects, createdAt: r.createdAt })),
          warnings: warns.map((w) => ({ type: w.type, level: w.level, status: w.status, detail: w.detail, createdAt: w.createdAt, handleNote: w.handleNote })),
          guidance: guides.map((g) => ({ date: g.date, step: g.step, done: g.done, answers: g.answers, createdAt: g.createdAt })),
          generatedAt: new Date().toISOString(),
        };
        return { ...portfolio, checksum: checksum(portfolio) };
      }),
  }),
});
