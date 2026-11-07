import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { assessmentActivities, assessmentActivityItems, assessmentAssignments, coachingEvents, coachingTaskVerifications, orgPointAccounts, orgPointLedger } from "@db/schema";
import { cancelAssessmentStudent, createAssessmentActivity, expireAssessmentActivity, startAssessmentAssignment } from "./assessmentActivities";
import { persistAssessmentResult } from "./assessmentPersistence";
import { listAssessmentReports } from "./assessmentReports";
import { reclaimOrgPoints } from "./orgPoints";
import { saveCoachingPlan, verifyCoachingTask } from "./coachingService";

const { refundMock, debitMock, reportAccessMock, studentAccessMock } = vi.hoisted(() => ({
  refundMock: vi.fn(), debitMock: vi.fn(), reportAccessMock: vi.fn(), studentAccessMock: vi.fn(),
}));
vi.mock("./orgPoints", async (importOriginal) => ({ ...await importOriginal<typeof import("./orgPoints")>(), refundOriginalDebitTx: refundMock, debitPoints: debitMock }));
vi.mock("./orgAccess", async (importOriginal) => ({ ...await importOriginal<typeof import("./orgAccess")>(), assertStudentAccess: studentAccessMock }));
vi.mock("./tutorAccess", async (importOriginal) => ({ ...await importOriginal<typeof import("./tutorAccess")>(), getTutorReportAccess: reportAccessMock }));

const me = { id: 9, orgId: 7, role: "admin" } as never;
const past = () => new Date(Date.now() - 60_000);

/** 仅模拟 Drizzle 调用链和事务边界；不声称验证真实 MySQL/CynosDB 锁与并发。 */
function mockDb(reads: unknown[][]) {
  const updates: { table: unknown; patch: Record<string, unknown> }[] = [];
  const inserts: { table: unknown; values: Record<string, unknown> }[] = [];
  const db = {
    select: vi.fn(() => {
      const result = reads.shift() ?? [];
      const query = {
        from: () => query, innerJoin: () => query, leftJoin: () => query,
        where: () => query, orderBy: () => query, limit: () => query,
        for: async () => result,
        then: (resolve: (rows: unknown[]) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
      };
      return query;
    }),
    update: (table: unknown) => ({ set: (patch: Record<string, unknown>) => ({ where: async () => {
      updates.push({ table, patch }); return { affectedRows: 1 };
    } }) }),
    insert: (table: unknown) => ({ values: (values: Record<string, unknown>) => {
      inserts.push({ table, values });
      return { $returningId: async () => [{ id: inserts.length }], onDuplicateKeyUpdate: async () => {} };
    } }),
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db)),
  };
  return { db: db as never, raw: db, updates, inserts };
}

function assignment(id: number, status = "pending", extra: Record<string, unknown> = {}) {
  return { assignment: { id, activityItemId: 10, studentUserId: 101, status, startedAt: null, completedAt: null, ...extra }, price: 20 };
}

beforeEach(() => {
  vi.clearAllMocks();
  studentAccessMock.mockResolvedValue(undefined);
  reportAccessMock.mockResolvedValue({ allowed: true, expiresAt: null });
  refundMock.mockResolvedValue({ refunded: true });
  debitMock.mockResolvedValue(undefined);
});

