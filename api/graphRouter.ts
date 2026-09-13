import { z } from "zod";
import { asc, eq, inArray } from "drizzle-orm";
import { createRouter, authedQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { knowledgePoints, questions } from "@db/schema";
import { getMasteryMap, getPreviewedSet, scopeKpsToUserGrade } from "./helpers";

/** 知识点是否有深度内容（精讲非空）；骨架占位 KP 的 summary 为空数组。 */
function hasContent(kp: { summary: unknown }): boolean {
  return Array.isArray(kp.summary) && kp.summary.length > 0;
}

export const graphRouter = createRouter({
  /**
   * 全部章节与知识点（含掌握度 + 是否已预习），按教学顺序排列。
   * 默认只返回有深度内容的知识点；withEmpty=true 时含骨架占位 KP
   * （预习中心用它展示「精讲内容建设中」）。
   */
  overview: authedQuery
    .input(z.object({ withEmpty: z.boolean().optional(), allGrades: z.boolean().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const userId = ctx.user.id;
      const db = getDb();
      const [allKps, masteryMap, previewedSet] = await Promise.all([
        db.select().from(knowledgePoints).orderBy(asc(knowledgePoints.sortOrder)),
        getMasteryMap(userId),
        getPreviewedSet(userId),
      ]);
      // 默认按学生档案年级过滤（伴学档案/仪表盘/报告等场景）；
      // allGrades=true 时返回全部年级（预习中心的年级选择器用）。
      const graded = input?.allGrades ? allKps : await scopeKpsToUserGrade(userId, allKps);
      const kps = input?.withEmpty ? graded : graded.filter(hasContent);
      const chapters: {
        name: string;
        stage: string;
        grade: string;
        subject: string;
        avg: number;
        kps: {
          id: number;
          code: string;
          title: string;
          score: number;
          previewed: boolean;
          prereqCodes: string[];
          hasContent: boolean;
        }[];
      }[] = [];
      for (const kp of kps) {
        // 同名章可能跨年级/学科出现，按 年级+学科+章 分组
        let ch = chapters.find((c) => c.grade === kp.grade && c.subject === kp.subject && c.name === kp.chapter);
        if (!ch) {
          ch = { name: kp.chapter, stage: kp.stage, grade: kp.grade, subject: kp.subject, avg: 0, kps: [] };
          chapters.push(ch);
        }
        ch.kps.push({
          id: kp.id,
          code: kp.code,
          title: kp.title,
          score: masteryMap.get(kp.id) ?? 0,
          previewed: previewedSet.has(kp.id),
          prereqCodes: kp.prereqCodes,
          hasContent: hasContent(kp),
        });
      }
      for (const ch of chapters) {
        ch.avg = ch.kps.length ? Math.round(ch.kps.reduce((s, k) => s + k.score, 0) / ch.kps.length) : 0;
      }
      return chapters;
    }),

  /** 单个知识点详情（精讲内容，不含题目答案）。 */
  detail: authedQuery.input(z.object({ code: z.string() })).query(async ({ input, ctx }) => {
    const userId = ctx.user.id;
    const db = getDb();
    const kp = await db.query.knowledgePoints.findFirst({ where: eq(knowledgePoints.code, input.code) });
    if (!kp) throw new Error("知识点不存在");
    const masteryMap = await getMasteryMap(userId);
    const preRows = kp.prereqCodes.length
      ? await db.select().from(knowledgePoints).where(inArray(knowledgePoints.code, kp.prereqCodes))
      : [];
    const prereqs = preRows.map((pre) => ({ id: pre.id, code: pre.code, title: pre.title, score: masteryMap.get(pre.id) ?? 0 }));
    const qCount = await db.select({ id: questions.id }).from(questions).where(eq(questions.kpId, kp.id));
    return {
      ...kp,
      hasContent: hasContent(kp),
      score: masteryMap.get(kp.id) ?? 0,
      prereqs: prereqs.filter((p) => p !== null),
      questionCount: qCount.length,
    };
  }),
});
