import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { assessmentResults, studentProfile, type StudentProfile } from "@db/schema";
import {
  MBTI_QUESTIONS,
  DISC_QUESTIONS,
  DISC_PARENT_QUESTIONS,
  E3V37_QUESTIONS,
  E3V37_STAGE_LABEL,
  E3V37_MOTIVATION_OPTIONS,
  E3V37_SCAN_SUBJECTS,
  E3V37_LOSS_REASONS,
  E3V37_SCORE_TRENDS,
  E3V37_LIFE_EVENTS,
  E3V37_OPEN_QUESTIONS,
  E3V37_RATING_COUNT,
  E3V37_LIFE_EVENT_COUNT,
  E3V37P_FAMILY_QUESTIONS,
  E3V37P_COND_OBSERVE,
  E3V37P_MIRROR_QUESTIONS,
  scoreMbti,
  scoreDisc,
  scoreE3V37,
  scoreE3V37Parent,
  e3StageOf,
  type MbtiResult,
  type DiscResult,
  type E3V27Result,
  type E3V37Result,
  type E3V37Stage,
  type E3V37Question,
  type E3V37LifeEvent,
  type E3V37ParentResult,
} from "@contracts/assessments";
import { stageOfGrade } from "@contracts/constants";
import { MULTI_RATINGS, scoreMulti, type MultiResult } from "@contracts/multi";
import { MULTI5_QUESTIONS, scoreMulti5, type Multi5PublicQuestion, type Multi5Result } from "@contracts/multi5";
import { ANCHOR_RATINGS, scoreAnchor, type AnchorResult } from "@contracts/careerAnchor";
import { HOLLAND_RATINGS, scoreHolland, type HollandResult } from "@contracts/holland";
import {
  MENTAL_V2_SECTIONS,
  MENTAL_V2_OPTIONS,
  MENTAL_V2_INTRO,
  MENTAL_V2_QUESTION_COUNT,
  scoreMental,
  type MentalResult,
  type MentalV2Result,
} from "@contracts/mentalHealth";
import { ACADEMIC_SUBJECTS, type AcademicsData } from "@contracts/academics";
import type { E3V27ParentResult } from "@contracts/e3v27Parent";

const kindSchema = z.enum(["mbti", "disc", "e3", "e3parent", "multi", "multi5", "anchor", "holland", "mental", "discparent"]);

/** questions 接口返回：V3.7 学生卷题包。 */
type E3V37QuestionSet = {
  kind: "e3";
  stage: E3V37Stage;
  stageLabel: string;
  /** 70 道评分题（1-5 分）。 */
  ratings: E3V37Question[];
  motivationOptions: typeof E3V37_MOTIVATION_OPTIONS;
  /** 学科快扫科目（按学段）。 */
  scanSubjects: string[];
  lossReasons: typeof E3V37_LOSS_REASONS;
  scoreTrends: typeof E3V37_SCORE_TRENDS;
  /** 8 道生活事件（0-3 分，按学段）。 */
  lifeEvents: E3V37LifeEvent[];
  openQuestions: typeof E3V37_OPEN_QUESTIONS;
};

/** questions 接口返回：V3.7 家长卷。 */
type E3V37ParentQuestionSet = {
  kind: "e3parent";
  studentDone: boolean;
  familyQuestions: typeof E3V37P_FAMILY_QUESTIONS;
  condObserve: typeof E3V37P_COND_OBSERVE;
  mirrorQuestions: typeof E3V37P_MIRROR_QUESTIONS;
};

/** questions 接口返回：家长版 DISC（复用学生 DISC 24 题）。 */
type DiscParentQuestionSet = { kind: "discparent"; questions: typeof DISC_PARENT_QUESTIONS };

/** questions 接口返回：心理健康 V2（PHQ-9 + GAD-7，两段结构 + 引导语 + 四级选项）。 */
type MentalQuestionSet = {
  kind: "mental";
  intro: string;
  options: typeof MENTAL_V2_OPTIONS;
  sections: typeof MENTAL_V2_SECTIONS;
};

type AssessmentQuestions =
  | { kind: "mbti"; questions: typeof MBTI_QUESTIONS }
  | { kind: "disc"; questions: typeof DISC_QUESTIONS }
  | E3V37QuestionSet
  | E3V37ParentQuestionSet
  | DiscParentQuestionSet
  | { kind: "multi"; ratings: typeof MULTI_RATINGS }
  | { kind: "multi5"; questions: Multi5PublicQuestion[] }
  | { kind: "anchor"; ratings: typeof ANCHOR_RATINGS }
  | { kind: "holland"; ratings: typeof HOLLAND_RATINGS }
  | MentalQuestionSet;

