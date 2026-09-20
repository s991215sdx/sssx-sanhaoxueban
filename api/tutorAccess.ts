import { and, eq } from "drizzle-orm";
import { studentProfile, studentTutor } from "@db/schema";

type Db = ReturnType<typeof import("./queries/connection").getDb>;

/**
 * V56：判定某学员是否在某伴学师名下。
 * 命中条件（任一）：student_profile.tutor_id 主管伴学师，或 student_tutor 多对多分配表中有记录。
 */
export async function isMyStudent(db: Db, tutorUserId: number, studentUserId: number): Promise<boolean> {
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
