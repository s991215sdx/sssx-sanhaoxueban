import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getTableConfig } from "drizzle-orm/mysql-core";
import {
  coachingCases, coachingDeliverableRecipients, coachingDeliverables, coachingEvents, coachingExtendedRecords,
  coachingGuardianGrants, coachingHandoffs, coachingMonthlyReports, coachingPlans, users,
} from "@db/schema";
import {
  acceptFamilyCoachingStageHandoff, createCoachingStageHandoff, familyCoachingStageHandoffs,
} from "./coachingStageHandoffs";
import type { StaffUser } from "./orgAccess";

vi.mock("./coachingNotifications", () => ({
  queueCoachingNotification: vi.fn(async () => ({ id: 1 })),
}));

const admin = { id: 9, role: "admin", orgId: 7 } as StaffUser;
const tutor = { id: 19, role: "tutor", orgId: 7 } as StaffUser;
const guardian = { id: 401, role: "user" };
const otherFamily = { id: 499, role: "user" };
const baseCase = { id: 91, orgId: 7, studentUserId: 301, coachId: 19, supervisorId: 19, status: "active" } as typeof coachingCases.$inferSelect;
const report = {
  id: 601, caseId: 91, orgId: 7, month: "2026-10", version: 2,
  goalProgress: "目标推进事实", academicProgress: "同口径学业事实", taskExecution: "任务执行证据",
  learningMethod: "方法使用事实", habitFamily: "习惯与家庭协同事实", meetingNotes: "已核对下阶段安排",
  nextActions: ["完成错题复验并保留记录"], familyAction: "每周核对一次行动证据", pushedAt: null, pushedBy: null,
} as typeof coachingMonthlyReports.$inferSelect;
const plan = {
  id: 602, caseId: 91, level: "month", title: "十一月陪跑计划", content: "每周复验并复盘",
  startDate: "2026-11-01", endDate: "2026-11-30", version: 3, status: "confirmed",
  issuedAt: new Date("2026-11-01T08:00:00+08:00"), cancelledAt: null,
} as typeof coachingPlans.$inferSelect;
const action = { id: 702, caseId: 91, orgId: 7, recordType: "family_action", type: "family_action", title: "阶段交接家庭行动" } as unknown as typeof coachingExtendedRecords.$inferSelect;
const attachment = { id: 703, caseId: 91, kind: "text", visibility: "family" } as typeof coachingDeliverables.$inferSelect;
const snapshot = {
  schemaVersion: 1,
  monthlyReport: { ...report, pushedAt: new Date("2026-11-01T09:00:00+08:00").toISOString() },
  nextPlan: { ...plan, issuedAt: plan.issuedAt!.toISOString() },
  familyAction: { id: 702, responsibleUserId: 401, action: "每周核对一次行动证据", dueAt: new Date("2026-11-07T20:00:00+08:00").toISOString() },
};
const familyHandoff = {
  id: 701, caseId: 91, type: "H5", fromUserId: 9, toUserId: 401, title: "十月总结与十一月交接",
  content: "每周核对一次行动证据", status: "pending", dueAt: new Date("2026-11-07T20:00:00+08:00"),
  nextSupervisorId: null, monthlyReportId: 601, nextPlanId: 602, familyActionId: 702, attachmentId: 703,
  familySnapshot: snapshot, acceptedAt: null, acceptedChannel: null, acceptedComment: null, createdAt: new Date(),
} as unknown as typeof coachingHandoffs.$inferSelect;
const studentRows = [{ id: 301, name: "测试学员", deletedAt: null }];
const guardianRows = [{ id: 401, guardianUserId: 401, caseId: 91, name: "测试家长", label: "妈妈", active: true }];
const input = {
  caseId: 91, monthlyReportId: 601, nextPlanId: 602, recipientUserId: 401,
  title: "十月总结与十一月交接", familyAction: "每周核对一次行动证据", dueAt: new Date("2026-11-07T20:00:00+08:00"),
};
type Db = Parameters<typeof createCoachingStageHandoff>[0];

