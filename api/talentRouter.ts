/**
 * 人才测评接口（v282 恢复线上 v271 版）。
 *
 * 六个评估对象：五个真实岗位（市场推广 / 咨询销售 / 人事行政 / 财务教务 / 教学服务，
 * 按前段获客 → 中段组织 → 后段交付的链路排）+ 一条潜质通道（pot：不是岗位，
 * 评的是「该不该带人、能带哪一段」）。
 *
 * 一套底盘（大五 20 + 价值观 18 + 职场 DISC 24 组 + 特质情商 30）+ 工作能力客观题
 * 21 题（教育行业版 / 通用版两套）+ 岗位加测一套。出卷只给题面，不给答案键。
 *
 * 两条入口，差别只在「谁发起」：
 *  - 管理员登录自测：ownerId = 自己；
 *  - HR 发码、候选人扫码答：码里带着岗位（见 talentCode.ts），提交时落到发起人名下。
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { organizations, talentAssessments, users } from "@db/schema";
import { createRouter, adminQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { env } from "./lib/env";
import { encodeTalentCode, decodeTalentCode } from "./talentCode";
import {
  BIGFIVE_ITEMS,
  DUTY_PACKS,
  EQ_ITEMS,
  EQ_FACTOR_LABEL,
  EQ_FACTOR_DIMS,
  EQ_DIM_LABEL,
  PART_META,
  VALUE_ITEMS,
  WORK_DISC_GROUPS,
} from "@contracts/talent/bank";
import {
  JOB_BLURB,
  JOB_DUTY_PACK,
  JOB_KEYS,
  JOB_KIND,
  JOB_LABEL,
  JOB_LAYER,
  JOB_SHORT,
  JOB_TRACK,
  JOB_WEIGHTS,
  LAYER_LABEL,
  computeDims,
  scoreBigFive,
  scoreDuty,
  scoreEq,
  scoreValue,
  scoreWorkDisc,
  type JobKey,
} from "@contracts/talent/score";
import { buildTalentReport, JOB_EQ_FOCUS, type TalentReport } from "@contracts/talent/report";
import { cogItemsFor, COG_TRACK_LABEL, cogTrackOf } from "@contracts/talent/cognitive-bank";
import { COG_CORE_LINE, COG_MAJOR_LINE, COG_TIME_LIMIT_SEC, scoreCognitive } from "@contracts/talent/cognitive-score";
import { PERSONAS } from "@contracts/talent/persona";
import { BAND_LABEL, TIER_LABEL, TIER_ORDER, TIER_ROLE } from "@contracts/talent/potential";

const isJob = (v: unknown): v is JobKey => typeof v === "string" && (JOB_KEYS as string[]).includes(v);

function badRequest(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

/** 交上来的作答必须能对上题号，否则宁可拒收——错位的答案会算出一份看着正常的错报告。 */
function assertIds(got: Record<string, unknown>, ids: string[], what: string) {
  const known = new Set(ids);
  for (const k of Object.keys(got)) if (!known.has(k)) badRequest(`${what}里出现了不认识的题号：${k}`);
}

const DAY = 24 * 60 * 60 * 1000;

/* 线上库把本地时间当 UTC 存（MySQL 时区口径），回显时往回拨 8 小时才对得上真实时刻。 */
const DB_UTC_SKEW_MS = 8 * 60 * 60 * 1000;
const forDisplay = (d: Date) => new Date(d.getTime() - DB_UTC_SKEW_MS);

