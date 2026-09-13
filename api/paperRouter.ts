import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { errorLogs, papers, reviewItems, type PaperItemSeed } from "@db/schema";
import { dayStr, findRootKp, getKpIndex, REVIEW_STAGES } from "./helpers";

const CAUSES = ["概念不清", "审题失误", "计算错误", "方法不会", "粗心大意"] as const;
type Cause = (typeof CAUSES)[number];

/** 未给错因时按提分区间推断：送分区多为粗心，提分区多为方法，攻坚区多为概念。 */
const BAND_DEFAULT_CAUSE: Record<1 | 2 | 3, Cause> = {
  1: "粗心大意",
  2: "方法不会",
  3: "概念不清",
};

const DEFAULT_ITEM_SCORE = 5;

const itemSeedSchema = z.object({
  no: z.number().int().min(1),
  result: z.enum(["right", "wrong", "half"]),
  band: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(),
  kpCode: z.string().max(32).optional(),
  cause: z.string().max(32).optional(),
  note: z.string().max(500).optional(),
  score: z.number().min(0.5).max(100).optional(), // 该题分值
});

/** 一题丢掉的分：做错全丢，半对丢一半。 */
function lostOf(it: { result: "right" | "wrong" | "half"; score?: number }): number {
  const s = it.score ?? DEFAULT_ITEM_SCORE;
  if (it.result === "wrong") return s;
  if (it.result === "half") return Math.round((s / 2) * 10) / 10;
  return 0;
}

/** 校验试卷属于当前用户，返回试卷。 */
async function ownPaper(id: number, userId: number) {
  const db = getDb();
  const paper = await db.query.papers.findFirst({ where: and(eq(papers.id, id), eq(papers.userId, userId)) });
  if (!paper) throw new Error("试卷不存在");
  return paper;
}