function rowsQuery(rows: unknown[]) {
  const query = {
    where: () => query, innerJoin: () => query, leftJoin: () => query, orderBy: () => query, limit: () => query,
    for: async () => rows,
    then: (resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
  };
  return query;
}
function selectMock(rowsForTable: (table: unknown) => unknown[]) {
  return vi.fn(() => ({ from: (table: unknown) => rowsQuery(rowsForTable(table)) }));
}
function insertMock() {
  const inserted: { table: unknown; values: Record<string, unknown> }[] = [];
  const insert = vi.fn((table: unknown) => ({ values: (values: Record<string, unknown>) => {
    inserted.push({ table, values });
    const id = table === coachingHandoffs ? 701 : table === coachingExtendedRecords ? 702 : table === coachingDeliverables ? 703 : 1;
    return Object.assign(Promise.resolve(), {
      $returningId: async () => [{ id }],
      onDuplicateKeyUpdate: async () => ({ affectedRows: 1 }),
    });
  } }));
  return { insert, inserted };
}
function updateMock() {
  const patches: { table: unknown; patch: Record<string, unknown> }[] = [];
  const update = vi.fn((table: unknown) => ({ set: (patch: Record<string, unknown>) => ({ where: async () => {
    patches.push({ table, patch }); return { affectedRows: 1 };
  } }) }));
  return { update, patches };
}
function dbMock(rootRows: (table: unknown) => unknown[], txRows: (table: unknown) => unknown[] = rootRows) {
  const tx = { select: selectMock(txRows), ...insertMock(), ...updateMock() };
  const db = { select: selectMock(rootRows), transaction: vi.fn(async (callback: (transaction: unknown) => unknown) => callback(tx)) };
  return { db: db as unknown as Db, tx, transaction: db.transaction };
}
function recipientGrants(excludedResourceId = 0) {
  const rows = [
    { resourceId: 601, resourceType: "monthly_report" }, { resourceId: 602, resourceType: "plan" },
    { resourceId: 702, resourceType: "family_action" }, { resourceId: 703, resourceType: "deliverable" },
  ];
  return rows.filter((row) => row.resourceId !== excludedResourceId)
    .map((row) => ({ ...row, orgId: 7, caseId: 91, recipientUserId: 401, active: true }));
}
function createRows(table: unknown) {
  if (table === coachingCases) return [baseCase];
  if (table === users) return studentRows;
  if (table === coachingGuardianGrants) return guardianRows;
  if (table === coachingMonthlyReports) return [report];
  if (table === coachingPlans) return [plan];
  if (table === coachingExtendedRecords) return [action];
  if (table === coachingDeliverables) return [attachment];
  return [];
}
function familyRows(table: unknown) {
  if (table === coachingCases) return [baseCase];
  if (table === users) return studentRows;
  if (table === coachingGuardianGrants) return guardianRows;
  if (table === coachingHandoffs) return [familyHandoff];
  if (table === coachingDeliverableRecipients) return recipientGrants();
  return [];
}

describe("H5 家庭阶段交接创建与材料授权", () => {
  it("仅机构管理员可发起，普通伴学师不能绕过", async () => {
    const mock = dbMock(() => []);
    await expect(createCoachingStageHandoff(mock.db, tutor, input)).rejects.toThrow("仅机构管理员");
    expect(mock.transaction).not.toHaveBeenCalled();
  });

  it("跨主档月报、跨主档计划和未生效计划均被拒绝", async () => {
    const wrongReport = dbMock(createRows, (table) => table === coachingMonthlyReports ? [{ ...report, caseId: 92 }] : createRows(table));
    await expect(createCoachingStageHandoff(wrongReport.db, admin, input)).rejects.toThrow("月报不属于当前");
    expect(wrongReport.tx.inserted).toHaveLength(0);

    const wrongPlan = dbMock(createRows, (table) => table === coachingPlans ? [{ ...plan, caseId: 92 }] : createRows(table));
    await expect(createCoachingStageHandoff(wrongPlan.db, admin, input)).rejects.toThrow("计划不属于当前");
    expect(wrongPlan.tx.inserted).toHaveLength(0);

    const unissued = dbMock(createRows, (table) => table === coachingPlans ? [{ ...plan, issuedAt: null }] : createRows(table));
    await expect(createCoachingStageHandoff(unissued.db, admin, input)).rejects.toThrow("必须已完成三方会签");
    expect(unissued.tx.inserted).toHaveLength(0);
  });

  it("接收人必须是本主档学生或有效监护人，不能跨家庭推送", async () => {
    const mock = dbMock((table) => table === coachingGuardianGrants ? [] : createRows(table));
    await expect(createCoachingStageHandoff(mock.db, admin, input)).rejects.toThrow("接收人必须是本主档学员");
    expect(mock.transaction).not.toHaveBeenCalled();
  });

  it("同一接收人、相同月报与计划的待确认交接不可重复创建", async () => {
    const mock = dbMock(createRows, (table) => table === coachingHandoffs ? [familyHandoff] : createRows(table));
    await expect(createCoachingStageHandoff(mock.db, admin, input)).rejects.toThrow("请勿重复发起");
    expect(mock.tx.inserted).toHaveLength(0);
  });

  it("成功事务关联四类材料、补齐月报推送并保存不可变家庭快照", async () => {
    const mock = dbMock(createRows);
    await expect(createCoachingStageHandoff(mock.db, admin, input)).resolves.toEqual({
      id: 701, familyActionId: 702, attachmentId: 703, status: "pending",
    });
    const handoff = mock.tx.inserted.find((row) => row.table === coachingHandoffs)!;
    expect(handoff.values).toMatchObject({ caseId: 91, type: "H5", toUserId: 401, status: "pending", nextSupervisorId: null });
    const familyAction = mock.tx.inserted.find((row) => row.table === coachingExtendedRecords)!;
    expect(familyAction.values).toMatchObject({ recordType: "family_action", status: "pending", ownerId: 19, dueAt: input.dueAt });
    expect(familyAction.values.payload).toMatchObject({ responsibleUserId: 401, handoffId: 701, evidence: "", result: "" });
    const reportPatch = mock.tx.patches.find((row) => row.table === coachingMonthlyReports)!;
    expect(reportPatch.patch.pushedAt).toBeInstanceOf(Date);
    expect(reportPatch.patch.pushedBy).toBe(9);
    const handoffPatch = mock.tx.patches.find((row) => row.table === coachingHandoffs)!;
    expect(handoffPatch.patch).toMatchObject({ monthlyReportId: 601, nextPlanId: 602, familyActionId: 702, attachmentId: 703 });
    expect(handoffPatch.patch.familySnapshot).toMatchObject({
      schemaVersion: 1, monthlyReport: { id: 601, version: 2, pushedAt: expect.any(String) },
      nextPlan: { id: 602, version: 3 }, familyAction: { id: 702, responsibleUserId: 401 },
    });
    const grants = mock.tx.inserted.filter((row) => row.table === coachingDeliverableRecipients);
    expect(grants.map((row) => row.values.resourceType).sort()).toEqual(["deliverable", "family_action", "monthly_report", "plan"]);
    expect(grants.every((row) => row.values.recipientUserId === 401 && row.values.active === true)).toBe(true);
    const document = mock.tx.inserted.find((row) => row.table === coachingDeliverables)!;
    expect(document.values.visibility).toBe("family");
    expect(document.values.body).toContain("确认交接不等于已完成家庭行动，也不代替计划三方会签");
    expect(mock.tx.inserted.some((row) => row.table === coachingEvents && row.values.type === "monthly_report_pushed")).toBe(true);
    expect(mock.tx.inserted.some((row) => row.table === coachingEvents && row.values.type === "stage_handoff_created")).toBe(true);
  });

  it("已推送月报保留原推送时间，不重复写推送事件", async () => {
    const pushed = new Date("2026-11-01T09:00:00+08:00");
    const rows = (table: unknown) => table === coachingMonthlyReports ? [{ ...report, pushedAt: pushed }] : createRows(table);
    const mock = dbMock(rows);
    await createCoachingStageHandoff(mock.db, admin, input);
    expect(mock.tx.patches.some((row) => row.table === coachingMonthlyReports)).toBe(false);
    expect(mock.tx.inserted.some((row) => row.table === coachingEvents && row.values.type === "monthly_report_pushed")).toBe(false);
    const patch = mock.tx.patches.find((row) => row.table === coachingHandoffs)!;
    expect(patch.patch.familySnapshot).toMatchObject({ monthlyReport: { pushedAt: pushed.toISOString() } });
  });
});

describe("家庭阶段交接读取与本人确认", () => {
  it("指定监护人只能看到四份材料均有效授权的交接快照", async () => {
    const mock = dbMock(familyRows);
    const result = await familyCoachingStageHandoffs(mock.db, guardian, 91);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 701, type: "H5", monthlyReportId: 601, nextPlanId: 602, familyActionId: 702, attachmentId: 703 });
    expect(result[0].familySnapshot).toMatchObject({ schemaVersion: 1 });
  });

  it("撤销任一单份材料后，快照不可见也不能用于确认", async () => {
    const revoked = (table: unknown) => table === coachingDeliverableRecipients ? recipientGrants(602) : familyRows(table);
    const listed = dbMock(revoked);
    await expect(familyCoachingStageHandoffs(listed.db, guardian, 91)).resolves.toEqual([]);
    const accepted = dbMock(revoked);
    await expect(acceptFamilyCoachingStageHandoff(accepted.db, guardian, { handoffId: 701 })).rejects.toThrow("授权已撤销");
    expect(accepted.tx.patches).toHaveLength(0);
  });

  it("撤销监护关系后不能读取或确认，即使其他授权仍在", async () => {
    const listed = dbMock((table) => table === coachingGuardianGrants ? [] : familyRows(table));
    await expect(familyCoachingStageHandoffs(listed.db, guardian, 91)).rejects.toThrow("接收人必须是本主档学员");
    const accepted = dbMock(familyRows, (table) => table === coachingGuardianGrants ? [] : familyRows(table));
    await expect(acceptFamilyCoachingStageHandoff(accepted.db, guardian, { handoffId: 701 })).rejects.toThrow("接收人必须是本主档学员");
    expect(accepted.tx.patches).toHaveLength(0);
  });

  it("非指定接收人、员工账号和重复确认均被拒绝", async () => {
    const wrong = dbMock(familyRows);
    await expect(acceptFamilyCoachingStageHandoff(wrong.db, otherFamily, { handoffId: 701 })).rejects.toThrow("只能由指定接收人");
    expect(wrong.transaction).not.toHaveBeenCalled();
    const staff = dbMock(familyRows);
    await expect(acceptFamilyCoachingStageHandoff(staff.db, { id: 401, role: "tutor" }, { handoffId: 701 })).rejects.toThrow("本人账号");
    expect(staff.transaction).not.toHaveBeenCalled();
    const repeated = dbMock((table) => table === coachingHandoffs ? [{ ...familyHandoff, status: "accepted" }] : familyRows(table));
    await expect(acceptFamilyCoachingStageHandoff(repeated.db, guardian, { handoffId: 701 })).rejects.toThrow("请勿重复操作");
    expect(repeated.transaction).not.toHaveBeenCalled();
  });

  it("本人确认只更新 H5，不替交家庭行动，也不替签计划", async () => {
    const mock = dbMock(familyRows);
    const result = await acceptFamilyCoachingStageHandoff(mock.db, guardian, { handoffId: 701, comment: "已阅读，愿按周配合" });
    expect(result).toMatchObject({ ok: true, status: "accepted", acceptedAt: expect.any(Date) });
    expect(mock.tx.patches).toHaveLength(1);
    expect(mock.tx.patches[0]).toMatchObject({ table: coachingHandoffs, patch: {
      status: "accepted", acceptedChannel: "in_app", acceptedComment: "已阅读，愿按周配合", acceptedAt: expect.any(Date),
    } });
    expect(mock.tx.patches.some((row) => row.table === coachingExtendedRecords || row.table === coachingPlans)).toBe(false);
    expect(mock.tx.inserted.find((row) => row.table === coachingEvents)?.values.content).toContain("不代替家庭行动提交或计划会签");
  });

  it("材料关联不完整时不能确认", async () => {
    const incomplete = (table: unknown) => table === coachingHandoffs ? [{ ...familyHandoff, attachmentId: null }] : familyRows(table);
    const mock = dbMock(incomplete);
    await expect(acceptFamilyCoachingStageHandoff(mock.db, guardian, { handoffId: 701 })).rejects.toThrow("材料不完整");
    expect(mock.tx.patches).toHaveLength(0);
  });
});

