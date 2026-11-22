import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getTableConfig } from "drizzle-orm/mysql-core";
import { coachingCases, coachingCaseStaff, coachingEvents, coachingHandoffs, users } from "@db/schema";
import { acceptHandoff, buildCoachingClosureReadiness, cancelReassignment, reassignCoachingCase } from "./coachingLifecycle";
import { addHandoff } from "./coachingService";
import type { StaffUser } from "./orgAccess";

const admin = { id: 9, role: "admin", orgId: 7 } as StaffUser;
const oldTutor = { id: 19, role: "tutor", orgId: 7 } as StaffUser;
const newSupervisor = { id: 29, role: "tutor", orgId: 7 } as StaffUser;
const otherTutor = { id: 39, role: "tutor", orgId: 7 } as StaffUser;
const baseCase = { id: 91, orgId: 7, studentUserId: 301, coachId: 19, supervisorId: 19, status: "active" } as typeof coachingCases.$inferSelect;
const baseHandoff = { id: 501, caseId: 91, type: "H5", fromUserId: 9, toUserId: 29, title: "人员改派 · 待新督学接收",
  content: "服务调整", status: "pending", acceptedAt: null, fromCoachId: 19, fromSupervisorId: 19,
  nextCoachId: 39, nextSupervisorId: 29, appliedAt: null } as typeof coachingHandoffs.$inferSelect;
type Db = Parameters<typeof reassignCoachingCase>[0];

function limit(rows: unknown[]) {
  return Object.assign(Promise.resolve(rows), { for: async () => rows });
}

function reassignDb(pending = false) {
  const inserted: { table: unknown; values: Record<string, unknown> }[] = [];
  const tx = {
    select: vi.fn(() => ({ from: (table: unknown) => ({ where: () => ({
      limit: () => limit(table === coachingCases ? [baseCase] : table === coachingHandoffs && pending ? [{ id: 500 }] : []),
      then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve(table === coachingCases ? [baseCase] : []).then(resolve),
    }) }) })),
    insert: vi.fn((table: unknown) => ({ values: (values: Record<string, unknown>) => {
      inserted.push({ table, values });
      return { $returningId: async () => [{ id: table === coachingHandoffs ? 501 : 701 }] };
    } })),
  };
  const db = {
    select: vi.fn(() => ({ from: (table: unknown) => ({ where: () => ({
      limit: async () => table === coachingCases ? [baseCase] : table === users ? [{ id: 1 }] : [],
      then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve(table === coachingCases ? [baseCase] : []).then(resolve),
    }) }) })),
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(tx)),
  };
  return { db: db as unknown as Db, transaction: db.transaction, inserted, tx };
}

function acceptDb(handoff = baseHandoff, current = baseCase) {
  const updates: { table: unknown; patch: Record<string, unknown> }[] = [];
  const events: Record<string, unknown>[] = [];
  const teamValues: Record<string, unknown>[] = [];
  const tx = {
    select: vi.fn(() => ({ from: (table: unknown) => ({ where: () => ({
      limit: () => limit(table === coachingHandoffs ? [handoff] : table === coachingCases ? [current] : table === users ? [{ id: 1 }] : []),
      for: async () => table === coachingCases ? [current] : [],
      then: (resolve: (rows: unknown[]) => unknown) => Promise.resolve(table === coachingCases ? [current] : []).then(resolve),
    }) }) })),
    update: vi.fn((table: unknown) => ({ set: (patch: Record<string, unknown>) => ({ where: async () => {
      updates.push({ table, patch });
      return { affectedRows: 1 };
    } }) })),
    insert: vi.fn((table: unknown) => ({ values: (values: Record<string, unknown>) => {
      if (table === coachingEvents) events.push(values);
      if (table === coachingCaseStaff) teamValues.push(values);
      return Object.assign(Promise.resolve(), { onDuplicateKeyUpdate: async () => ({ affectedRows: 1 }) });
    } })),
  };
  const db = {
    select: vi.fn(() => ({ from: (table: unknown) => ({
      innerJoin: () => ({ where: () => ({ limit: async () => table === coachingHandoffs ? [{ handoff, coachingCase: current }] : [] }) }),
    }) })),
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(tx)),
  };
  return { db: db as unknown as Parameters<typeof acceptHandoff>[0], transaction: db.transaction, updates, events, teamValues };
}

