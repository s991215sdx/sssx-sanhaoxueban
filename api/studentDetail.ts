/**
 * 学员数据聚合：管理员后台与伴学师工作台共用。
 * 隐私边界：树洞只返回心情分，不返回文字内容。
 */
import { and, desc, eq, sql } from "drizzle-orm";
import {
  assessmentResults,
  attempts,
  dailyPlans,
  errorLogs,
  moodEntries,
  organizations,
  previewSessions,
  studentProfile,
  users,
} from "@db/schema";
import type { MbtiResult, DiscResult, E3V27Result, E3V37Result } from "@contracts/assessments";
import type { MultiResult } from "@contracts/multi";
import type { AcademicsData } from "@contracts/academics";

type Db = ReturnType<typeof import("./queries/connection").getDb>;

export type StudentListItem = {
  userId: number;
  name: string;
  phone: string | null;
  grade: string | null;
  school: string | null;
  mbti: string | null;
  disc: string | null;
  onboarded: boolean;
  /** 主管伴学师（student_profile.tutor_id，兼容旧逻辑；= tutors[0]） */
  tutorId: number | null;
  tutorName: string | null;
  /** V56：名下全部伴学师（多对多，含主管） */
  tutors: { id: number; name: string }[];
  tutorIds: number[];
  /** 学员端功能开关（null=全功能） */
  enabledModules: string[] | null;
  /** V54：报告是否已推送给家长（false=伴学师把关中） */
  reportReleased: boolean;
  /** V55：家长请求推送报告的时间（null=未请求） */
  reportPushRequestedAt: Date | null;
  hasMulti: boolean;
  hasAcademics: boolean;
  /** V60：所属机构品牌名（平台超管看全量时可分辨归属） */
  orgName: string | null;
  errors: number;
  attempts: number;
  plans: number;
  previewsDone: number;
  lastSignInAt: Date;
  createdAt: Date;
};

/** 学员列表（有档案的用户视为学员），含测评标签与学习概览。
 *  V59：orgId 限定机构范围；V60：传 null/undefined（平台超管）返回全量——总系统可查所有机构。 */
export async function listStudents(db: Db, orgId?: number | null): Promise<StudentListItem[]> {
  const profiles = await db.select().from(studentProfile);
  /* 机构范围：number=本机构；null/undefined=全量（平台超管 god mode） */
  const allUsers =
    orgId == null ? await db.select().from(users) : await db.select().from(users).where(eq(users.orgId, orgId));
  const userMap = new Map(allUsers.map((u) => [u.id, u]));
  /* V60：附带机构品牌名，超管看全量列表时可分辨学员归属 */
  const orgRows = await db.select().from(organizations);
  const orgNameMap = new Map(orgRows.map((o) => [o.id, o.brandName]));
  const tutorNameMap = new Map(
    allUsers.filter((u) => u.role === "tutor" || u.role === "admin").map((u) => [u.id, u.name ?? `用户${u.id}`]),
  );

  const countBy = async (table: never, col: never) => {
    const rows = await db
      .select({ userId: col, c: sql<number>`count(*)` })
      .from(table as never)
      .groupBy(col as never);
    return new Map((rows as { userId: number; c: number }[]).map((r) => [r.userId, Number(r.c)]));
  };
  const [errMap, attMap, planMap, prevRows, multiRows] = await Promise.all([
    countBy(errorLogs as never, errorLogs.userId as never),
    countBy(attempts as never, attempts.userId as never),
    countBy(dailyPlans as never, dailyPlans.userId as never),
    db
      .select({ userId: previewSessions.userId, c: sql<number>`count(*)` })
      .from(previewSessions)
      .where(eq(previewSessions.completed, true))
      .groupBy(previewSessions.userId),
    db.select({ userId: assessmentResults.userId }).from(assessmentResults).where(eq(assessmentResults.kind, "multi")),
  ]);
  const prevMap = new Map(prevRows.map((r) => [r.userId, Number(r.c)]));
  const multiSet = new Set(multiRows.map((r) => r.userId));
  // V56：学员-伴学师多对多分配（容错：表未就绪时退化为空）
  const { listStudentTutorLinks } = await import("./tutorAccess");
  const links = await listStudentTutorLinks(db);
  const tutorsOf = (studentUserId: number, primaryTutorId: number | null) => {
    const ids: number[] = [];
    if (primaryTutorId != null) ids.push(primaryTutorId);
    for (const l of links) {
      if (l.studentUserId === studentUserId && !ids.includes(l.tutorUserId)) ids.push(l.tutorUserId);
    }
    return ids;
  };

  return profiles
    .filter((p) => userMap.has(p.userId))
    .map((p) => {
      const u = userMap.get(p.userId)!;
      const tutorIds = tutorsOf(p.userId, p.tutorId ?? null);
      return {
        userId: p.userId,
        name: p.name || u.name || "未命名",
        phone: u.phone ?? null,
        grade: p.grade,
        school: p.school,
        mbti: p.mbti,
        disc: p.disc,
        onboarded: p.onboarded,
        tutorId: p.tutorId ?? null,
        tutorName: p.tutorId != null ? (tutorNameMap.get(p.tutorId) ?? null) : null,
        tutors: tutorIds.map((id) => ({ id, name: tutorNameMap.get(id) ?? `伴学师${id}` })),
        tutorIds,
        enabledModules: p.enabledModules ?? null,
        reportReleased: p.reportReleased,
        reportPushRequestedAt: p.reportPushRequestedAt ?? null,
        hasMulti: multiSet.has(p.userId),
        hasAcademics: p.academics != null,
        orgName: u.orgId != null ? (orgNameMap.get(u.orgId) ?? null) : null,
        errors: errMap.get(p.userId) ?? 0,
        attempts: attMap.get(p.userId) ?? 0,
        plans: planMap.get(p.userId) ?? 0,
        previewsDone: prevMap.get(p.userId) ?? 0,
        lastSignInAt: u.lastSignInAt,
        createdAt: u.createdAt,
      };
    })
    .sort((a, b) => b.lastSignInAt.getTime() - a.lastSignInAt.getTime());
}

