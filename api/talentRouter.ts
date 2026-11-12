/**
 * v253 人才测评接口。
 *
 * 四类岗位（销售咨询师 / 教学服务 / 行政 / 管理）共用一套底盘（大五 20 + 价值观 18 +
 * 职场 DISC 24 组 + 特质情商 30），再按岗位加测一套（10—12 题）。一套数据、四张岗位画像——
 * 同一个「目标感强」在销售岗是长处、在行政岗是隐患，所以不做四套题四个分。
 *
 * 两条入口，差别只在「谁发起」：
 *  - 本人登录自测：ownerId = 自己，改岗位重测会新增一条，历史留痕；
 *  - HR 发码、候选人扫码答：码里带着岗位（见 talentCode.ts），提交时落到发起人名下，
 *    候选人全程没有账号态——他不该看到自己的十维分数被怎么用。
 *
 * 出卷时剥离了两样东西：题目的 reverse 标记、DISC 每组词的字母归属、加测选项的分数。
 * 这三样都是答案键，前端拿不到，改请求也改不出高分。
 */
import { TRPCError } from "@trpc/server";
import { and, desc, eq, or, sql } from "drizzle-orm";
import { organizations, talentAssessments, users } from "@db/schema";
import { createRouter, adminQuery, authedQuery, publicQuery, tutorQuery } from "./middleware";
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
  JOB_LABEL,
  JOB_WEIGHTS,
  computeDims,
  scoreBigFive,
  scoreDuty,
  scoreEq,
  scoreValue,
  scoreWorkDisc,
  type JobKey,
} from "@contracts/talent/score";
import { buildTalentReport, JOB_EQ_FOCUS, type TalentReport } from "@contracts/talent/report";

const JOB_KEYS: JobKey[] = ["sales", "service", "admin", "mgmt"];
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

export const talentRouter = createRouter({
  /** 岗位目录 + 题本构成 + 权重表：选岗页与说明页都用这一份，避免前端另抄一份常量。 */
  catalog: publicQuery.query(() => ({
    jobs: JOB_KEYS.map((k) => ({
      key: k,
      label: JOB_LABEL[k],
      blurb: JOB_BLURB[k],
      dutyPack: JOB_DUTY_PACK[k],
      dutyName: DUTY_PACKS[JOB_DUTY_PACK[k]].name,
      dutyMinutes: DUTY_PACKS[JOB_DUTY_PACK[k]].minutes,
      minutes: 24 + DUTY_PACKS[JOB_DUTY_PACK[k]].minutes,
      eqFocus: JOB_EQ_FOCUS[k].map((d) => EQ_DIM_LABEL[d]),
      weights: JOB_WEIGHTS[k],
    })),
    parts: (["bigfive", "value", "discwork", "eq"] as const).map((k) => ({ key: k, ...PART_META[k] })),
    eq: {
      factors: (Object.keys(EQ_FACTOR_LABEL) as (keyof typeof EQ_FACTOR_LABEL)[]).map((f) => ({
        key: f,
        label: EQ_FACTOR_LABEL[f],
        dims: EQ_FACTOR_DIMS[f].map((d) => ({ key: d, label: EQ_DIM_LABEL[d] })),
      })),
    },
    /** 做完要多久：底盘 24 分钟 + 岗位加测 */
    totalMinutes: 24,
  })),

  /** 出卷。只给题面，不给答案键。 */
  paper: publicQuery
    .input((v: unknown) => v as { position?: string })
    .query(({ input }) => {
      const position = isJob(input?.position) ? input.position : "sales";
      const pack = DUTY_PACKS[JOB_DUTY_PACK[position]];
      return {
        position,
        positionLabel: JOB_LABEL[position],
        parts: [
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
          answers?: {
            bigfive?: Record<string, number>;
            value?: Record<string, number>;
            discwork?: { most?: number[]; least?: number[] };
            eq?: Record<string, number>;
            duty?: Record<string, number | string>;
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

      const bigfive = scoreBigFive(bf);
      const value = scoreValue(vv);
      const discwork = scoreWorkDisc({ most: dw.most, least: dw.least });
      const eq = scoreEq(eqa);
      const duty = scoreDuty(JOB_DUTY_PACK[position], du);

      const answered = {
        bigfive: Object.keys(bf).filter((k) => Number.isFinite(bf[k])).length,
        value: Object.keys(vv).filter((k) => Number.isFinite(vv[k])).length,
        discwork: dw.most.filter((m, i) => m != null && dw.least[i] != null && m !== dw.least[i]).length,
        eq: Object.keys(eqa).filter((k) => Number.isFinite(eqa[k])).length,
        duty: duty.answered,
      };

      const { dims, details } = computeDims({ bigfive, value, discwork, dutyScores: duty, answered });

      const name = (input?.name ?? "").trim().slice(0, 32) || (ctx.user?.name ?? "").slice(0, 32) || "未署名";
      const report = buildTalentReport({
        name,
        position,
        generatedAt: new Date().toISOString(),
        parts: { bigfive, value, discwork, eq, duty },
        dims,
        details,
        answered,
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
          fitScore: report.current.score,
          report: report as unknown as Record<string, unknown>,
          answers: { ...answers, answered } as unknown as Record<string, unknown>,
        })
        .$returningId();

      return { id: row.id, report };
    }),

  /** HR / 伴学师出一张邀请码：岗位锁死在码里，7 天内有效。 */
  invite: tutorQuery
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
        inviterName: owner?.name ?? "招聘负责人",
        orgName,
        minutes: 24 + DUTY_PACKS[JOB_DUTY_PACK[decoded.position]].minutes,
      };
    }),

  /** 我的历史（本人自测）。 */
  mine: authedQuery.query(async ({ ctx }) => {
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
    return rows;
  }),

  /** 名单（HR 视角）：谁、什么岗、匹配度。按匹配度从高到低——招聘旺季一次面很多人，
     同岗的排在一起，谁最合适一眼看出。 */
  list: tutorQuery
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
      return { rows, total: Number(total[0]?.n ?? 0) };
    }),

  /** 读一份报告。本人、同机构伴学师、管理员可看；其余一律「没有这份」。 */
  report: authedQuery
    .input((v: unknown) => v as { id?: number })
    .query(async ({ ctx, input }) => {
      const id = Number(input?.id);
      if (!Number.isFinite(id) || id <= 0) badRequest("缺少报告编号");
      const db = getDb();
      const row = (await db.select().from(talentAssessments).where(eq(talentAssessments.id, id)).limit(1))[0];
      if (!row) throw new TRPCError({ code: "NOT_FOUND", message: "没有这份报告" });
      const me = ctx.user!;
      const sameOrg = me.orgId != null && row.orgId === me.orgId;
      const canSee = row.ownerId === me.id || me.role === "admin" || (me.role === "tutor" && sameOrg);
      if (!canSee) throw new TRPCError({ code: "FORBIDDEN", message: "没有这份报告" });
      return { id: row.id, candidateName: row.candidateName, source: row.source, createdAt: row.createdAt, report: row.report as unknown as TalentReport };
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