function cancelDb(handoff = baseHandoff) {
  const updates: Record<string, unknown>[] = [];
  const tx = {
    select: vi.fn(() => ({ from: (table: unknown) => ({ where: () => ({
      limit: () => ({ for: async () => table === coachingHandoffs ? [handoff] : [] }),
    }) }) })),
    update: vi.fn((table: unknown) => {
      expect(table).toBe(coachingHandoffs);
      return { set: (patch: Record<string, unknown>) => ({ where: async () => { updates.push(patch); return { affectedRows: 1 }; } }) };
    }),
    insert: vi.fn(() => ({ values: async () => undefined })),
  };
  const db = {
    select: vi.fn(() => ({ from: (table: unknown) => ({ where: () => ({
      limit: async () => table === coachingHandoffs ? [handoff] : table === coachingCases ? [baseCase] : [],
    }) }) })),
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(tx)),
  };
  return { db: db as unknown as Parameters<typeof cancelReassignment>[0], transaction: db.transaction, updates };
}

describe("H5 人员改派接收闭环", () => {
  it("管理员只发起待接收快照，不直接修改主档负责人", async () => {
    const mock = reassignDb();
    await expect(reassignCoachingCase(mock.db, admin, { caseId: 91, coachId: 39, supervisorId: 29, reason: "加强后期学习坊服务" })).resolves.toEqual({ id: 501, status: "pending" });
    expect(mock.tx).not.toHaveProperty("update");
    const handoff = mock.inserted.find((row) => row.table === coachingHandoffs)!;
    expect(handoff.values).toMatchObject({ type: "REASSIGN", status: "pending", toUserId: 29,
      fromCoachId: 19, fromSupervisorId: 19, nextCoachId: 39, nextSupervisorId: 29 });
    expect(mock.inserted.find((row) => row.table === coachingEvents)?.values.content).toContain("等待新督学接收");
  });

  it("普通伴学师不能发起，重复待接收改派也会被拒绝", async () => {
    const denied = reassignDb();
    await expect(reassignCoachingCase(denied.db, oldTutor, { caseId: 91, coachId: 39, supervisorId: 29, reason: "越权改派" })).rejects.toThrow("仅机构管理员");
    expect(denied.transaction).not.toHaveBeenCalled();
    const duplicate = reassignDb(true);
    await expect(reassignCoachingCase(duplicate.db, admin, { caseId: 91, coachId: 39, supervisorId: 29, reason: "重复改派" })).rejects.toThrow("已有待接收改派");
    expect(duplicate.inserted).toHaveLength(0);
  });

  it("新督学接收时才同时更新负责人并写入生效时间", async () => {
    const mock = acceptDb();
    await expect(acceptHandoff(mock.db, newSupervisor, 501)).resolves.toEqual({ ok: true, reassigned: true });
    expect(mock.updates.find((row) => row.table === coachingCases)).toMatchObject({ table: coachingCases, patch: { coachId: 39, supervisorId: 29 } });
    const accepted = mock.updates.find((row) => row.table === coachingHandoffs)!;
    expect(accepted.patch).toMatchObject({ status: "accepted" });
    expect(accepted.patch.appliedAt).toBeInstanceOf(Date);
    expect(mock.teamValues).toEqual(expect.arrayContaining([
      expect.objectContaining({ userId: 39, serviceRole: "coach", active: true }),
      expect.objectContaining({ userId: 29, serviceRole: "supervisor", active: true }),
    ]));
    expect(mock.events[0].content).toContain("接收并生效");
  });

  it("非指定接收人和其他机构人员不能接收", async () => {
    const wrongUser = acceptDb();
    await expect(acceptHandoff(wrongUser.db, otherTutor, 501)).rejects.toThrow("只能接收分配给自己");
    expect(wrongUser.transaction).not.toHaveBeenCalled();
    const otherOrg = acceptDb(baseHandoff, { ...baseCase, orgId: 8 });
    await expect(acceptHandoff(otherOrg.db, newSupervisor, 501)).rejects.toThrow("交接记录不存在");
    expect(otherOrg.transaction).not.toHaveBeenCalled();
  });

  it("负责人快照变化时拒绝覆盖后来的安排", async () => {
    const mock = acceptDb(baseHandoff, { ...baseCase, coachId: 88 });
    await expect(acceptHandoff(mock.db, newSupervisor, 501)).rejects.toThrow("不能覆盖新安排");
    expect(mock.updates).toHaveLength(0);
  });

  it("普通 H1—H4 接收只确认交接，不改变负责人", async () => {
    const handoff = { ...baseHandoff, type: "H2", toUserId: 29, fromCoachId: null, fromSupervisorId: null, nextCoachId: null, nextSupervisorId: null };
    const mock = acceptDb(handoff);
    await expect(acceptHandoff(mock.db, newSupervisor, 501)).resolves.toEqual({ ok: true, reassigned: false });
    expect(mock.updates).toHaveLength(1);
    expect(mock.updates[0]).toMatchObject({ table: coachingHandoffs, patch: { status: "accepted", appliedAt: null } });
  });

  it("员工不能接收家庭阶段 H5，历史 H5 人员改派仍可接收", async () => {
    const family = { ...baseHandoff, fromCoachId: null, fromSupervisorId: null, nextCoachId: null, nextSupervisorId: null };
    const denied = acceptDb(family);
    await expect(acceptHandoff(denied.db, newSupervisor, 501)).rejects.toThrow("家庭阶段交接须由指定学生或监护人");
    expect(denied.transaction).not.toHaveBeenCalled();
    const historical = acceptDb();
    await expect(acceptHandoff(historical.db, newSupervisor, 501)).resolves.toEqual({ ok: true, reassigned: true });
    expect(historical.updates.find((row) => row.table === coachingCases)).toMatchObject({ table: coachingCases, patch: { coachId: 39, supervisorId: 29 } });
    expect(historical.teamValues).toHaveLength(2);
  });

  it("管理员可取消待接收改派，取消后不能再接收", async () => {
    const mock = cancelDb();
    await expect(cancelReassignment(mock.db, admin, { handoffId: 501, reason: "调整后仍由原团队服务" })).resolves.toEqual({ ok: true });
    expect(mock.updates).toEqual([{ status: "cancelled" }]);
    const cancelled = acceptDb({ ...baseHandoff, status: "cancelled" });
    await expect(acceptHandoff(cancelled.db, newSupervisor, 501)).rejects.toThrow("只能接收分配给自己的待交接事项");
    expect(cancelled.transaction).not.toHaveBeenCalled();
  });

  it("普通伴学师不能取消改派，已接收改派不能重复取消", async () => {
    const denied = cancelDb();
    await expect(cancelReassignment(denied.db, oldTutor, { handoffId: 501, reason: "越权取消" })).rejects.toThrow("仅机构管理员");
    expect(denied.transaction).not.toHaveBeenCalled();
    const accepted = cancelDb({ ...baseHandoff, status: "accepted" });
    await expect(cancelReassignment(accepted.db, admin, { handoffId: 501, reason: "重复取消" })).rejects.toThrow("不能重复操作");
    expect(accepted.updates).toHaveLength(0);
  });

  it("手工交接入口不能绕过管理员直接创建 H5", async () => {
    const db = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => [baseCase] }) }) }),
      insert: vi.fn(),
    } as unknown as Parameters<typeof addHandoff>[0];
    await expect(addHandoff(db, admin, { caseId: 91, type: "H5", toUserId: 29, title: "绕过改派", content: "不应直接生效" })).rejects.toThrow("须由管理员从改派入口发起");
    expect(db.insert).not.toHaveBeenCalled();
  });
});

