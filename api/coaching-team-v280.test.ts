import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getTableConfig } from "drizzle-orm/mysql-core";
import {
  coachingCases, coachingCaseStaff, coachingDeliverableRecipients, coachingEvents, coachingHandoffs,
  coachingMonthlyReports, coachingPlanConfirmations, coachingPlans, coachingTasks, orgStaffRoles,
  studentProfile, studentTutor, users,
} from "@db/schema";
import {
  COACHING_SERVICE_ROLE_KEYS, coachingNaturalMonthRange, initialCoachingNaturalMonths,
  isCoachingNaturalMonthPlan, lastThursdayOfCoachingMonth, shiftCoachingServiceMonth,
} from "@contracts/coachingTeam";
import { assertCaseAccess } from "./coachingAccess";
import { assertAssessmentReportAccess } from "./assessmentReports";
import { saveCoachingMonthlyReport } from "./coachingMonthly";
import { confirmCoachingPlan, deleteCoachingPlan } from "./coachingPlanning";
import { createInitialCoachingMonthPlans, listCoachingCases, saveCoachingPlan } from "./coachingService";
import { assertCoachingMonthlySummaryRole, saveCoachingCaseTeam, saveCoachingStaffRoles } from "./coachingTeam";
import { assertStudentAccess } from "./orgAccess";
import type { StaffUser } from "./orgAccess";

const admin = { id: 9, role: "admin", orgId: 7 } as StaffUser;
const tutor = { id: 29, role: "tutor", orgId: 7 } as StaffUser;
const baseCase = { id: 91, orgId: 7, studentUserId: 301, coachId: 19, supervisorId: 19,
  serviceStart: "2026-11-12", serviceEnd: "2027-05-11", status: "active" } as typeof coachingCases.$inferSelect;
const student = { id: 301, orgId: 7, role: "user", deletedAt: null };
const primary = [
  { userId: 19, serviceRole: "coach" as const },
  { userId: 19, serviceRole: "supervisor" as const },
];
type Db = Parameters<typeof saveCoachingCaseTeam>[0];
type RowsFor = (table: unknown, join?: "inner" | "left") => unknown[];

function rowsQuery(rowsFor: RowsFor, table: unknown) {
  let join: "inner" | "left" | undefined;
  const query = {
    innerJoin: () => { join = "inner"; return query; },
    leftJoin: () => { join = "left"; return query; },
    where: () => query,
    orderBy: () => query,
    limit: () => query,
    for: async () => rowsFor(table, join),
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(rowsFor(table, join)).then(resolve, reject),
  };
  return query;
}

function mockDb(rootRows: RowsFor, transactionRows: RowsFor = rootRows) {
  const inserted: { table: unknown; values: unknown }[] = [];
  const updated: { table: unknown; patch: Record<string, unknown> }[] = [];
  const deleted: unknown[] = [];
  const tx = {
    select: vi.fn(() => ({ from: (table: unknown) => rowsQuery(transactionRows, table) })),
    insert: vi.fn((table: unknown) => ({ values: (values: unknown) => {
      inserted.push({ table, values });
      return Object.assign(Promise.resolve(), {
        $returningId: async () => [{ id: 601 + inserted.length }],
        onDuplicateKeyUpdate: async () => ({ affectedRows: 1 }),
      });
    } })),
    update: vi.fn((table: unknown) => ({ set: (patch: Record<string, unknown>) => ({ where: async () => {
      updated.push({ table, patch });
      return { affectedRows: 1 };
    } }) })),
    delete: vi.fn((table: unknown) => ({ where: async () => { deleted.push(table); return { affectedRows: 1 }; } })),
  };
  const db = {
    select: vi.fn(() => ({ from: (table: unknown) => rowsQuery(rootRows, table) })),
    transaction: vi.fn(async (callback: (transaction: unknown) => unknown) => callback(tx)),
  };
  return { db: db as unknown as Db, tx, transaction: db.transaction, inserted, updated, deleted };
}

function studentAndTeamRows(membership: unknown[] = [{ id: 801 }], caseRow = baseCase): RowsFor {
  return (table, join) => {
    if (table === coachingCases) return [caseRow];
    if (table === users) return [student];
    if (table === coachingCaseStaff && join === "inner") return membership;
    return [];
  };
}