export type StudentDetail = {
  user: { id: number; name: string | null; phone: string | null; role: string; createdAt: Date; lastSignInAt: Date };
  profile: {
    name: string;
    grade: string;
    school: string | null;
    targetSchool: string | null;
    dailyMinutes: number;
    mbti: string | null;
    disc: string | null;
    onboarded: boolean;
    tutorId: number | null;
  } | null;
  academics: AcademicsData | null;
  assessments: {
    mbti?: MbtiResult;
    disc?: DiscResult;
    /** 最新一条 e3 诊断：V3.7（version "3.7"）或 V2.7 legacy（version "v27"），原样透传，前端按 version 区分。 */
    e3?: E3V27Result | E3V37Result;
    /** 最新一条 e3parent 家长卷结果（V3.7 或 V2.7 legacy），原样透传。 */
    e3parent?: unknown;
    /** 全部家长版 DISC 结果（可多人/多次填写），按时间倒序。 */
    discParents: { label: string; result: unknown; createdAt: Date }[];
    multi?: MultiResult;
    /** 选做测评（multi5/职业锚/霍兰德/心理健康），结构各异，前端按 kind 解析。 */
    optional?: Record<string, unknown>;
    raw: { kind: string; answers: unknown; createdAt: Date }[];
  };
  learning: {
    recentAttempts: { createdAt: Date; correct: boolean; stage: string }[];
    moodRecent: { mood: number; createdAt: Date }[];
    previewsDone: number;
    errorCount: number;
    attemptCount: number;
    planCount: number;
  };
};

/** 单个学员详情：档案 + 学业目标 + 全部测评（含原始作答）+ 学习数据。
 *  V59：传 orgId（number）时校验目标学员属于该机构（跨机构访问直接抛错）；
 *  V60：传 null/undefined 不校验（平台超管可查任意学员）。 */