export const paperRouter = createRouter({
  /** 试卷列表：不含 images/items 大字段，只带统计。 */
  list: authedQuery.query(async ({ ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const rows = await db
      .select({
        id: papers.id,
        title: papers.title,
        examDate: papers.examDate,
        score: papers.score,
        createdAt: papers.createdAt,
        items: papers.items,
        summary: papers.summary,
      })
      .from(papers)
      .where(eq(papers.userId, userId))
      .orderBy(desc(papers.createdAt));
    return rows.map((p) => {
      const bandCounts = (p.summary?.bandCounts ?? { 1: 0, 2: 0, 3: 0 }) as Record<string, number>;
      const totalLost = typeof p.summary?.totalLost === "number" ? (p.summary.totalLost as number) : null;
      return {
        id: p.id,
        title: p.title,
        examDate: p.examDate,
        score: p.score,
        createdAt: p.createdAt,
        itemCount: p.items.length,
        bandCounts: { 1: bandCounts["1"] ?? 0, 2: bandCounts["2"] ?? 0, 3: bandCounts["3"] ?? 0 },
        totalLost,
      };
    });
  }),

  /** 单卷完整数据（含 images base64 与逐题 items）。 */
  get: authedQuery.input(z.object({ id: z.number() })).query(async ({ input, ctx }) => {
    return ownPaper(input.id, ctx.user.id);
  }),

  /** 先建空卷（照片），再逐题定性分析。 */
  create: authedQuery
    .input(
      z.object({
        title: z.string().min(1).max(128),
        examDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        score: z.string().max(32).optional(),
        images: z.array(z.string().max(2_000_000)).max(6), // 每张压缩后 ≤1.5MB 的 base64 dataURL
      }),
    )
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = getDb();
      const [{ id }] = await db
        .insert(papers)
        .values({
          userId,
          title: input.title,
          examDate: input.examDate ?? null,
          score: input.score ?? null,
          images: input.images,
          items: [],
        })
        .$returningId();
      return { id };
    }),

  /**
   * 考试分析三步法：①保存逐题定性 ②统计 bandCounts/各区间可捞分数/错因分布
   * ③wrong/half 且 kpCode 可匹配的题自动入错题本（带 band/cause + 间隔复习计划，band3 加当天复习）。
   */
  analyze: authedQuery
    .input(z.object({ id: z.number(), items: z.array(itemSeedSchema).min(1).max(200) }))
    .mutation(async ({ input, ctx }) => {
      const userId = ctx.user.id;
      const db = getDb();
      const paper = await ownPaper(input.id, userId);

      const items: PaperItemSeed[] = input.items;
      const right = items.filter((i) => i.result === "right").length;
      const wrong = items.filter((i) => i.result === "wrong").length;
      const half = items.filter((i) => i.result === "half").length;
      const bandCounts: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
      const bandLost: Record<1 | 2 | 3, number> = { 1: 0, 2: 0, 3: 0 };
      let totalLost = 0;
      for (const it of items) {
        const lost = lostOf(it);
        totalLost += lost;
        if ((it.result === "wrong" || it.result === "half") && (it.band === 1 || it.band === 2 || it.band === 3)) {
          bandCounts[it.band] += 1;
          bandLost[it.band] = Math.round((bandLost[it.band] + lost) * 10) / 10;
        }
      }
      totalLost = Math.round(totalLost * 10) / 10;
      const causeCount = new Map<string, number>();

      // ③ 错题入库：仅当 kpCode 在知识点索引中存在才入错题本（未知 code 忽略但已计数）
      const kpIndex = await getKpIndex();
      const linkedErrorIds: number[] = [];
      const itemErrorMap: Record<number, number> = {}; // 题号 → 错题 id（前端直接跳引导学习）
      for (const it of items) {
        if (it.result === "right") continue;
        const band = it.band ?? 2;
        const cause: Cause = (CAUSES as readonly string[]).includes(it.cause ?? "")
          ? (it.cause as Cause)
          : BAND_DEFAULT_CAUSE[band];
        causeCount.set(cause, (causeCount.get(cause) ?? 0) + 1);
        const kp = it.kpCode ? kpIndex.byCode.get(it.kpCode) : undefined;
        if (!kp) continue;
        const root = await findRootKp(userId, kp.id);
        const lost = lostOf(it);
        const [{ id }] = await db
          .insert(errorLogs)
          .values({
            userId,
            kpId: kp.id,
            stem: `试卷《${paper.title}》第${it.no}题`,
            cause,
            band,
            note: [it.note, lost > 0 ? `这题丢了 ${lost} 分` : null].filter(Boolean).join("；") || null,
            rootKpId: root?.id ?? null,
          })
          .$returningId();
        // 复刻 addError：提分区间越靠后复习越密，攻坚区额外加一次当天复习
        const stages = band === 3 ? [0, ...REVIEW_STAGES] : REVIEW_STAGES;
        await db.insert(reviewItems).values(
          stages.map((d, i) => ({ errorLogId: id, dueDate: dayStr(d), stageIndex: i })),
        );
        linkedErrorIds.push(id);
        itemErrorMap[it.no] = id;
      }

      const topCauses = [...causeCount.entries()]
        .map(([cause, count]) => ({ cause, count }))
        .sort((a, b) => b.count - a.count);

      // 所见即所得：每个区间直接告诉孩子「搞定它就能多拿几分」
      const bandScores = {
        1: { count: bandCounts[1], lost: bandLost[1] },
        2: { count: bandCounts[2], lost: bandLost[2] },
        3: { count: bandCounts[3], lost: bandLost[3] },
      };
      const advice: string[] = [];
      if (bandCounts[1] > 0) {
        advice.push(
          `送分区 ${bandCounts[1]} 题、共 ${bandLost[1]} 分：这些是本该拿下的分，今晚逐题重做一遍，下次考试直接多拿 ${bandLost[1]} 分。`,
        );
      }
      if (bandCounts[2] > 0) {
        advice.push(
          `提分区 ${bandCounts[2]} 题、共 ${bandLost[2]} 分：讲一遍就能会的题，先回例题盖住答案重做，再做同类变式，这 ${bandLost[2]} 分很快到手。`,
        );
      }
      if (bandCounts[3] > 0) {
        advice.push(
          `攻坚区 ${bandCounts[3]} 题、共 ${bandLost[3]} 分：根子可能在更早的知识，已帮你回溯根因并安排了更密的复习。别急着硬啃，弄懂一个是一个。`,
        );
      }
      if (advice.length === 0) {
        advice.push("这张卷子没有错题，状态很好！保持「先预习、勤复习」的节奏继续向前。");
      }

      const summary = {
        total: items.length,
        right,
        wrong,
        half,
        bandCounts,
        bandScores,
        totalLost,
        topCauses,
        advice,
        linkedErrorIds,
        itemErrorMap,
      };
      await db
        .update(papers)
        .set({ items, summary })
        .where(and(eq(papers.id, input.id), eq(papers.userId, userId)));
      return { summary };
    }),

  remove: authedQuery.input(z.object({ id: z.number() })).mutation(async ({ input, ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    await ownPaper(input.id, userId);
    await db.delete(papers).where(and(eq(papers.id, input.id), eq(papers.userId, userId)));
    return { ok: true };
  }),
});