describe("V280 自然月与最后周四", () => {
  it("非 1 日开课生成首月剩余期与下一个完整自然月，支持跨年", () => {
    expect(initialCoachingNaturalMonths("2026-11-12")).toEqual([
      { month: "2026-11", start: "2026-11-12", end: "2026-11-30" },
      { month: "2026-12", start: "2026-12-01", end: "2026-12-31" },
    ]);
    expect(initialCoachingNaturalMonths("2026-12-20")).toEqual([
      { month: "2026-12", start: "2026-12-20", end: "2026-12-31" },
      { month: "2027-01", start: "2027-01-01", end: "2027-01-31" },
    ]);
    expect(initialCoachingNaturalMonths("2026-11-01")).toEqual([
      { month: "2026-11", start: "2026-11-01", end: "2026-11-30" },
    ]);
  });

  it("完整月、闰年与真实日历严格校验", () => {
    expect(coachingNaturalMonthRange("2024-02", "2024-01-20")).toEqual({ start: "2024-02-01", end: "2024-02-29" });
    expect(coachingNaturalMonthRange("2023-02", "2023-02-08")).toEqual({ start: "2023-02-08", end: "2023-02-28" });
    expect(shiftCoachingServiceMonth("2026-12", 1)).toBe("2027-01");
    expect(isCoachingNaturalMonthPlan("2026-11-12", "2026-11-30", "2026-11-12")).toBe(true);
    expect(isCoachingNaturalMonthPlan("2026-11-01", "2026-11-30", "2026-11-12")).toBe(false);
    for (const invalid of ["2026-02-29", "2026-02-31", "2026-13-01", "2026-11-12xxx"]) {
      expect(() => initialCoachingNaturalMonths(invalid)).toThrow("服务开始日期无效");
    }
  });

  it("每月最后一个周四准确，期限不限制提前完成", () => {
    expect(lastThursdayOfCoachingMonth("2026-11")).toBe("2026-11-26");
    expect(lastThursdayOfCoachingMonth("2026-12")).toBe("2026-12-31");
    expect(lastThursdayOfCoachingMonth("2024-02")).toBe("2024-02-29");
    expect(() => lastThursdayOfCoachingMonth("2026-13")).toThrow("月份格式");
  });
});

