import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import { coachingCaseStaff, coachingCases, coachingEvents, orgStaffRoles, users } from "@db/schema";
import { COACHING_SERVICE_ROLE_KEYS, coachingServiceRoleLabel, type CoachingServiceRole } from "@contracts/coachingTeam";
import type { getDb } from "./queries/connection";
import { requireOrgStaff, type StaffUser } from "./orgAccess";
import { assertCaseAccess } from "./coachingAccess";
import type { PointTx } from "./orgPoints";

type Db = ReturnType<typeof getDb>;
type TeamAssignmentInput = { userId: number; serviceRole: CoachingServiceRole };

function requireAdmin(me: StaffUser): number {
  const orgId = requireOrgStaff(me);
  if (me.role !== "admin") throw new TRPCError({ code: "FORBIDDEN", message: "仅机构管理员可调整服务职能与学员团队" });
  return orgId;
}

function validRoles(roles: string[]): CoachingServiceRole[] {
  return [...new Set(roles.filter((role): role is CoachingServiceRole => COACHING_SERVICE_ROLE_KEYS.includes(role as CoachingServiceRole)))];
}

export async function listCoachingStaff(db: Db, me: StaffUser) {
  const orgId = requireOrgStaff(me);
  const [staff, roleRows] = await Promise.all([
    db.select({ id: users.id, name: users.name, role: users.role }).from(users)
      .where(and(eq(users.orgId, orgId), inArray(users.role, ["tutor", "admin"]), isNull(users.deletedAt))).orderBy(users.id),
    db.select().from(orgStaffRoles).where(eq(orgStaffRoles.orgId, orgId)),
  ]);
  return staff.map((person) => ({
    ...person,
    serviceRoles: [...new Set([person.role === "admin" ? "admin" : "tutor", ...roleRows.filter((row) => row.userId === person.id).map((row) => row.serviceRole)])],
  }));
}

export async function listCoachingCaseTeam(db: Db, orgId: number, caseId: number) {
  const rows = await db.select({ assignment: coachingCaseStaff, name: users.name, accountRole: users.role }).from(coachingCaseStaff)
    .leftJoin(users, eq(coachingCaseStaff.userId, users.id))
    .where(and(eq(coachingCaseStaff.orgId, orgId), eq(coachingCaseStaff.caseId, caseId)))
    .orderBy(desc(coachingCaseStaff.active), asc(coachingCaseStaff.serviceRole), asc(coachingCaseStaff.id));
  return rows.map((row) => ({ ...row.assignment, name: row.name, accountRole: row.accountRole, serviceRoleLabel: coachingServiceRoleLabel(row.assignment.serviceRole) }));
}

export async function saveCoachingStaffRoles(db: Db, me: StaffUser, input: { userId: number; serviceRoles: string[] }) {
  const orgId = requireAdmin(me);
  const [target] = await db.select({ id: users.id, role: users.role }).from(users)
    .where(and(eq(users.id, input.userId), eq(users.orgId, orgId), inArray(users.role, ["tutor", "admin"]), isNull(users.deletedAt))).limit(1);
  if (!target) throw new TRPCError({ code: "NOT_FOUND", message: "员工不存在或不属于当前机构" });
  const roles = validRoles(input.serviceRoles);
  if (roles.length !== new Set(input.serviceRoles).size) throw new TRPCError({ code: "BAD_REQUEST", message: "员工职能无效" });
  if (target.role !== "admin" && roles.includes("admin")) throw new TRPCError({ code: "FORBIDDEN", message: "不能通过职能配置把普通员工提升为管理员" });
  if (target.role === "admin" && !roles.includes("admin")) roles.push("admin");
  if (!roles.length) roles.push(target.role === "admin" ? "admin" : "tutor");
  return db.transaction(async (tx) => {
    await tx.select().from(orgStaffRoles).where(and(eq(orgStaffRoles.orgId, orgId), eq(orgStaffRoles.userId, target.id))).for("update");
    await tx.delete(orgStaffRoles).where(and(eq(orgStaffRoles.orgId, orgId), eq(orgStaffRoles.userId, target.id)));
    for (const serviceRole of roles) await tx.insert(orgStaffRoles).values({ orgId, userId: target.id, serviceRole, createdBy: me.id });
    return { userId: target.id, serviceRoles: roles };
  });
}

