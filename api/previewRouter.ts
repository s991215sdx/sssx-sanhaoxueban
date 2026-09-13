import { z } from "zod";
import { and, asc, desc, eq, gte, inArray } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { attempts, chatMessages, knowledgePoints, previewSessions, questions } from "@db/schema";
import { adjustMastery, bumpMasteryFloor, grade, getMasteryMap, normalize } from "./helpers";

const answerInput = z.object({ questionId: z.number(), given: z.string() });

type GradedResult = {
  questionId: number;
  correct: boolean;
  answer: string;
  explanation: string;
  kpId: number;
};

async function gradeBatch(userId: number, batch: z.infer<typeof answerInput>[], stage: string): Promise<GradedResult[]> {
  const db = getDb();
  // 一次性取回整批题目，避免逐题查询（N+1）
  const qRows = batch.length
    ? await db.select().from(questions).where(inArray(questions.id, [...new Set(batch.map((a) => a.questionId))]))
    : [];
  const qMap = new Map(qRows.map((q) => [q.id, q]));
  const results: GradedResult[] = [];
  for (const a of batch) {
    const q = qMap.get(a.questionId);
    if (!q) continue;
    const correct = grade(q, a.given);
    await db.insert(attempts).values({ userId, questionId: q.id, kpId: q.kpId, stage, correct, given: a.given.slice(0, 255) });
    results.push({ questionId: q.id, correct, answer: q.answer.split("|")[0], explanation: q.explanation, kpId: q.kpId });
  }
  // 按知识点聚合更新掌握度
  const byKp = new Map<number, { c: number; t: number }>();
  for (const r of results) {
    const v = byKp.get(r.kpId) ?? { c: 0, t: 0 };
    v.t += 1;
    if (r.correct) v.c += 1;
    byKp.set(r.kpId, v);
  }
  for (const [kpId, { c, t }] of byKp) await adjustMastery(userId, kpId, c, t);
  return results;
}

/** 校验预习会话属于当前用户，返回会话。 */
async function ownSession(sessionId: number, userId: number) {
  const db = getDb();
  const session = await db.query.previewSessions.findFirst({
    where: and(eq(previewSessions.id, sessionId), eq(previewSessions.userId, userId)),
  });
  if (!session) throw new Error("会话不存在");
  return session;
}

