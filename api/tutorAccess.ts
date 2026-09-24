import { and, eq } from "drizzle-orm";
import { studentProfile, studentTutor, users } from "@db/schema";

type Db = ReturnType<typeof import("./queries/connection").getDb>;

/**
 * 读取全部学员-伴学师分配记录。
 * 容错：迁移 0020 是后台非阻塞执行的，若 student_tutor 尚未建好（或任何原因查询失败），
 * 退化为空数组——学员列表只按主管伴学师展示，保证页面可用；保存分配时仍会明确报错。
 */
export async function listStudentTutorLinks(db: Db): Promise<{ studentUserId: number; tutorUserId: number }[]> {
  try {
    const rows = await db
      .select({ studentUserId: studentTutor.studentUserId, tutorUserId: studentTutor.tutorUserId })
      .from(studentTutor);
    return rows;
  } catch {
    return [];
  }
}

/**
 * V56：判定某学员是否在某伴学师名下。
 * 命中条件（任一）：student_profile.tutor_id 主管伴学师，或 student_tutor 多对多分配表中有记录。
 * V59：必须同机构（users.orgId 一致），跨机构记录一律不认。
 */
export async function isMyStudent(db: Db, tutorUserId: number, studentUserId: number): Promise<boolean> {
  const [me, target] = await Promise.all([
    db.select({ orgId: users.orgId }).from(users).where(eq(users.id, tutorUserId)).limit(1),
    db.select({ orgId: users.orgId }).from(users).where(eq(users.id, studentUserId)).limit(1),
  ]);
  if (!me[0] || !target[0] || me[0].orgId == null || me[0].orgId !== target[0].orgId) return false;
  const p = (
    await db
      .select({ tutorId: studentProfile.tutorId })
      .from(studentProfile)
      .where(eq(studentProfile.userId, studentUserId))
      .limit(1)
  )[0];
  if (p?.tutorId === tutorUserId) return true;
  const link = await db
    .select({ id: studentTutor.id })
    .from(studentTutor)
    .where(and(eq(studentTutor.studentUserId, studentUserId), eq(studentTutor.tutorUserId, tutorUserId)))
    .limit(1);
  return link.length > 0;
}
