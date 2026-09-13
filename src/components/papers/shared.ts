/** 试卷分析共享类型与小工具（前端侧）。 */
import type { PaperItemSeed } from "@db/schema";

export type { PaperItemSeed };

/** 每个提分区间的统计：题数 + 可捞回的分数。 */
export type BandStat = { count: number; lost: number };

/** paper.analyze 返回 / papers.summary 写回的分析摘要结构。 */
export type PaperSummary = {
  total: number;
  right: number;
  wrong: number;
  half: number;
  bandCounts: Record<string, number>;
  bandScores: Record<string, BandStat>;
  totalLost: number; // 这张卷子一共还能捞回多少分
  topCauses: { cause: string; count: number }[];
  advice: string[];
  linkedErrorIds: number[];
  itemErrorMap: Record<string, number>; // 题号 → 错题 id（跳转引导学习用）
};

/** 从 papers.summary（Record<string, unknown>）安全解析摘要。 */
export function parseSummary(raw: unknown): PaperSummary | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (typeof s.total !== "number" || !Array.isArray(s.advice)) return null;
  const bandCounts = (s.bandCounts ?? {}) as Record<string, number>;
  const rawScores = (s.bandScores ?? {}) as Record<string, BandStat>;
  // 旧数据没有 bandScores 时按题数兜底（每题按 5 分估）
  const bandScores: Record<string, BandStat> = {};
  for (const b of ["1", "2", "3"]) {
    bandScores[b] = rawScores[b] ?? { count: bandCounts[b] ?? 0, lost: 0 };
  }
  return {
    total: Number(s.total ?? 0),
    right: Number(s.right ?? 0),
    wrong: Number(s.wrong ?? 0),
    half: Number(s.half ?? 0),
    bandCounts,
    bandScores,
    totalLost: Number(s.totalLost ?? 0),
    topCauses: Array.isArray(s.topCauses) ? (s.topCauses as PaperSummary["topCauses"]) : [],
    advice: s.advice as string[],
    linkedErrorIds: Array.isArray(s.linkedErrorIds) ? (s.linkedErrorIds as number[]) : [],
    itemErrorMap: (s.itemErrorMap ?? {}) as Record<string, number>,
  };
}

export const ITEM_RESULT_LABEL: Record<PaperItemSeed["result"], string> = {
  right: "做对",
  wrong: "做错",
  half: "半对",
};

/** 五种错因（与后端一致）。 */
export const PAPER_CAUSES = ["概念不清", "审题失误", "计算错误", "方法不会", "粗心大意"] as const;

/** UTC+8 的今天 YYYY-MM-DD。 */
export function todayStr(): string {
  return new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
}

/** 默认试卷标题：X 月 X 日试卷。 */
export function defaultPaperTitle(): string {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  return `${d.getUTCMonth() + 1}月${d.getUTCDate()}日试卷`;
}
