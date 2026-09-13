import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { errorLogs, knowledgePoints, questions, tutorSessions, attempts, type TutorMessage } from "@db/schema";
import { adjustMastery, bumpMasteryFloor, grade, normalize } from "./helpers";
import { tryChat, type ChatMessage } from "./ai";

/** 苏格拉底引导的 LLM 系统提示：一次只问一个问题，绝不给答案。 */
function socraticPrompt(ctx: {
  kpTitle: string;
  kpSummary: string[];
  keyConcepts: string[];
  errorStem: string;
  quizStem?: string;
  quizAnswer?: string;
  turn: number;
}): string {
  return `你是一位小学/中学伴学师，正在用「苏格拉底式提问」辅导一个孩子。孩子刚做错了一道与「${ctx.kpTitle}」相关的题。

【知识点精讲要点】
${ctx.kpSummary.map((s) => `- ${s}`).join("\n")}

【希望孩子自己想通的关键概念】${ctx.keyConcepts.join("、")}
【孩子的错题】${ctx.errorStem}
${ctx.quizStem ? `【重做的检验题】${ctx.quizStem}\n【正确答案（绝不可透露）】${ctx.quizAnswer ?? ""}` : ""}

铁律：
1. 每次只问一个具体的小问题，绝不直接给答案或完整解题过程；
2. 孩子说对了要立即肯定，并指出他说对了哪个概念；
3. 孩子答非所问或说错了，要温和地指出偏差在哪，再把问题拆得更小；
4. 孩子要答案时温和拒绝，转而给一个最小提示；
5. 语气像亲切的大姐姐/大哥哥，句子短，适合小学生读，一次回复不超过 120 字；
6. 当你判断孩子已经基本想通了（能自己说出大部分关键概念），在正常回复的最后另起一行输出标记 [UNDERSTOOD]。`;
}

async function ownError(errorId: number, userId: number) {
  const db = getDb();
  const err = await db.query.errorLogs.findFirst({ where: and(eq(errorLogs.id, errorId), eq(errorLogs.userId, userId)) });
  if (!err) throw new Error("错题不存在");
  return err;
}

async function ownSession(sessionId: number, userId: number) {
  const db = getDb();
  const s = await db.query.tutorSessions.findFirst({
    where: and(eq(tutorSessions.id, sessionId), eq(tutorSessions.userId, userId)),
  });
  if (!s) throw new Error("学习会话不存在");
  return s;
}

async function pickQuestion(kpId: number) {
  const db = getDb();
  for (const stage of ["variant", "practice", "check"] as const) {
    const qs = await db.select().from(questions).where(and(eq(questions.kpId, kpId), eq(questions.stage, stage))).limit(3);
    if (qs.length > 0) return qs[Math.floor(Math.random() * qs.length)];
  }
  return null;
}

function isStuck(text: string) {
  const t = text.trim();
  if (t.length < 6) return true;
  return /不知道|不会|不懂|没思路|不清楚|忘了|不知道怎么说/.test(t);
}

