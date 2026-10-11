/**
 * v96：学员删除 / 回收站。
 * 软删 = users.deleted_at 打时间戳：学员从所有列表消失、无法登录（middleware 拦截），
 * 数据保留 2 个月（RETENTION_MS）——期间可在回收站一键恢复；
 * 到期未恢复则由 purgeExpiredStudents 物理清除该学员的全部数据（惰性触发：
 * 服务启动时 + 每次打开回收站时各扫一遍）。
 */
import { eq, isNotNull } from "drizzle-orm";
import {
  academicRecords,
  assessmentResults,
  attempts,
  dailyPlans,
  errorLogs,
  guideSessions,
  mastery,
  moodEntries,
  papers,
  previewSessions,
  recordings,
  studentPrescriptions,
  studentProfile,
  studentTutor,
  tutorSessions,
  users,
} from "@db/schema";

type Db = ReturnType<typeof import("./queries/connection").getDb>;

/** 删除后保留期限：2 个月（按 62 天计）。 */
export const RETENTION_DAYS = 62;
export const RETENTION_MS = RETENTION_DAYS * 24 * 3600 * 1000;

/** 该学员数据所在的全部业务表（student_tutor/student_prescriptions 走 studentUserId 单独删，users 本体最后删）。 */
const USER_DATA_TABLES = [
  studentProfile,
  assessmentResults,
  academicRecords,
  attempts,
  dailyPlans,
  errorLogs,
  guideSessions,
  mastery,
  moodEntries,
  papers,
  previewSessions,
  recordings,
  tutorSessions,
] as const;

/** 物理清除单个学员的全部数据（不可恢复）。 */
export async function purgeStudent(db: Db, userId: number): Promise<void> {
  for (const t of USER_DATA_TABLES) {
    await db.delete(t).where(eq((t as { userId?: unknown }).userId as never, userId) as never);
  }
  await db.delete(studentTutor).where(eq(studentTutor.studentUserId, userId));
  await db.delete(studentPrescriptions).where(eq(studentPrescriptions.studentUserId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

/** 惰性清理：把保留期超期仍未恢复的已删学员物理清除，返回清除人数。 */
export async function purgeExpiredStudents(db: Db): Promise<number> {
  const rows = await db
    .select({ id: users.id, deletedAt: users.deletedAt })
    .from(users)
    .where(isNotNull(users.deletedAt));
  const now = Date.now();
  let purged = 0;
  for (const r of rows) {
    if (r.deletedAt && now - r.deletedAt.getTime() >= RETENTION_MS) {
      await purgeStudent(db, r.id);
      purged++;
    }
  }
  return purged;
}

export type DeletedStudentItem = {
  userId: number;
  name: string;
  phone: string | null;
  grade: string | null;
  deletedAt: Date;
  /** 距物理清除还剩的完整天数（0 = 今天内随时可能被清） */
  remainingDays: number;
};

/** 回收站列表：已软删、仍有学员档案的用户（只列学员，不列伴学师/管理员）。 */
export async function listDeletedStudents(db: Db, orgId?: number | null): Promise<DeletedStudentItem[]> {
  const deletedUsers = await db
    .select()
    .from(users)
    .where(isNotNull(users.deletedAt));
  const profiles = await db.select().from(studentProfile);
  const profileByUser = new Map(profiles.map((p) => [p.userId, p]));
  const now = Date.now();
  return deletedUsers
    .filter((u) => u.deletedAt != null)
    .filter((u) => profileByUser.has(u.id))
    .filter((u) => orgId == null || u.orgId === orgId)
    .map((u) => {
      const p = profileByUser.get(u.id)!;
      const deletedAt = u.deletedAt!;
      const remainingMs = deletedAt.getTime() + RETENTION_MS - now;
      return {
        userId: u.id,
        name: p.name || u.name || "未命名",
        phone: u.phone ?? null,
        grade: p.grade,
        deletedAt,
        remainingDays: Math.max(0, Math.ceil(remainingMs / (24 * 3600 * 1000))),
      };
    })
    .sort((a, b) => b.deletedAt.getTime() - a.deletedAt.getTime());
}
