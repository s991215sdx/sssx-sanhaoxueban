import { and, eq, inArray } from "drizzle-orm";
import { inviteChannels, inviteRegistrations, studentProfile, studentTutor, users } from "@db/schema";

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

/** v169：分配记录 + 报告权限（容错：迁移未跑完时退化为「有记录但无权限信息」= 默认放行，兼容存量）。 */
export type TutorLink = {
  studentUserId: number;
  tutorUserId: number;
  reportAccess: boolean | null;
  reportAccessExpiresAt: Date | null;
};

export async function listTutorLinksWithAccess(db: Db): Promise<TutorLink[]> {
  try {
    return await db
      .select({
        studentUserId: studentTutor.studentUserId,
        tutorUserId: studentTutor.tutorUserId,
        reportAccess: studentTutor.reportAccess,
        reportAccessExpiresAt: studentTutor.reportAccessExpiresAt,
      })
      .from(studentTutor);
  } catch {
    const links = await listStudentTutorLinks(db);
    return links.map((l) => ({ ...l, reportAccess: null, reportAccessExpiresAt: null }));
  }
}

/**
 * v169：某伴学师对某学员的测评报告查看权限。
 * report_access=true 且（未设有效期或尚未到期）→ allowed。
 * v170 修正：查不到分配记录 → 放行（存量主管/渠道关系早于 v169，无显式记录不收紧），
 * 新关系（注册/分配时写入的显式记录）一律按记录执行——未付费老师的新学员因此默认无报告权限。
 */
export async function getTutorReportAccess(
  db: Db,
  tutorUserId: number,
  studentUserId: number,
): Promise<{ allowed: boolean; expiresAt: Date | null }> {
  try {
    const row = (
      await db
        .select({
          reportAccess: studentTutor.reportAccess,
          reportAccessExpiresAt: studentTutor.reportAccessExpiresAt,
        })
        .from(studentTutor)
        .where(and(eq(studentTutor.studentUserId, studentUserId), eq(studentTutor.tutorUserId, tutorUserId)))
        .limit(1)
    )[0];
    if (!row) return { allowed: true, expiresAt: null }; // 存量关系：无显式记录不收紧
    if (!row.reportAccess) return { allowed: false, expiresAt: row.reportAccessExpiresAt ?? null };
    const exp = row.reportAccessExpiresAt;
    if (exp && exp.getTime() <= Date.now()) return { allowed: false, expiresAt: exp };
    return { allowed: true, expiresAt: exp ?? null };
  } catch {
    /* 迁移未就绪：放行（兼容存量），迁好后自动收紧 */
    return { allowed: true, expiresAt: null };
  }
}

/**
 * v99：扫某伴学师自己的注册二维码注册的学员 userId 集合
 * （invite_channels.tutor_id = 该伴学师 → 经此渠道注册的 invite_registrations.user_id）。
 */
export async function listInviteeStudentIds(db: Db, tutorUserId: number): Promise<Set<number>> {
  try {
    const chans = await db
      .select({ id: inviteChannels.id })
      .from(inviteChannels)
      .where(eq(inviteChannels.tutorId, tutorUserId));
    const ids = chans.map((c) => c.id);
    if (ids.length === 0) return new Set();
    const regs = await db
      .select({ userId: inviteRegistrations.userId })
      .from(inviteRegistrations)
      .where(inArray(inviteRegistrations.channelId, ids));
    return new Set(regs.map((r) => r.userId));
  } catch {
    return new Set();
  }
}

/**
 * V56：判定某学员是否在某伴学师名下。
 * 命中条件（任一）：student_profile.tutor_id 主管伴学师，或 student_tutor 多对多分配表中有记录。
 * V59：必须同机构（users.orgId 一致），跨机构记录一律不认。
 * v99：追加第三条件——学员扫的是该伴学师自己的注册二维码（渠道归属判定）。
 */
export async function isMyStudent(db: Db, tutorUserId: number, studentUserId: number): Promise<boolean> {
  const [me, target] = await Promise.all([
    db.select({ orgId: users.orgId }).from(users).where(eq(users.id, tutorUserId)).limit(1),
    db.select({ orgId: users.orgId }).from(users).where(eq(users.id, studentUserId)).limit(1),
  ]);
  if (!me[0] || !target[0]) return false;
  /* v93：一方为 NULL（平台直客/无机构伴学师）时跳过机构一致性校验，只要名下关系命中即可；
     双方都有机构且不同 → 仍一律不认（跨机构隔离不破） */
  const meOrg = me[0].orgId;
  const targetOrg = target[0].orgId;
  if (meOrg != null && targetOrg != null && meOrg !== targetOrg) return false;
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
  if (link.length > 0) return true;
  return (await listInviteeStudentIds(db, tutorUserId)).has(studentUserId);
}
