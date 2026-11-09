import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  coachingCases, coachingCaseScenarios, coachingDeliverableRecipients, coachingDeliverables,
  coachingEvents, courseParticipants, courseSessions,
} from "@db/schema";
import { endCoachingScenarios, pushParticipantFeedback } from "./coachingService";
import { buildCoachingClosureReadiness } from "./coachingLifecycle";
import type { StaffUser } from "./orgAccess";

const mocks = vi.hoisted(() => ({
  caseAccess: vi.fn(), studentAccess: vi.fn(), grant: vi.fn(), queue: vi.fn(),
}));
vi.mock("./coachingAccess", async (importOriginal) => ({
  ...await importOriginal<typeof import("./coachingAccess")>(), assertCaseAccess: mocks.caseAccess,
}));
vi.mock("./orgAccess", async (importOriginal) => ({
  ...await importOriginal<typeof import("./orgAccess")>(), assertStudentAccess: mocks.studentAccess,
}));
vi.mock("./coachingRecipients", async (importOriginal) => ({
  ...await importOriginal<typeof import("./coachingRecipients")>(),
  grantFamilyResourcesTx: mocks.grant, queueFamilyResourceNotifications: mocks.queue,
}));

const me = { id: 9, role: "admin", orgId: 7 } as StaffUser;
const ownerCase = { id: 91, orgId: 7, studentUserId: 301, coachId: 9, supervisorId: 9, status: "active" } as typeof coachingCases.$inferSelect;
type Db = Parameters<typeof endCoachingScenarios>[0];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.caseAccess.mockResolvedValue(ownerCase);
  mocks.studentAccess.mockResolvedValue(undefined);
  mocks.grant.mockResolvedValue([301]);
  mocks.queue.mockResolvedValue([]);
});

describe("服务场景结束与结课最终记录", () => {
  function endDb(active: { id: number; scenario: string; endedAt: Date | null }[]) {
    const updates: Record<string, unknown>[] = [];
    const events: Record<string, unknown>[] = [];
    const tx = {
      select: vi.fn(() => ({ from: (table: unknown) => {
        expect(table).toBe(coachingCaseScenarios);
        return { where: () => ({ for: async () => active }) };
      } })),
      update: vi.fn((table: unknown) => {
        expect(table).toBe(coachingCaseScenarios);
        return { set: (patch: Record<string, unknown>) => ({ where: async () => { updates.push(patch); } }) };
      }),
      insert: vi.fn((table: unknown) => {
        expect(table).toBe(coachingEvents);
        return { values: async (values: Record<string, unknown>) => { events.push(values); } };
      }),
    };
    const db = { transaction: vi.fn(async (callback: (transaction: unknown) => unknown) => callback(tx)) };
    return { db: db as unknown as Db, tx, updates, events };
  }

  it("可只结束勾选的场景，保留其他服务场景并记录原因", async () => {
    const mock = endDb([{ id: 1, scenario: "A", endedAt: null }, { id: 2, scenario: "B", endedAt: null }]);
    await expect(endCoachingScenarios(mock.db, me, { caseId: 91, scenarios: ["A"], reason: "晚自习服务已按约完成" })).resolves.toEqual({ ended: ["A"] });
    expect(mock.updates).toHaveLength(1);
    expect(mock.updates[0]).toMatchObject({ activeKey: null, endedBy: 9, changeReason: "晚自习服务已按约完成" });
    expect(mock.updates[0].endedAt).toBeInstanceOf(Date);
    expect(mock.events[0].content).toContain("原因：晚自习服务已按约完成");
  });

  it("已结束场景不会重复写入，空选择或缺少原因会在事务前拒绝", async () => {
    const mock = endDb([{ id: 1, scenario: "B", endedAt: null }]);
    await expect(endCoachingScenarios(mock.db, me, { caseId: 91, scenarios: ["A"], reason: "重复结束" })).rejects.toThrow("所选服务场景已经结束");
    expect(mock.updates).toHaveLength(0);
    await expect(endCoachingScenarios(mock.db, me, { caseId: 91, scenarios: ["B"], reason: " " })).rejects.toThrow("填写结束原因");
    await expect(endCoachingScenarios(mock.db, me, { caseId: 91, scenarios: [], reason: "全部结束" })).rejects.toThrow("请选择服务场景");
  });

  function readySource(): Parameters<typeof buildCoachingClosureReadiness>[0] {
    const finalRecord = (recordType: string, id: number) => ({ id, recordType, version: 1, status: "completed" });
    return {
      coachingCase: { ...ownerCase, goal: "学生目标", currentSituation: "现状", planSummary: "计划" },
      scenarioHistory: [{ endedAt: new Date() }], plans: [{ status: "confirmed", issuedAt: new Date() }], tasks: [],
      reviews: [{ period: "term", content: "目标对照", nextActions: "后续安排" }],
      growProfiles: [{ version: 1, studentGoal: "学生目标", parentExpectation: "家长期待", currentSituation: "现状", evidence: "证据", followUpActions: "行动" }],
      extendedRecords: ["four_line_review", "closure_assessment", "closure_interview", "termination"].map((type, index) => finalRecord(type, index + 1)),
      exceptions: [], handoffs: [], supervisions: [], sessions: [], participants: [], deliverables: [], crisisFollowups: [],
    } as unknown as Parameters<typeof buildCoachingClosureReadiness>[0];
  }

  it.each(["four_line_review", "closure_assessment", "closure_interview", "termination"])("%s 的最新版本是草稿时不能通过结课", (recordType) => {
    const source = readySource();
    source.extendedRecords = source.extendedRecords!.map((row) => row.recordType === recordType ? { ...row, status: "draft" } : row);
    const readiness = buildCoachingClosureReadiness(source);
    expect(readiness.ready).toBe(false);
    expect(readiness.blockers.map((row) => row.code)).toContain(recordType === "termination" ? "closureDestination" : recordType);
  });

  it("最新取消版本不会抵消已取消之前的完成版本，但新草稿会阻断", () => {
    const source = readySource();
    const old = source.extendedRecords!.find((row) => row.recordType === "closure_assessment")!;
    source.extendedRecords = [...source.extendedRecords!.filter((row) => row.recordType !== "closure_assessment"),
      { ...old, id: 20, version: 2, status: "draft" }, { ...old, id: 21, version: 3, status: "cancelled" }];
    const readiness = buildCoachingClosureReadiness(source);
    expect(readiness.blockers.map((row) => row.code)).toContain("closure_assessment");
  });
});

