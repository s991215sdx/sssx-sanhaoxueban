import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { guideSessions } from "@db/schema";
import { dayStr } from "./helpers";
import { SEVEN_STEPS } from "@contracts/content";

/** 引用学生原话的片段（≤20 字）。 */
function snippet(text: string): string {
  const t = text.trim().replace(/\s+/g, "");
  return t.length > 20 ? `${t.slice(0, 20)}…` : t;
}

/** 校验导学 session 属于当前用户，返回 session。 */
async function ownGuide(sessionId: number, userId: number) {
  const db = getDb();
  const session = await db.query.guideSessions.findFirst({
    where: and(eq(guideSessions.id, sessionId), eq(guideSessions.userId, userId)),
  });
  if (!session) throw new Error("导学不存在");
  return session;
}

export const guideRouter = createRouter({
  /** 今天的导学 session（没有则 null）。 */
  today: authedQuery.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const session = await db.query.guideSessions.findFirst({
      where: and(eq(guideSessions.userId, userId), eq(guideSessions.date, dayStr())),
    });
    return session ?? null;
  }),

  /** 创建今日 session；已存在则直接返回现有。 */
  start: authedQuery.mutation(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const today = dayStr();
    const existing = await db.query.guideSessions.findFirst({
      where: and(eq(guideSessions.userId, userId), eq(guideSessions.date, today)),
    });
    if (existing) return existing;
    const [{ id }] = await db
      .insert(guideSessions)
      .values({ userId, date: today, step: 0, answers: {} })
      .$returningId();
    const session = await db.query.guideSessions.findFirst({ where: eq(guideSessions.id, id) });
    if (!session) throw new Error("导学创建失败");
    return session;
  }),

  /** 保存某一步的回答，并把进度推进到该步序号 +1。 */
  answer: authedQuery
    .input(
      z.object({
        sessionId: z.number(),
        stepKey: z.string().min(1).max(32),
        answer: z.string().min(1).max(1000),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = getDb();
      const stepIdx = SEVEN_STEPS.findIndex((s) => s.key === input.stepKey);
      if (stepIdx < 0) throw new Error("未知的导学步骤");
      const session = await ownGuide(input.sessionId, userId);
      const answers = { ...session.answers, [input.stepKey]: input.answer };
      const step = Math.max(session.step, stepIdx + 1); // 只允许前进，回改答案不退步
      const done = step >= SEVEN_STEPS.length;
      await db
        .update(guideSessions)
        .set({ answers, step, done: session.done || done })
        .where(and(eq(guideSessions.id, input.sessionId), eq(guideSessions.userId, userId)));
      return { step, done };
    }),

  /** 生成导学小结：回顾每一步的回答要点（引用原话片段）+ 明天开始的行动约定。 */
  finish: authedQuery.input(z.object({ sessionId: z.number() })).mutation(async ({ input, ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const session = await ownGuide(input.sessionId, userId);

    const lines: string[] = ["今天我们一起走完了自主学习七步法，这是你留下的思考："];
    for (const s of SEVEN_STEPS) {
      const a = session.answers[s.key];
      if (a) lines.push(`${s.title}：你说「${snippet(a)}」——记住这份自己的想法。`);
    }
    if (lines.length === 1) {
      lines.push("今天还没来得及写下回答，没关系，明天我们可以从任何一步重新开始。");
    }
    const goalAnswer = session.answers[SEVEN_STEPS[0].key];
    lines.push(
      goalAnswer
        ? `明天开始，我们就从你自己定的目标「${snippet(goalAnswer)}」做起——说好了，明天晚上再来对一次答案，我等你。`
        : "明天开始，先花一分钟定下一个具体的小目标——说好了，明天晚上再来对一次答案，我等你。",
    );
    const summary = lines.join("\n");

    await db
      .update(guideSessions)
      .set({ step: SEVEN_STEPS.length, done: true })
      .where(and(eq(guideSessions.id, input.sessionId), eq(guideSessions.userId, userId)));
    return { summary };
  }),
});
