import { z } from "zod";
import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  dailyPlans,
  errorLogs,
  knowledgePoints,
  moodEntries,
  reviewItems,
  studentProfile,
  type PlanItemSeed,
} from "@db/schema";
import { dayStr, getKpIndex, getMasteryMap, scopeKpsToUserGrade } from "./helpers";

/** 学生每天可用学习时长（默认 45 分钟）。 */
async function getDailyMinutes(userId: number): Promise<number> {
  const db = getDb();
  const profile = await db.query.studentProfile.findFirst({ where: eq(studentProfile.userId, userId) });
  return profile?.dailyMinutes ?? 45;
}

/** 今日心情均值（直接查 moodEntries，供降载判断；与 treehole 统计口径一致）。 */
async function getTodayMoodAvg(userId: number): Promise<number | null> {
  const db = getDb();
  const since = new Date(Date.now() + 8 * 3600 * 1000 - 2 * 86400 * 1000);
  const rows = await db
    .select({ mood: moodEntries.mood, createdAt: moodEntries.createdAt })
    .from(moodEntries)
    .where(and(eq(moodEntries.userId, userId), gte(moodEntries.createdAt, since)));
  const today = dayStr();
  const todays = rows.filter(
    (r) => new Date(r.createdAt.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10) === today,
  );
  if (todays.length === 0) return null;
  return todays.reduce((s, r) => s + r.mood, 0) / todays.length;
}

/** 分段学习建议：攻坚区多或心情低时用更短的专注段。纯函数。 */
function sessionAdvice(minutes: number, band3Count: number, lowMood: boolean) {
  let sessionMinutes = 25;
  let breakMinutes = 5;
  if (band3Count >= 2 || lowMood) {
    sessionMinutes = 20; // 攻坚题耗神/状态差 → 短段多歇
  } else if (minutes <= 30) {
    sessionMinutes = 30;
    breakMinutes = 10; // 任务轻，一段就够
  }
  const sessions = Math.max(1, Math.ceil(minutes / sessionMinutes));
  return { sessionMinutes, breakMinutes, sessions };
}

/** 当前用户到期未做的复习项（reviewItems 无 userId 列，须经用户错题 id 过滤）。 */
async function dueReviewRows(userId: number, today: string) {
  const db = getDb();
  const myErrs = await db.select({ id: errorLogs.id }).from(errorLogs).where(eq(errorLogs.userId, userId));
  const myErrIds = myErrs.map((e) => e.id);
  if (myErrIds.length === 0) return [];
  return db
    .select()
    .from(reviewItems)
    .where(and(eq(reviewItems.done, false), lte(reviewItems.dueDate, today), inArray(reviewItems.errorLogId, myErrIds)))
    .orderBy(asc(reviewItems.dueDate));
}

