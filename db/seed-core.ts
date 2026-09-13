import { knowledgePoints, questions, mastery } from "./schema";
import { chapter1 } from "./seed-ch1";
import { chapter2 } from "./seed-ch2";
import { chapter3 } from "./seed-ch3";
import { chapter4 } from "./seed-ch4";
import { primarySkeleton } from "./seed-skeleton-primary";
import { juniorSkeleton } from "./seed-skeleton-junior";
import { seniorSkeleton } from "./seed-skeleton-senior";
import { g4Chinese } from "./seed-g4-chinese";
import { g4Math } from "./seed-g4-math";
import { g4English } from "./seed-g4-english";
import { g4Ethics } from "./seed-g4-ethics";
import { g4Science } from "./seed-g4-science";
import { eq } from "drizzle-orm";
import type { KPSeed, SkeletonChapter, SkeletonKP } from "./seed-types";
import type { getDb } from "../api/queries/connection";

export const ALL_KPS: KPSeed[] = [
  ...chapter1,
  ...chapter2,
  ...chapter3,
  ...chapter4,
  ...g4Chinese,
  ...g4Math,
  ...g4English,
  ...g4Ethics,
  ...g4Science,
];

type Db = ReturnType<typeof getDb>;

/** 学科排序权重：同学年内 语文→数学→英语→道德与法治→科学→其他。 */
const SUBJECT_W: Record<string, number> = { YW: 0, EN: 2, DF: 3, KX: 4 };

/**
 * 从 code 解析全局教学顺序。支持两种编码：
 * 数学/存量：G{学段序号}-{章号}-{序号}（如 G7-1-01）
 * 其他学科：G{学段序号}-{学科}-{章号}-{序号}（如 G4-YW-1-01，学科码 YW/EN/DF/KX）
 */
export function sortKeyOf(code: string): number | null {
  const m = /^G(\d+)(?:-([A-Z]+))?-(\d+)-(\d+)$/.exec(code);
  if (!m) return null;
  const w = m[2] ? (SUBJECT_W[m[2]] ?? 9) : 1; // 无学科段 = 数学
  return Number(m[1]) * 1_000_000 + w * 100_000 + Number(m[3]) * 100 + Number(m[4]);
}

/** 章级骨架展开为知识点骨架：章内按标题顺序链接前置，首 KP 前置指向上一章首 KP。 */
export function expandSkeleton(chapters: SkeletonChapter[]): SkeletonKP[] {
  const out: SkeletonKP[] = [];
  for (let ci = 0; ci < chapters.length; ci++) {
    const ch = chapters[ci];
    const prereqChapters = ch.prereq ?? (ci > 0 ? [chapters[ci - 1].code] : []);
    ch.titles.forEach((title, i) => {
      const code = `${ch.code}-${String(i + 1).padStart(2, "0")}`;
      out.push({
        code,
        stage: ch.stage,
        grade: ch.grade,
        chapter: ch.chapter,
        title,
        prereqCodes:
          i === 0 ? prereqChapters.map((c) => `${c}-01`) : [`${ch.code}-${String(i).padStart(2, "0")}`],
        sortOrder: sortKeyOf(code)!,
      });
    });
  }
  return out;
}

export const SKELETON_CHAPTERS: SkeletonChapter[] = [
  ...primarySkeleton,
  ...juniorSkeleton,
  ...seniorSkeleton,
];
export const SKELETON_KPS: SkeletonKP[] = expandSkeleton(SKELETON_CHAPTERS);

/** 幂等铺数据：知识点按 code upsert，题目按知识点重铺。 */
export async function runSeed(db: Db) {
  for (const kp of ALL_KPS) {
    const existing = await db.query.knowledgePoints.findFirst({
      where: eq(knowledgePoints.code, kp.code),
    });
    let kpId: number;
    const payload = {
      stage: kp.stage ?? ("初中" as const), // 深度种子全部为 G7
      grade: kp.grade ?? "初一",
      chapter: kp.chapter,
      title: kp.title,
      summary: kp.summary,
      example: kp.example,
      prereqCodes: kp.prereqCodes,
      commonErrors: kp.commonErrors,
      socratic: kp.socratic,
      sortOrder: sortKeyOf(kp.code) ?? kp.sortOrder,
    };
    if (existing) {
      kpId = existing.id;
      await db.update(knowledgePoints).set(payload).where(eq(knowledgePoints.id, kpId));
    } else {
      const [{ id }] = await db.insert(knowledgePoints).values({ code: kp.code, ...payload }).$returningId();
      kpId = id;
      await db.insert(mastery).values({ kpId, score: 0 });
    }
    await db.delete(questions).where(eq(questions.kpId, kpId));
    if (kp.questions.length > 0) {
      await db.insert(questions).values(
        kp.questions.map((q) => ({
          kpId,
          type: q.type,
          stage: q.stage,
          difficulty: q.difficulty,
          stem: q.stem,
          options: q.options ?? null,
          answer: q.answer,
          hint: q.hint,
          explanation: q.explanation,
        })),
      );
    }
  }
  return ALL_KPS.length;
}

const EMPTY_CONTENT = {
  summary: [] as { heading: string; body: string }[],
  example: { stem: "", analysis: "", answer: "" },
  commonErrors: [] as { cause: string; detail: string }[],
  socratic: { keyConcepts: [] as string[], probes: [] as string[], hints: [] as string[] },
};

/**
 * 幂等铺知识骨架：只插不更新——若 code 已存在（例如与深度内容撞车），
 * 绝不覆盖其精讲/题库。插入后归一全部知识点的 sortOrder 到编码序
 * （存量 G7 深度行的 1..17 并入全学段顺序）。
 */
export async function runSkeletonSeed(db: Db) {
  const existingRows = await db.select({ code: knowledgePoints.code }).from(knowledgePoints);
  const existing = new Set(existingRows.map((r) => r.code));
  const fresh = SKELETON_KPS.filter((k) => !existing.has(k.code));
  const CHUNK = 100;
  for (let i = 0; i < fresh.length; i += CHUNK) {
    await db.insert(knowledgePoints).values(
      fresh.slice(i, i + CHUNK).map((kp) => ({
        code: kp.code,
        stage: kp.stage,
        grade: kp.grade,
        chapter: kp.chapter,
        title: kp.title,
        ...EMPTY_CONTENT,
        prereqCodes: kp.prereqCodes,
        sortOrder: kp.sortOrder,
      })),
    );
  }
  // 归一 sortOrder（幂等：只在不一致时更新）
  const rows = await db.select().from(knowledgePoints);
  for (const r of rows) {
    const want = sortKeyOf(r.code);
    if (want != null && r.sortOrder !== want) {
      await db.update(knowledgePoints).set({ sortOrder: want }).where(eq(knowledgePoints.id, r.id));
    }
  }
  return fresh.length;
}
