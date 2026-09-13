import { and, eq } from "drizzle-orm";
import { mastery, knowledgePoints, previewSessions, studentProfile } from "@db/schema";
import { getDb } from "./queries/connection";

/** 全角转半角、统一符号、去空白和句尾标点，用于答案比对。 */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xfee0))
    .replace(/×/g, "*")
    .replace(/÷/g, "/")
    .replace(/\s+/g, "")
    .replace(/[。．.,，、;；:：!！?？'"“”‘’]+$/g, "")
    .replace(/^(答|答案是|答案)[:：]?/g, "");
}

export function grade(question: { type: string; answer: string }, given: string): boolean {
  const g = normalize(given);
  if (!g) return false;
  return question.answer.split("|").some((a) => normalize(a) === g);
}

/** 掌握度：指数滑动平均，新一批正确率权重 0.5。 */
export async function adjustMastery(userId: number, kpId: number, correct: number, total: number) {
  if (total <= 0) return;
  const db = getDb();
  const row = await db.query.mastery.findFirst({ where: and(eq(mastery.userId, userId), eq(mastery.kpId, kpId)) });
  const pct = Math.round((correct / total) * 100);
  const prev = row?.score ?? 0;
  // 首次接触权重大一些，之后平滑更新
  const next = prev === 0 ? pct : Math.round(prev * 0.5 + pct * 0.5);
  if (row) {
    await db.update(mastery).set({ score: next, updatedAt: new Date() }).where(eq(mastery.id, row.id));
  } else {
    await db.insert(mastery).values({ userId, kpId, score: next });
  }
}

export async function getMasteryMap(userId: number) {
  const db = getDb();
  const rows = await db.select().from(mastery).where(eq(mastery.userId, userId));
  return new Map(rows.map((r) => [r.kpId, r.score]));
}

/** 一次性加载全部知识点，返回按 id / code 索引的 Map（避免 N+1 查询）。 */
export async function getKpIndex() {
  const db = getDb();
  const rows = await db.select().from(knowledgePoints);
  return {
    byId: new Map(rows.map((r) => [r.id, r])),
    byCode: new Map(rows.map((r) => [r.code, r])),
    all: rows,
  };
}

/** 按学生档案年级过滤知识点：多学科多年级铺开后，推荐/统计只看自己年级（无档案回退初一）。 */
export async function scopeKpsToUserGrade<T extends { grade: string }>(userId: number, kps: T[]): Promise<T[]> {
  const db = getDb();
  const profile = await db.query.studentProfile.findFirst({ where: eq(studentProfile.userId, userId) });
  const grade = profile?.grade ?? "初一";
  return kps.filter((k) => k.grade === grade);
}

/** 已完成预习的知识点 id 集合。 */
export async function getPreviewedSet(userId: number) {
  const db = getDb();
  const rows = await db
    .select({ kpId: previewSessions.kpId })
    .from(previewSessions)
    .where(and(eq(previewSessions.userId, userId), eq(previewSessions.completed, true)));
  return new Set(rows.map((r) => r.kpId));
}

/** 掌握度兜底：低于 min 时提升到 min（用于「完成预习」等里程碑）。 */
export async function bumpMasteryFloor(userId: number, kpId: number, min: number) {
  const db = getDb();
  const row = await db.query.mastery.findFirst({ where: and(eq(mastery.userId, userId), eq(mastery.kpId, kpId)) });
  if (!row) {
    await db.insert(mastery).values({ userId, kpId, score: min });
  } else if (row.score < min) {
    await db.update(mastery).set({ score: min, updatedAt: new Date() }).where(eq(mastery.id, row.id));
  }
}

/** 东八区日期串，offsetDays 可为负。 */
export function dayStr(offsetDays = 0): string {
  const d = new Date(Date.now() + 8 * 3600 * 1000 + offsetDays * 86400 * 1000);
  return d.toISOString().slice(0, 10);
}

export const REVIEW_STAGES = [1, 3, 7, 15, 30];

/** 沿前置链回溯，找出掌握度低于 60 的最弱前置知识点（根因候选）。单次加载全部知识点，内存遍历。 */
export async function findRootKp(userId: number, kpId: number): Promise<{ id: number; title: string; code: string; score: number } | null> {
  const [{ byId, byCode }, masteryMap] = await Promise.all([getKpIndex(), getMasteryMap(userId)]);
  const visited = new Set<number>();
  let weakest: { id: number; title: string; code: string; score: number } | null = null;
  let frontier = [kpId];
  for (let depth = 0; depth < 3 && frontier.length > 0; depth++) {
    const next: number[] = [];
    for (const id of frontier) {
      if (visited.has(id)) continue;
      visited.add(id);
      const kp = byId.get(id);
      if (!kp) continue;
      for (const code of kp.prereqCodes) {
        const pre = byCode.get(code);
        if (!pre) continue;
        // 骨架占位（无精讲内容）不能作为根因学习对象，跳过但继续沿链回溯
        if (Array.isArray(pre.summary) && pre.summary.length === 0) {
          next.push(pre.id);
          continue;
        }
        const score = masteryMap.get(pre.id) ?? 0;
        if (score < 60 && (!weakest || score < weakest.score)) {
          weakest = { id: pre.id, title: pre.title, code: pre.code, score };
        }
        next.push(pre.id);
      }
    }
    frontier = next;
  }
  return weakest;
}