describe("五类服务角色与完整资料访问", () => {
  it.each(COACHING_SERVICE_ROLE_KEYS)("%s 的有效团队关系可访问当前学员主档与完整测评", async (serviceRole) => {
    const me = serviceRole === "admin" ? admin : tutor;
    const rows = studentAndTeamRows([{ id: 801, serviceRole, active: true }]);
    const mock = mockDb(rows);
    await expect(assertCaseAccess(mock.db, me, 91)).resolves.toMatchObject({ id: 91, studentUserId: 301 });
    await expect(assertStudentAccess(mock.db, me, 301)).resolves.toBeUndefined();
    await expect(assertAssessmentReportAccess(mock.db, me, 301)).resolves.toBeUndefined();
  });

  it("停用关系、跨机构和跨主档均失败关闭", async () => {
    const inactive = mockDb(studentAndTeamRows([]));
    await expect(assertStudentAccess(inactive.db, tutor, 301)).rejects.toThrow("服务团队");
    await expect(assertAssessmentReportAccess(inactive.db, tutor, 301)).rejects.toThrow("权限");
    const otherOrg = mockDb(studentAndTeamRows([{ id: 801 }], { ...baseCase, orgId: 8 }));
    await expect(assertCaseAccess(otherOrg.db, tutor, 91)).rejects.toThrow("主档不存在");
    const otherCase = mockDb(studentAndTeamRows([]));
    await expect(assertCaseAccess(otherCase.db, tutor, 91)).rejects.toThrow("服务团队");
  });

  it("普通员工的主档列表只并入口径内的有效团队主档", async () => {
    const cases = [
      { ...baseCase, id: 91, coachId: 88, supervisorId: 88 },
      { ...baseCase, id: 92, studentUserId: 302, coachId: 88, supervisorId: 88 },
    ];
    const mock = mockDb((table) => {
      if (table === coachingCases) return cases.map((coachingCase) => ({ coachingCase, studentName: "学员", grade: "五年级" }));
      if (table === coachingCaseStaff) return [{ caseId: 91 }];
      return [];
    });
    const result = await listCoachingCases(mock.db, tutor);
    expect(result.map((row) => row.coachingCase.id)).toEqual([91]);
    expect(studentProfile && studentTutor).toBeTruthy();
  });

  it("一人多职能、多督学和多教练可同事务保存，历史停用不物理删除", async () => {
    const current = [
      { id: 1, userId: 19, serviceRole: "coach", active: true },
      { id: 2, userId: 19, serviceRole: "supervisor", active: true },
      { id: 3, userId: 31, serviceRole: "consultant", active: true },
    ];
    const mock = mockDb((table) => {
      if (table === coachingCases) return [baseCase];
      if (table === users) return [{ id: 19, role: "tutor" }, { id: 29, role: "tutor" }, { id: 9, role: "admin" }];
      return [];
    }, (table) => table === coachingCaseStaff ? current : []);
    const result = await saveCoachingCaseTeam(mock.db, admin, { caseId: 91, reason: "增加协同服务", assignments: [
      ...primary,
      { userId: 29, serviceRole: "tutor" }, { userId: 29, serviceRole: "coach" },
      { userId: 29, serviceRole: "supervisor" }, { userId: 9, serviceRole: "admin" },
    ] });
    expect(result.activeCount).toBe(6);
    expect(mock.updated).toEqual([expect.objectContaining({ table: coachingCaseStaff, patch: expect.objectContaining({ active: false, endedBy: 9 }) })]);
    expect(mock.inserted.filter((row) => row.table === coachingCaseStaff)).toHaveLength(4);
    expect(mock.inserted.find((row) => row.table === coachingEvents)?.values).toMatchObject({ type: "service_team_updated" });
    expect(mock.deleted).not.toContain(coachingCaseStaff);
  });

  it("主负责人不能直接删除，普通员工不能配置团队或提权为管理员", async () => {
    const denied = mockDb(() => []);
    await expect(saveCoachingCaseTeam(denied.db, tutor, { caseId: 91, assignments: primary, reason: "越权调整" })).rejects.toThrow("仅机构管理员");
    expect(denied.transaction).not.toHaveBeenCalled();
    const removePrimary = mockDb((table) => table === coachingCases ? [baseCase] : []);
    await expect(saveCoachingCaseTeam(removePrimary.db, admin, { caseId: 91, assignments: [primary[0]], reason: "绕过改派" })).rejects.toThrow("先走管理员改派");
    expect(removePrimary.transaction).not.toHaveBeenCalled();
    const escalate = mockDb((table) => table === users ? [{ id: 29, role: "tutor" }] : []);
    await expect(saveCoachingStaffRoles(escalate.db, admin, { userId: 29, serviceRoles: ["coach", "admin"] })).rejects.toThrow("提升为管理员");
    expect(escalate.transaction).not.toHaveBeenCalled();
    const nonAdmin = mockDb(() => []);
    await expect(saveCoachingStaffRoles(nonAdmin.db, tutor, { userId: 29, serviceRoles: ["coach"] })).rejects.toThrow("仅机构管理员");
  });

  it("员工职能支持一人多角色，并拒绝其他机构员工", async () => {
    const mock = mockDb((table) => table === users ? [{ id: 29, role: "tutor" }] : []);
    await expect(saveCoachingStaffRoles(mock.db, admin, { userId: 29, serviceRoles: ["consultant", "tutor", "supervisor", "coach"] }))
      .resolves.toEqual({ userId: 29, serviceRoles: ["consultant", "tutor", "supervisor", "coach"] });
    expect(mock.inserted.filter((row) => row.table === orgStaffRoles)).toHaveLength(4);
    const other = mockDb(() => []);
    await expect(saveCoachingStaffRoles(other.db, admin, { userId: 99, serviceRoles: ["coach"] })).rejects.toThrow("不属于当前机构");
    expect(other.transaction).not.toHaveBeenCalled();
  });
});

const monthlyInput = { caseId: 91, month: "2026-11", goalProgress: "目标推进事实", academicProgress: "本月暂无同口径成绩新数据",
  taskExecution: "任务执行事实", learningMethod: "费曼输出与订正事实", habitFamily: "习惯与家校配合事实",
  meetingNotes: "已确认下月安排", nextActions: ["完成错题复验并保留记录"], familyAction: "每周核对一次行动证据" };