describe("课堂反馈逐人授权", () => {
  it("再次推送先撤销当前反馈旧接收人，不批量撤销历史附件", async () => {
    const participant = { id: 11, sessionId: 22, studentUserId: 301 };
    const session = { id: 22, caseId: 91, orgId: 7, status: "completed" };
    const db = {
      select: vi.fn(() => ({ from: (table: unknown) => ({ where: () => ({
        limit: async () => table === courseParticipants ? [participant] : table === courseSessions ? [session] : table === coachingCases ? [ownerCase] : [],
      }) }) })),
      transaction: vi.fn(),
    };
    const updates: { table: unknown; patch: Record<string, unknown> }[] = [];
    const tx = {
      select: vi.fn(() => ({
        from: (table: unknown) => ({
          where: () => {
            const rows = table === courseParticipants ? [participant] : [];
            return Object.assign(Promise.resolve(rows), {
              for: async () => rows,
              orderBy: () => ({ limit: async () => [] }),
              limit: () => ({ for: async () => rows }),
            });
          },
        }),
      })),
      update: vi.fn((table: unknown) => ({ set: (patch: Record<string, unknown>) => ({ where: async () => { updates.push({ table, patch }); } }) })),
      insert: vi.fn((table: unknown) => ({ values: (values: Record<string, unknown>) => ({
        $returningId: async () => [{ id: table === coachingDeliverables ? 88 : 89 }],
      }) })),
    };
    db.transaction.mockImplementation(async (callback: (transaction: unknown) => unknown) => callback(tx));
    await expect(pushParticipantFeedback(db as unknown as Parameters<typeof pushParticipantFeedback>[0], me,
      { participantId: 11, feedbackText: "本次只发给学生本人", recipientUserIds: [301] })).resolves.toEqual({ ok: true, version: 1 });
    const revocation = updates.find((row) => row.table === coachingDeliverableRecipients);
    expect(revocation?.patch).toMatchObject({ active: false, revokedBy: 9 });
    expect(revocation?.patch.revokedAt).toBeInstanceOf(Date);
    expect(mocks.grant).toHaveBeenCalledTimes(2);
    expect(mocks.grant.mock.calls[0][1]).toMatchObject({ resourceType: "session_feedback", resourceIds: [11], recipientUserIds: [301] });
    expect(mocks.grant.mock.calls[1][1]).toMatchObject({ resourceType: "deliverable", resourceIds: [88], recipientUserIds: [301] });
    expect(updates.filter((row) => row.table === coachingDeliverableRecipients)).toHaveLength(1);
  });
});
