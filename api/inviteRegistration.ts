import { TRPCError } from "@trpc/server";
import { and, eq, sql } from "drizzle-orm";
import { inviteRegistrations, organizations, studentProfile, studentTutor, users, type InviteChannel, type Organization } from "@db/schema";
import { DEFAULT_INVITE_MODULES } from "@contracts/studentModules";
import { campusUserLimit } from "@contracts/edition";
import { inviteAssessmentQuote } from "@contracts/orgService";
import { debitPoints, type PointDb, type PointTx } from "./orgPoints";

export type InviteRegistrationChannel = Pick<InviteChannel, "id" | "code" | "name" | "orgId" | "tutorId" | "createdBy" | "assessmentAccess" | "assessmentKinds">;
type LockedOrganization = Pick<Organization, "id" | "edition" | "settings">;

export type InviteRegistrationInput = {
  unionId: string;
  phone: string;
  passwordHash: string;
  name: string;
  campus: boolean;
  grade?: string;
  className?: string;
  school?: string | null;
};

export function duplicateInviteEntry(error: unknown): boolean {
  const e = error as { code?: string; cause?: { code?: string } } | null;
  return e?.code === "ER_DUP_ENTRY" || e?.cause?.code === "ER_DUP_ENTRY";
}

/** 机构行锁覆盖人数检查与插入，防止多个二维码同时注册突破校园账户上限。 */
async function lockChannelOrganization(tx: PointTx, orgId: number | null): Promise<LockedOrganization | null> {
  if (orgId == null) return null;
  const [org] = await tx.select({ id: organizations.id, edition: organizations.edition, settings: organizations.settings })
    .from(organizations).where(eq(organizations.id, orgId)).for("update");
  if (!org) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "渠道所属机构不存在，请联系平台超管重新配置" });
  return org;
}

async function assertCampusCapacityTx(tx: PointTx, channel: InviteRegistrationChannel, org: LockedOrganization | null) {
  if (!org || org.edition !== "school" || channel.orgId == null) return;
  const limit = campusUserLimit(org.settings);
  if (limit == null) return; // 存量未配置校园机构保持不限，新开校园默认写入 200。
  const [row] = await tx.select({ c: sql<number>`count(*)` }).from(users)
    .where(and(eq(users.orgId, channel.orgId), eq(users.role, "user")));
  const count = Number(row?.c ?? 0);
  if (count >= limit) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: `本校注册账户已达 ${limit} 人上限，请联系平台超管调整名额` });
  }
}

/**
 * 只有机构版新用户真正注册成功才扣发码人的个人钱包；校园版完全免积分，不检查钱包。
 * 机构未分配池不在此再次扣减；平台公共码及超管代发的历史码也不能错误扣平台账号。
 */
export async function debitInviteRegistrationTx(
  tx: PointTx,
  channel: InviteRegistrationChannel,
  studentUserId: number,
  lockedOrg?: LockedOrganization | null,
) {
  if (channel.orgId == null) return { credits: 0, billed: false as const, reason: "platform_channel" as const };
  const org = lockedOrg === undefined ? await lockChannelOrganization(tx, channel.orgId) : lockedOrg;
  if (org?.edition === "school") return { credits: 0, billed: false as const, reason: "school_edition" as const };
  const quote = inviteAssessmentQuote(channel.assessmentAccess, channel.assessmentKinds);
  const payerUserId = channel.tutorId ?? channel.createdBy;
  const [payer] = await tx.select({ id: users.id, orgId: users.orgId, role: users.role, deletedAt: users.deletedAt })
    .from(users).where(eq(users.id, payerUserId)).limit(1);
  if (channel.tutorId == null && payer?.role === "admin" && payer.orgId == null) {
    return { credits: 0, billed: false as const, reason: "legacy_platform_channel" as const };
  }
  if (!payer || payer.deletedAt || payer.orgId !== channel.orgId || !["tutor", "admin"].includes(payer.role)) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "渠道发码人不是本机构在职伴学师或管理员，请联系机构重新建码" });
  }
  await debitPoints(tx, {
    orgId: channel.orgId,
    payerUserId,
    actorUserId: payerUserId,
    amount: quote.total,
    eventKey: `invite:channel:${channel.id}:user:${studentUserId}`,
    studentUserId,
    kind: "invite_assessment",
    reason: `渠道「${channel.name}」成功注册：${quote.items.filter((item) => item.credits > 0).map((item) => item.label).join("、") || "免费测评"}`.slice(0, 500),
  });
  return { credits: quote.total, billed: quote.total > 0, reason: "registered" as const };
}

/** 用户、档案、伴学关系、渠道记录、积分流水必须同一事务成功，失败时全部回滚。 */
export async function createInviteRegistrationTx(tx: PointTx, channel: InviteRegistrationChannel, input: InviteRegistrationInput) {
  const org = await lockChannelOrganization(tx, channel.orgId);
  await assertCampusCapacityTx(tx, channel, org);
  const [{ id }] = await tx.insert(users).values({
    unionId: input.unionId,
    phone: input.phone || null,
    passwordHash: input.passwordHash,
    name: input.name,
    orgId: channel.orgId ?? null,
    lastSignInAt: new Date(),
  }).$returningId();
  const userId = Number(id);
  await tx.insert(studentProfile).values({
    userId,
    name: input.name,
    ...(input.grade ? { grade: input.grade } : {}),
    className: input.className ?? null,
    school: input.school ?? null,
    enabledModules: DEFAULT_INVITE_MODULES,
    tutorId: channel.tutorId ?? null,
    onboarded: true,
    reportReleased: input.campus,
    campusReportKinds: input.campus ? [] : null,
  });
  if (channel.tutorId != null) {
    const [tutor] = await tx.select({ inviteReportDefault: users.inviteReportDefault })
      .from(users).where(eq(users.id, channel.tutorId)).limit(1);
    await tx.insert(studentTutor).values({
      studentUserId: userId,
      tutorUserId: channel.tutorId,
      reportAccess: tutor?.inviteReportDefault ?? false,
      reportAccessExpiresAt: null,
    });
  }
  await tx.insert(inviteRegistrations).values({
    channelId: channel.id,
    channelCode: channel.code,
    phone: input.phone,
    studentName: input.campus ? input.name : null,
    grade: input.grade ?? null,
    userId,
  });
  const billing = await debitInviteRegistrationTx(tx, channel, userId, org);
  return { userId, billing };
}

export async function createInviteRegistration(db: PointDb, channel: InviteRegistrationChannel, input: InviteRegistrationInput) {
  return db.transaction((tx) => createInviteRegistrationTx(tx, channel, input));
}