export const planRouter = createRouter({
  /**
   * 学习时长规划建议：基于查漏情况（到期复习数、三提分区间错题数、薄弱新课、心情）
   * 推算「今天建议学多久 + 每次学多久（分段节奏）」，并给出可解释的理由。
   */
  suggest: authedQuery.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const today = dayStr();
    const [due, activeErrors, kps, masteryMap, moodAvg] = await Promise.all([
      dueReviewRows(userId, today),
      db.select().from(errorLogs).where(and(eq(errorLogs.userId, userId), eq(errorLogs.status, "active"))),
      db.select().from(knowledgePoints).orderBy(asc(knowledgePoints.sortOrder)),
      getMasteryMap(userId),
      getTodayMoodAvg(userId),
    ]);
    const activeIds = new Set(activeErrors.map((e) => e.id));
    const dueCount = new Set(due.map((d) => d.errorLogId).filter((id) => activeIds.has(id))).size;
    const band1 = activeErrors.filter((e) => e.band === 1).length;
    const band2 = activeErrors.filter((e) => e.band === 2).length;
    const band3 = activeErrors.filter((e) => e.band === 3).length;
    // 只统计有深度内容的 KP：骨架占位的 0 分不算薄弱；多学科多年级后只看本年级
    const gradeKps = await scopeKpsToUserGrade(userId, kps);
    const hasWeakKp = gradeKps.some(
      (k) => Array.isArray(k.summary) && k.summary.length > 0 && (masteryMap.get(k.id) ?? 0) < 60,
    );
    const lowMood = moodAvg !== null && moodAvg <= 2;

    // 估算今日建议总时长：到期复习 4min/题 + 送分区 6min/题 + 提分区 10min/题（最多计 4 题）
    // + 有攻坚区至少留 15 分钟 + 有薄弱新课留 15 分钟预习
    let raw = dueCount * 4 + band1 * 6 + Math.min(band2, 4) * 10 + (band3 > 0 ? 15 : 0) + (hasWeakKp ? 15 : 0);
    if (lowMood) raw = Math.round(raw * 0.8);
    let suggestedMinutes = Math.min(120, Math.max(20, Math.round(raw / 5) * 5));
    if (raw === 0) suggestedMinutes = 25; // 没有欠债：一段轻松预习

    const { sessionMinutes, breakMinutes, sessions } = sessionAdvice(suggestedMinutes, band3, lowMood);

    const reasons: string[] = [];
    if (dueCount > 0) reasons.push(`今天有 ${dueCount} 道到期复习题（约 ${dueCount * 4} 分钟），不清掉会越积越多。`);
    if (band1 > 0) reasons.push(`送分区（会了但错）还有 ${band1} 题，每题约 6 分钟就能拿回本该属于你的分。`);
    if (band2 > 0) reasons.push(`提分区（讲一遍就会）还有 ${band2} 题，建议攻 ${Math.min(band2, 4)} 题，每题约 10 分钟。`);
    if (band3 > 0) reasons.push(`攻坚区（讲了也不会）有 ${band3} 题，至少需要留 15 分钟回到根因知识点深练。`);
    if (hasWeakKp) reasons.push("还有掌握度不足 60 的新课知识点，留 15 分钟预习，明天听课更省力。");
    if (lowMood) reasons.push("你今天心情不太好，总时长已自动减量 20%，先照顾好自己。");
    if (reasons.length === 0) reasons.push("今天没有学习欠债，轻松学一段保持手感就好。");
    reasons.push(
      `建议分 ${sessions} 段进行，每段专注 ${sessionMinutes} 分钟、段间休息 ${breakMinutes} 分钟——短暂休息时大脑会把刚学的内容「存档」，比一口气学到底记得更牢。`,
    );

    return {
      suggestedMinutes,
      sessionMinutes,
      breakMinutes,
      sessions,
      reasons,
      load: { due: dueCount, band1, band2, band3 },
      moodAvg,
    };
  }),

  /** 今天的计划 + 可用时长（默认取档案 dailyMinutes，无档案则 45）。 */
  today: authedQuery.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const [plan, minutes] = await Promise.all([
      db.query.dailyPlans.findFirst({ where: and(eq(dailyPlans.userId, userId), eq(dailyPlans.date, dayStr())) }),
      getDailyMinutes(userId),
    ]);
    return { plan: plan ?? null, minutes };
  }),

  /**
   * 规划引擎（确定性、可解释）：固定顺序填充，预算用完即止。
   * ① 到期复习 4min/题（band3 优先）→ ② 送分区 6min/题 → ③ 预习 15min
   * → ④ 提分区 10min/题、攻坚区 15min/题（预算 <60 不排攻坚）→ ⑤ 心情 ≤2 降载 20% 并加休息项。
   */
  generate: authedQuery
    .input(z.object({ minutes: z.number().int().min(10).max(240) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = getDb();
      const today = dayStr();
      const items: PlanItemSeed[] = [];
      const explanation: string[] = [];

      // ⑤ 心情降载：今日平均 mood ≤2 时总预算 ×0.8
      const moodAvg = await getTodayMoodAvg(userId);
      const lowMood = moodAvg !== null && moodAvg <= 2;
      let budget = lowMood ? Math.floor(input.minutes * 0.8) : input.minutes;

      /** 预算够才排；排一项就扣一项。 */
      const tryAdd = (item: PlanItemSeed, why: string): boolean => {
        if (budget < item.minutes) return false;
        items.push(item);
        explanation.push(why);
        budget -= item.minutes;
        return true;
      };

      const kpIndex = await getKpIndex();
      const kpTitle = (kpId: number) => kpIndex.byId.get(kpId)?.title ?? "";

      // ① 今日到期复习（due<=today 且错题 active），同一错题只排一次，band3 优先
      const due = await dueReviewRows(userId, today);
      if (due.length > 0) {
        const errs = await db
          .select()
          .from(errorLogs)
          .where(inArray(errorLogs.id, [...new Set(due.map((d) => d.errorLogId))]));
        const errMap = new Map(errs.map((e) => [e.id, e]));
        const dueErrors = [...new Set(due.map((d) => d.errorLogId))]
          .map((id) => errMap.get(id))
          .filter((e): e is NonNullable<typeof e> => !!e && e.status === "active")
          .sort((a, b) => b.band - a.band);
        let reviewCount = 0;
        for (const err of dueErrors) {
          const ok = tryAdd(
            {
              kind: "review",
              title: `复习错题：${err.stem.slice(0, 20)}（${kpTitle(err.kpId)}）`,
              errorId: err.id,
              minutes: 4,
              done: false,
            },
            reviewCount === 0
              ? `先把 ${dueErrors.length} 道到期复习题清掉（每题约 4 分钟，攻坚区优先），避免遗忘曲线反扑。`
              : `第 ${reviewCount + 1} 道到期复习题，趁热打铁一起清掉。`,
          );
          if (!ok) {
            explanation.push(`还有 ${dueErrors.length - reviewCount} 道到期复习题没排进今天的预算，明天会优先补上。`);
            break;
          }
          reviewCount += 1;
        }
      }

      // 按区间取出 active 错题（各区间独立排队）
      const activeErrors = await db
        .select()
        .from(errorLogs)
        .where(and(eq(errorLogs.userId, userId), eq(errorLogs.status, "active")))
        .orderBy(asc(errorLogs.createdAt));
      const byBand = (band: number) => activeErrors.filter((e) => e.band === band);

      // ② 第1区间（送分区）：每题约 6 分钟做变式
      const band1 = byBand(1);
      let b1 = 0;
      for (const err of band1) {
        const ok = tryAdd(
          {
            kind: "band1",
            title: `送分区抢分：${err.stem.slice(0, 20)}（${kpTitle(err.kpId)}）`,
            errorId: err.id,
            minutes: 6,
            done: false,
          },
          b1 === 0
            ? `第1区间是送分题，${band1.length} 题每题约 6 分钟就能拿回本该属于你的分，优先安排。`
            : `继续清送分区第 ${b1 + 1} 题，这类分拿得最快。`,
        );
        if (!ok) break;
        b1 += 1;
      }
      if (b1 < band1.length && band1.length > 0) {
        explanation.push(`送分区还剩 ${band1.length - b1} 题超出今天预算，已留到后续安排。`);
      }

      // ③ 下一个建议预习知识点（掌握度 <60 的第一个，同 dashboard.suggestedKp 逻辑）
      // 只看有深度内容的 KP：骨架占位不进入计划推荐
      const kps = await scopeKpsToUserGrade(
        userId,
        await db.select().from(knowledgePoints).orderBy(asc(knowledgePoints.sortOrder)),
      );
      const masteryMap = await getMasteryMap(userId);
      const suggestedKp =
        kps.find((k) => Array.isArray(k.summary) && k.summary.length > 0 && (masteryMap.get(k.id) ?? 0) < 60) ?? null;
      if (suggestedKp) {
        const ok = tryAdd(
          {
            kind: "preview",
            title: `预习新课「${suggestedKp.title}」（含 5 分钟讲给 AI 听）`,
            kpCode: suggestedKp.code,
            minutes: 15,
            done: false,
          },
          `「${suggestedKp.title}」掌握度还不到 60，排 15 分钟预习（10 分钟看要点 + 5 分钟讲给 AI 听），带着问题去听课。`,
        );
        if (!ok) {
          explanation.push(`今天预算排满了，「${suggestedKp.title}」的预习留到明天。`);
        }
      }

      // ④ 第2区间（提分区）：每题约 10 分钟
      const band2 = byBand(2);
      let b2 = 0;
      for (const err of band2) {
        const ok = tryAdd(
          {
            kind: "band2",
            title: `提分区攻克：${err.stem.slice(0, 20)}（${kpTitle(err.kpId)}）`,
            errorId: err.id,
            minutes: 10,
            done: false,
          },
          b2 === 0
            ? `第2区间是「讲一遍就会」的题，每题约 10 分钟回例题重做再做变式，补上方法就能提分。`
            : `继续攻提分区第 ${b2 + 1} 题。`,
        );
        if (!ok) break;
        b2 += 1;
      }
      if (b2 < band2.length && band2.length > 0) {
        explanation.push(`提分区还剩 ${band2.length - b2} 题超出今天预算，明天继续。`);
      }

      // ④ 第3区间（攻坚区）：每题约 15 分钟，仅预算 ≥60 时才排，时间紧不排攻坚
      const band3 = byBand(3);
      if (band3.length > 0) {
        if (input.minutes >= 60) {
          let b3 = 0;
          for (const err of band3) {
            const ok = tryAdd(
              {
                kind: "band3",
                title: `攻坚区深练：${err.stem.slice(0, 20)}（${kpTitle(err.kpId)}）`,
                errorId: err.id,
                minutes: 15,
                done: false,
              },
              b3 === 0
                ? `第3区间（攻坚区）需要回到根因知识点深挖，每题约 15 分钟，今天时间充足才安排。`
                : `攻坚区第 ${b3 + 1} 题，慢慢来，弄懂一题是一题。`,
            );
            if (!ok) break;
            b3 += 1;
          }
          if (b3 === 0) {
            explanation.push(`攻坚区有 ${band3.length} 题，但今天剩余预算不够 15 分钟一题的深练，改天再战。`);
          } else if (b3 < band3.length) {
            explanation.push(`攻坚区还剩 ${band3.length - b3} 题，已留到后面时间充裕的日子。`);
          }
        } else {
          explanation.push(`攻坚区有 ${band3.length} 题，但今天总时长不足 60 分钟，时间紧不排攻坚，先保住基础分。`);
        }
      }

      // ⑤ 心情降载：末尾加一条休息项
      let note: string | null = null;
      if (lowMood) {
        note = "今天情绪有点低落，计划已减量 20%，先照顾好自己。";
        items.push({
          kind: "rest",
          title: "今天情绪需要照顾，早点休息",
          minutes: 10,
          done: false,
        });
        explanation.push("注意到你今天心情不太好，计划已减量 20%，最后留 10 分钟放松一下，早点休息。");
      }

      if (items.length === 0) {
        explanation.push("今天没有到期复习和待攻克错题，可以轻松一点，或者去做一次新课预习。");
      }

      // 分段节奏建议（每次学多久）
      const sa = sessionAdvice(input.minutes, band3.length, lowMood);
      explanation.push(
        `建议分 ${sa.sessions} 段进行，每段专注 ${sa.sessionMinutes} 分钟、段间休息 ${sa.breakMinutes} 分钟——短暂休息时大脑会把刚学的内容「存档」。`,
      );

      // 写入 dailyPlans：每人每天一份，已存在则更新（重生成覆盖）
      const existing = await db.query.dailyPlans.findFirst({
        where: and(eq(dailyPlans.userId, userId), eq(dailyPlans.date, today)),
      });
      if (existing) {
        await db
          .update(dailyPlans)
          .set({ minutes: input.minutes, items, note })
          .where(and(eq(dailyPlans.userId, userId), eq(dailyPlans.date, today)));
      } else {
        await db.insert(dailyPlans).values({ userId, date: today, minutes: input.minutes, items, note });
      }
      const plan = await db.query.dailyPlans.findFirst({
        where: and(eq(dailyPlans.userId, userId), eq(dailyPlans.date, today)),
      });
      if (!plan) throw new Error("计划写入失败");
      return { plan, explanation };
    }),

  /** 勾选/取消计划项完成状态。 */
  toggleItem: authedQuery
    .input(z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), index: z.number().int().min(0), done: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = getDb();
      const plan = await db.query.dailyPlans.findFirst({
        where: and(eq(dailyPlans.userId, userId), eq(dailyPlans.date, input.date)),
      });
      if (!plan) throw new Error("当天计划不存在");
      if (input.index >= plan.items.length) throw new Error("计划项不存在");
      const items = plan.items.map((it, i) => (i === input.index ? { ...it, done: input.done } : it));
      await db.update(dailyPlans).set({ items }).where(eq(dailyPlans.id, plan.id));
      return { ok: true };
    }),
});