/** submit 接口返回。 */
type AssessmentSubmitOutcome =
  | { kind: "mbti"; result: MbtiResult }
  | { kind: "disc"; result: DiscResult }
  | { kind: "e3"; result: E3V37Result }
  | { kind: "e3parent"; result: E3V37ParentResult }
  | { kind: "discparent"; result: DiscResult }
  | { kind: "multi"; result: MultiResult }
  | { kind: "multi5"; result: Multi5Result }
  | { kind: "anchor"; result: AnchorResult }
  | { kind: "holland"; result: HollandResult }
  | { kind: "mental"; result: MentalV2Result };

/** 当前用户的档案；没有则返回 null（前端跳 /welcome）。 */
async function getProfile(userId: number): Promise<StudentProfile | null> {
  const db = getDb();
  const rows = await db.select().from(studentProfile).where(eq(studentProfile.userId, userId)).limit(1);
  return rows[0] ?? null;
}

export const profileRouter = createRouter({
  /** 学生档案（当前用户；无则 null）。 */
  get: authedQuery.query(async ({ ctx }) => {
    return getProfile(ctx.user.id);
  }),

  /** 创建或更新档案基本信息。 */
  setup: authedQuery
    .input(
      z.object({
        name: z.string().min(1).max(64),
        grade: z.string().min(1).max(32),
        school: z.string().max(128).optional(),
        targetSchool: z.string().max(128).optional(),
        dailyMinutes: z.number().int().min(10).max(240),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = getDb();
      const existing = await getProfile(userId);
      const values = {
        name: input.name,
        grade: input.grade,
        school: input.school ?? null,
        targetSchool: input.targetSchool ?? null,
        dailyMinutes: input.dailyMinutes,
      };
      if (existing) {
        await db.update(studentProfile).set(values).where(eq(studentProfile.id, existing.id));
      } else {
        await db.insert(studentProfile).values({ userId, ...values });
      }
      return { ok: true as const };
    }),

  /** 只更新每日可用学习时长。 */
  updateMinutes: authedQuery
    .input(z.object({ dailyMinutes: z.number().int().min(10).max(240) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = getDb();
      const existing = await getProfile(userId);
      if (existing) {
        await db
          .update(studentProfile)
          .set({ dailyMinutes: input.dailyMinutes })
          .where(eq(studentProfile.id, existing.id));
      } else {
        await db.insert(studentProfile).values({ userId, dailyMinutes: input.dailyMinutes });
      }
      return { ok: true as const };
    }),

  /** 保存学科自评与中考目标（各科现状 + 最近大考分 + 目标分）。 */
  saveAcademics: authedQuery
    .input(
      z.object({
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
      const userId = ctx.user.id;
      const db = getDb();
      const data: AcademicsData = { ...input, updatedAt: Date.now() };
      const existing = await getProfile(userId);
      const value = data as unknown as Record<string, unknown>;
      if (existing) {
        await db.update(studentProfile).set({ academics: value }).where(eq(studentProfile.id, existing.id));
      } else {
        await db.insert(studentProfile).values({ userId, academics: value });
      }
      return { ok: true as const };
    }),
});

export const assessmentRouter = createRouter({
  /** 题库（来自 contracts/assessments.ts，前端可预览）。E3 学生卷/家长卷为 V3.7。 */
  questions: authedQuery
    .input(z.object({ kind: kindSchema }))
    .query(
      async ({
        input,
        ctx,
      }): Promise<AssessmentQuestions> => {
      switch (input.kind) {
        case "mbti":
          return { kind: "mbti", questions: MBTI_QUESTIONS };
        case "disc":
          return { kind: "disc", questions: DISC_QUESTIONS };
        case "discparent":
          // 家长版 DISC：家庭/亲子场景 24 题（aType/bType 与学生版逐题一致，计分直接复用 scoreDisc）
          return { kind: "discparent", questions: DISC_PARENT_QUESTIONS };
        case "e3": {
          // V3.7：按学生学段下发对应版本（小学/初中/高中），默认初中版
          const profile = await getProfile(ctx.user.id);
          const stage: E3V37Stage = e3StageOf(stageOfGrade(profile?.grade ?? ""));
          return {
            kind: "e3",
            stage,
            stageLabel: E3V37_STAGE_LABEL[stage],
            ratings: E3V37_QUESTIONS[stage],
            motivationOptions: E3V37_MOTIVATION_OPTIONS,
            scanSubjects: E3V37_SCAN_SUBJECTS[stage],
            lossReasons: E3V37_LOSS_REASONS,
            scoreTrends: E3V37_SCORE_TRENDS,
            lifeEvents: E3V37_LIFE_EVENTS[stage],
            openQuestions: E3V37_OPEN_QUESTIONS,
          };
        }
        case "multi":
          return { kind: "multi", ratings: MULTI_RATINGS };
        case "multi5":
          // 客观题下发时剔除答案字段，客户端不可见
          return { kind: "multi5", questions: MULTI5_QUESTIONS.map(({ answer: _answer, ...q }) => q) };
        case "anchor":
          return { kind: "anchor", ratings: ANCHOR_RATINGS };
        case "holland":
          return { kind: "holland", ratings: HOLLAND_RATINGS };
        case "mental":
          // V2：PHQ-9 + GAD-7 两段式专业量表（三甲医院通用筛查）
          return { kind: "mental", intro: MENTAL_V2_INTRO, options: MENTAL_V2_OPTIONS, sections: MENTAL_V2_SECTIONS };
        case "e3parent": {
          // V3.7 家长卷：三版一致；studentDone 标记孩子是否已完成 e3 诊断（决定能否生成认知对照）
          const db = getDb();
          const e3row = await db
            .select({ answers: assessmentResults.answers })
            .from(assessmentResults)
            .where(eq(assessmentResults.userId, ctx.user.id))
            .orderBy(desc(assessmentResults.createdAt), desc(assessmentResults.id));
          const studentDone = e3row.some((r) => {
            const a = r.answers as { stage?: string } | null;
            return !!a && typeof a === "object" && typeof a.stage === "string";
          });
          return {
            kind: "e3parent",
            studentDone,
            familyQuestions: E3V37P_FAMILY_QUESTIONS,
            condObserve: E3V37P_COND_OBSERVE,
            mirrorQuestions: E3V37P_MIRROR_QUESTIONS,
          };
        }
      }
      },
    ),

  /** 提交测评：计分 → 写 assessmentResults → 同步 studentProfile；三项都完成则 onboarded=true。 */
  submit: authedQuery
    .input(
      z.discriminatedUnion("kind", [
        z.object({
          kind: z.literal("mbti"),
          answers: z.array(z.union([z.literal(0), z.literal(1)])).length(MBTI_QUESTIONS.length),
        }),
        z.object({
          kind: z.literal("disc"),
          answers: z.array(z.union([z.literal(0), z.literal(1)])).length(DISC_QUESTIONS.length),
        }),
        z.object({
          kind: z.literal("e3"),
          answers: z.object({
            stage: z.enum(["primary", "junior", "senior"]),
            ratings: z.array(z.number().int().min(1).max(5)).length(E3V37_RATING_COUNT),
            motivation: z.enum(["A", "B", "C", "D", "E"]),
            subjects: z.array(z.object({
              name: z.string().max(32),
              liking: z.number().int().min(0).max(5),
              mastery: z.number().int().min(0).max(5),
              exam: z.number().int().min(0).max(5),
              lastScore: z.number().min(0).max(750).nullable().optional(),
              fullScore: z.number().min(1).max(750).nullable().optional(),
              rank: z.string().max(40).optional(),
              weakest: z.string().max(200),
            })).max(10),
            lossReasons: z.array(z.string().max(32)).max(8),
            scoreTrend: z.enum(["持续上升", "基本稳定", "波动较大", "持续下滑", ""]),
            lifeEvents: z.array(z.number().int().min(0).max(3)).length(E3V37_LIFE_EVENT_COUNT),
            openAnswers: z.array(z.string().max(2000)).length(E3V37_OPEN_QUESTIONS.length),
          }),
        }),
        z.object({
          kind: z.literal("e3parent"),
          answers: z.object({
            family: z.record(z.string(), z.number().int().min(0).max(8)),
            distractions: z.array(z.number().int().min(0).max(8)).max(8),
            familyChangeNote: z.string().max(200),
            wish: z.string().max(1000),
            condObserve: z.record(z.string(), z.number().int().min(0).max(3)),
            mirror: z.array(z.number().int().min(0).max(5)).length(E3V37P_MIRROR_QUESTIONS.length),
          }),
        }),
        z.object({
          kind: z.literal("discparent"),
          answers: z.object({
            /** 填写人与孩子的关系标签（如「父亲」「母亲」）。 */
            label: z.string().min(1).max(12),
            answers: z.array(z.union([z.literal(0), z.literal(1)])).length(DISC_QUESTIONS.length),
          }),
        }),
        z.object({
          kind: z.literal("multi"),
          answers: z.array(z.number().int().min(1).max(5)).length(MULTI_RATINGS.length),
        }),
        z.object({
          kind: z.literal("multi5"),
          answers: z.array(z.number().int().min(0).max(3)).length(MULTI5_QUESTIONS.length),
        }),
        z.object({
          kind: z.literal("anchor"),
          answers: z.array(z.number().int().min(1).max(5)).length(ANCHOR_RATINGS.length),
        }),
        z.object({
          kind: z.literal("holland"),
          answers: z.array(z.number().int().min(1).max(5)).length(HOLLAND_RATINGS.length),
        }),
        z.object({
          kind: z.literal("mental"),
          // V2：16 题（PHQ-9 九题 + GAD-7 七题），每题 0-3 整数
          answers: z.array(z.number().int().min(0).max(3)).length(MENTAL_V2_QUESTION_COUNT),
        }),
      ]),
    )
    .mutation(
      async ({
        input,
        ctx,
      }): Promise<AssessmentSubmitOutcome> => {
      const userId = ctx.user.id;
      const db = getDb();

      let outcome: AssessmentSubmitOutcome;
      if (input.kind === "e3parent") {
        // 取孩子最近一次 e3 原始作答，计算家长认知对照；仅 V3.7（70 题）作答参与对照，否则传 null
        const [e3row] = await db
          .select({ answers: assessmentResults.answers })
          .from(assessmentResults)
          .where(and(eq(assessmentResults.userId, userId), eq(assessmentResults.kind, "e3")))
          .orderBy(desc(assessmentResults.createdAt), desc(assessmentResults.id))
          .limit(1);
        const ea = e3row?.answers as { stage?: E3V37Stage; ratings?: number[] } | null;
        const ratings = ea && Array.isArray(ea.ratings) && ea.ratings.length === E3V37_RATING_COUNT ? ea.ratings : null;
        const stage = ratings && ea && typeof ea === "object" && (ea.stage === "primary" || ea.stage === "junior" || ea.stage === "senior") ? ea.stage : null;
        const result: E3V37ParentResult = scoreE3V37Parent(input.answers, stage, ratings);
        outcome = { kind: "e3parent", result };
      } else if (input.kind === "discparent") {
        // 家长版 DISC：计分同学生版；存整条 {label, answers}，不同步 profile.disc
        const result: DiscResult = scoreDisc(input.answers.answers);
        outcome = { kind: "discparent", result };
      } else if (input.kind === "mbti") {
        const result: MbtiResult = scoreMbti(input.answers);
        outcome = { kind: "mbti", result };
      } else if (input.kind === "disc") {
        const result: DiscResult = scoreDisc(input.answers);
        outcome = { kind: "disc", result };
      } else if (input.kind === "multi") {
        const result: MultiResult = scoreMulti(input.answers);
        outcome = { kind: "multi", result };
      } else if (input.kind === "multi5") {
        const result: Multi5Result = scoreMulti5(input.answers);
        outcome = { kind: "multi5", result };
      } else if (input.kind === "anchor") {
        const result: AnchorResult = scoreAnchor(input.answers);
        outcome = { kind: "anchor", result };
      } else if (input.kind === "holland") {
        const result: HollandResult = scoreHolland(input.answers);
        outcome = { kind: "holland", result };
      } else if (input.kind === "mental") {
        // V2：PHQ-9 + GAD-7 计分（0-3 × 16 题）
        const result: MentalV2Result = scoreMental(input.answers);
        outcome = { kind: "mental", result };
      } else {
        const result: E3V37Result = scoreE3V37(input.answers);
        outcome = { kind: "e3", result };
      }

      // 存结果 + 原始作答（伴学师可查看答题明细）
      await db.insert(assessmentResults).values({
        userId,
        kind: outcome.kind,
        result: outcome.result as unknown as Record<string, unknown>,
        answers: input.answers as unknown as number[],
      });

      // 同步到档案对应字段；没有档案则先建一条默认档案
      let profile = await getProfile(userId);
      if (!profile) {
        const [{ id }] = await db.insert(studentProfile).values({ userId }).$returningId();
        profile = (await db.query.studentProfile.findFirst({ where: eq(studentProfile.id, id) })) ?? null;
      }
      if (profile) {
        if (outcome.kind === "mbti") {
          await db.update(studentProfile).set({ mbti: outcome.result.type }).where(eq(studentProfile.id, profile.id));
        } else if (outcome.kind === "disc") {
          await db.update(studentProfile).set({ disc: outcome.result.primary }).where(eq(studentProfile.id, profile.id));
        } else if (
          outcome.kind === "multi" ||
          outcome.kind === "multi5" ||
          outcome.kind === "anchor" ||
          outcome.kind === "holland" ||
          outcome.kind === "mental" ||
          outcome.kind === "discparent"
        ) {
          // 多元智能（自评版 / 五项客观题）与职业锚、霍兰德、心理健康、家长版 DISC 均为选做，不同步档案字段、不影响 onboarding
        } else {
          await db
            .update(studentProfile)
            .set({ diagnosis: outcome.result as unknown as Record<string, unknown> })
            .where(eq(studentProfile.id, profile.id));
        }
        // 三项测评都有记录 → 完成 onboarding
        const done = await db
          .select({ kind: assessmentResults.kind })
          .from(assessmentResults)
          .where(eq(assessmentResults.userId, userId));
        const kinds = new Set(done.map((r) => r.kind));
        if (kinds.has("mbti") && kinds.has("disc") && kinds.has("e3")) {
          await db.update(studentProfile).set({ onboarded: true }).where(eq(studentProfile.id, profile.id));
        }
      }
      return outcome;
    }),

  /** 各测评最新一条结果（含原始作答 raw，供答题明细展示）。 */
  latest: authedQuery.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const rows = await db
      .select()
      .from(assessmentResults)
      .where(eq(assessmentResults.userId, userId))
      .orderBy(desc(assessmentResults.createdAt), desc(assessmentResults.id));
    const latest: {
      mbti?: MbtiResult;
      disc?: DiscResult;
      /** 最新一条 e3 结果：V3.7 或 V2.7 legacy（按 result.version 区分："3.7" / "v27"）。 */
      e3?: E3V37Result | E3V27Result;
      /** 最新一条 e3parent 结果：V3.7 或 V2.7 legacy。 */
      e3parent?: E3V37ParentResult | E3V27ParentResult;
      /** 全部家长版 DISC 结果（可多人填写），按时间倒序。 */
      discParents: { label: string; result: DiscResult; createdAt: Date }[];
      multi?: MultiResult;
      multi5?: Multi5Result;
      anchor?: AnchorResult;
      holland?: HollandResult;
      /** 最新一条 mental 结果：V2（PHQ-9+GAD-7）或 V1 legacy（按 result.version==="v2" 区分）。 */
      mental?: MentalV2Result | MentalResult;
      raw: { kind: string; answers: unknown; createdAt: Date }[];
    } = { raw: [], discParents: [] };
    for (const row of rows) {
      if (row.kind === "discparent") {
        // 家长版 DISC 可多次/多人填写，全部收集
        const a = row.answers as { label?: string } | null;
        latest.discParents.push({
          label: a && typeof a.label === "string" && a.label ? a.label : "家长",
          result: row.result as unknown as DiscResult,
          createdAt: row.createdAt,
        });
        latest.raw.push({ kind: row.kind, answers: row.answers ?? null, createdAt: row.createdAt });
        continue;
      }
      const key = row.kind as "mbti" | "disc" | "e3" | "e3parent" | "multi" | "multi5" | "anchor" | "holland" | "mental";
      if (latest[key]) continue;
      if (key === "e3parent") latest.e3parent = row.result as unknown as E3V37ParentResult | E3V27ParentResult;
      else if (key === "mbti") latest.mbti = row.result as unknown as MbtiResult;
      else if (key === "disc") latest.disc = row.result as unknown as DiscResult;
      else if (key === "e3") latest.e3 = row.result as unknown as E3V37Result | E3V27Result;
      else if (key === "multi5") latest.multi5 = row.result as unknown as Multi5Result;
      else if (key === "anchor") latest.anchor = row.result as unknown as AnchorResult;
      else if (key === "holland") latest.holland = row.result as unknown as HollandResult;
      else if (key === "mental") latest.mental = row.result as unknown as MentalV2Result | MentalResult;
      else latest.multi = row.result as unknown as MultiResult;
      latest.raw.push({ kind: row.kind, answers: row.answers ?? null, createdAt: row.createdAt });
      if (latest.mbti && latest.disc && latest.e3 && latest.multi && latest.multi5 && latest.anchor && latest.holland && latest.mental) break;
    }
    return latest;
  }),
});
