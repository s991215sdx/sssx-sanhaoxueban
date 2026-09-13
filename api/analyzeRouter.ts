import { z } from "zod";
import { asc } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { knowledgePoints } from "@db/schema";
import { getMasteryMap, scopeKpsToUserGrade } from "./helpers";
import { tryChatJSON, type ChatMessage } from "./ai";

/**
 * 首页全能入口：文字 / 图片丢进来，AI 自动分析。
 * 判断意图（问知识 / 传错题 / 聊学习状态），匹配知识点，
 * 结合掌握度给出查漏补缺的系统性方案。无 AI 时降级为关键词匹配。
 */
export const analyzeRouter = createRouter({
  analyze: authedQuery
    .input(
      z.object({
        text: z.string().max(2000).optional(),
        imageData: z.string().max(2_000_000).optional(),
      }),
    )
    .mutation(async ({ input, ctx }) => {
      if (!input.text?.trim() && !input.imageData) throw new Error("说点什么，或传一张图片吧");
      const userId = ctx.user.id;
      const db = getDb();

      const [allKps, masteryMap] = await Promise.all([
        db.select().from(knowledgePoints).orderBy(asc(knowledgePoints.sortOrder)),
        getMasteryMap(userId),
      ]);
      const scoped = (await scopeKpsToUserGrade(userId, allKps)).filter(
        (k) => Array.isArray(k.summary) && (k.summary as unknown[]).length > 0,
      );
      const withScore = scoped.map((k) => ({ ...k, score: masteryMap.get(k.id) ?? 0 }));
      const weakest = [...withScore].sort((a, b) => a.score - b.score).slice(0, 12);


      // —— 阶段一：有图片时先转录 + 判学科（防止跨学科张冠李戴）——
      const subjects = [...new Set(scoped.map((k) => k.subject))];
      let transcript = input.text?.trim() ?? "";
      let detectedSubject: string | null = null;
      if (input.imageData) {
        const sys1 = `你是 K12 题目识别助手。孩子给了你一张图片（可能是一道题、一页试卷或一段文字）。
请只做两件事：
1. 把图片里的题目/内容完整、忠实地转录为文字 stem（保留数字、符号、单位；不要编造不存在的内容；不要解答）；
2. 判断内容属于哪个学科 subject，只能从下面列表中选一个：${subjects.join(" / ")}。判断依据是内容本身在考什么（有算式、方程、几何→数学；拼音、古诗、阅读理解→语文）。

只返回 JSON：{"stem":"转录文字","subject":"学科"}`;
        const stage1 = await tryChatJSON<{ stem?: string; subject?: string }>(
          [
            { role: "system", content: sys1 },
            {
              role: "user",
              content: [
                { type: "text", text: input.text?.trim() ? `孩子补充：${input.text.trim()}` : "请转录并识别这张图片。" },
                { type: "image_url", image_url: { url: input.imageData } },
              ] as ChatMessage["content"],
            },
          ],
          { timeoutMs: 60000, maxTokens: 3000 },
        );
        if (stage1?.stem) transcript = stage1.stem.trim().slice(0, 2000);
        detectedSubject = subjects.find((s) => stage1?.subject?.includes(s)) ?? null;
      } else if (transcript) {
        // 纯文字输入：快速判学科，限定匹配范围
        const sysT = `判断下面这段内容属于哪个学科，只能从以下列表选一个，只返回学科名本身：${subjects.join(" / ")}\n\n内容：${transcript}`;
        const sj = await tryChatJSON<{ subject?: string }>(
          [
            { role: "system", content: sysT + `\n\n只返回 JSON：{"subject":"学科"}` },
            { role: "user", content: "请判断学科。" },
          ],
          { timeoutMs: 45000, maxTokens: 800 },
        );
        detectedSubject = subjects.find((s) => sj?.subject?.includes(s)) ?? null;
      }

      const pool = detectedSubject ? withScore.filter((k) => k.subject === detectedSubject) : withScore;
      const poolCatalog = pool.map((k) => `${k.id}|${k.chapter}|${k.title}|掌握度${k.score}`).join("\n");

      const sys = `你是 K12 伴学助手「三好学伴」的智能入口。孩子给你了${input.imageData ? "一张图片（已转录如下）" : "一段文字"}，内容属于【${detectedSubject ?? "未知学科"}】。

【孩子输入的内容】
${transcript || "（未能转录）"}

【孩子当前最薄弱的知识点（掌握度 0-100）】
${weakest.map((k) => `${k.title}(${k.score})`).join("、")}

【本学科知识点（id|章节|标题|掌握度，匹配只允许从这里选）】
${poolCatalog}

请完成：
1. 用 2-4 句亲切的话回应孩子（reply），像大姐姐/大哥哥，句子短；
2. 从知识点列表里选出与这次输入最相关的 1-4 个（matchedKpIds）；
3. 判断这些知识点当前是否薄弱（结合掌握度），给出一条「系统性查漏方案」（planSteps，2-4 步，每步一句话，第一步优先最薄弱的环节）；
4. 给这次输入判一个意图：question（问问题）/ error（传错题）/ chat（聊学习）。

只返回 JSON：{"reply":"...","intent":"question|error|chat","matchedKpIds":[数字],"planSteps":["...","..."]}`;

      type AiResult = { reply?: string; intent?: string; matchedKpIds?: number[]; planSteps?: string[] };
      const parsed = await tryChatJSON<AiResult>(
        [
          { role: "system", content: sys },
          { role: "user", content: transcript ? "请分析并给出方案。" : "孩子只发了一张无法识别的图片，请温柔地请他补充说明。" },
        ],
        { timeoutMs: 45000, maxTokens: 2500 },
      );

      const kpById = new Map(pool.map((k) => [k.id, k]));
      const toKpBrief = (id: number) => {
        const k = kpById.get(id);
        return k ? { id: k.id, code: k.code, title: k.title, subject: k.subject, chapter: k.chapter, score: k.score } : null;
      };

      if (parsed?.reply) {
        const matched = (parsed.matchedKpIds ?? []).map(toKpBrief).filter((x): x is NonNullable<typeof x> => x != null).slice(0, 4);
        return {
          reply: parsed.reply,
          transcript: transcript || null,
          subject: detectedSubject,
          intent: (["question", "error", "chat"].includes(parsed.intent ?? "") ? parsed.intent : "question") as "question" | "error" | "chat",
          matchedKps: matched,
          planSteps: (parsed.planSteps ?? []).filter((s) => typeof s === "string" && s.trim()).slice(0, 4),
          ai: true as const,
        };
      }

      // 降级：关键词匹配（限定在判定学科内）
      const text = transcript;
      const matched = text
        ? pool
            .map((k) => {
              const chars = [...new Set(k.title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").split(""))];
              const hitCount = chars.filter((c) => text.includes(c)).length;
              return { k, s: chars.length ? hitCount / chars.length : 0 };
            })
            .filter((x) => x.s >= 0.5)
            .sort((a, b) => b.s - a.s || a.k.score - b.k.score)
            .slice(0, 4)
            .map((x) => toKpBrief(x.k.id)!)
        : [];
      const focus = matched.length > 0 ? matched : weakest.slice(0, 3).map((k) => toKpBrief(k.id)!);
      return {
        reply:
          matched.length > 0
            ? `我找到了和你说的内容相关的 ${matched.length} 个知识点，可以从掌握度最低的开始补起。`
            : "我暂时没听懂具体是哪块内容，不过下面是你当前最需要补的几个知识点，先从它们开始吧。",
        intent: "question" as const,
        transcript: text || null,
        subject: detectedSubject,
        matchedKps: focus,
        planSteps: focus.map((k, i) => `${i + 1}. 预习「${k.title}」（当前掌握度 ${k.score}），学完做一组小试牛刀`),
        ai: false as const,
      };
    }),
});