export async function getStudentDetail(db: Db, userId: number, orgId?: number | null): Promise<StudentDetail> {
  if (orgId != null) {
    const target = (await db.select({ orgId: users.orgId }).from(users).where(eq(users.id, userId)).limit(1))[0];
    if (!target || target.orgId !== orgId) {
      throw new Error("无权查看该学员");
    }
  }
  const u = await db.query.users.findFirst({ where: eq(users.id, userId) });
  if (!u) throw new Error("用户不存在");
  const profile = (await db.select().from(studentProfile).where(eq(studentProfile.userId, userId)).limit(1))[0] ?? null;

  // 测评：每种取最新一条（含原始作答）
  const rows = await db
    .select()
    .from(assessmentResults)
    .where(eq(assessmentResults.userId, userId))
    .orderBy(desc(assessmentResults.createdAt), desc(assessmentResults.id));
  const assessments: StudentDetail["assessments"] = { raw: [], discParents: [] };
  // 选做测评（multi5/职业锚/霍兰德/心理健康三套）也一并带出，供伴学师查看完整报告与综合分析
  const OPTIONAL_KINDS = ["multi5", "anchor", "holland", "mental", "mentalsdq", "mentalpa", "scl90"] as const;
  for (const row of rows) {
    const kind = row.kind;
    if (kind === "discparent") {
      // 家长版 DISC 可多次/多人填写，全部收集（answers.label 作为家长标签）
      const a = row.answers as { label?: string } | null;
      assessments.discParents.push({
        label: a && typeof a.label === "string" && a.label ? a.label : "家长",
        result: row.result,
        createdAt: row.createdAt,
      });
      assessments.raw.push({ kind, answers: row.answers ?? null, createdAt: row.createdAt });
      continue;
    }
    if (kind === "e3parent") {
      // 家长版 e3 只取最新一条，原样透传
      if (assessments.e3parent) continue;
      assessments.e3parent = row.result;
      assessments.raw.push({ kind, answers: row.answers ?? null, createdAt: row.createdAt });
      continue;
    }
    if (kind === "mbti" || kind === "disc" || kind === "e3" || kind === "multi") {
      if (assessments[kind]) continue;
      if (kind === "mbti") assessments.mbti = row.result as unknown as MbtiResult;
      else if (kind === "disc") assessments.disc = row.result as unknown as DiscResult;
      else if (kind === "e3") assessments.e3 = row.result as unknown as E3V27Result | E3V37Result;
      else assessments.multi = row.result as unknown as MultiResult;
    } else if ((OPTIONAL_KINDS as readonly string[]).includes(kind)) {
      assessments.optional ??= {};
      if (kind in assessments.optional) continue;
      assessments.optional[kind] = row.result;
    } else {
      continue;
    }
    assessments.raw.push({ kind, answers: row.answers ?? null, createdAt: row.createdAt });
  }

  const [recentAttempts, moodRecent, previews, errC, attC, planC] = await Promise.all([
    db
      .select({ createdAt: attempts.createdAt, correct: attempts.correct, stage: attempts.stage })
      .from(attempts)
      .where(eq(attempts.userId, userId))
      .orderBy(desc(attempts.createdAt))
      .limit(20),
    db
      .select({ mood: moodEntries.mood, createdAt: moodEntries.createdAt })
      .from(moodEntries)
      .where(eq(moodEntries.userId, userId))
      .orderBy(desc(moodEntries.createdAt))
      .limit(7),
    db
      .select({ id: previewSessions.id })
      .from(previewSessions)
      .where(and(eq(previewSessions.userId, userId), eq(previewSessions.completed, true))),
    db.select({ c: sql<number>`count(*)` }).from(errorLogs).where(eq(errorLogs.userId, userId)),
    db.select({ c: sql<number>`count(*)` }).from(attempts).where(eq(attempts.userId, userId)),
    db.select({ c: sql<number>`count(*)` }).from(dailyPlans).where(eq(dailyPlans.userId, userId)),
  ]);

  return {
    user: { id: u.id, name: u.name, phone: u.phone ?? null, role: u.role, createdAt: u.createdAt, lastSignInAt: u.lastSignInAt },
    profile: profile
      ? {
          name: profile.name,
          grade: profile.grade,
          school: profile.school,
          targetSchool: profile.targetSchool,
          dailyMinutes: profile.dailyMinutes,
          mbti: profile.mbti,
          disc: profile.disc,
          onboarded: profile.onboarded,
          tutorId: profile.tutorId ?? null,
        }
      : null,
    academics: (profile?.academics as AcademicsData | null) ?? null,
    assessments,
    learning: {
      recentAttempts,
      moodRecent,
      previewsDone: previews.length,
      errorCount: Number((errC[0] as { c: number })?.c ?? 0),
      attemptCount: Number((attC[0] as { c: number })?.c ?? 0),
      planCount: Number((planC[0] as { c: number })?.c ?? 0),
    },
  };
}