export const previewRouter = createRouter({
  /** 开始预习：若该知识点有前置，返回前置检测题（每个前置最多 2 道）。 */
  start: authedQuery.input(z.object({ kpId: z.number() })).mutation(async ({ input, ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const kp = await db.query.knowledgePoints.findFirst({ where: eq(knowledgePoints.id, input.kpId) });
    if (!kp) throw new Error("知识点不存在");
    const [{ id: sessionId }] = await db
      .insert(previewSessions)
      .values({ userId, kpId: kp.id, feynmanConceptsHit: [], classQuestions: [] })
      .$returningId();

    // 批量取前置知识点与其检测题，避免逐条查询（N+1）
    const preRows = kp.prereqCodes.length
      ? await db.select().from(knowledgePoints).where(inArray(knowledgePoints.code, kp.prereqCodes))
      : [];
    const prereqKps = preRows.map((pre) => ({ id: pre.id, code: pre.code, title: pre.title }));
    const allCheck = prereqKps.length
      ? await db
          .select()
          .from(questions)
          .where(and(inArray(questions.kpId, prereqKps.map((p) => p.id)), eq(questions.stage, "check")))
      : [];
    const checkQuestions: typeof questions.$inferSelect[] = [];
    for (const p of prereqKps) {
      checkQuestions.push(...allCheck.filter((q) => q.kpId === p.id).slice(0, 2));
    }
    return { sessionId, kp: { id: kp.id, code: kp.code, title: kp.title }, prereqKps, checkQuestions };
  }),

  /** 提交前置检测。 */
  submitCheck: authedQuery
    .input(z.object({ sessionId: z.number(), answers: z.array(answerInput) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = getDb();
      await ownSession(input.sessionId, userId);
      const results = await gradeBatch(userId, input.answers, "check");
      const correct = results.filter((r) => r.correct).length;
      await db
        .update(previewSessions)
        .set({ prereqTotal: results.length, prereqCorrect: correct })
        .where(and(eq(previewSessions.id, input.sessionId), eq(previewSessions.userId, userId)));
      // 每个前置知识点是否过关（全对算过关）
      const masteryMap = await getMasteryMap(userId);
      return { results, total: results.length, correct, masteryMap: Object.fromEntries(masteryMap) };
    }),

  /** 取本节练习题。 */
  getPractice: authedQuery.input(z.object({ sessionId: z.number() })).query(async ({ input, ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const session = await ownSession(input.sessionId, userId);
    return db.select().from(questions).where(and(eq(questions.kpId, session.kpId), eq(questions.stage, "practice"))).limit(4);
  }),

  /** 提交练习。 */
  submitPractice: authedQuery
    .input(z.object({ sessionId: z.number(), answers: z.array(answerInput) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = getDb();
      await ownSession(input.sessionId, userId);
      const results = await gradeBatch(userId, input.answers, "practice");
      const correct = results.filter((r) => r.correct).length;
      await db
        .update(previewSessions)
        .set({ practiceTotal: results.length, practiceCorrect: correct })
        .where(and(eq(previewSessions.id, input.sessionId), eq(previewSessions.userId, userId)));
      return { results, total: results.length, correct };
    }),

  /** 费曼输出：AI 学伴开场。 */
  feynmanStart: authedQuery.input(z.object({ sessionId: z.number() })).mutation(async ({ input, ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const session = await ownSession(input.sessionId, userId);
    const kp = await db.query.knowledgePoints.findFirst({ where: eq(knowledgePoints.id, session.kpId) });
    if (!kp) throw new Error("知识点不存在");
    const opening = `太好了，现在轮到你当老师了 🎓\n\n请用你自己的话，把「${kp.title}」这一节讲给我听——就当我是完全没学过的同学。可以讲：这节学了什么、最容易错的地方是什么、能举个例子吗？\n\n想到什么说什么，我会边听边追问。`;
    await db.insert(chatMessages).values({ sessionId: input.sessionId, role: "tutor", content: opening });
    return { message: opening, conceptsTotal: kp.socratic.keyConcepts.length };
  }),

  /** 费曼输出：学生讲解，学伴追问（结构化苏格拉底引擎）。 */
  feynmanReply: authedQuery
    .input(z.object({ sessionId: z.number(), message: z.string().min(1).max(2000) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = getDb();
      const session = await ownSession(input.sessionId, userId);
      const kp = await db.query.knowledgePoints.findFirst({ where: eq(knowledgePoints.id, session.kpId) });
      if (!kp) throw new Error("知识点不存在");

      await db.insert(chatMessages).values({ sessionId: input.sessionId, role: "student", content: input.message });

      const studentTurns = await db
        .select({ id: chatMessages.id })
        .from(chatMessages)
        .where(and(eq(chatMessages.sessionId, input.sessionId), eq(chatMessages.role, "student")));
      const turn = studentTurns.length;

      // 概念命中检测
      const text = normalize(input.message);
      const hit = new Set(session.feynmanConceptsHit);
      const newHits: string[] = [];
      for (const concept of kp.socratic.keyConcepts) {
        if (!hit.has(concept) && text.includes(normalize(concept))) {
          hit.add(concept);
          newHits.push(concept);
        }
      }
      await db
        .update(previewSessions)
        .set({ feynmanConceptsHit: [...hit] })
        .where(and(eq(previewSessions.id, input.sessionId), eq(previewSessions.userId, userId)));

      const total = kp.socratic.keyConcepts.length;
      const hitCount = hit.size;
      const lastTurn = turn >= 3 || hitCount === total;

      let reply: string;
      if (lastTurn) {
        const missed = kp.socratic.keyConcepts.filter((c) => !hit.has(c));
        const praise =
          hitCount === total
            ? "讲得太棒了！重点一个不落，看来你是真懂了 🌟"
            : hitCount >= total / 2
              ? "讲得不错，大方向抓住了 👍"
              : "敢开口讲就是胜利！不过有几个重点还没讲到。";
        const missedPart =
          missed.length > 0
            ? `\n\n我注意到你还没提到：${missed.map((m) => `「${m}」`).join("、")}。这几个点正是这节课的骨头，建议明天上课重点听老师讲这部分。`
            : "";
        reply = `${praise}\n\n你讲到了 ${hitCount}/${total} 个关键点${newHits.length ? `，其中「${newHits[0]}」说得很好` : ""}。${missedPart}\n\n最后考你一下：${
          kp.socratic.probes[kp.socratic.probes.length - 1]
        }\n\n（这个问题留给你带着走，不用现在回答——它就是明天的课堂任务之一。）`;
      } else {
        const parts: string[] = [];
        if (input.message.trim().length < 8) {
          parts.push("再多说一点点嘛，把脑子里的想法倒出来，说错完全没关系。");
        } else if (newHits.length > 0) {
          parts.push(`嗯，你提到了「${newHits.join("」「")}」，这个很关键！`);
        } else {
          parts.push("我大概懂你的意思了。");
          const hint = kp.socratic.hints[(turn - 1) % kp.socratic.hints.length];
          if (hint) parts.push(`给你一个提示：${hint}`);
        }
        const probe = kp.socratic.probes[Math.min(turn - 1, kp.socratic.probes.length - 1)];
        parts.push(probe);
        reply = parts.join("\n\n");
      }

      await db.insert(chatMessages).values({ sessionId: input.sessionId, role: "tutor", content: reply });
      return { reply, hitCount, total, done: lastTurn };
    }),

  /** 费曼对话历史。 */
  feynmanHistory: authedQuery.input(z.object({ sessionId: z.number() })).query(async ({ input, ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    await ownSession(input.sessionId, userId);
    return db.select().from(chatMessages).where(eq(chatMessages.sessionId, input.sessionId)).orderBy(asc(chatMessages.createdAt));
  }),

  /** 完成预习：生成课堂提问清单。 */
  finish: authedQuery.input(z.object({ sessionId: z.number() })).mutation(async ({ input, ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const session = await ownSession(input.sessionId, userId);
    const kp = await db.query.knowledgePoints.findFirst({ where: eq(knowledgePoints.id, session.kpId) });
    if (!kp) throw new Error("知识点不存在");

    const classQuestions: string[] = [];
    // 1. 费曼输出中没讲到的概念
    const missed = kp.socratic.keyConcepts.filter((c) => !session.feynmanConceptsHit.includes(c));
    for (const c of missed.slice(0, 2)) {
      classQuestions.push(`关于「${c}」我还不太确定，上课要重点听老师讲这部分。`);
    }
    // 2. 做错的本节练习
    const wrongAttempts = await db
      .select({ stem: questions.stem })
      .from(attempts)
      .innerJoin(questions, eq(attempts.questionId, questions.id))
      .where(
        and(
          eq(attempts.userId, userId),
          eq(attempts.kpId, session.kpId),
          eq(attempts.stage, "practice"),
          eq(attempts.correct, false),
          gte(attempts.createdAt, session.createdAt),
        ),
      )
      .orderBy(desc(attempts.createdAt))
      .limit(2);
    for (const w of wrongAttempts) {
      const short = w.stem.length > 30 ? w.stem.slice(0, 30) + "…" : w.stem;
      classQuestions.push(`预习练习里「${short}」我做错了，想听老师课上怎么讲这类题。`);
    }
    // 3. 前置知识有漏洞
    if (session.prereqTotal > 0 && session.prereqCorrect < session.prereqTotal) {
      classQuestions.push("这节课的前置知识我还有漏洞，老师复习相关旧知识时要格外留心。");
    }
    if (classQuestions.length === 0) {
      classQuestions.push(`这节预习得很顺！可以挑战一下：想想「${kp.title}」和前面学过的知识有什么联系。`);
    }

    await db
      .update(previewSessions)
      .set({ classQuestions, completed: true })
      .where(and(eq(previewSessions.id, input.sessionId), eq(previewSessions.userId, userId)));
    // 完成预习是一个里程碑：掌握度兜底到 30，避免「预习完仍显示未开始」
    await bumpMasteryFloor(userId, session.kpId, 30);
    return {
      classQuestions: classQuestions.slice(0, 4),
      stats: {
        prereq: { total: session.prereqTotal, correct: session.prereqCorrect },
        practice: { total: session.practiceTotal, correct: session.practiceCorrect },
        feynman: { hit: session.feynmanConceptsHit.length, total: kp.socratic.keyConcepts.length },
      },
    };
  }),
});