describe("计划、总结和首期自然月职责", () => {
  it("团队督学师或学习教练可写总结，其他职能与无职能管理员不可写", async () => {
    await expect(assertCoachingMonthlySummaryRole(mockDb(studentAndTeamRows()).db, { ...tutor, id: 19 }, 91)).resolves.toBeUndefined();
    const member = mockDb((table) => {
      if (table === coachingCases) return [baseCase];
      if (table === users) return [student];
      if (table === coachingCaseStaff) return [{ id: 801, serviceRole: "coach", active: true }];
      return [];
    });
    await expect(assertCoachingMonthlySummaryRole(member.db, tutor, 91)).resolves.toBeUndefined();
    await expect(saveCoachingMonthlyReport(member.db, tutor, monthlyInput)).resolves.toMatchObject({ version: 1 });
    const adminDenied = mockDb((table) => table === coachingCases ? [baseCase] : []);
    await expect(saveCoachingMonthlyReport(adminDenied.db, admin, monthlyInput)).rejects.toThrow("督学师或学习教练");
    expect(adminDenied.transaction).not.toHaveBeenCalled();
    const consultant = mockDb((table) => {
      if (table === coachingCases) return [baseCase];
      /* SQL 的 service_role IN ('coach','supervisor') 会排除咨询师，返回空代表无有效写权限关系。 */
      if (table === coachingCaseStaff) return [];
      return [];
    });
    await expect(assertCoachingMonthlySummaryRole(consultant.db, tutor, 91)).rejects.toThrow("督学师或学习教练");
  });

  it("非管理员不能创建或提交月计划，即使其可查看完整主档", async () => {
    const rows = studentAndTeamRows();
    const input = { caseId: 91, level: "month" as const, title: "下月计划", content: "下月真实安排", startDate: "2026-12-01", endDate: "2026-12-31", confirmed: false };
    const save = mockDb(rows);
    await expect(saveCoachingPlan(save.db, tutor, input)).rejects.toThrow("仅管理员");
    expect(save.transaction).not.toHaveBeenCalled();
    const confirm = mockDb((table) => {
      if (table === coachingCases) return [baseCase];
      if (table === users) return [student];
      if (table === coachingCaseStaff) return [{ id: 801, serviceRole: "coach", active: true }];
      if (table === coachingPlans) return [{ ...input, id: 501, caseId: 91, status: "draft", issuedAt: null }];
      return [];
    });
    await expect(confirmCoachingPlan(confirm.db, tutor, 501)).rejects.toThrow("仅管理员");
    expect(confirm.transaction).not.toHaveBeenCalled();
    const initial = mockDb(rows);
    await expect(createInitialCoachingMonthPlans(initial.db, tutor, { caseId: 91, plans: [] })).rejects.toThrow("仅管理员");
    expect(initial.transaction).not.toHaveBeenCalled();
  });

  it("管理员一次生成首期两份草稿，已存在月份跳过且不覆盖", async () => {
    const mock = mockDb((table) => table === coachingCases ? [baseCase] : []);
    const plans = [
      { month: "2026-11", title: "首月计划", content: "首月真实目标与行动" },
      { month: "2026-12", title: "次月计划", content: "次月真实目标与行动" },
    ];
    const created = await createInitialCoachingMonthPlans(mock.db, admin, { caseId: 91, plans });
    expect(created.skipped).toEqual([]);
    expect(created.created.map(({ month, startDate, endDate }) => ({ month, startDate, endDate }))).toEqual([
      { month: "2026-11", startDate: "2026-11-12", endDate: "2026-11-30" },
      { month: "2026-12", startDate: "2026-12-01", endDate: "2026-12-31" },
    ]);
    expect(created.created.every((row) => row.id > 0)).toBe(true);
    const drafts = mock.inserted.filter((row) => row.table === coachingPlans);
    expect(drafts).toHaveLength(2);
    for (const row of drafts) expect(row.values).toMatchObject({ status: "draft", confirmedBy: null, issuedAt: null });
    const existing = mockDb((table) => table === coachingCases ? [baseCase] : [],
      (table) => table === coachingPlans ? [{ id: 500, caseId: 91, startDate: "2026-11-12", version: 2 }] : []);
    await expect(createInitialCoachingMonthPlans(existing.db, admin, { caseId: 91, plans })).resolves.toMatchObject({ skipped: ["2026-11"] });
    expect(existing.inserted.filter((row) => row.table === coachingPlans)).toHaveLength(1);
  });
});

type Draft = { id: number; caseId: number; title: string; version: number; status: string; issuedAt: Date | null };
const draft: Draft = { id: 501, caseId: 91, title: "V280 专用草稿", version: 1, status: "draft", issuedAt: null };
const dependencyTables = [coachingPlans, coachingTasks, coachingPlanConfirmations, coachingHandoffs, coachingDeliverableRecipients];

function deleteMock(options: { plan?: Draft; dependency?: unknown; affectedRows?: number } = {}) {
  let planQueries = 0;
  return mockDb((table) => {
    if (table === coachingCases) return [baseCase];
    if (table === users) return [student];
    if (table === coachingCaseStaff) return [{ id: 801, serviceRole: "coach", active: true }];
    return [];
  }, (table) => {
    if (table === coachingPlans) return planQueries++ === 0 ? [options.plan ?? draft] : table === options.dependency ? [{ id: 900 }] : [];
    if (table === options.dependency) return [{ id: 900 }];
    return [];
  });
}

