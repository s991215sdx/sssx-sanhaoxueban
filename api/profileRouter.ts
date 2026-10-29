import { scryptSync, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { and, desc, eq, gte, inArray } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { academicRecords, assessmentResults, studentProfile, users, inviteChannels, inviteRegistrations, type StudentProfile } from "@db/schema";
import { hashPassword } from "./auth-router";
import { getTutorReportAccess, isMyStudent } from "./tutorAccess";
import {
  MBTI_QUESTIONS,
  DISC_QUESTIONS,
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
  scoreDiscV2,
  DISC_V2_GROUPS,
  DISC_PARENT_V2_GROUPS,
  DISC_V2_GROUP_COUNT,
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
import {
  FAMILY_STUDENT_CONDITION_REFS,
  FAMILY_STUDENT_PACKS,
  buildFamilyStudentProfile,
  e3ScoresOf,
  itemsOf as familyStudentItems,
  type FamilyItem,
  type FamilyConditionRef,
  type FamilyStudentAnswers,
  type FamilyStudentProfile,
} from "@contracts/familyStudent";
import {
  FAMILY_PARENT_PACKS,
  FAMILY_PARENT_SCENE_OPTIONS,
  buildFamilyParentProfile,
  parentItemsOf,
  type FamilyParentAnswers,
  type FamilyParentItem,
  type FamilyParentProfile,
} from "@contracts/familyParent";
import { buildFamilyProfile, type FamilyProfile } from "@contracts/familyProfile";
import { MULTI5_QUESTIONS, MULTI5_COMMON_STAGE, multi5QuestionsFor, scoreMulti5For, toMulti5Public, type Multi5PublicQuestion, type Multi5Result } from "@contracts/multi5";
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
  MENTAL_SDQ_QUESTIONS,
  MENTAL_SDQ_INTRO,
  MENTAL_SDQ_OPTIONS,
  MENTAL_SDQ_QUESTION_COUNT,
  scoreMentalSdq,
  type MentalSdqResult,
  MENTAL_PA_SECTIONS,
  MENTAL_PA_QUESTION_COUNT,
  scoreMentalPa,
  type MentalPaResult,
  SCL90_QUESTIONS,
  MENTAL_SCL90_INTRO,
  SCL90_OPTIONS,
  MENTAL_SCL90_QUESTION_COUNT,
  scoreScl90,
  type Scl90Result,
} from "@contracts/mentalHealth";
import { ACADEMIC_SUBJECTS, type AcademicsData } from "@contracts/academics";
import type { E3V27ParentResult } from "@contracts/e3v27Parent";
import {
  SUBJECT_BANK,
  SUBJECT_ITEM_COUNT,
  mergeSubjectAnswers,
  scoreSubjectAssessment,
  type SubjectAssessmentResult,
} from "@contracts/subjectAssessment";
import {
  SUBJECT4D_BANK,
  SUBJECT4D_DIM_LABEL,
  SUBJECT4D_DIMS,
  SUBJECT4D_OPTIONS,
  SUBJECT4D_SUBJECTS,
  scoreSubject4d,
  type Subject4dResult,
} from "@contracts/subject4d";

const kindSchema = z.enum(["mbti", "disc", "e3", "e3parent", "multi", "multi5", "anchor", "holland", "mental", "mentalsdq", "mentalpa", "scl90", "discparent", "subject", "subject4d", "familystudent", "familyparent"]);

/**
 * 判定这份家庭卷属于完整版还是速测版。
 *
 * 不直接信客户端声明的 pack：完整版里少答几题时，按声明算会把没答的级判成「未测」，
 * 按实际算能判成速测版，报告还能出。以「哪一版每一题都有作答」为准，声明只作优先参考。
 */
function familyPackOf(
  items: Record<string, number>,
  packs: Record<"standard" | "lite", string[]>,
  declared?: "standard" | "lite",
  // v236 修复：场景题（FS14/HP01）的答案走 scene 字段、不在 items 里，
  // 不豁免的话 standard/lite 永远凑不齐，每份提交都会被误判「还有题没答完」
  sceneIds: readonly string[] = [],
): "standard" | "lite" | null {
  const complete = (p: "standard" | "lite") => packs[p].every((id) => items[id] != null || sceneIds.includes(id));
  if (declared && complete(declared)) return declared;
  if (complete("standard")) return "standard";
  if (complete("lite")) return "lite";
  return null;
}

/** 取孩子最近一次 E3 V3.7 的 70 题原始作答（家庭包复用条件域的六个分值用）。 */
async function latestE3Ratings(
  db: ReturnType<typeof getDb>,
  userId: number,
): Promise<number[] | null> {
  const [row] = await db
    .select({ answers: assessmentResults.answers })
    .from(assessmentResults)
    .where(and(eq(assessmentResults.userId, userId), eq(assessmentResults.kind, "e3")))
    .orderBy(desc(assessmentResults.createdAt), desc(assessmentResults.id))
    .limit(1);
  const a = row?.answers as { ratings?: number[] } | null;
  return a && Array.isArray(a.ratings) && a.ratings.length === E3V37_RATING_COUNT ? a.ratings : null;
}


/** questions 接口返回：V3.7 学生卷题包。 */type E3V37QuestionSet = {
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

/** questions 接口返回：DISC V2 强迫选择题包（24 组四词）。 */
type DiscParentQuestionSet = { kind: "discparent"; groups: typeof DISC_PARENT_V2_GROUPS };

/** DISC V2 作答：most/least 各 24 个词下标（0-3），且同组最像≠最不像。 */
const discV2AnswersSchema = z
  .object({
    most: z.array(z.number().int().min(0).max(3)).length(DISC_V2_GROUP_COUNT),
    least: z.array(z.number().int().min(0).max(3)).length(DISC_V2_GROUP_COUNT),
  })
  .refine((a) => a.most.every((m, i) => m !== a.least[i]), { message: "同一组里最像与最不像不能是同一个词" });

/** questions 接口返回：心理健康 V2（PHQ-9 + GAD-7，两段结构 + 引导语 + 四级选项）。 */
type MentalQuestionSet = {
  kind: "mental";
  intro: string;
  options: typeof MENTAL_V2_OPTIONS;
  sections: typeof MENTAL_V2_SECTIONS;
};

/** questions 接口返回：学生版 B（PHQ-A + GAD-7 学生化，结构同 V2）。 */
type MentalPaQuestionSet = {
  kind: "mentalpa";
  intro: string;
  options: typeof MENTAL_V2_OPTIONS;
  sections: typeof MENTAL_PA_SECTIONS;
};

/** questions 接口返回：学生版 A（SDQ 学生自评，25+1 题平铺 + 三级选项）。 */
type MentalSdqQuestionSet = {
  kind: "mentalsdq";
  intro: string;
  options: typeof MENTAL_SDQ_OPTIONS;
  questions: typeof MENTAL_SDQ_QUESTIONS;
};

/** questions 接口返回：深度评估 SCL-90（90 题平铺 + 五级选项）。 */
type Scl90QuestionSet = {
  kind: "scl90";
  intro: string;
  options: typeof SCL90_OPTIONS;
  questions: typeof SCL90_QUESTIONS;
};

type AssessmentQuestions =
  | { kind: "mbti"; questions: typeof MBTI_QUESTIONS }
  | { kind: "disc"; groups: typeof DISC_V2_GROUPS }
  | E3V37QuestionSet
  | E3V37ParentQuestionSet
  | DiscParentQuestionSet
  | { kind: "multi"; ratings: typeof MULTI_RATINGS }
  | { kind: "multi5"; stage?: string; stageLabel?: string; questions: Multi5PublicQuestion[] }
  | { kind: "anchor"; ratings: typeof ANCHOR_RATINGS }
  | { kind: "holland"; ratings: typeof HOLLAND_RATINGS }
  | { kind: "subject"; bank: typeof SUBJECT_BANK }
  | { kind: "subject4d"; subjects: typeof SUBJECT4D_SUBJECTS; dims: typeof SUBJECT4D_DIMS; dimLabel: typeof SUBJECT4D_DIM_LABEL; options: typeof SUBJECT4D_OPTIONS; bank: typeof SUBJECT4D_BANK }
  | MentalQuestionSet
  | MentalPaQuestionSet
  | MentalSdqQuestionSet
  | Scl90QuestionSet
  | { kind: "familystudent"; pack: "standard" | "lite"; items: FamilyItem[]; conditionRefs: FamilyConditionRef[] }
  | { kind: "familyparent"; pack: "standard" | "lite"; items: FamilyParentItem[]; sceneOptions: typeof FAMILY_PARENT_SCENE_OPTIONS };

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
  | { kind: "subject"; result: SubjectAssessmentResult }
  | { kind: "subject4d"; result: Subject4dResult }
  | { kind: "mental"; result: MentalV2Result }
  | { kind: "mentalsdq"; result: MentalSdqResult }
  | { kind: "mentalpa"; result: MentalPaResult }
  | { kind: "scl90"; result: Scl90Result }
  | { kind: "familystudent"; result: FamilyStudentProfile }
  | { kind: "familyparent"; result: FamilyParentProfile };

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

  /** V53：本人修改登录密码（需验证原密码；重置后的默认密码 123456 登录后应先改掉）。 */
  changePassword: authedQuery
    .input(z.object({ oldPassword: z.string().min(1).max(64), newPassword: z.string().min(6).max(64) }))
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      const me = (await db.select().from(users).where(eq(users.id, ctx.user.id)).limit(1))[0];
      if (!me?.passwordHash) throw new Error("当前账号不支持密码登录");
      const [v, salt, hash] = me.passwordHash.split("$");
      const calc = scryptSync(input.oldPassword, salt ?? "", 32);
      const expect = Buffer.from(hash ?? "", "hex");
      const ok = v === "s1" && salt && hash && calc.length === expect.length && timingSafeEqual(calc, expect);
      if (!ok) throw new Error("原密码不对，再想想或联系伴学师重置");
      await db.update(users).set({ passwordHash: hashPassword(input.newPassword) }).where(eq(users.id, ctx.user.id));
      return { ok: true as const };
    }),

  /** V55：家长/学员一键「请伴学师推送报告」——记录请求时间，伴学师在学员卡上看到提醒。 */
  requestReportPush: authedQuery.mutation(async ({ ctx }) => {
    const db = getDb();
    const userId = ctx.user.id;
    const existing = await getProfile(userId);
    const now = new Date();
    if (existing) {
      await db.update(studentProfile).set({ reportPushRequestedAt: now }).where(eq(studentProfile.id, existing.id));
    } else {
      await db.insert(studentProfile).values({ userId, reportPushRequestedAt: now });
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
      /* V72：成绩多次记录——只要这次保存里有任何一科填了「最近分」，就追加一条历史（曲线图数据源）。
         只改目标分/自评、没填分数的不产生记录，避免把编辑误当一次新考试。 */
      const hasAnyScore = input.subjects.some((s) => s.lastScore != null);
      if (hasAnyScore) {
        await db.insert(academicRecords).values({
          userId,
          examName: input.examName ?? "",
          subjects: input.subjects as unknown as Record<string, unknown>[],
        });
      }
      return { ok: true as const };
    }),

  /** V72：成绩历史（新→旧），成绩变化曲线数据源。 */
  academicRecords: authedQuery.query(async ({ ctx }) => {
    const db = getDb();
    const rows = await db
      .select()
      .from(academicRecords)
      .where(eq(academicRecords.userId, ctx.user.id))
      .orderBy(desc(academicRecords.id))
      .limit(50);
    return rows.map((r) => ({
      id: r.id,
      examName: r.examName,
      subjects: (r.subjects ?? []) as {
        name: string;
        selfLevel: number | null;
        fullScore: number | null;
        lastScore: number | null;
        targetScore: number | null;
      }[],
      createdAt: r.createdAt,
    }));
  }),
});