type ClosureSource = Parameters<typeof buildCoachingClosureReadiness>[0];
function closureSource(): ClosureSource {
  const finalRecord = (recordType: string) => ({ id: 1, recordType, version: 1, status: "completed" });
  return {
    coachingCase: { ...baseCase, goal: "提升数学自主学习", currentSituation: "当前错题复验不足", planSummary: "每周复验并回顾" },
    scenarioHistory: [{ endedAt: new Date() }], plans: [{ status: "confirmed", issuedAt: new Date() }], tasks: [],
    reviews: [{ period: "term", content: "目标已基本达成", nextActions: "寒暑假每周复验" }],
    growProfiles: [{ version: 1, studentGoal: "学生自己的目标", parentExpectation: "家长独立期待", currentSituation: "现状", evidence: "作业与测评事实", followUpActions: "后续行动" }],
    extendedRecords: ["four_line_review", "closure_assessment", "closure_interview", "termination"].map(finalRecord),
    exceptions: [], handoffs: [], supervisions: [], sessions: [], participants: [], deliverables: [],
  } as unknown as ClosureSource;
}

describe("结课完整性检查", () => {
  it("纯督学场景不强制存在行动任务或课堂，可以具备结课条件", () => {
    expect(buildCoachingClosureReadiness(closureSource())).toMatchObject({ ready: true, blockers: [] });
  });

  it.each([
    ["structuredGrow", (source: ClosureSource) => { source.growProfiles = []; }],
    ["plans", (source: ClosureSource) => { source.plans = [{ status: "draft" }] as ClosureSource["plans"]; }],
    ["scenarios", (source: ClosureSource) => { source.scenarioHistory = [{ endedAt: null }] as ClosureSource["scenarioHistory"]; }],
    ["drafts", (source: ClosureSource) => { source.sessions = [{ id: 1, status: "draft" }] as ClosureSource["sessions"]; }],
    ["supervisions", (source: ClosureSource) => { source.supervisions = [{ status: "completed", alignment: "", checks: "已检查", exitCheck: "已验收" }] as ClosureSource["supervisions"]; }],
    ["feedback", (source: ClosureSource) => {
      source.sessions = [{ id: 1, status: "completed" }] as ClosureSource["sessions"];
      source.participants = [{ participant: { id: 11, sessionId: 1, studentUserId: 301, feedbackVersion: 0 } }] as ClosureSource["participants"];
    }],
    ["tasks", (source: ClosureSource) => { source.tasks = [{ status: "pending" }] as ClosureSource["tasks"]; }],
    ["exceptions", (source: ClosureSource) => { source.exceptions = [{ status: "processing" }]; }],
    ["handoffs", (source: ClosureSource) => { source.handoffs = [{ status: "pending" }] as ClosureSource["handoffs"]; }],
    ["termReview", (source: ClosureSource) => { source.reviews = [{ period: "term", content: "已经总结", nextActions: "" }] as ClosureSource["reviews"]; }],
  ])("%s 缺项会明确阻断结课", (code, mutate) => {
    const source = closureSource();
    mutate(source);
    const result = buildCoachingClosureReadiness(source);
    expect(result.ready).toBe(false);
    expect(result.blockers.map((item) => item.code)).toContain(code);
  });

  it("只有本学员的已推送家庭端附件可以替代文字反馈", () => {
    const source = closureSource();
    source.sessions = [{ id: 1, status: "completed" }] as ClosureSource["sessions"];
    source.participants = [{ participant: { id: 11, sessionId: 1, studentUserId: 301, feedbackVersion: 0 } }] as ClosureSource["participants"];
    expect(buildCoachingClosureReadiness(source).blockers.map((item) => item.code)).toContain("feedback");
    source.deliverables = [{ sessionId: 1, participantId: 12, visibility: "family", pushedAt: new Date() }];
    expect(buildCoachingClosureReadiness(source).blockers.map((item) => item.code)).toContain("feedback");
    source.deliverables = [{ sessionId: 1, participantId: null, visibility: "family", pushedAt: new Date() }];
    expect(buildCoachingClosureReadiness(source).blockers.map((item) => item.code)).toContain("feedback");
    source.deliverables = [{ sessionId: 1, participantId: 11, visibility: "family", pushedAt: new Date() }];
    expect(buildCoachingClosureReadiness(source).blockers.map((item) => item.code)).not.toContain("feedback");
  });

  it("已验收状态不能替代实际证据和验收结果", () => {
    const source = closureSource();
    source.tasks = [{ status: "verified", evidence: "", result: "已掌握" }] as ClosureSource["tasks"];
    expect(buildCoachingClosureReadiness(source).blockers.map((item) => item.code)).toContain("tasks");
    source.tasks = [{ status: "verified", evidence: "错题复验照片与讲解记录", result: "同类题已全部答对" }] as ClosureSource["tasks"];
    expect(buildCoachingClosureReadiness(source).ready).toBe(true);
  });

  it("待接收 H5 阻断结课，取消后不再阻断", () => {
    const pending = closureSource();
    pending.handoffs = [{ ...baseHandoff, status: "pending" }];
    expect(buildCoachingClosureReadiness(pending).blockers.map((item) => item.code)).toContain("handoffs");
    const cancelled = closureSource();
    cancelled.handoffs = [{ ...baseHandoff, status: "cancelled" }];
    expect(buildCoachingClosureReadiness(cancelled).ready).toBe(true);
  });

  it("家庭 H5 待本人确认阻断结课，确认后解除且不改变负责人", () => {
    const family = { ...baseHandoff, fromCoachId: null, fromSupervisorId: null, nextCoachId: null, nextSupervisorId: null };
    const pending = closureSource();
    pending.handoffs = [{ ...family, status: "pending" }];
    expect(buildCoachingClosureReadiness(pending).blockers.map((item) => item.code)).toContain("handoffs");
    const accepted = closureSource();
    accepted.handoffs = [{ ...family, status: "accepted", acceptedAt: new Date() }];
    expect(buildCoachingClosureReadiness(accepted).ready).toBe(true);
    expect(accepted.coachingCase.coachId).toBe(19);
    expect(accepted.coachingCase.supervisorId).toBe(19);
  });
});