export const talentRouter = createRouter({
  /** 岗位目录 + 题本构成 + 权重表：选岗页与说明页都用这一份，避免前端另抄一份常量。 */
  catalog: publicQuery.query(() => ({
    /* 按段排：前段两个 → 中段两个 → 后段一个 → 潜质通道。前端直接照这个顺序分组渲染，
       不再自己维护一份岗位清单——两处维护迟早会漏一个。 */
    jobs: JOB_KEYS.map((k) => ({
      key: k,
      label: JOB_LABEL[k],
      short: JOB_SHORT[k],
      track: JOB_TRACK[k],
      layer: JOB_LAYER[k],
      layerLabel: LAYER_LABEL[JOB_LAYER[k]],
      kind: JOB_KIND[k],
      blurb: JOB_BLURB[k],
      dutyPack: JOB_DUTY_PACK[k],
      dutyName: DUTY_PACKS[JOB_DUTY_PACK[k]].name,
      dutyMinutes: DUTY_PACKS[JOB_DUTY_PACK[k]].minutes,
      dutyItems: DUTY_PACKS[JOB_DUTY_PACK[k]].items.length,
      minutes: 24 + COG_TIME_LIMIT_SEC / 60 + DUTY_PACKS[JOB_DUTY_PACK[k]].minutes,
      eqFocus: JOB_EQ_FOCUS[k].map((d) => EQ_DIM_LABEL[d]),
      weights: JOB_WEIGHTS[k],
      persona: PERSONAS[k],
    })),
    /** 潜质通道的说明与四段定义：后台画像页与报告页共用 */
    potential: {
      tiers: TIER_ORDER.map((t) => ({ key: t, label: TIER_LABEL[t], role: TIER_ROLE[t] })),
      bands: Object.entries(BAND_LABEL).map(([key, label]) => ({ key, label })),
    },
    parts: (["bigfive", "value", "discwork", "eq"] as const).map((k) => ({ key: k, ...PART_META[k] })),
    eq: {
      factors: (Object.keys(EQ_FACTOR_LABEL) as (keyof typeof EQ_FACTOR_LABEL)[]).map((f) => ({
        key: f,
        label: EQ_FACTOR_LABEL[f],
        dims: EQ_FACTOR_DIMS[f].map((d) => ({ key: d, label: EQ_DIM_LABEL[d] })),
      })),
    },
    /** 做完要多久：底盘 24 分钟 + 工作能力 15 分钟 + 岗位加测 */
    totalMinutes: 24 + COG_TIME_LIMIT_SEC / 60,
    /** 工作能力段：题量、限时、参考线。前端只用来说明，不参与计分。 */
    cognitive: {
      items: cogItemsFor("edu").length,
      tracks: ["edu", "general"],
      minutes: COG_TIME_LIMIT_SEC / 60,
      coreLine: COG_CORE_LINE,
      majorLine: COG_MAJOR_LINE,
    },
  })),

  /** 出卷。只给题面，不给答案键。 */
  paper: publicQuery
    .input((v: unknown) => v as { position?: string; track?: string })
    .query(({ input }) => {
      const position = isJob(input?.position) ? input.position : "sales";
      const pack = DUTY_PACKS[JOB_DUTY_PACK[position]];
      const track = input?.track === "general" ? "general" : "edu";
      const cogItems = cogItemsFor(track);
      return {
        position,
        positionLabel: JOB_LABEL[position],
        positionTrack: JOB_TRACK[position],
        cogTrack: track,
        cogTrackLabel: COG_TRACK_LABEL[track],
        parts: [
          {
            /* 工作能力放第一段：限时测验要趁脑子清醒，也避免排在 100 多道自陈题之后
               被疲劳和作答惯性拖累——那样测出来的不是能力，是耐心。 */
            key: "cognitive" as const,
            name: "工作能力（客观题）",
            minutes: COG_TIME_LIMIT_SEC / 60,
            kind: "choice" as const,
            timed: true,
            blurb: `本段 ${cogItems.length} 题（${COG_TRACK_LABEL[track]}），限时 ${COG_TIME_LIMIT_SEC / 60} 分钟。点「开始计时」才起表，到点这一段自动锁定，后面的问卷还能继续慢慢答。每题只有一个正确答案，不会的可以先跳过——错答不倒扣，空着也不给分。`,
            items: cogItems.map((i) => ({ id: i.id, kind: "choice" as const, text: i.text, options: [...i.options] })),
          },
          {
            key: "bigfive" as const,
            name: PART_META.bigfive.name,
            minutes: PART_META.bigfive.minutes,
            kind: "likert5" as const,
            items: BIGFIVE_ITEMS.map((i) => ({ id: i.id, text: i.text })),
          },
          {
            key: "value" as const,
            name: PART_META.value.name,
            minutes: PART_META.value.minutes,
            kind: "likert5" as const,
            items: VALUE_ITEMS.map((i) => ({ id: i.id, text: i.text })),
          },
          {
            key: "discwork" as const,
            name: PART_META.discwork.name,
            minutes: PART_META.discwork.minutes,
            kind: "disc" as const,
            groups: WORK_DISC_GROUPS.map((g) => ({ words: [...g.words] })),
          },
          {
            key: "eq" as const,
            name: PART_META.eq.name,
            minutes: PART_META.eq.minutes,
            kind: "likert7" as const,
            items: EQ_ITEMS.map((i) => ({ id: i.id, text: i.text })),
          },
          {
            key: "duty" as const,
            name: pack.name,
            minutes: pack.minutes,
            kind: "mixed" as const,
            blurb: pack.blurb,
            items: pack.items.map((it) =>
              it.kind === "likert"
                ? { id: it.id, kind: "likert5" as const, text: it.text }
                : { id: it.id, kind: "choice" as const, text: it.text, options: it.options.map((o) => o.text) },
            ),
          },
        ],
      };
    }),

  /** 交卷。登录态与扫码态共用；扫码态靠 code 认人，不建账号。 */
  submit: publicQuery
    .input(
      (v: unknown) =>
        v as {
          position?: string;
          name?: string;
          code?: string;
          cognitiveTimeSec?: number;
          answers?: {
            bigfive?: Record<string, number>;
            value?: Record<string, number>;
            discwork?: { most?: number[]; least?: number[] };
            eq?: Record<string, number>;
            duty?: Record<string, number | string>;
            notes?: Record<string, string>;
            cognitive?: Record<string, number>;
          };
        },
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const answers = input?.answers ?? {};

      /* 岗位优先取码里的：候选人答的题是 HR 定的那套，不能被他改请求换成另一套 */
      let position: JobKey | null = null;
      let ownerId = 0;
      let source: "self" | "invite" = "self";
      let inviteDay: number | null = null;

      if (input?.code) {
        const decoded = decodeTalentCode(input.code, env.appSecret);
        if (!decoded) badRequest("这张链接已失效，请让 HR 重新发一张");
        position = decoded.position;
        ownerId = decoded.ownerId;
        inviteDay = decoded.day;
        source = "invite";
      } else {
        if (!ctx.user) throw new TRPCError({ code: "UNAUTHORIZED", message: "请先登录再做测评" });
        if (ctx.user.role !== "admin") {
          throw new TRPCError({ code: "FORBIDDEN", message: "这份测评用于招聘，请扫后台发出的码作答" });
        }
        if (!isJob(input?.position)) badRequest("请先选择要评估的岗位");
        position = input.position;
        ownerId = ctx.user.id;
      }

      if (inviteDay != null && Date.now() - inviteDay * DAY > 7 * DAY) {
        badRequest("这张链接已失效，请让 HR 重新发一张");
      }

      const bf = answers.bigfive ?? {};
      const vv = answers.value ?? {};
      const eqa = answers.eq ?? {};
      const dw = { most: answers.discwork?.most ?? [], least: answers.discwork?.least ?? [] };
      const du = answers.duty ?? {};

      assertIds(bf, BIGFIVE_ITEMS.map((i) => i.id), "大五人格");
      assertIds(vv, VALUE_ITEMS.map((i) => i.id), "工作价值观");
      assertIds(eqa, EQ_ITEMS.map((i) => i.id), "特质情商");
      assertIds(du, DUTY_PACKS[JOB_DUTY_PACK[position]].items.map((i) => i.id), "岗位加测");
      const cogTrack = cogTrackOf(answers.cognitive ?? {});
      assertIds(answers.cognitive ?? {}, cogItemsFor(cogTrack).map((i) => i.id), "工作能力");

      const bigfive = scoreBigFive(bf);
      const value = scoreValue(vv);
      const discwork = scoreWorkDisc({ most: dw.most, least: dw.least });
      const eq = scoreEq(eqa);
      const duty = scoreDuty(JOB_DUTY_PACK[position], du);

      /* 客观题只收 0–3 的合法选项下标，其余当没答——防手滑带进来的脏数据污染正确率 */
      const cg: Record<string, number> = {};
      for (const [k, v] of Object.entries(answers.cognitive ?? {})) {
        const n = Number(v);
        if (Number.isInteger(n) && n >= 0 && n <= 3) cg[k] = n;
      }
      const cogAnswered = Object.keys(cg).length;
      const cognitive = scoreCognitive(cg, cogTrack);
      const cogTimeSec = Math.max(0, Math.min(COG_TIME_LIMIT_SEC, Math.round(Number(input?.cognitiveTimeSec) || 0)));

      const answered = {
        bigfive: Object.keys(bf).filter((k) => Number.isFinite(bf[k])).length,
        value: Object.keys(vv).filter((k) => Number.isFinite(vv[k])).length,
        discwork: dw.most.filter((m, i) => m != null && dw.least[i] != null && m !== dw.least[i]).length,
        eq: Object.keys(eqa).filter((k) => Number.isFinite(eqa[k])).length,
        duty: duty.answered,
        cognitive: cogAnswered,
      };

      const { dims, details } = computeDims({ bigfive, value, discwork, dutyScores: duty, answered });

      const name = (input?.name ?? "").trim().slice(0, 32) || (ctx.user?.name ?? "").slice(0, 32) || "未署名";
      const report = buildTalentReport({
        name,
        position,
        generatedAt: new Date().toISOString(),
        answers: { ...answers, cognitive: cg },
        parts: { bigfive, value, discwork, eq, duty },
        dims,
        details,
        answered,
        cognitive,
        cognitiveTimeSec: cogTimeSec,
      });

      const [row] = await db
        .insert(talentAssessments)
        .values({
          orgId: ctx.user?.orgId ?? null,
          ownerId,
          candidateName: name,
          position,
          source,
          completeness: report.completeness.pct,
          /* 潜质通道存的是潜质指数，不是人岗匹配度：列表里同一个「分数」列，
             两种记录的含义必须一致，否则 HR 会拿 82 分的潜质和 82 分的岗位匹配做比较。 */
          fitScore: report.potential ? report.potential.index : report.current.score,
          report: report as unknown as Record<string, unknown>,
          answers: { ...answers, cognitive: cg, cognitiveTimeSec: cogTimeSec, answered } as unknown as Record<string, unknown>,
        })
        .$returningId();

      return { id: row.id, report };
    }),

  /** 后台发一张邀请码：岗位锁死在码里，7 天内有效。只有管理员能发。 */
  invite: adminQuery
    .input((v: unknown) => v as { position?: string })
    .mutation(({ ctx, input }) => {
      if (!isJob(input?.position)) badRequest("请先选择岗位");
      const { code, expiresAt } = encodeTalentCode(ctx.user!.id, input.position, env.appSecret);
      return { code, expiresAt, position: input.position, positionLabel: JOB_LABEL[input.position] };
    }),

  /** 扫码页：先告诉答题人「谁请你答、答哪个岗」，别让他一进来就对着 100 道题发懵。 */
  inviteInfo: publicQuery
    .input((v: unknown) => v as { code?: string })
    .query(async ({ input }) => {
      const decoded = decodeTalentCode(input?.code ?? "", env.appSecret);
      if (!decoded) return null;
      const db = getDb();
      const owner = (await db.select({ name: users.name, orgId: users.orgId }).from(users).where(eq(users.id, decoded.ownerId)).limit(1))[0];
      let orgName: string | null = null;
      if (owner?.orgId) {
        const org = (await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, owner.orgId)).limit(1))[0];
        orgName = org?.name ?? null;
      }
      return {
        position: decoded.position,
        positionLabel: JOB_LABEL[decoded.position],
        positionTrack: JOB_TRACK[decoded.position],
        inviterName: owner?.name ?? "招聘负责人",
        orgName,
        minutes: 24 + COG_TIME_LIMIT_SEC / 60 + DUTY_PACKS[JOB_DUTY_PACK[decoded.position]].minutes,
        cogMinutes: COG_TIME_LIMIT_SEC / 60,
      };
    }),

  /** 我试做过的记录（后台校准题目用，不对学员开放）。 */
  mine: adminQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select({
        id: talentAssessments.id,
        position: talentAssessments.position,
        completeness: talentAssessments.completeness,
        fitScore: talentAssessments.fitScore,
        source: talentAssessments.source,
        createdAt: talentAssessments.createdAt,
      })
      .from(talentAssessments)
      .where(eq(talentAssessments.ownerId, ctx.user!.id))
      .orderBy(desc(talentAssessments.createdAt))
      .limit(20);
    return rows.map((r) => ({ ...r, createdAt: forDisplay(r.createdAt) }));
  }),

  /** 名单（HR 视角）：谁、什么岗、匹配度。按匹配度从高到低——招聘旺季一次面很多人，
     同岗的排在一起，谁最合适一眼看出。 */
  list: adminQuery
    .input((v: unknown) => v as { limit?: number; offset?: number; position?: string })
    .query(async ({ ctx, input }) => {
      const db = getDb();
      const me = ctx.user!;
      const cond =
        me.role === "admin" && me.orgId == null
          ? undefined
          : me.role === "admin"
            ? eq(talentAssessments.orgId, me.orgId as number)
            : or(eq(talentAssessments.ownerId, me.id), me.orgId != null ? eq(talentAssessments.orgId, me.orgId) : undefined);
      const where = and(
        cond,
        isJob(input?.position) ? eq(talentAssessments.position, input.position) : undefined,
      );
      const rows = await db
        .select({
          id: talentAssessments.id,
          candidateName: talentAssessments.candidateName,
          position: talentAssessments.position,
          source: talentAssessments.source,
          completeness: talentAssessments.completeness,
          fitScore: talentAssessments.fitScore,
          createdAt: talentAssessments.createdAt,
        })
        .from(talentAssessments)
        .where(where)
        .orderBy(desc(talentAssessments.fitScore), desc(talentAssessments.createdAt))
        .limit(Math.min(Math.max(input?.limit ?? 50, 1), 100))
        .offset(Math.max(input?.offset ?? 0, 0));
      const total = await db.select({ n: sql<number>`count(*)` }).from(talentAssessments).where(where);
      return {
        rows: rows.map((r) => ({ ...r, createdAt: forDisplay(r.createdAt) })),
        total: Number(total[0]?.n ?? 0),
      };
    }),

  /** 读一份报告。人才评估是后台工具，只对管理员开放；其余一律「没有这份」。 */
  report: adminQuery
    .input((v: unknown) => v as { id?: number })
    .query(async ({ ctx, input }) => {
      const id = Number(input?.id);
      if (!Number.isFinite(id) || id <= 0) badRequest("缺少报告编号");
      const db = getDb();
      const row = (await db.select().from(talentAssessments).where(eq(talentAssessments.id, id)).limit(1))[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "没有这份报告" });
      const me = ctx.user!;
      if (me.role !== "admin" && row.ownerId !== me.id) throw new TRPCError({ code: "FORBIDDEN", message: "没有这份报告" });
      let orgName: string | null = null;
      if (row.orgId != null) {
        const org = (await db.select({ name: organizations.name }).from(organizations).where(eq(organizations.id, row.orgId)).limit(1))[0];
        orgName = org?.name ?? null;
      }
      return { id: row.id, candidateName: row.candidateName, source: row.source, createdAt: forDisplay(row.createdAt), orgName, report: row.report as unknown as TalentReport };
    }),

  /** 删除一条记录（只允许发起人或管理员）。 */
  remove: adminQuery.input((v: unknown) => v as { id?: number }).mutation(async ({ input }) => {
    const id = Number(input?.id);
    if (!Number.isFinite(id) || id <= 0) badRequest("缺少报告编号");
    const db = getDb();
    await db.delete(talentAssessments).where(eq(talentAssessments.id, id));
    return { ok: true as const };
  }),
});