describe("测评到期、取消和复测（模拟事务）", () => {
  it("综合包任一子项已完成时，其余待做到期也不退整包", async () => {
    const activity = { id: 1, status: "open", dueAt: past(), expiryPolicy: "auto_refund" };
    const mock = mockDb([[activity], [assignment(1, "completed", { completedAt: new Date() }), assignment(2)]]);
    const result = await expireAssessmentActivity(mock.db, 1, 9);
    expect(result).toEqual({ expired: 1, refunded: 0 });
    expect(refundMock).not.toHaveBeenCalled();
    expect(mock.updates[0]).toMatchObject({ table: assessmentAssignments, patch: { status: "expired" } });
  });

  it("综合包任一子项已开始时，其余待做到期也不退整包", async () => {
    const activity = { id: 1, status: "open", dueAt: past(), expiryPolicy: "auto_refund" };
    const mock = mockDb([[activity], [assignment(1, "in_progress", { startedAt: new Date() }), assignment(2)]]);
    const result = await expireAssessmentActivity(mock.db, 1, 9);
    expect(result).toEqual({ expired: 2, refunded: 0 });
    expect(refundMock).not.toHaveBeenCalled();
  });

  it("综合包全部未开始时只按原扣费事件退款一次", async () => {
    const activity = { id: 1, status: "open", dueAt: past(), expiryPolicy: "auto_refund" };
    const mock = mockDb([[activity], [assignment(1), assignment(2)]]);
    const result = await expireAssessmentActivity(mock.db, 1, 9);
    expect(result).toEqual({ expired: 2, refunded: 1 });
    expect(refundMock).toHaveBeenCalledOnce();
    expect(refundMock.mock.calls[0]![1]).toMatchObject({ eventKey: "assessment:item:10:student:101" });
  });

  it("手动过期的综合包若曾开始，逐生取消也不能绕过退款限制", async () => {
    const rows = [{ id: 1, activityItemId: 10, studentUserId: 101, status: "expired", startedAt: new Date(), completedAt: null }];
    const mock = mockDb([[{ id: 10, activityId: 1, priceSnapshot: 20 }], [{ id: 1, orgId: 7, createdBy: 9 }], rows]);
    await expect(cancelAssessmentStudent(mock.db, me, 10, 101, "人工取消过期任务")).rejects.toThrow("已有子项开始或完成");
    expect(refundMock).not.toHaveBeenCalled();
    expect(mock.updates).toHaveLength(0);
  });

  it("逐生整包取消只退该生一次，重复取消不再次退款", async () => {
    const item = [{ id: 10, activityId: 1, priceSnapshot: 20 }];
    const activity = [{ id: 1, orgId: 7, createdBy: 9 }];
    const pending = [{ id: 1, activityItemId: 10, studentUserId: 101, status: "pending", startedAt: null, completedAt: null }, { id: 2, activityItemId: 10, studentUserId: 101, status: "pending", startedAt: null, completedAt: null }];
    const first = mockDb([item, activity, pending]);
    expect((await cancelAssessmentStudent(first.db, me, 10, 101, "只取消该生")).refunded).toBe(true);
    expect(refundMock).toHaveBeenCalledOnce();
    expect(refundMock.mock.calls[0]![1].eventKey).toBe("assessment:item:10:student:101");
    const second = mockDb([item, activity, [pending.map((row) => ({ ...row, status: "cancelled" }))]]);
    await expect(cancelAssessmentStudent(second.db, me, 10, 101, "重复取消")).rejects.toThrow("已有子项开始或完成");
    expect(refundMock).toHaveBeenCalledOnce();
  });

  it("开始任务时拒绝超过完成期限的活动", async () => {
    const row = { assignment: { id: 1, studentUserId: 101, kind: "e3", status: "pending" }, activityStatus: "open", dueAt: past() };
    const mock = mockDb([[row]]);
    await expect(startAssessmentAssignment(mock.db, 101, 1)).rejects.toThrow("超过完成期限");
    expect(mock.updates).toHaveLength(0);
  });

  it("提交结果时同样拒绝超过完成期限的活动", async () => {
    const hit = { assignment: { id: 1, studentUserId: 101, kind: "e3", status: "in_progress" }, item: { includedKinds: ["e3"] }, activity: { status: "open", dueAt: past() } };
    const mock = mockDb([[], [hit]]);
    await expect(persistAssessmentResult(mock.db, { userId: 101, outcome: { kind: "e3", result: {} }, answers: [1], submissionKey: "expired-submit-test", assignmentId: 1 })).rejects.toThrow("不能提交");
    expect(mock.inserts).toHaveLength(0);
  });

  it("旧入口遇到有效本机构伴学师时仍按单项价格正常扣费", async () => {
    const mock = mockDb([
      [], [],
      [{ orgId: 7, edition: "org" }],
      [{ orgId: 7 }],
      [{ tutorId: 9 }],
      [{ orgId: 7, role: "tutor", deletedAt: null }],
      [{ initialized: true }],
    ]);
    const saved = await persistAssessmentResult(mock.db, {
      userId: 101,
      outcome: { kind: "e3", result: {} },
      answers: [1],
      submissionKey: "current-tutor-debit-regression",
    });
    expect(saved.resultId).toBe(1);
    expect(debitMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      orgId: 7, payerUserId: 9, studentUserId: 101, amount: 10, kind: "e3",
    }));
  });

  it("复测新建 20 积分组合任务并保留原结果与复测来源", async () => {
    const source = { assignment: { id: 40, status: "completed", studentUserId: 101, resultId: 88 }, selectionKey: "xuanke_free" };
    const mock = mockDb([[source], [], []]);
    const result = await createAssessmentActivity(mock.db, me, { requestKey: "retest-request-001", studentIds: [101], selections: ["xuanke_free"], title: "选科复测", retestOfAssignmentId: 40 });
    expect(result).toEqual({ activityId: 1, duplicate: false });
    expect(mock.inserts.find((row) => row.table === assessmentActivityItems)?.values.priceSnapshot).toBe(20);
    const tasks = mock.inserts.filter((row) => row.table === assessmentAssignments);
    expect(tasks).toHaveLength(2);
    expect(tasks.every((row) => row.values.retestOfAssignmentId === 40)).toBe(true);
    expect(debitMock).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ amount: 20, reason: "复测：选科及升学规划组合" }));
    expect(mock.updates).toHaveLength(0);
    expect(source.assignment.resultId).toBe(88);
  });
});