export const assessmentRouter = createRouter({
  /** 题库（来自 contracts/assessments.ts，前端可预览）。E3 学生卷/家长卷为 V3.7。 */
  questions: authedQuery
    .input(z.object({ kind: kindSchema, pack: z.enum(["standard", "lite"]).optional() }))
    .query(
      async ({
        input,
        ctx,
      }): Promise<AssessmentQuestions> => {
      switch (input.kind) {
        case "mbti":
          return { kind: "mbti", questions: MBTI_QUESTIONS };
        case "disc":
          // V2 强迫选择：24 组四词（最像/最不像）
          return { kind: "disc", groups: DISC_V2_GROUPS };
        case "discparent":
          // 家长版 V2：家庭/亲子场景词组（维度映射与学生版逐组一致，计分复用 scoreDiscV2）
          return { kind: "discparent", groups: DISC_PARENT_V2_GROUPS };
        case "familystudent": {
          // v235：学生侧家庭补充包（独立于 e3，14 道新题 + 6 条条件引用）
          // v236：支持 pack=standard|lite（速测版 9 题），默认完整版
          const pack = input.pack ?? "standard";
          return {
            kind: "familystudent",
            pack,
            items: familyStudentItems(pack),
            conditionRefs: FAMILY_STUDENT_CONDITION_REFS,
          };
        }
        case "familyparent": {
          // v235：家长侧家庭卷（29 题：台阶/管教/情感对照/投入/自身/场景）
          const pack = input.pack ?? "standard";
          return {
            kind: "familyparent",
            pack,
            items: parentItemsOf(pack),
            sceneOptions: FAMILY_PARENT_SCENE_OPTIONS,
          };
        }
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
        case "multi5": {
          // v233：统一通用版卷（不依赖学科知识，各学段同卷通用）；客观题剔除答案并附加「这题我不会」选项
          return {
            kind: "multi5",
            stage: MULTI5_COMMON_STAGE,
            stageLabel: "通用版",
            questions: multi5QuestionsFor(MULTI5_COMMON_STAGE).map(toMulti5Public),
          };
        }
        case "anchor":
          return { kind: "anchor", ratings: ANCHOR_RATINGS };
        case "holland":
          return { kind: "holland", ratings: HOLLAND_RATINGS };
        case "subject":
          // 学科能力测评：9 科自评题库（学生端自选科目作答）
          return { kind: "subject", bank: SUBJECT_BANK };
        case "subject4d":
          // V175 学科四维测评：9 科 × 4 维 × 3 题李克特量表（智慧生涯报告数据源）
          return {
            kind: "subject4d",
            subjects: SUBJECT4D_SUBJECTS,
            dims: SUBJECT4D_DIMS,
            dimLabel: SUBJECT4D_DIM_LABEL,
            options: SUBJECT4D_OPTIONS,
            bank: SUBJECT4D_BANK,
          };
        case "mental":
          // 通用版：PHQ-9 + GAD-7 两段式量表（国际通用筛查工具）
          return { kind: "mental", intro: MENTAL_V2_INTRO, options: MENTAL_V2_OPTIONS, sections: MENTAL_V2_SECTIONS };
        case "mentalpa":
          // 学生版 B：PHQ-A + GAD-7 学生化措辞（结构同通用版）
          return { kind: "mentalpa", intro: MENTAL_V2_INTRO, options: MENTAL_V2_OPTIONS, sections: MENTAL_PA_SECTIONS };
        case "mentalsdq":
          // 学生版 A：SDQ 学生自评（25 题 + 1 条安全预警题，平铺）
          return { kind: "mentalsdq", intro: MENTAL_SDQ_INTRO, options: MENTAL_SDQ_OPTIONS, questions: MENTAL_SDQ_QUESTIONS };
        case "scl90":
          // 深度评估：SCL-90 症状自评（90 题，5 级评分）
          return { kind: "scl90", intro: MENTAL_SCL90_INTRO, options: SCL90_OPTIONS, questions: SCL90_QUESTIONS };
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
          // V2 强迫选择作答；兼容旧版二选一（升级期间在途会话）
          answers: z.union([z.array(z.union([z.literal(0), z.literal(1)])).length(DISC_QUESTIONS.length), discV2AnswersSchema]),
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
            answers: z.union([z.array(z.union([z.literal(0), z.literal(1)])).length(DISC_QUESTIONS.length), discV2AnswersSchema]),
          }),
        }),
        z.object({
          kind: z.literal("multi"),
          answers: z.array(z.number().int().min(1).max(5)).length(MULTI_RATINGS.length),
        }),
        z.object({
          kind: z.literal("multi5"),
          // v233：第 5 个选项「这题我不会」= 下标 4
          answers: z.array(z.number().int().min(0).max(4)).length(MULTI5_QUESTIONS.length),
          // v234：逐题作答用时（秒），用于时间系数加权；旧客户端不传则不扣时间分
          times: z.array(z.number().min(0).max(3600)).length(MULTI5_QUESTIONS.length).optional(),
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
          // 通用版：16 题（PHQ-9 九题 + GAD-7 七题），每题 0-3 整数
          answers: z.array(z.number().int().min(0).max(3)).length(MENTAL_V2_QUESTION_COUNT),
        }),
        z.object({
          kind: z.literal("mentalpa"),
          // 学生版 B：16 题（PHQ-A 九题 + GAD-7 学生化七题），每题 0-3 整数
          answers: z.array(z.number().int().min(0).max(3)).length(MENTAL_PA_QUESTION_COUNT),
        }),
        z.object({
          kind: z.literal("mentalsdq"),
          // 学生版 A：SDQ 25 题 + 1 条安全预警题，每题 0-2 整数
          answers: z.array(z.number().int().min(0).max(2)).length(MENTAL_SDQ_QUESTION_COUNT),
        }),
        z.object({
          kind: z.literal("scl90"),
          // 深度评估 SCL-90：90 题，每题 1-5 整数（1 没有 … 5 严重）
          answers: z.array(z.number().int().min(1).max(5)).length(MENTAL_SCL90_QUESTION_COUNT),
        }),
        z.object({
          kind: z.literal("subject"),
          // 学科能力测评：key=科目名，value=该科每题 1-5 分（长度须与题库一致，至少 1 科）
          answers: z
            .record(z.string(), z.array(z.number().int().min(1).max(5)))
            .refine((r) => Object.keys(r).length >= 1, { message: "至少完成 1 个学科" })
            .refine((r) => Object.entries(r).every(([name, vals]) => {
              const n = (SUBJECT_ITEM_COUNT as Record<string, number>)[name];
              return n != null && vals.length === n;
            }), { message: "学科或答案数量与题库不符" }),
        }),
        z.object({
          kind: z.literal("subject4d"),
          // V175 学科四维测评：key=科目名，value=12 个选项索引（0-4，与题库顺序一致），须 9 科全答
          answers: z
            .record(z.string(), z.array(z.number().int().min(0).max(4)))
            .refine((r) => Object.keys(r).length === 9, { message: "需完成全部 9 个学科" })
            .refine((r) => Object.entries(r).every(([name, vals]) => {
              const n = (SUBJECT4D_BANK as Record<string, unknown[]>)[name];
              return n != null && vals.length === n.length;
            }), { message: "学科或答案数量与题库不符" }),
        }),
        z.object({
          kind: z.literal("familystudent"),
          // v235 学生侧家庭补充包：items 为 FS01—FS14 的作答（五点 1—5；FS09 为 0—10 打分）
          // condition 是包内自带的六道条件题（答过 E3 的孩子不答这六题，改由后端按 srcNo 复用）
          answers: z.object({
            pack: z.enum(["standard", "lite"]).optional(),
            items: z.record(z.string(), z.number().int().min(0).max(10)),
            scene: z.string().max(16).nullable().optional(),
            condition: z.record(z.string(), z.number().int().min(1).max(5)).optional(),
          }),
        }),
        z.object({
          kind: z.literal("familyparent"),
          // v235 家长侧家庭卷：家长家庭卷多人可填，每次都存一条（同 discparent 的做法）
          answers: z.object({
            pack: z.enum(["standard", "lite"]).optional(),
            respondent: z.enum(["dad", "mom", "other"]),
            label: z.string().max(12).optional(),
            items: z.record(z.string(), z.number().int().min(0).max(5)),
            scene: z.string().max(16).nullable().optional(),
          }),
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

      /* v220 学校版心理测评合规：校园生每学年（9月1日起算）每套心理量表仅测一次，
       * 防止重复筛查刷数据；复测需求由老师线下评估后处理。 */
      if (input.kind === "mental" || input.kind === "mentalsdq" || input.kind === "mentalpa" || input.kind === "scl90") {
        const [reg] = await db
          .select({ channelId: inviteRegistrations.channelId })
          .from(inviteRegistrations)
          .where(eq(inviteRegistrations.userId, userId))
          .orderBy(desc(inviteRegistrations.id))
          .limit(1);
        if (reg) {
          const [ch] = await db
            .select({ campus: inviteChannels.campus })
            .from(inviteChannels)
            .where(eq(inviteChannels.id, reg.channelId))
            .limit(1);
          if (ch?.campus) {
            const now = new Date();
            const y = now.getMonth() >= 8 ? now.getFullYear() : now.getFullYear() - 1;
            const yearStart = new Date(y, 8, 1); // 本学年 9月1日
            const prev = await db
              .select({ id: assessmentResults.id })
              .from(assessmentResults)
              .where(
                and(
                  eq(assessmentResults.userId, userId),
                  eq(assessmentResults.kind, input.kind),
                  gte(assessmentResults.createdAt, yearStart),
                ),
              )
              .limit(1);
            if (prev.length) {
              throw new TRPCError({
                code: "BAD_REQUEST",
                message: "本学年已完成该心理筛查（每学年一次）。如确需复测，请联系老师评估后处理。",
              });
            }
          }
        }
      }

      let outcome: AssessmentSubmitOutcome;
      let mergedSubjectAnswers: Record<string, number[]> | undefined; /* v81 学科累计作答（存库用） */
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
        // 家长版 DISC：V2 用词组维度映射计分；旧版数组作答兼容；存整条 {label, answers}，不同步 profile.disc
        const a = input.answers.answers;
        const result: DiscResult = Array.isArray(a) ? scoreDisc(a) : scoreDiscV2(a, DISC_PARENT_V2_GROUPS);
        outcome = { kind: "discparent", result };
      } else if (input.kind === "mbti") {
        const result: MbtiResult = scoreMbti(input.answers);
        outcome = { kind: "mbti", result };
      } else if (input.kind === "disc") {
        const result: DiscResult = Array.isArray(input.answers) ? scoreDisc(input.answers) : scoreDiscV2(input.answers);
        outcome = { kind: "disc", result };
      } else if (input.kind === "multi") {
        const result: MultiResult = scoreMulti(input.answers);
        outcome = { kind: "multi", result };
      } else if (input.kind === "multi5") {
        // v233：通用版卷统一计分；原始作答包一层版本存储（e3 的 { stage, ratings } 同款做法），供答题明细/打印还原对应题库
        // v234：逐题作答秒数一并存入并参与计分（答对题按时间系数加权，无计时按系数 1）
        const stage = MULTI5_COMMON_STAGE;
        const result: Multi5Result = scoreMulti5For(stage, input.answers, input.times);
        outcome = { kind: "multi5", result };
        input = { ...input, answers: { stage, picks: input.answers, times: input.times } as unknown as number[] };
      } else if (input.kind === "anchor") {
        const result: AnchorResult = scoreAnchor(input.answers);
        outcome = { kind: "anchor", result };
      } else if (input.kind === "holland") {
        const result: HollandResult = scoreHolland(input.answers);
        outcome = { kind: "holland", result };
      } else if (input.kind === "mental") {
        // 通用版：PHQ-9 + GAD-7 计分（0-3 × 16 题）
        const result: MentalV2Result = scoreMental(input.answers);
        outcome = { kind: "mental", result };
      } else if (input.kind === "mentalpa") {
        // 学生版 B：PHQ-A + GAD-7 学生化（算法同通用版）
        const result: MentalPaResult = scoreMentalPa(input.answers);
        outcome = { kind: "mentalpa", result };
      } else if (input.kind === "mentalsdq") {
        // 学生版 A：SDQ 学生自评（0-2 × 26 题，末题为安全预警不计分）
        const result: MentalSdqResult = scoreMentalSdq(input.answers);
        outcome = { kind: "mentalsdq", result };
      } else if (input.kind === "scl90") {
        // 深度评估 SCL-90：90 题 1-5 级评分，10 因子 + 中国常模筛选口径
        const result: Scl90Result = scoreScl90(input.answers);
        outcome = { kind: "scl90", result };
      } else if (input.kind === "subject") {
        // 学科能力测评：9 科听懂/记住/运用(+特定)环节自评
        // v81 累计口径：与上一次学科作答合并（新测的同科目覆盖、未测的保留），
        // 避免「再测一科就把之前测过的覆盖没了」——支持分次测完 9 科
        const [prevRow] = await db
          .select({ answers: assessmentResults.answers })
          .from(assessmentResults)
          .where(and(eq(assessmentResults.userId, userId), eq(assessmentResults.kind, "subject")))
          .orderBy(desc(assessmentResults.createdAt), desc(assessmentResults.id))
          .limit(1);
        const prev = (prevRow?.answers ?? null) as Record<string, number[]> | null;
        const merged = mergeSubjectAnswers(prev, input.answers);
        mergedSubjectAnswers = merged;
        const result: SubjectAssessmentResult = scoreSubjectAssessment(merged);
        outcome = { kind: "subject", result };
      } else if (input.kind === "subject4d") {
        // V175 学科四维测评：四维计分 + 学科潜力指数
        const result: Subject4dResult = scoreSubject4d(input.answers);
        outcome = { kind: "subject4d", result };
      } else if (input.kind === "familystudent") {
        // v236：学生侧家庭补充包计分
        // 条件域优先复用孩子最近一次 E3 的 6 个分值——做过诊断的孩子不重答这 6 题
        const a = input.answers;
        const pack = familyPackOf(a.items, FAMILY_STUDENT_PACKS, a.pack, ["FS14"]);
        if (!pack) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "还有题没答完，翻回去补齐再提交。" });
        }
        const ratings = await latestE3Ratings(db, userId);
        const e3Scores = e3ScoresOf(ratings);
        const payload: FamilyStudentAnswers = {
          items: a.items,
          scene: (a.scene ?? null) as FamilyStudentAnswers["scene"],
          condition: a.condition,
          e3Scores: Object.keys(e3Scores).length ? e3Scores : undefined,
        };
        const result = buildFamilyStudentProfile(payload);
        outcome = { kind: "familystudent", result };
        // 存库：pack 与原始分一并留下，答题明细/复算都要用
        input = { ...input, answers: { ...a, pack } as unknown as typeof input.answers };
      } else if (input.kind === "familyparent") {
        // v236：家长侧家庭卷计分（同 discparent，多位家长各存一条）
        const a = input.answers;
        const pack = familyPackOf(a.items, FAMILY_PARENT_PACKS, a.pack, ["HP01"]);
        if (!pack) {
          throw new TRPCError({ code: "BAD_REQUEST", message: "还有题没答完，翻回去补齐再提交。" });
        }
        const payload: FamilyParentAnswers = {
          items: a.items,
          scene: a.scene ?? null,
          respondent: a.respondent,
        };
        const result = buildFamilyParentProfile(payload);
        outcome = { kind: "familyparent", result };
        input = { ...input, answers: { ...a, pack } as unknown as typeof input.answers };
      } else {
        const result: E3V37Result = scoreE3V37(input.answers);
        outcome = { kind: "e3", result };
      }

      // 存结果 + 原始作答（伴学师可查看答题明细）；学科测评存累计合并后的作答
      await db.insert(assessmentResults).values({
        userId,
        kind: outcome.kind,
        result: outcome.result as unknown as Record<string, unknown>,
        answers: (outcome.kind === "subject" ? mergedSubjectAnswers : input.answers) as unknown as number[],
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
          outcome.kind === "mentalsdq" ||
          outcome.kind === "mentalpa" ||
          outcome.kind === "scl90" ||
          outcome.kind === "discparent" ||
          outcome.kind === "subject" ||
          outcome.kind === "subject4d" ||
          outcome.kind === "familystudent" ||
          outcome.kind === "familyparent"
        ) {
          // 多元智能（自评版 / 五项客观题）与职业锚、霍兰德、心理健康（四套）、家长版 DISC、
          // 家庭关系测评（学生卷 / 家长卷）均为选做，不同步档案字段、不影响 onboarding
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
      /** 最新一条学生侧家庭补充包结果（v236）。 */
      familyStudent?: FamilyStudentProfile;
      /** 全部家长侧家庭卷结果（爸爸/妈妈/其他可各填一份），按时间倒序。 */
      familyParents: { label: string; respondent: string; result: FamilyParentProfile; createdAt: Date }[];
      multi?: MultiResult;
      multi5?: Multi5Result;
      anchor?: AnchorResult;
      holland?: HollandResult;
      /** 最新一条 mental 结果：V2 通用版（PHQ-9+GAD-7）或 V1 legacy（按 result.version==="v2" 区分）。 */
      mental?: MentalV2Result | MentalResult;
      /** 最新一条 mentalsdq 结果：学生版 A（SDQ 学生自评）。 */
      mentalSdq?: MentalSdqResult;
      /** 最新一条 mentalpa 结果：学生版 B（PHQ-A + GAD-7 标准版）。 */
      mentalPa?: MentalPaResult;
      /** 最新一条 scl90 结果：深度评估（SCL-90 症状自评，10 因子）。 */
      mentalScl90?: Scl90Result;
      /** 最新一条学科能力测评结果（9 科听懂/记住/运用自评）。 */
      subject?: SubjectAssessmentResult;
      /** 最新一条学科四维测评结果（V175 智慧生涯数据源）。 */
      subject4d?: Subject4dResult;
      raw: { kind: string; answers: unknown; createdAt: Date }[];
    } = { raw: [], discParents: [], familyParents: [] };
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
      if (row.kind === "familyparent") {
        // 家长侧家庭卷与 discparent 同理：可多人各填一份，全部收集
        const a = row.answers as { label?: string; respondent?: string } | null;
        latest.familyParents.push({
          label: a && typeof a.label === "string" && a.label ? a.label : "家长",
          respondent: a?.respondent ?? "other",
          result: row.result as unknown as FamilyParentProfile,
          createdAt: row.createdAt,
        });
        latest.raw.push({ kind: row.kind, answers: row.answers ?? null, createdAt: row.createdAt });
        continue;
      }
      if (row.kind === "familystudent") {
        // 学生侧只留最新一份（rows 已按时间倒序）
        if (!latest.familyStudent) latest.familyStudent = row.result as unknown as FamilyStudentProfile;
        latest.raw.push({ kind: row.kind, answers: row.answers ?? null, createdAt: row.createdAt });
        continue;
      }
      const key = row.kind as "mbti" | "disc" | "e3" | "e3parent" | "multi" | "multi5" | "anchor" | "holland" | "mental" | "mentalsdq" | "mentalpa" | "scl90" | "subject" | "subject4d";
      if (key === "mentalsdq" ? latest.mentalSdq : key === "mentalpa" ? latest.mentalPa : key === "scl90" ? latest.mentalScl90 : key === "subject" ? latest.subject : key === "subject4d" ? latest.subject4d : latest[key]) continue;
      if (key === "e3parent") latest.e3parent = row.result as unknown as E3V37ParentResult | E3V27ParentResult;
      else if (key === "mbti") latest.mbti = row.result as unknown as MbtiResult;
      else if (key === "disc") latest.disc = row.result as unknown as DiscResult;
      else if (key === "e3") latest.e3 = row.result as unknown as E3V37Result | E3V27Result;
      else if (key === "multi5") latest.multi5 = row.result as unknown as Multi5Result;
      else if (key === "anchor") latest.anchor = row.result as unknown as AnchorResult;
      else if (key === "holland") latest.holland = row.result as unknown as HollandResult;
      else if (key === "mental") latest.mental = row.result as unknown as MentalV2Result | MentalResult;
      else if (key === "mentalsdq") latest.mentalSdq = row.result as unknown as MentalSdqResult;
      else if (key === "mentalpa") latest.mentalPa = row.result as unknown as MentalPaResult;
      else if (key === "scl90") latest.mentalScl90 = row.result as unknown as Scl90Result;
      else if (key === "subject") latest.subject = row.result as unknown as SubjectAssessmentResult;
      else if (key === "subject4d") latest.subject4d = row.result as unknown as Subject4dResult;
      else latest.multi = row.result as unknown as MultiResult;
      latest.raw.push({ kind: row.kind, answers: row.answers ?? null, createdAt: row.createdAt });
      if (latest.mbti && latest.disc && latest.e3 && latest.multi && latest.multi5 && latest.anchor && latest.holland && latest.mental) break;
    }
    return latest;
  }),

  /**
   * v236 家庭教育测评聚合取数：台阶合并（取低）／盲区六对配对／加固-修复分支／场景比对。
   *
   * 报告层只认这一个接口：两边都没测就返回全空，测了一边就出单方判断（标 singleSide），
   * 不在这里补任何默认值——报告宁可少一页，也不能拿默认数糊一页。
   */
  family: authedQuery
    .input(z.object({ userId: z.number().int().positive().optional() }).optional())
    .query(async ({ ctx, input }) => {
    const db = getDb();
    /* 学生看自己；伴学师/管理员看学员时传 userId，要有该学员的报告查看权限 */
    const userId = input?.userId ?? ctx.user.id;
    if (userId !== ctx.user.id) {
      const allowed =
        ctx.user.role === "admin" ||
        ((await isMyStudent(db, ctx.user.id, userId)) &&
          (await getTutorReportAccess(db, ctx.user.id, userId)).allowed);
      if (!allowed) {
        throw new TRPCError({ code: "FORBIDDEN", message: "没有查看该学员报告的权限" });
      }
    }
    const rows = await db
      .select({
        kind: assessmentResults.kind,
        result: assessmentResults.result,
        answers: assessmentResults.answers,
        createdAt: assessmentResults.createdAt,
      })
      .from(assessmentResults)
      .where(
        and(
          eq(assessmentResults.userId, userId),
          inArray(assessmentResults.kind, ["familystudent", "familyparent"]),
        ),
      )
      .orderBy(desc(assessmentResults.createdAt), desc(assessmentResults.id));

    const sRow = rows.find((r) => r.kind === "familystudent") ?? null;
    const sAnswers = sRow?.answers as { items?: Record<string, number>; pack?: string } | null;
    const student = (sRow?.result ?? null) as FamilyStudentProfile | null;
    const studentItems = sAnswers?.items ?? {};

    const parents = rows
      .filter((r) => r.kind === "familyparent")
      .map((r) => {
        const a = r.answers as { label?: string; respondent?: string; pack?: string } | null;
        return {
          label: a?.label ?? "家长",
          respondent: (a?.respondent ?? "other") as "dad" | "mom" | "other",
          pack: a?.pack === "lite" ? ("lite" as const) : ("standard" as const),
          profile: r.result as unknown as FamilyParentProfile,
          createdAt: r.createdAt,
        };
      });

    const me = await getProfile(userId);
    /* 寄宿家庭每周可相处时间本就少，台阶阈值整体放宽 0.4（见 contracts/familyProfile.ts） */
    const boarding = me?.boarding === "board";
    const parent = parents[0]?.profile ?? null;
    const merged: FamilyProfile | null =
      student && parent ? buildFamilyProfile({ student, parent, studentItems, boarding }) : null;

    return {
      student,
      parent,
      parents,
      merged,
      boarding,
      studentPack: sAnswers?.pack === "lite" ? ("lite" as const) : ("standard" as const),
      /** 报告缺哪一块：前端据此撤页或灰显，不拿默认值凑。 */
      has: {
        student: !!student,
        parent: !!parent,
        /** 两侧都答到才谈得上「对照」，单方只出自己那一侧。 */
        pair: !!student && !!parent,
      },
    };
    }),
});