export const tutorRouter = createRouter({
  /** ① 开始引导学习：返回复习卡内容（精讲要点 + 例题，不含检验题答案）。 */
  start: authedQuery.input(z.object({ errorId: z.number() })).mutation(async ({ input, ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const err = await ownError(input.errorId, userId);
    const kpId = err.rootKpId ?? err.kpId;
    const kp = await db.query.knowledgePoints.findFirst({ where: eq(knowledgePoints.id, kpId) });
    if (!kp) throw new Error("知识点不存在");
    const selfKp = kpId === err.kpId ? kp : await db.query.knowledgePoints.findFirst({ where: eq(knowledgePoints.id, err.kpId) });
    const [{ id }] = await db.insert(tutorSessions).values({ userId, errorId: err.id, kpId, conceptsHit: [], messages: [] }).$returningId();
    return {
      sessionId: id,
      phase: "review",
      error: { id: err.id, stem: err.stem, band: err.band, cause: err.cause },
      kp: { id: kp.id, code: kp.code, title: kp.title, summary: kp.summary, example: kp.example },
      isRoot: kpId !== err.kpId,
      selfKpTitle: selfKp?.title ?? kp.title,
    };
  }),

  /** 查询会话当前状态（刷新页面后恢复）。 */
  state: authedQuery.input(z.object({ sessionId: z.number() })).query(async ({ input, ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const s = await ownSession(input.sessionId, userId);
    const kp = await db.query.knowledgePoints.findFirst({ where: eq(knowledgePoints.id, s.kpId) });
    const err = await db.query.errorLogs.findFirst({ where: eq(errorLogs.id, s.errorId) });
    let q = null;
    if (s.questionId) {
      const row = await db.query.questions.findFirst({ where: eq(questions.id, s.questionId) });
      if (row) q = { id: row.id, type: row.type, stem: row.stem, options: row.options, hint: row.hint };
    }
    return {
      phase: s.phase,
      understood: s.understood,
      messages: s.messages,
      errorId: s.errorId,
      kp: kp ? { id: kp.id, code: kp.code, title: kp.title, summary: kp.summary, example: kp.example } : null,
      error: err ? { id: err.id, stem: err.stem, band: err.band, cause: err.cause } : null,
      question: q,
      conceptsTotal: kp?.socratic.keyConcepts.length ?? 0,
      conceptsHit: s.conceptsHit.length,
    };
  }),

  /** ② 看完复习卡，领一道检验题重做。 */
  beginQuiz: authedQuery.input(z.object({ sessionId: z.number() })).mutation(async ({ input, ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const s = await ownSession(input.sessionId, userId);
    const q = await pickQuestion(s.kpId);
    if (!q) throw new Error("这个知识点暂时没有检验题");
    await db.update(tutorSessions).set({ phase: "quiz", questionId: q.id }).where(and(eq(tutorSessions.id, s.id), eq(tutorSessions.userId, userId)));
    return {
      question: { id: q.id, type: q.type, stem: q.stem, options: q.options, hint: q.hint },
    };
  }),

  /**
   * ③ 提交重做的答案：答对 → 完成（可去举一反三）；仍答错 → 启动苏格拉底引导，
   * 只问第一个问题，不给答案、不给完整过程。
   */
  submitQuiz: authedQuery.input(z.object({ sessionId: z.number(), given: z.string().min(1).max(255) })).mutation(async ({ input, ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const s = await ownSession(input.sessionId, userId);
    if (!s.questionId) throw new Error("还没有领取检验题");
    const q = await db.query.questions.findFirst({ where: eq(questions.id, s.questionId) });
    if (!q) throw new Error("题目不存在");
    const kp = await db.query.knowledgePoints.findFirst({ where: eq(knowledgePoints.id, s.kpId) });
    if (!kp) throw new Error("知识点不存在");
    const correct = grade(q, input.given);
    await db.insert(attempts).values({ userId, questionId: q.id, kpId: q.kpId, stage: "tutor", correct, given: input.given.slice(0, 255) });
    await adjustMastery(userId, q.kpId, correct ? 1 : 0, 1);
    if (correct) {
      await db.update(tutorSessions).set({ phase: "done", understood: true }).where(and(eq(tutorSessions.id, s.id), eq(tutorSessions.userId, userId)));
      return {
        correct: true,
        answer: q.answer.split("|")[0],
        explanation: q.explanation,
        phase: "done",
      };
    }
    const opening: TutorMessage = {
      role: "tutor",
      content: `没关系，这道题确实容易拐错弯，咱们不急着看答案——我陪你一步一步想，想通了就是你的了。\n\n先问第一个小问题：${kp.socratic.probes[0] ?? `「${kp.title}」里最核心的那个概念，你能用自己的话说说吗？`}`,
    };
    await db.update(tutorSessions).set({ phase: "tutor", messages: [opening], turn: 0 }).where(and(eq(tutorSessions.id, s.id), eq(tutorSessions.userId, userId)));
    return {
      correct: false,
      phase: "tutor",
      tutorMessage: opening.content,
      conceptsTotal: kp.socratic.keyConcepts.length,
    };
  }),

  /**
   * 苏格拉底对话：一次只问一个问题。概念命中检测判定是否「想通了」；
   * 卡住时给最小提示并把问题拆得更小；直接要答案时温和拒绝。
   */
  chat: authedQuery.input(z.object({ sessionId: z.number(), message: z.string().min(1).max(1e3) })).mutation(async ({ input, ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const s = await ownSession(input.sessionId, userId);
    if (s.phase !== "tutor") throw new Error("当前不在引导对话中");
    const kp = await db.query.knowledgePoints.findFirst({ where: eq(knowledgePoints.id, s.kpId) });
    if (!kp) throw new Error("知识点不存在");
    const messages: TutorMessage[] = [...s.messages, { role: "student", content: input.message }];
    const turn = s.turn + 1;
    const text = normalize(input.message);
    const hit = new Set(s.conceptsHit);
    const newHits: string[] = [];
    for (const concept of kp.socratic.keyConcepts) {
      if (!hit.has(concept) && text.includes(normalize(concept))) {
        hit.add(concept);
        newHits.push(concept);
      }
    }
    const total = kp.socratic.keyConcepts.length;
    const hitCount = hit.size;
    let understood = (hitCount >= Math.ceil(total / 2) && turn >= 2) || turn >= 5;

    // 优先走大模型苏格拉底对话；不可用或失败时回退规则引擎
    let reply: string | null = null;
    const errRow = await db.query.errorLogs.findFirst({ where: eq(errorLogs.id, s.errorId) });
    let quiz: { stem: string; answer: string } | null = null;
    if (s.questionId) {
      const qRow = await db.query.questions.findFirst({ where: eq(questions.id, s.questionId) });
      if (qRow) quiz = { stem: qRow.stem, answer: qRow.answer.split("|")[0] };
    }
    const sys = socraticPrompt({
      kpTitle: kp.title,
      kpSummary: Array.isArray(kp.summary)
        ? (kp.summary as { heading?: string; body?: string }[]).map((s) => (s.heading ? `${s.heading}：${s.body ?? ""}` : (s.body ?? ""))).filter(Boolean)
        : [],
      keyConcepts: kp.socratic.keyConcepts,
      errorStem: errRow?.stem ?? "",
      quizStem: quiz?.stem,
      quizAnswer: quiz?.answer,
      turn,
    });
    const history: ChatMessage[] = [
      { role: "system", content: sys },
      ...messages.map((m) => ({
        role: (m.role === "tutor" ? "assistant" : "user") as "assistant" | "user",
        content: m.content,
      })),
    ];
    const aiReply = await tryChat(history, { timeoutMs: 30000, maxTokens: 1500 });
    if (aiReply) {
      if (aiReply.includes("[UNDERSTOOD]")) {
        understood = true;
        reply = aiReply.replace("[UNDERSTOOD]", "").trim();
      } else {
        reply = aiReply;
      }
    }
    if (reply == null) {
      // —— 规则引擎兜底 ——
    if (understood) {
      const missed = kp.socratic.keyConcepts.filter((c) => !hit.has(c));
      reply =
        (hitCount >= Math.ceil(total / 2)
          ? `对了！${newHits.length ? `你刚才说到「${newHits.join("」「")}」，这就是最关键的那一环。` : "你刚才那番话已经把关键点说出来了。"}现在回头看刚才那道错题，是不是能看清自己当时卡在哪了？\n\n`
          : `我们聊了这么几轮，你已经在往对的方向走了。\n\n`) +
        (missed.length > 0
          ? `还有${missed.map((m) => `「${m}」`).join("、")}这一点，建议你自己再小声讲一遍，讲顺了才算真的懂。\n\n`
          : "") +
        `最后一步：用你自己的话，把「${kp.title}」完整讲一遍给我听（打字或语音都行）。讲完，这个知识点就真是你的了。之后还可以选「举一反三」做几道同类题把它钉牢。`;
    } else if (isStuck(input.message)) {
      const hint = kp.socratic.hints[(turn - 1) % kp.socratic.hints.length];
      reply = `卡住很正常，我们把它拆小一点。${hint ? `给你一个小提示：${hint}\n\n` : ""}先不用管整道题，只回答这一个最小的问题：${kp.socratic.probes[Math.min(turn, kp.socratic.probes.length - 1)] ?? `「${kp.socratic.keyConcepts[0]}」是什么意思？用你自己的话说说看。`}`;
    } else if (/答案|直接告诉我|告诉我怎么做/.test(input.message)) {
      reply = `答案我现在不能给你——给了答案，下次换道题还是会卡住。\n\n但你刚才已经离它很近了。再想想：${kp.socratic.probes[Math.min(turn, kp.socratic.probes.length - 1)] ?? kp.socratic.hints[0]}`;
    } else {
      const parts: string[] = [];
      if (newHits.length > 0) {
        parts.push(`对，你提到了「${newHits.join("」「")}」，这很关键！`);
      } else {
        parts.push("嗯，我听懂了你的意思了。");
      }
      const nextProbe = kp.socratic.probes[Math.min(turn, kp.socratic.probes.length - 1)];
      parts.push(nextProbe ?? `那「${kp.socratic.keyConcepts.find((c) => !hit.has(c)) ?? kp.title}」你觉得是怎么回事？`);
      reply = parts.join("\n\n");
    }
    } // end 规则引擎兜底
    messages.push({ role: "tutor", content: reply });
    await db.update(tutorSessions).set({
      messages,
      turn,
      conceptsHit: [...hit],
      ...(understood ? { phase: "done", understood: true } : {}),
    }).where(and(eq(tutorSessions.id, s.id), eq(tutorSessions.userId, userId)));
    if (understood) {
      await bumpMasteryFloor(userId, s.kpId, 60);
      const err = await db.query.errorLogs.findFirst({ where: eq(errorLogs.id, s.errorId) });
      if (err && err.status === "active") {
        await db.update(errorLogs).set({ variantStreak: Math.min(err.variantStreak + 1, 2) }).where(and(eq(errorLogs.id, s.errorId), eq(errorLogs.userId, userId)));
      }
    }
    return { reply, hitCount, total, understood };
  }),

  /** 批量取某知识点根因链上的可复习内容（供 PaperDetail 直接展开复习卡）。 */
  reviewCard: authedQuery.input(z.object({ errorId: z.number() })).query(async ({ input, ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const err = await ownError(input.errorId, userId);
    const kpIds = [err.rootKpId, err.kpId].filter((v): v is number => v != null);
    const rows = await db.select().from(knowledgePoints).where(inArray(knowledgePoints.id, kpIds));
    const byId = new Map(rows.map((r) => [r.id, r]));
    const self = byId.get(err.kpId);
    if (!self) throw new Error("知识点不存在");
    const root = err.rootKpId ? byId.get(err.rootKpId) : null;
    return {
      error: { id: err.id, stem: err.stem, band: err.band, cause: err.cause },
      kp: { id: self.id, code: self.code, title: self.title, summary: self.summary, example: self.example },
      rootKp: root && root.id !== self.id ? { id: root.id, code: root.code, title: root.title, summary: root.summary, example: root.example } : null,
    };
  }),
});