describe("报告权限与验收版本（模拟事务）", () => {
  it("报告权限到期后，报告记录不可见，GROW 计划也不能关联该报告", async () => {
    reportAccessMock.mockResolvedValue({ allowed: false, expiresAt: past() });
    const report = { id: 88, kind: "e3", createdAt: new Date(), studentUserId: 101, studentName: "测试学员", activityId: 1, activityDueAt: null, activityTitle: "伴学测评" };
    const tutorMe = { id: 9, orgId: 7, role: "tutor" } as never;
    const list = mockDb([[report]]);
    expect(await listAssessmentReports(list.db, tutorMe, {})).toEqual([]);
    const coachingCase = { id: 5, orgId: 7, studentUserId: 101, coachId: 9, supervisorId: 9 };
    const plan = mockDb([[coachingCase], [{ userId: 101 }]]);
    await expect(saveCoachingPlan(plan.db, tutorMe, { caseId: 5, level: "week", title: "周计划", content: "依据报告安排行动", startDate: "2026-11-07", endDate: "2026-11-14", sourceResultId: 88, confirmed: true })).rejects.toThrow("权限");
    expect(plan.raw.transaction).not.toHaveBeenCalled();
  });

  it("二次验收新增 V2，首次 evidence 与 result 保持不变", async () => {
    const task = { id: 3, caseId: 5, title: "错题三刷", status: "verified", evidence: "首次原始证据", result: "首次验收结果", verifierId: 8 };
    const coachingCase = { id: 5, orgId: 7, studentUserId: 101, coachId: 9, supervisorId: 9 };
    const first = { id: 11, taskId: 3, caseId: 5, version: 1, evidence: "首次原始证据", result: "首次验收结果" };
    const mock = mockDb([[task], [coachingCase], [task], [first]]);
    const result = await verifyCoachingTask(mock.db, me, { taskId: 3, evidence: "补充更正证据", result: "补充更正结果" });
    expect(result.version).toBe(2);
    const v2 = mock.inserts.find((row) => row.table === coachingTaskVerifications);
    expect(v2?.values).toMatchObject({ version: 2, previousId: 11, evidence: "补充更正证据", result: "补充更正结果" });
    expect(mock.inserts.some((row) => row.table === coachingEvents)).toBe(true);
    expect(mock.updates).toHaveLength(0);
    expect(task.evidence).toBe("首次原始证据");
    expect(task.result).toBe("首次验收结果");
  });
});

describe("积分回收（模拟事务）", () => {
  const pool = { id: 1, orgId: 7, ownerUserId: 0, balance: 100, initialized: true };
  const tutor = { id: 2, orgId: 7, ownerUserId: 9, balance: 50, initialized: true };

  it("回收入账与个人出账成双，未消耗余额同步转移", async () => {
    const mock = mockDb([[{ id: 9 }], [], [pool, tutor], [], []]);
    const result = await reclaimOrgPoints(mock.db, { orgId: 7, actorUserId: 8, tutorUserId: 9, amount: 40, reason: "服务改派后回收" });
    expect(result).toMatchObject({ balance: 10, poolBalance: 140 });
    const entries = mock.inserts.filter((row) => row.table === orgPointLedger);
    expect(entries.map((row) => [row.values.type, row.values.amount])).toEqual([["reclaim_out", -40], ["reclaim_in", 40]]);
    expect(mock.updates.filter((row) => row.table === orgPointAccounts)).toHaveLength(2);
  });

  it("不能回收超过个人未用余额的积分", async () => {
    const mock = mockDb([[{ id: 9 }], [], [{ ...pool }, { ...tutor, balance: 20 }]]);
    await expect(reclaimOrgPoints(mock.db, { orgId: 7, actorUserId: 8, tutorUserId: 9, amount: 30, reason: "超额回收" })).rejects.toThrow("已消耗积分不能回收");
    expect(mock.inserts).toHaveLength(0);
  });

  it("存在未改派的服务中主档时阻止回收", async () => {
    const mock = mockDb([[{ id: 9 }], [{ id: 5 }]]);
    await expect(reclaimOrgPoints(mock.db, { orgId: 7, actorUserId: 8, tutorUserId: 9, amount: 10, reason: "仍有陪跑主档" })).rejects.toThrow("先完成改派");
    expect(mock.raw.transaction).not.toHaveBeenCalled();
  });
});

describe("0047 迁移交付一致性", () => {
  it("SQL、journal、embedded 与 schema 同步，默认值符合 CynosDB 红线", () => {
    const sql = readFileSync("db/migrations/0047_assessment_closure.sql", "utf8");
    const journal = readFileSync("db/migrations/meta/_journal.json", "utf8");
    const embedded = readFileSync("api/migrationsEmbedded.ts", "utf8");
    const schema = readFileSync("db/orgServiceSchema.ts", "utf8");
    expect(sql).toContain("coaching_task_verifications");
    expect(sql).toContain("DEFAULT CURRENT_TIMESTAMP");
    expect(journal).toContain("0047_assessment_closure");
    expect(embedded).toContain("0047_assessment_closure");
    expect(schema).toContain("coachingTaskVerifications");
    expect(schema).toContain("retestOfAssignmentId");
  });
});