export async function saveCoachingCaseTeam(db: Db, me: StaffUser, input: { caseId: number; assignments: TeamAssignmentInput[]; reason: string }) {
  const orgId = requireAdmin(me);
  const coachingCase = await assertCaseAccess(db, me, input.caseId);
  const reason = input.reason.trim();
  if (reason.length < 2) throw new TRPCError({ code: "BAD_REQUEST", message: "请填写团队调整原因" });
  const desired = new Map<string, TeamAssignmentInput>();
  for (const assignment of input.assignments) {
    if (!COACHING_SERVICE_ROLE_KEYS.includes(assignment.serviceRole)) throw new TRPCError({ code: "BAD_REQUEST", message: "学员团队职能无效" });
    desired.set(`${assignment.userId}:${assignment.serviceRole}`, assignment);
  }
  const assignments = [...desired.values()];
  if (!assignments.some((row) => row.userId === coachingCase.coachId && row.serviceRole === "coach")
    || !assignments.some((row) => row.userId === coachingCase.supervisorId && row.serviceRole === "supervisor")) {
    throw new TRPCError({ code: "CONFLICT", message: "主负责人不能从团队页移除，请先走管理员改派与接收流程" });
  }
  const userIds = [...new Set(assignments.map((row) => row.userId))];
  const staff = userIds.length ? await db.select({ id: users.id, role: users.role }).from(users)
    .where(and(eq(users.orgId, orgId), inArray(users.id, userIds), inArray(users.role, ["tutor", "admin"]), isNull(users.deletedAt))) : [];
  if (staff.length !== userIds.length) throw new TRPCError({ code: "FORBIDDEN", message: "服务团队只能分配当前机构的有效员工" });
  if (assignments.some((row) => row.serviceRole === "admin" && staff.find((person) => person.id === row.userId)?.role !== "admin")) {
    throw new TRPCError({ code: "FORBIDDEN", message: "管理员职能只能分配给真实管理员账号" });
  }
  return db.transaction(async (tx) => {
    const current = await tx.select().from(coachingCaseStaff)
      .where(and(eq(coachingCaseStaff.orgId, orgId), eq(coachingCaseStaff.caseId, input.caseId))).for("update");
    const currentByKey = new Map(current.map((row) => [`${row.userId}:${row.serviceRole}`, row]));
    const now = new Date();
    for (const row of current.filter((item) => item.active && !desired.has(`${item.userId}:${item.serviceRole}`))) {
      await tx.update(coachingCaseStaff).set({ active: false, endedAt: now, endedBy: me.id, changeReason: reason })
        .where(and(eq(coachingCaseStaff.id, row.id), eq(coachingCaseStaff.caseId, input.caseId), eq(coachingCaseStaff.active, true)));
    }
    for (const assignment of assignments) {
      const existing = currentByKey.get(`${assignment.userId}:${assignment.serviceRole}`);
      if (existing?.active) continue;
      await tx.insert(coachingCaseStaff).values({ orgId, caseId: input.caseId, userId: assignment.userId,
        serviceRole: assignment.serviceRole, active: true, changeReason: reason, createdBy: me.id, endedAt: null, endedBy: null })
        .onDuplicateKeyUpdate({ set: { active: true, endedAt: null, endedBy: null, changeReason: reason } });
    }
    const summary = COACHING_SERVICE_ROLE_KEYS.map((role) => {
      const count = assignments.filter((row) => row.serviceRole === role).length;
      return count ? `${coachingServiceRoleLabel(role)} ${count} 人` : "";
    }).filter(Boolean).join("、");
    await tx.insert(coachingEvents).values({ caseId: input.caseId, actorUserId: me.id, type: "service_team_updated",
      content: `服务团队已调整：${summary || "无额外成员"}；原因：${reason}。已分配角色可查看本主档完整陪跑信息，停用后立即收回团队访问权限。`, visibility: "internal" });
    return { ok: true as const, activeCount: assignments.length };
  });
}

/** 改派接收后与主档同事务同步：只结束旧主负责人对应的 coach／supervisor 关系，其他服务职能保留。 */
export async function syncCoachingReassignmentTeamTx(tx: PointTx, input: {
  orgId: number; caseId: number; actorUserId: number; reason: string;
  fromCoachId: number; fromSupervisorId: number; nextCoachId: number; nextSupervisorId: number;
}) {
  const current = await tx.select().from(coachingCaseStaff)
    .where(and(eq(coachingCaseStaff.orgId, input.orgId), eq(coachingCaseStaff.caseId, input.caseId))).for("update");
  const now = new Date();
  const oldPrimary = new Set([`${input.fromCoachId}:coach`, `${input.fromSupervisorId}:supervisor`]);
  for (const row of current.filter((item) => item.active && oldPrimary.has(`${item.userId}:${item.serviceRole}`))) {
    await tx.update(coachingCaseStaff).set({ active: false, endedAt: now, endedBy: input.actorUserId, changeReason: input.reason })
      .where(and(eq(coachingCaseStaff.id, row.id), eq(coachingCaseStaff.orgId, input.orgId), eq(coachingCaseStaff.caseId, input.caseId), eq(coachingCaseStaff.active, true)));
  }
  const next = [
    { userId: input.nextCoachId, serviceRole: "coach" },
    { userId: input.nextSupervisorId, serviceRole: "supervisor" },
  ];
  for (const assignment of next) {
    await tx.insert(coachingCaseStaff).values({ orgId: input.orgId, caseId: input.caseId, ...assignment,
      active: true, changeReason: input.reason, createdBy: input.actorUserId, endedAt: null, endedBy: null })
      .onDuplicateKeyUpdate({ set: { active: true, endedAt: null, endedBy: null, changeReason: input.reason } });
  }
}

/** 月总结只由当前主档督学／学习教练填写；旧主负责人继续兼容。 */
export async function assertCoachingMonthlySummaryRole(db: Db, me: StaffUser, caseId: number): Promise<void> {
  const [coachingCase] = await db.select().from(coachingCases).where(eq(coachingCases.id, caseId)).limit(1);
  if (!coachingCase) throw new TRPCError({ code: "NOT_FOUND", message: "陪跑主档不存在" });
  if ([coachingCase.coachId, coachingCase.supervisorId].includes(me.id)) return;
  const [membership] = await db.select({ id: coachingCaseStaff.id }).from(coachingCaseStaff)
    .where(and(eq(coachingCaseStaff.orgId, coachingCase.orgId), eq(coachingCaseStaff.caseId, caseId), eq(coachingCaseStaff.userId, me.id),
      eq(coachingCaseStaff.active, true), inArray(coachingCaseStaff.serviceRole, ["coach", "supervisor"]))).limit(1);
  if (!membership) throw new TRPCError({ code: "FORBIDDEN", message: "当月总结仅由本学员当前督学师或学习教练填写" });
}