describe("0051 改派迁移与页面接线", () => {
  it("迁移保存快照、生效时间和接收人索引，并已登记内嵌", () => {
    const migration = readFileSync("db/migrations/0051_coaching_reassignment_handoffs.sql", "utf8");
    for (const column of ["from_coach_id", "from_supervisor_id", "next_coach_id", "next_supervisor_id", "applied_at"]) expect(migration).toContain(column);
    expect(migration).toContain("(`to_user_id`,`status`)");
    const journal = JSON.parse(readFileSync("db/migrations/meta/_journal.json", "utf8")) as { entries: { idx: number; tag: string }[] };
    expect(journal.entries).toContainEqual(expect.objectContaining({ idx: 51, tag: "0051_coaching_reassignment_handoffs" }));
    expect(readFileSync("api/migrationsEmbedded.ts", "utf8")).toContain('"0051_coaching_reassignment_handoffs":');
    const table = getTableConfig(coachingHandoffs);
    expect(table.columns.map((column) => column.name)).toEqual(expect.arrayContaining(["from_coach_id", "next_supervisor_id", "applied_at"]));
    expect(table.indexes.map((index) => index.config.name)).toContain("coaching_handoffs_recipient_status_idx");
    const initDb = readFileSync("api/initDb.ts", "utf8");
    expect(initDb).toContain('"0051": async () =>');
    expect(initDb).toContain('columnExists(db, "coaching_handoffs", "next_supervisor_id")');
    expect(initDb).toContain('columnExists(db, "coaching_handoffs", "applied_at")');
  });

  it("新督学 inbox、管理员取消和结课清单均已接入", () => {
    const workspace = readFileSync("src/components/org/CoachingWorkspace.tsx", "utf8");
    const inbox = readFileSync("src/components/org/CoachingHandoffInbox.tsx", "utf8");
    const router = readFileSync("api/coachingRouter.ts", "utf8");
    const lifecycle = readFileSync("api/coachingLifecycle.ts", "utf8");
    expect(workspace).toContain("<CoachingHandoffInbox />");
    expect(workspace).toContain("data.closureReadiness.checks");
    expect(workspace).toContain("trpc.coaching.cancelReassignment.useMutation");
    expect(inbox).toContain("trpc.coaching.incoming.useQuery");
    expect(inbox).toContain("接收并使改派生效");
    expect(router).toContain("incoming: tutorQuery");
    expect(router).toContain("cancelReassignment: tutorQuery");
    expect(lifecycle).toContain('status: "closed", acceptedAt: null');
    expect(lifecycle).toContain("if (input.status === \"closed\") assertClosureReady(await getCoachingClosureReadiness(tx, me, input.caseId))");
  });
});
