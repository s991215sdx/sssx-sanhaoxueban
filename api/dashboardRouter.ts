import { asc, eq, gte, and, lte, inArray } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { attempts, errorLogs, knowledgePoints, previewSessions, reviewItems } from "@db/schema";
import { dayStr, getMasteryMap, scopeKpsToUserGrade } from "./helpers";

export const dashboardRouter = createRouter({
  summary: authedQuery.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const allKps = await db.select().from(knowledgePoints).orderBy(asc(knowledgePoints.sortOrder));
    // 骨架占位 KP（精讲为空）不参与均分与推荐，避免全学段铺开后把 0 分占位当薄弱点
    const kps = await scopeKpsToUserGrade(userId, allKps.filter((k) => Array.isArray(k.summary) && k.summary.length > 0));
    const masteryMap = await getMasteryMap(userId);

    // 章节均分（雷达图）
    const chapterAgg = new Map<string, { sum: number; n: number }>();
    for (const kp of kps) {
      const a = chapterAgg.get(kp.chapter) ?? { sum: 0, n: 0 };
      a.sum += masteryMap.get(kp.id) ?? 0;
      a.n += 1;
      chapterAgg.set(kp.chapter, a);
    }
    const radar = [...chapterAgg.entries()].map(([chapter, a]) => ({ chapter: chapter.replace(/^第.章\s*/, ""), full: chapter, score: Math.round(a.sum / a.n) }));

    // 今日任务：先取当前用户的错题 id 集合，再过滤复习项（reviewItems 无 userId 列）
    const today = dayStr();
    const myErrIds = (
      await db.select({ id: errorLogs.id }).from(errorLogs).where(eq(errorLogs.userId, userId))
    ).map((e) => e.id);
    let reviewDue = 0;
    if (myErrIds.length > 0) {
      const dueReviews = await db
        .select({ id: reviewItems.id, errorLogId: reviewItems.errorLogId })
        .from(reviewItems)
        .where(and(eq(reviewItems.done, false), lte(reviewItems.dueDate, today), inArray(reviewItems.errorLogId, myErrIds)));
      // 批量取回关联错题，避免逐条查询（N+1）
      const dueErrs = dueReviews.length
        ? await db
            .select({ id: errorLogs.id, status: errorLogs.status })
            .from(errorLogs)
            .where(inArray(errorLogs.id, [...new Set(dueReviews.map((r) => r.errorLogId))]))
        : [];
      const activeErrIds = new Set(dueErrs.filter((e) => e.status === "active").map((e) => e.id));
      reviewDue = dueReviews.filter((r) => activeErrIds.has(r.errorLogId)).length;
    }
    const suggestedKp = kps.find((k) => (masteryMap.get(k.id) ?? 0) < 60) ?? null;

    // 近 7 天活动 + 连续学习天数
    const since = new Date(Date.now() + 8 * 3600 * 1000 - 7 * 86400 * 1000);
    const recentAttempts = await db
      .select({ id: attempts.id, createdAt: attempts.createdAt, correct: attempts.correct })
      .from(attempts)
      .where(and(eq(attempts.userId, userId), gte(attempts.createdAt, since)));
    const weekly: { day: string; total: number; correct: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      weekly.push({ day: dayStr(-i), total: 0, correct: 0 });
    }
    const weekSet = new Map(weekly.map((w) => [w.day, w]));
    const activeDays = new Set<string>();
    for (const a of recentAttempts) {
      const d = new Date(a.createdAt.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10);
      const w = weekSet.get(d);
      if (w) {
        w.total += 1;
        if (a.correct) w.correct += 1;
      }
      activeDays.add(d);
    }
    let streak = 0;
    for (let i = 0; ; i++) {
      if (activeDays.has(dayStr(-i))) streak += 1;
      else if (i === 0) continue; // 今天还没学不算断
      else break;
    }

    // 错因分布
    const errs = await db.select({ cause: errorLogs.cause, status: errorLogs.status }).from(errorLogs).where(eq(errorLogs.userId, userId));
    const causeCount = new Map<string, number>();
    let activeErrors = 0;
    for (const e of errs) {
      causeCount.set(e.cause, (causeCount.get(e.cause) ?? 0) + 1);
      if (e.status === "active") activeErrors += 1;
    }
    const causeDist = [...causeCount.entries()].map(([cause, count]) => ({ cause, count }));

    // 预习完成数
    const previews = await db
      .select({ id: previewSessions.id })
      .from(previewSessions)
      .where(and(eq(previewSessions.userId, userId), eq(previewSessions.completed, true)));

    const mastered = kps.filter((k) => (masteryMap.get(k.id) ?? 0) >= 80).length;

    // 给家长的一句话建议
    const weakest = [...radar].sort((a, b) => a.score - b.score)[0];
    const topCause = [...causeDist].sort((a, b) => b.count - a.count)[0];
    const suggestions: string[] = [];
    if (weakest && weakest.score < 60) {
      suggestions.push(`「${weakest.full}」是当前最薄弱的章节，建议优先安排这一章的预习与错题巩固。`);
    }
    if (topCause && topCause.count >= 2) {
      const advice: Record<string, string> = {
        概念不清: "「概念不清」出现较多，建议让孩子多用“讲给别人听”的方式复述概念，而不是只看笔记。",
        审题失误: "「审题失误」出现较多，建议做题时圈画关键词，做完回头核对题目问的是什么。",
        计算错误: "「计算错误」出现较多，建议每天做 5 分钟口算/符号专项，强调草稿规范。",
        方法不会: "「方法不会」出现较多，建议先回到例题，盖住答案自己重做一遍再做同类题。",
        粗心大意: "「粗心」出现较多，其实多半是熟练度不够，建议限时训练 + 即时检查。",
      };
      suggestions.push(advice[topCause.cause]);
    }
    if (suggestions.length === 0) {
      suggestions.push("目前状态不错！保持“先预习、后查漏、勤复习”的节奏，坚持就是领先。");
    }

    return {
      radar,
      reviewDue,
      suggestedKp: suggestedKp ? { id: suggestedKp.id, code: suggestedKp.code, title: suggestedKp.title, chapter: suggestedKp.chapter } : null,
      weekly: weekly.map((w) => ({ day: w.day.slice(5), total: w.total, correct: w.correct })),
      streak,
      causeDist,
      stats: {
        totalKps: kps.length,
        mastered,
        activeErrors,
        previewsDone: previews.length,
        totalAttempts: recentAttempts.length,
      },
      suggestions,
    };
  }),
});