describe("0056 迁移与前后端接线", () => {
  it("七个可空字段、journal、内嵌迁移和启动效果核对一致", () => {
    const columns = ["monthly_report_id", "next_plan_id", "family_action_id", "attachment_id", "family_snapshot", "accepted_channel", "accepted_comment"];
    const migration = readFileSync("db/migrations/0056_coaching_stage_handoffs.sql", "utf8");
    for (const column of columns) expect(migration).toContain(column);
    expect(migration).not.toContain("NOT NULL");
    const journal = JSON.parse(readFileSync("db/migrations/meta/_journal.json", "utf8")) as { entries: { idx: number; tag: string }[] };
    expect(journal.entries).toContainEqual(expect.objectContaining({ idx: 56, tag: "0056_coaching_stage_handoffs" }));
    const embedded = readFileSync("api/migrationsEmbedded.ts", "utf8");
    expect(embedded).toContain('"0056_coaching_stage_handoffs":');
    expect(embedded).toContain('"idx": 56');
    const initDb = readFileSync("api/initDb.ts", "utf8");
    expect(initDb).toContain('"0056": async () =>');
    for (const column of columns) expect(initDb).toContain(`columnExists(db, "coaching_handoffs", "${column}")`);
    expect(getTableConfig(coachingHandoffs).columns.map((column) => column.name)).toEqual(expect.arrayContaining(columns));
  });

  it("管理端、家庭端和三个独立端点已接线，员工查重与接收按行区分 H5", () => {
    const workspace = readFileSync("src/components/org/CoachingWorkspace.tsx", "utf8");
    const family = readFileSync("src/pages/FamilyCoaching.tsx", "utf8");
    const manager = readFileSync("src/components/org/CoachingStageHandoffs.tsx", "utf8");
    const familyPanel = readFileSync("src/components/org/FamilyStageHandoffs.tsx", "utf8");
    const router = readFileSync("api/coachingRouter.ts", "utf8");
    const lifecycle = readFileSync("api/coachingLifecycle.ts", "utf8");
    expect(workspace).toContain("<CoachingStageHandoffs data={data} />");
    expect(workspace).toContain("data.handoffs.filter((h) => h.type !== \"H5\" || h.nextSupervisorId != null)");
    expect(family).toContain("<FamilyStageHandoffs caseId={caseId} />");
    expect(manager).toContain("trpc.coaching.createStageHandoff.useMutation");
    expect(familyPanel).toContain("trpc.coaching.acceptFamilyStageHandoff.useMutation");
    expect(familyPanel).toContain("本人已阅读并确认收到交接");
    for (const endpoint of ["createStageHandoff", "familyStageHandoffs", "acceptFamilyStageHandoff"]) expect(router).toContain(`${endpoint}:`);
    expect(lifecycle).toContain("const reassignmentRows");
    expect(lifecycle).toContain("and(eq(coachingHandoffs.type, \"H5\"), isNotNull(coachingHandoffs.nextSupervisorId))");
    expect(lifecycle).toContain("家庭阶段交接须由指定学生或监护人在家庭端确认");
    expect(readFileSync("api/router.ts", "utf8")).toContain('BUILD_TAG = "v267-2026-11-09"');
  });
});