describe("内部草稿安全删除", () => {
  it("无依赖草稿真实删除并保留内部审计事件", async () => {
    const mock = deleteMock();
    await expect(deleteCoachingPlan(mock.db, tutor, { caseId: 91, planId: 501 })).resolves.toEqual({ id: 501, deleted: true });
    expect(mock.deleted).toEqual([coachingPlans]);
    expect(mock.inserted.find((row) => row.table === coachingEvents)?.values).toMatchObject({ type: "plan_draft_deleted", visibility: "internal" });
  });

  it.each([
    ["待家庭会签", { ...draft, status: "awaiting_family" }],
    ["已生效", { ...draft, status: "confirmed", issuedAt: new Date() }],
    ["跨主档", { ...draft, caseId: 92 }],
  ])("%s 计划不能删除", async (_label, plan) => {
    const mock = deleteMock({ plan });
    await expect(deleteCoachingPlan(mock.db, tutor, { caseId: 91, planId: 501 })).rejects.toThrow();
    expect(mock.deleted).toHaveLength(0);
    expect(mock.inserted).toHaveLength(0);
  });

  it("跨机构主档在事务前拒绝", async () => {
    const mock = mockDb(() => []);
    await expect(deleteCoachingPlan(mock.db, tutor, { caseId: 91, planId: 501 })).rejects.toThrow("主档不存在");
    expect(mock.transaction).not.toHaveBeenCalled();
  });

  it.each(dependencyTables.map((table) => ({ name: getTableConfig(table).name, dependency: table })))("$name 依赖阻止删除", async ({ dependency }) => {
    const mock = deleteMock({ dependency });
    await expect(deleteCoachingPlan(mock.db, tutor, { caseId: 91, planId: 501 })).rejects.toThrow("不能删除");
    expect(mock.deleted).toHaveLength(0);
    expect(mock.inserted).toHaveLength(0);
  });
});

describe("0059 迁移与页面接线", () => {
  it("团队两表已登记内嵌，使用 CURRENT_TIMESTAMP，保留历史关系", () => {
    const migration = readFileSync("db/migrations/0059_coaching_service_team.sql", "utf8");
    for (const table of ["org_staff_roles", "coaching_case_staff"]) expect(migration).toContain(`CREATE TABLE \`${table}\``);
    expect(migration).toContain("DEFAULT CURRENT_TIMESTAMP");
    expect(migration).toContain("(`case_id`,`user_id`,`service_role`)");
    expect(migration).toContain("INSERT IGNORE INTO `coaching_case_staff`");
    const journal = JSON.parse(readFileSync("db/migrations/meta/_journal.json", "utf8")) as { entries: { idx: number; tag: string }[] };
    expect(journal.entries).toContainEqual(expect.objectContaining({ idx: 59, tag: "0059_coaching_service_team" }));
    expect(readFileSync("api/migrationsEmbedded.ts", "utf8")).toContain('"0059_coaching_service_team":');
    expect(getTableConfig(coachingCaseStaff).indexes.map((index) => index.config.name)).toContain("coaching_case_staff_case_user_role_unique");
    expect(getTableConfig(orgStaffRoles).indexes.map((index) => index.config.name)).toContain("org_staff_roles_org_user_role_unique");
  });

  it("工作台、画像、规划、运营和月末分工均已接线", () => {
    const workspace = readFileSync("src/components/org/CoachingWorkspace.tsx", "utf8");
    const profile = readFileSync("src/components/org/CoachingProfile.tsx", "utf8");
    const quality = readFileSync("src/components/org/CoachingMonthlyQuality.tsx", "utf8");
    const rhythm = readFileSync("src/components/org/CoachingKnowledgePanels.tsx", "utf8");
    expect(workspace).toContain("<CoachingTeamPanel data={data} />");
    expect(workspace).toContain("<InitialMonthPlans");
    expect(profile).toContain("compact");
    expect(quality).toContain("serviceTeam");
    expect(rhythm).toContain("lastThursdayOfCoachingMonth");
    expect(readFileSync("api/coachingRouter.ts", "utf8")).toContain("createInitialMonthPlans:");
    expect(readFileSync("src/components/org/CoachingPlanning.tsx", "utf8")).toContain("deletePlan");
    expect(readFileSync("api/coachingMonthly.ts", "utf8")).toContain("coachingMonthlyReports");
    expect(coachingMonthlyReports).toBeTruthy();
  });
});
