import { describe, expect, it, vi } from "vitest";
import { coachingCases, coachingEvents, coachingTasks, courseParticipants, courseSessions, courseSessionUnits, studySupervisionRecords, users } from "@db/schema";
import { persistCourseActionTx } from "./coachingService";
import { cancelCourseSession, rescheduleCourseSession } from "./coachingSchedule";
import type { PointTx } from "./orgPoints";
import type { StaffUser } from "./orgAccess";

const admin = { id: 9, role: "admin", orgId: 7 } as StaffUser;
const ownerCase = { id: 91, orgId: 7, studentUserId: 301, coachId: 9, supervisorId: 9, serviceStart: "2026-08-01" } as typeof coachingCases.$inferSelect;

function actionTx(task?: Record<string, unknown>) {
  const updates: { table: unknown; patch: Record<string, unknown> }[] = [];
  const inserts: { table: unknown; values: Record<string, unknown> }[] = [];
  const tx = {
    select: vi.fn(() => ({ from: (table: unknown) => {
      expect(table).toBe(coachingTasks);
      return { where: () => ({ limit: () => ({ for: async () => task ? [task] : [] }) }) };
    } })),
    update: vi.fn((table: unknown) => ({ set: (patch: Record<string, unknown>) => ({ where: async () => { updates.push({ table, patch }); } }) })),
    insert: vi.fn((table: unknown) => ({ values: (values: Record<string, unknown>) => {
      inserts.push({ table, values });
      return { $returningId: async () => [{ id: 802 }] };
    } })),
  };
  return { tx: tx as unknown as PointTx, updates, inserts };
}

describe("课堂行动续写回归", () => {
  it("已有行动只更新计划字段，不清空已验收证据和结果", async () => {
    const mock = actionTx({ id: 801, caseId: 91, ownerId: 301, status: "verified", evidence: "原验收证据", result: "原验收结果" });
    const taskId = await persistCourseActionTx(mock.tx, ownerCase, admin,
      { studentUserId: 301, attendance: "present", action: { title: "三天内完成错题复验", detail: "每张须有错因和复验日期", dueDate: "2026-11-16" } }, 801);
    expect(taskId).toBe(801);
    expect(mock.updates).toHaveLength(1);
    expect(mock.updates[0]).toEqual({ table: coachingTasks, patch: { title: "三天内完成错题复验", detail: "每张须有错因和复验日期", dueDate: "2026-11-16" } });
    expect(mock.updates[0].patch).not.toHaveProperty("evidence");
    expect(mock.updates[0].patch).not.toHaveProperty("result");
    expect(mock.updates[0].patch).not.toHaveProperty("status");
    expect(mock.inserts.filter((row) => row.table === coachingTasks)).toHaveLength(0);
  });

  it("缺席时保留原任务，不更新也不标记完成", async () => {
    const mock = actionTx({ id: 801, caseId: 91, ownerId: 301, status: "pending", evidence: "", result: "" });
    const taskId = await persistCourseActionTx(mock.tx, ownerCase, admin, { studentUserId: 301, attendance: "absent" }, 801);
    expect(taskId).toBe(801);
    expect(mock.updates).toHaveLength(0);
    expect(mock.inserts.filter((row) => row.table === coachingTasks)).toHaveLength(0);
    expect(mock.inserts.find((row) => row.table === coachingEvents)?.values.content).toContain("不代表已验收");
  });

  it("清空页面行动不删除已有任务，没有历史任务则保持为空", async () => {
    const existing = actionTx({ id: 801, caseId: 91, ownerId: 301 });
    await expect(persistCourseActionTx(existing.tx, ownerCase, admin, { studentUserId: 301, attendance: "present" }, 801)).resolves.toBe(801);
    expect(existing.updates).toHaveLength(0);
    expect(existing.inserts.filter((row) => row.table === coachingTasks)).toHaveLength(0);
    const empty = actionTx();
    await expect(persistCourseActionTx(empty.tx, ownerCase, admin, { studentUserId: 301, attendance: "present" }, null)).resolves.toBeNull();
    expect(empty.inserts).toHaveLength(0);
  });

  it("只有新行动才创建任务，历史记录归属不一致时失败关闭", async () => {
    const created = actionTx();
    await expect(persistCourseActionTx(created.tx, ownerCase, admin,
      { studentUserId: 301, action: { title: "完成两张错题三刷卡", dueDate: "2026-11-16" } }, null)).resolves.toBe(802);
    expect(created.inserts.find((row) => row.table === coachingTasks)?.values).toMatchObject({ caseId: 91, ownerId: 301, evidence: "", result: "" });
    const invalid = actionTx({ id: 801, caseId: 91, ownerId: 999 });
    await expect(persistCourseActionTx(invalid.tx, ownerCase, admin,
      { studentUserId: 301, action: { title: "不应覆盖他人任务", dueDate: "2026-11-16" } }, 801)).rejects.toThrow("主档不匹配");
    expect(invalid.updates).toHaveLength(0);
  });
});

function rowsResult(rows: unknown[]) {
  return {
    limit: () => ({ for: async () => rows }),
    for: async () => rows,
    then: (resolve: (value: unknown[]) => unknown) => Promise.resolve(rows).then(resolve),
  };
}

describe("课堂改期与取消回归", () => {
  function scheduleDb(status = "scheduled") {
    const session = { id: 601, orgId: 7, caseId: 91, supervisionId: 701, startAt: new Date("2026-12-01T10:00:00+08:00"),
      status, format: "salon", changeReason: "阶段评估通过", changeConfirmedBy: 9 };
    const tx = {
      select: vi.fn(() => ({
        from: (table: unknown) => ({
          where: () => {
            if (table === courseSessions) return rowsResult([session]);
            if (table === courseSessionUnits) return rowsResult([{ id: 1, sessionId: 601 }]);
            if (table === courseParticipants) return rowsResult([{ id: 1, sessionId: 601, studentUserId: 301 }]);
            if (table === coachingCases) return rowsResult([ownerCase]);
            if (table === studySupervisionRecords) return rowsResult([{ id: 701, caseId: 91 }]);
            throw new Error("unexpected transaction table");
          },
        }),
      })),
      update: vi.fn(), insert: vi.fn(),
    };
    const db = {
      select: vi.fn(() => ({ from: (table: unknown) => ({ where: () => ({ limit: async () => {
        if (table === courseSessions) return [session];
        if (table === coachingCases) return [ownerCase];
        if (table === users) return [{ id: 301, orgId: 7, role: "user", deletedAt: null }];
        throw new Error("unexpected table");
      } }) }) })),
      transaction: vi.fn(async (callback: (value: unknown) => unknown) => callback(tx)),
    };
    return { db, tx, session };
  }

  it("后期小组课不能通过改期绕过前三个月一对一规则", async () => {
    const mock = scheduleDb();
    await expect(rescheduleCourseSession(mock.db as never, admin,
      { sessionId: 601, startAt: new Date("2026-10-15T10:00:00+08:00"), reason: "场地调整提前到店" })).rejects.toThrow("前三个月");
    expect(mock.tx.update).not.toHaveBeenCalled();
    expect(mock.tx.insert).not.toHaveBeenCalled();
  });

  it("已完成课堂和已归档督学事实不能被取消覆盖", async () => {
    const mock = scheduleDb("completed");
    await expect(cancelCourseSession(mock.db as never, admin, { sessionId: 601, reason: "尝试取消历史课堂" })).rejects.toThrow("历史事实");
    expect(mock.tx.update).not.toHaveBeenCalled();
    expect(mock.tx.insert).not.toHaveBeenCalled();
  });
});
