import { z } from "zod";
import { and, asc, desc, eq, inArray, lte } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { attempts, errorLogs, knowledgePoints, questions, reviewItems } from "@db/schema";
import { adjustMastery, dayStr, findRootKp, getKpIndex, getMasteryMap, grade, REVIEW_STAGES, scopeKpsToUserGrade } from "./helpers";
import { tryChatJSON, type ChatMessage } from "./ai";

const CAUSES = ["概念不清", "审题失误", "计算错误", "方法不会", "粗心大意"] as const;

/** 当前用户的错题 id 集合（reviewItems 无 userId 列，须经此过滤）。 */
async function myErrorIds(userId: number): Promise<number[]> {
  const db = getDb();
  const rows = await db.select({ id: errorLogs.id }).from(errorLogs).where(eq(errorLogs.userId, userId));
  return rows.map((r) => r.id);
}

/** 校验错题属于当前用户，返回错题。 */
async function ownError(errorId: number, userId: number) {
  const db = getDb();
  const err = await db.query.errorLogs.findFirst({ where: and(eq(errorLogs.id, errorId), eq(errorLogs.userId, userId)) });
  if (!err) throw new Error("错题不存在");
  return err;
}

export const gapsRouter = createRouter({
  causes: authedQuery.query(() => [...CAUSES]),

  /** 错题列表（含知识点、下次复习日期）。批量 join，避免 N+1。 */
  listErrors: authedQuery.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const [errs, masteryMap, kpIndex] = await Promise.all([
      db.select().from(errorLogs).where(eq(errorLogs.userId, userId)).orderBy(desc(errorLogs.createdAt)),
      getMasteryMap(userId),
      getKpIndex(),
    ]);
    const errIds = errs.map((e) => e.id);
    const items = errIds.length
      ? await db.select().from(reviewItems).where(and(eq(reviewItems.done, false), inArray(reviewItems.errorLogId, errIds)))
      : [];
    const dueMap = new Map<number, string>();
    for (const it of items) {
      const prev = dueMap.get(it.errorLogId);
      if (!prev || it.dueDate < prev) dueMap.set(it.errorLogId, it.dueDate);
    }
    return errs.map((e) => {
      const kp = kpIndex.byId.get(e.kpId);
      const { imageData, ...rest } = e; // 列表不回传大字段，照片用 getImage 单独取
      return {
        ...rest,
        hasImage: !!imageData,
        kpTitle: kp?.title ?? "",
        kpCode: kp?.code ?? "",
        kpScore: masteryMap.get(e.kpId) ?? 0,
        nextDue: dueMap.get(e.id) ?? null,
      };
    });
  }),

  /** 取错题照片（base64 dataURL）。 */
  getImage: authedQuery.input(z.object({ errorId: z.number() })).query(async ({ input, ctx }) => {
    const userId = ctx.user.id;
    const err = await ownError(input.errorId, userId);
    return { imageData: err.imageData ?? null };
  }),

  /** 录入错题：自动回溯根因 + 生成 1/3/7/15/30 天复习计划。支持拍照图片与提分区间。 */
  addError: authedQuery
    .input(
      z.object({
        kpId: z.number(),
        stem: z.string().min(2).max(2000),
        cause: z.enum(CAUSES),
        band: z.union([z.literal(1), z.literal(2), z.literal(3)]).default(2),
        note: z.string().max(500).optional(),
        imageData: z.string().max(2_000_000).optional(), // 压缩后 base64 dataURL
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = getDb();
      const root = await findRootKp(userId, input.kpId);
      const [{ id }] = await db
        .insert(errorLogs)
        .values({
          userId,
          kpId: input.kpId,
          stem: input.stem,
          cause: input.cause,
          band: input.band,
          note: input.note ?? null,
          imageData: input.imageData ?? null,
          rootKpId: root?.id ?? null,
        })
        .$returningId();
      // 提分区间越靠后，复习越密：3 区间（攻坚区）额外加一次当天复习
      const stages = input.band === 3 ? [0, ...REVIEW_STAGES] : REVIEW_STAGES;
      await db.insert(reviewItems).values(
        stages.map((d, i) => ({ errorLogId: id, dueDate: dayStr(d), stageIndex: i })),
      );
      return { id, root };
    }),

  /**
   * 错题自动识别：拍照/附件图片或手写题干 → 大模型 OCR 题干 + 自动匹配知识点 + 归因。
   * 返回结果均可由孩子手动修改；无 AI 时降级为关键词匹配（可能返回空）。
   */
  autoClassify: authedQuery
    .input(
      z.object({
        imageData: z.string().max(2_000_000).optional(), // 压缩后的 dataURL
        stem: z.string().max(2000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!input.imageData && !input.stem) throw new Error("请提供错题图片或题干文字");
      const userId = ctx.user.id;
      const db = getDb();
      const allKps = await db.select().from(knowledgePoints);
      const scoped = (await scopeKpsToUserGrade(userId, allKps)).filter(
        (k) => Array.isArray(k.summary) && (k.summary as unknown[]).length > 0,
      );


      // —— 阶段一：只做转录 + 学科判定（不让模型同时挑知识点，避免跨学科张冠李戴）——
      const subjects = [...new Set(scoped.map((k) => k.subject))];
      const sys1 = `你是 K12 题目识别助手。孩子给了你一道错题（图片或文字）。
请只做两件事：
1. 把题目完整、忠实地转录为文字 stem（保留数字、符号、单位、图形描述；不要编造题目里不存在的内容；不要解答题目）；
2. 判断这道题属于哪个学科 subject，只能从下面列表中选一个：${subjects.join(" / ")}。判断依据是题目本身在考什么（例如有算式、方程、几何图形→数学；有拼音、古诗、阅读理解→语文），不要凭图片颜色或排版猜。

只返回 JSON：{"stem":"题目原文转录","subject":"学科"}`;

      const userContent: ChatMessage["content"] = input.imageData
        ? [
            { type: "text", text: input.stem ? `孩子补充说明：${input.stem}\n请转录这张错题图片上的题目。` : "请转录这张错题图片上的题目。" },
            { type: "image_url", image_url: { url: input.imageData } },
          ]
        : `错题题干：${input.stem}`;

      const stage1 = await tryChatJSON<{ stem?: string; subject?: string }>(
        [
          { role: "system", content: sys1 },
          { role: "user", content: userContent },
        ],
        { timeoutMs: 60000, maxTokens: 3000 },
      );

      const stem = (stage1?.stem ?? input.stem ?? "").trim().slice(0, 2000);
      const detectedSubject = subjects.find((s) => stage1?.subject?.includes(s)) ?? null;

      const validCause = (c: unknown): (typeof CAUSES)[number] | null =>
        typeof c === "string" && (CAUSES as readonly string[]).includes(c) ? (c as (typeof CAUSES)[number]) : null;

      // —— 阶段二：只在判定学科的知识点子集内匹配（纯文本，目录更小更准）——
      if (stem) {
        const pool = detectedSubject ? scoped.filter((k) => k.subject === detectedSubject) : scoped;
        const poolCatalog = pool.map((k) => `${k.id}|${k.chapter}|${k.title}`).join("\n");
        const sys2 = `你是 K12 错题整理助手。这是一道【${detectedSubject ?? "未知学科"}】错题，题目如下：

${stem}

请完成两件事：
1. 从下面候选知识点中选出这道题最直接考查的一个（格式：id|章节|标题），返回其 id。只允许选列表里的，拿不准就选最接近的；
2. 判断孩子最可能的错因，只能从以下五类中选一个：概念不清 / 审题失误 / 计算错误 / 方法不会 / 粗心大意。若无法判断，选「概念不清」。

候选知识点（仅可从这里选）：
${poolCatalog}

只返回 JSON：{"kpId":数字,"cause":"五类之一","confidence":0到1的小数}`;

        const stage2 = await tryChatJSON<{ kpId?: number; cause?: string; confidence?: number }>(
          [
            { role: "system", content: sys2 },
            { role: "user", content: "请匹配知识点并归因。" },
          ],
          { timeoutMs: 60000, maxTokens: 3000 },
        );

        const kpById = new Map(pool.map((k) => [k.id, k]));
        if (stage2 && typeof stage2.kpId === "number" && kpById.has(stage2.kpId)) {
          return {
            stem,
            kpId: stage2.kpId,
            cause: validCause(stage2.cause) ?? "概念不清",
            confidence: Math.max(0, Math.min(1, Number(stage2.confidence) || 0.5)),
            subject: detectedSubject,
            ai: true as const,
          };
        }
      }

      // 降级：关键词匹配（有文字题干时，仍优先限定在判定学科内）
      const text = stem;
      if (text) {
        const pool = detectedSubject ? scoped.filter((k) => k.subject === detectedSubject) : scoped;
        let best: { id: number; score: number } | null = null;
        for (const k of pool) {
          const chars = [...new Set(k.title.replace(/[^一-龥a-zA-Z0-9]/g, "").split(""))];
          const hitCount = chars.filter((c) => text.includes(c)).length;
          const s = chars.length ? hitCount / chars.length : 0;
          if (!best || s > best.score) best = { id: k.id, score: s };
        }
        if (best && best.score >= 0.5) {
          return { stem: text.slice(0, 2000), kpId: best.id, cause: "概念不清" as const, confidence: 0.3, subject: detectedSubject, ai: false as const };
        }
        return { stem: text.slice(0, 2000), kpId: null, cause: null, confidence: 0, subject: detectedSubject, ai: false as const };
      }
      return { stem: "", kpId: null, cause: null, confidence: 0, subject: null, ai: false as const };

    }),

  /** 错因分析：匹配的常见错因详解 + 前置知识回溯链。 */
  analyze: authedQuery.input(z.object({ errorId: z.number() })).query(async ({ input, ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const err = await ownError(input.errorId, userId);
    const kp = await db.query.knowledgePoints.findFirst({ where: eq(knowledgePoints.id, err.kpId) });
    if (!kp) throw new Error("知识点不存在");
    const [masteryMap, kpIndex] = await Promise.all([getMasteryMap(userId), getKpIndex()]);

    // 回溯链：从本知识点沿前置向上，最多 3 层（内存遍历，无逐条查询）
    const chain: { id: number; code: string; title: string; score: number; isRoot: boolean; isSelf: boolean }[] = [
      { id: kp.id, code: kp.code, title: kp.title, score: masteryMap.get(kp.id) ?? 0, isRoot: err.rootKpId === kp.id, isSelf: true },
    ];
    let frontier = [kp.id];
    const visited = new Set<number>([kp.id]);
    for (let depth = 0; depth < 3 && frontier.length > 0; depth++) {
      const next: number[] = [];
      for (const id of frontier) {
        const node = kpIndex.byId.get(id);
        if (!node) continue;
        for (const code of node.prereqCodes) {
          const pre = kpIndex.byCode.get(code);
          if (!pre || visited.has(pre.id)) continue;
          visited.add(pre.id);
          chain.push({
            id: pre.id,
            code: pre.code,
            title: pre.title,
            score: masteryMap.get(pre.id) ?? 0,
            isRoot: err.rootKpId === pre.id,
            isSelf: false,
          });
          next.push(pre.id);
        }
      }
      frontier = next;
    }
    const matched = kp.commonErrors.find((c) => c.cause === err.cause) ?? null;
    const rootKp = err.rootKpId ? kpIndex.byId.get(err.rootKpId) : null;
    return {
      error: err,
      kp: { id: kp.id, code: kp.code, title: kp.title },
      causeAdvice: matched?.detail ?? null,
      chain,
      root: rootKp ? { id: rootKp.id, code: rootKp.code, title: rootKp.title, score: masteryMap.get(rootKp.id) ?? 0 } : null,
    };
  }),

  /** 变式训练题：优先根因知识点，其次本知识点；无变式题时回退到练习题。 */
  getVariant: authedQuery.input(z.object({ errorId: z.number() })).query(async ({ input, ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const err = await ownError(input.errorId, userId);
    const kpIds = [err.rootKpId, err.kpId].filter((v): v is number => v != null);
    let qs = await db
      .select()
      .from(questions)
      .where(and(inArray(questions.kpId, kpIds), eq(questions.stage, "variant")))
      .limit(5);
    if (qs.length === 0) {
      qs = await db
        .select()
        .from(questions)
        .where(and(inArray(questions.kpId, kpIds), eq(questions.stage, "practice")))
        .limit(5);
    }
    const kpIndex = await getKpIndex();
    return qs.map((q) => ({ ...q, kpTitle: kpIndex.byId.get(q.kpId)?.title ?? "" }));
  }),

  /** 提交变式答案：连续答对 3 题判定掌握。 */
  submitVariant: authedQuery
    .input(z.object({ errorId: z.number(), questionId: z.number(), given: z.string() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = getDb();
      const err = await ownError(input.errorId, userId);
      const q = await db.query.questions.findFirst({ where: eq(questions.id, input.questionId) });
      if (!q) throw new Error("题目不存在");
      const correct = grade(q, input.given);
      await db.insert(attempts).values({ userId, questionId: q.id, kpId: q.kpId, stage: "variant", correct, given: input.given.slice(0, 255) });
      await adjustMastery(userId, q.kpId, correct ? 1 : 0, 1);

      const streak = correct ? err.variantStreak + 1 : 0;
      const mastered = streak >= 3;
      await db
        .update(errorLogs)
        .set({ variantStreak: streak, status: mastered ? "mastered" : "active" })
        .where(and(eq(errorLogs.id, input.errorId), eq(errorLogs.userId, userId)));
      if (mastered) {
        // 已掌握：清掉剩余复习安排
        await db.delete(reviewItems).where(and(eq(reviewItems.errorLogId, input.errorId), eq(reviewItems.done, false)));
      }
      return { correct, answer: q.answer.split("|")[0], explanation: q.explanation, streak, mastered };
    }),

  /** 今日复习队列。 */
  todayReviews: authedQuery.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const today = dayStr();
    const errIds = await myErrorIds(userId);
    if (errIds.length === 0) return [];
    const due = await db
      .select()
      .from(reviewItems)
      .where(and(eq(reviewItems.done, false), lte(reviewItems.dueDate, today), inArray(reviewItems.errorLogId, errIds)))
      .orderBy(asc(reviewItems.dueDate));
    if (due.length === 0) return [];
    const [dueErrs, kpIndex] = await Promise.all([
      db.select().from(errorLogs).where(inArray(errorLogs.id, [...new Set(due.map((d) => d.errorLogId))])),
      getKpIndex(),
    ]);
    const errMap = new Map(dueErrs.map((e) => [e.id, e]));
    const out = [];
    for (const it of due) {
      const err = errMap.get(it.errorLogId);
      if (!err || err.status !== "active") continue;
      const kp = kpIndex.byId.get(err.kpId);
      out.push({ ...it, kpTitle: kp?.title ?? "", stem: err.stem, cause: err.cause, band: err.band });
    }
    return out;
  }),

  /** 完成一次复习：答错则明天再战。 */
  completeReview: authedQuery
    .input(z.object({ reviewItemId: z.number(), correct: z.boolean() }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = getDb();
      const item = await db.query.reviewItems.findFirst({ where: eq(reviewItems.id, input.reviewItemId) });
      if (!item) throw new Error("复习项不存在");
      // 校验该复习项属于当前用户（经错题归属）
      await ownError(item.errorLogId, userId);
      await db.update(reviewItems).set({ done: true, doneAt: new Date() }).where(eq(reviewItems.id, input.reviewItemId));
      if (!input.correct) {
        await db.insert(reviewItems).values({ errorLogId: item.errorLogId, dueDate: dayStr(1), stageIndex: item.stageIndex });
        await db
          .update(errorLogs)
          .set({ variantStreak: 0 })
          .where(and(eq(errorLogs.id, item.errorLogId), eq(errorLogs.userId, userId)));
      }
      return { ok: true };
    }),
});
