import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getTableConfig } from "drizzle-orm/mysql-core";
import { coachingCases, coachingEvents, coachingExceptionActions, coachingExceptions, coachingPlans, users } from "@db/schema";
import { coachingExceptionSensitive, defaultCoachingExceptionDueAt } from "@contracts/orgService";
import { addCoachingTask, familyCoachingFeedback, saveCoachingPlan } from "./coachingService";
import { createCoachingException, projectCoachingException, recordCoachingException, revealCoachingException } from "./coachingExceptions";
import type { StaffUser } from "./orgAccess";

const admin = { id: 9, role: "admin", orgId: 7 } as StaffUser;
const tutor = { id: 19, role: "tutor", orgId: 7 } as StaffUser;
const coachingCase = { id: 91, orgId: 7, studentUserId: 301, coachId: 19, supervisorId: 19 } as typeof coachingCases.$inferSelect;
const dueAt = new Date("2026-11-08T12:00:00+08:00");
const baseInput = { caseId: 91, title: "周复盘延迟", detail: "周总结超过约定节点，需要当日补交", assigneeId: 9, dueAt };
type Db = Parameters<typeof createCoachingException>[0];
type ExceptionRow = typeof coachingExceptions.$inferSelect;

function exceptionRow(patch: Partial<ExceptionRow> = {}): ExceptionRow {
  return { id: 501, orgId: 7, caseId: 91, severity: "S2", category: "service", title: "周复盘延迟",
    detail: "周总结超过约定节点", sensitive: false, status: "open", assigneeId: 9, dueAt,
    createdBy: 19, createdAt: new Date("2026-11-07T10:00:00+08:00"), updatedAt: new Date("2026-11-07T10:00:00+08:00"),
    closedBy: null, closedAt: null, closeEvidence: null, ...patch };
}

function createDb(caseRow = coachingCase, receiver: { id: number; role: string } | null = { id: 9, role: "admin" }) {
  const inserted: { table: unknown; values: Record<string, unknown> }[] = [];
  const tx = { insert: vi.fn((table: unknown) => ({ values: (values: Record<string, unknown>) => {
    inserted.push({ table, values });
    if (table === coachingExceptions) return { $returningId: async () => [{ id: 501 }] };
    return Promise.resolve();
  } })) };
  const db = {
    select: vi.fn(() => ({ from: (table: unknown) => ({ where: () => ({ limit: async () => table === coachingCases ? [caseRow] : table === users ? (receiver ? [receiver] : []) : [] }) }) })),
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(tx)),
  };
  return { db: db as unknown as Db, transaction: db.transaction, inserted };
}

describe("S1—S4 异常登记与敏感规则", () => {
  it.each(["S1", "S2", "S3", "S4"] as const)("%s 均创建接收人、期限、初始处理记录和非敏感事件", async (severity) => {
    const mock = createDb();
    const result = await createCoachingException(mock.db, tutor, { ...baseInput, severity, category: "service" });
    expect(result).toEqual({ id: 501, sensitive: severity === "S4", status: "open" });
    const main = mock.inserted.find((entry) => entry.table === coachingExceptions)!;
    const action = mock.inserted.find((entry) => entry.table === coachingExceptionActions)!;
    const event = mock.inserted.find((entry) => entry.table === coachingEvents)!;
    expect(main.values).toMatchObject({ orgId: 7, caseId: 91, severity, assigneeId: 9, dueAt, status: "open" });
    expect(action.values).toMatchObject({ exceptionId: 501, caseId: 91, action: "created" });
    expect(event.values.content).not.toContain(baseInput.title);
    expect(event.values.content).not.toContain(baseInput.detail);
    if (severity === "S4") expect(event.values.content).toContain("立即升级");
  });

  it("S4、心理、安全和主动标记不能取消敏感保护，期限只是可调整默认值", () => {
    expect(coachingExceptionSensitive("S4", "service")).toBe(true);
    expect(coachingExceptionSensitive("S1", "wellbeing")).toBe(true);
    expect(coachingExceptionSensitive("S1", "safety")).toBe(true);
    expect(coachingExceptionSensitive("S1", "service", true)).toBe(true);
    expect(coachingExceptionSensitive("S1", "service")).toBe(false);
    const now = new Date("2026-11-07T10:00:00+08:00");
    expect(defaultCoachingExceptionDueAt("S2", now).getTime() - now.getTime()).toBe(2 * 60 * 60 * 1000);
    expect(defaultCoachingExceptionDueAt("S3", now).getTime() - now.getTime()).toBe(24 * 60 * 60 * 1000);
    expect(defaultCoachingExceptionDueAt("S4", now).getTime()).toBe(now.getTime());
  });

  it("敏感异常不能指派给普通伴学师，非法或跨机构接收人被拒绝", async () => {
    const tutorReceiver = createDb(coachingCase, { id: 19, role: "tutor" });
    await expect(createCoachingException(tutorReceiver.db, tutor, { ...baseInput, severity: "S1", category: "wellbeing", assigneeId: 19 })).rejects.toThrow("管理员接收");
    expect(tutorReceiver.transaction).not.toHaveBeenCalled();
    const unknownReceiver = createDb(coachingCase, null);
    await expect(createCoachingException(unknownReceiver.db, admin, { ...baseInput, severity: "S1", category: "service", assigneeId: 888 })).rejects.toThrow("本机构");
    expect(unknownReceiver.transaction).not.toHaveBeenCalled();
  });

  it("其他机构主档在任何异常写入前被拒绝", async () => {
    const mock = createDb({ ...coachingCase, orgId: 8 });
    await expect(createCoachingException(mock.db, admin, { ...baseInput, severity: "S1", category: "service" })).rejects.toThrow("主档不存在");
    expect(mock.transaction).not.toHaveBeenCalled();
    expect(mock.inserted).toHaveLength(0);
  });
});

describe("异常处理、关闭与敏感授权", () => {
  function recordDb(row = exceptionRow()) {
    const actions: Record<string, unknown>[] = [];
    const events: Record<string, unknown>[] = [];
    const patches: Record<string, unknown>[] = [];
    const tx = {
      select: () => ({ from: (table: unknown) => {
        expect(table).toBe(coachingExceptions);
        return { where: () => ({ limit: () => ({ for: async () => [row] }) }) };
      } }),
      insert: vi.fn((table: unknown) => ({ values: async (values: Record<string, unknown>) => {
        if (table === coachingExceptionActions) actions.push(values);
        else if (table === coachingEvents) events.push(values);
        else throw new Error("unexpected insert");
      } })),
      update: vi.fn((table: unknown) => {
        expect(table).toBe(coachingExceptions);
        return { set: (patch: Record<string, unknown>) => ({ where: async () => { patches.push(patch); return { affectedRows: 1 }; } }) };
      }),
    };
    let reads = 0;
    const db = {
      select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => [reads++ === 0 ? row : coachingCase] }) }) })),
      transaction: async (callback: (tx: unknown) => unknown) => callback(tx),
    };
    return { db: db as unknown as Db, actions, events, patches };
  }

  it("先追加处理进展，再追加关闭记录与证据，不覆盖历史", async () => {
    const progress = recordDb();
    await expect(recordCoachingException(progress.db, tutor, { exceptionId: 501, action: "progress", note: "已补交周复盘并核对内容" })).resolves.toMatchObject({ status: "processing" });
    expect(progress.actions[0]).toMatchObject({ action: "progress", note: "已补交周复盘并核对内容", actorUserId: 19 });
    expect(progress.patches[0]).toMatchObject({ status: "processing", closeEvidence: null });

    const closing = recordDb(exceptionRow({ status: "processing" }));
    await expect(recordCoachingException(closing.db, admin, { exceptionId: 501, action: "closed", note: "补交内容已复核", evidence: "复盘 V2 与主管抽查记录 #81" })).resolves.toMatchObject({ status: "closed" });
    expect(closing.actions[0]).toMatchObject({ action: "closed", note: "补交内容已复核", evidence: "复盘 V2 与主管抽查记录 #81" });
    expect(closing.patches[0]).toMatchObject({ status: "closed", closedBy: 9, closeEvidence: "复盘 V2 与主管抽查记录 #81" });
    expect(closing.events[0].content).not.toContain("复盘 V2 与主管抽查记录");
  });

  it("关闭缺少证据、重复关闭均被拒绝", async () => {
    const missing = recordDb();
    await expect(recordCoachingException(missing.db, tutor, { exceptionId: 501, action: "closed", note: "已处理", evidence: " " })).rejects.toThrow("关闭证据");
    expect(missing.actions).toHaveLength(0);
    const closed = recordDb(exceptionRow({ status: "closed" }));
    await expect(recordCoachingException(closed.db, tutor, { exceptionId: 501, action: "closed", note: "重复关闭", evidence: "另一份证据" })).rejects.toThrow("已关闭");
    expect(closed.actions).toHaveLength(0);
    expect(closed.patches).toHaveLength(0);
  });

  it("普通详情对管理员和非管理员都不携带敏感正文，授权投影才包含处理历史", () => {
    const secret = "仅用于测试的敏感事实，不得进入普通响应";
    const row = exceptionRow({ severity: "S4", category: "safety", sensitive: true, title: "敏感标题", detail: secret, closeEvidence: "敏感关闭证据" });
    const action = { id: 1, exceptionId: 501, caseId: 91, action: "progress", note: "敏感处理正文", evidence: "敏感过程证据", actorUserId: 9, createdAt: new Date() };
    const joined = { exception: row, assigneeName: "机构管理员" };
    const actions = [{ action, actorName: "机构管理员" }];
    const masked = projectCoachingException(joined, actions);
    expect(masked).toMatchObject({ restricted: true, category: "restricted", title: "敏感异常 · 需管理员授权查看", detail: "", closeEvidence: "" });
    expect(JSON.stringify(masked)).not.toContain(secret);
    expect(JSON.stringify(masked)).not.toContain("敏感处理正文");
    expect(JSON.stringify(masked)).not.toContain("敏感关闭证据");
    expect(projectCoachingException(joined, actions, true)).toMatchObject({ restricted: false, detail: secret, closeEvidence: "敏感关闭证据" });
  });

  function revealDb() {
    const row = exceptionRow({ sensitive: true, category: "wellbeing", title: "敏感标题", detail: "敏感事实" });
    const events: Record<string, unknown>[] = [];
    let plainCaseRead = false;
    const db = {
      select: vi.fn((fields?: unknown) => ({ from: (table: unknown) => {
        if (table === coachingExceptions && !fields) return { where: () => ({ limit: async () => [row] }) };
        if (table === coachingCases) { plainCaseRead = true; return { where: () => ({ limit: async () => [coachingCase] }) }; }
        if (table === coachingExceptions) return { leftJoin: () => ({ where: () => ({ limit: async () => [{ exception: row, assigneeName: "机构管理员" }] }) }) };
        if (table === coachingExceptionActions) return { leftJoin: () => ({ where: () => ({ orderBy: async () => [{ action: { id: 1, exceptionId: 501, caseId: 91, action: "created", note: "敏感登记说明", evidence: "", actorUserId: 9, createdAt: new Date() }, actorName: "机构管理员" }] }) }) };
        throw new Error("unexpected table");
      } })),
      insert: vi.fn((table: unknown) => {
        expect(table).toBe(coachingEvents);
        return { values: async (values: Record<string, unknown>) => { events.push(values); } };
      }),
    };
    return { db: db as unknown as Db, events, row, wasCaseChecked: () => plainCaseRead };
  }

  it("普通伴学师越权查看敏感详情被拒绝且不写审计", async () => {
    const mock = revealDb();
    await expect(revealCoachingException(mock.db, tutor, 501)).rejects.toThrow("仅本机构管理员");
    expect(mock.events).toHaveLength(0);
    expect(mock.wasCaseChecked()).toBe(true);
  });

  it("机构管理员授权查看才返回正文，并记录不含正文的审计事件", async () => {
    const mock = revealDb();
    const result = await revealCoachingException(mock.db, admin, 501);
    expect(result).toMatchObject({ id: 501, detail: "敏感事实", restricted: false });
    expect(mock.events).toHaveLength(1);
    expect(mock.events[0]).toMatchObject({ caseId: 91, actorUserId: 9, type: "sensitive_exception_revealed", visibility: "internal" });
    expect(mock.events[0].content).not.toContain("敏感事实");
  });
});

describe("跨主档关联与家庭端隔离", () => {
  function crossPlanDb() {
    const db = {
      select: vi.fn(() => ({ from: (table: unknown) => ({ where: () => ({ limit: async () => table === coachingCases ? [coachingCase] : [{ id: 88, caseId: 92 }] }) }) })),
      transaction: vi.fn(), insert: vi.fn(),
    };
    return db as unknown as Db;
  }

  it("父级计划属于另一主档时，拒绝生成计划版本", async () => {
    const db = crossPlanDb();
    await expect(saveCoachingPlan(db, admin, { caseId: 91, parentId: 88, level: "week", title: "错误关联周计划", content: "不应写入其他学员计划", startDate: "2026-11-07", endDate: "2026-11-14", confirmed: true })).rejects.toThrow("主档不匹配");
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("任务引用另一主档计划时，拒绝写入任务", async () => {
    const db = crossPlanDb();
    await expect(addCoachingTask(db, admin, { caseId: 91, planId: 88, title: "错误关联任务", dueDate: "2026-11-08" })).rejects.toThrow("主档不匹配");
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("家庭反馈响应不含异常对象或敏感处理数据", async () => {
    const db = {
      select: vi.fn((fields?: unknown) => ({ from: (table: unknown) => {
        if (table === coachingCases) return { innerJoin: () => ({ where: () => ({ limit: async () => [{ coachingCase }] }) }) };
        if (table === coachingPlans) return { where: () => ({ orderBy: async () => [] }) };
        return { where: async () => [], innerJoin: () => ({ where: async () => [] }) };
      } })),
    } as unknown as Parameters<typeof familyCoachingFeedback>[0];
    const result = await familyCoachingFeedback(db, { id: 301, role: "user" }, 91);
    expect(Object.keys(result)).toEqual(["coachingCase", "plans", "tasks", "sessions", "attachments"]);
    expect(JSON.stringify(result)).not.toContain("exceptions");
    expect(JSON.stringify(result)).not.toContain("敏感");
  });
});

describe("0050 异常迁移与页面接线", () => {
  it("两张表均有 CURRENT_TIMESTAMP、必要索引，且已登记和内嵌部署", () => {
    const migration = readFileSync("db/migrations/0050_coaching_service_exceptions.sql", "utf8");
    expect(migration.match(/DEFAULT CURRENT_TIMESTAMP/g)).toHaveLength(3);
    expect(migration).toContain("(`org_id`,`status`)");
    expect(migration).toContain("(`case_id`,`status`)");
    expect(migration).toContain("(`assignee_id`,`due_at`)");
    expect(migration).not.toMatch(/UPDATE\s+`coaching_exception_actions`/i);
    const journal = JSON.parse(readFileSync("db/migrations/meta/_journal.json", "utf8")) as { entries: { idx: number; tag: string }[] };
    expect(journal.entries.find((entry) => entry.idx === 50)).toMatchObject({ idx: 50, tag: "0050_coaching_service_exceptions" });
    expect(readFileSync("api/migrationsEmbedded.ts", "utf8")).toContain('"0050_coaching_service_exceptions":');
    expect(getTableConfig(coachingExceptions).indexes.map((item) => item.config.name)).toHaveLength(3);
    expect(getTableConfig(coachingExceptionActions).indexes.map((item) => item.config.name)).toHaveLength(2);
  });

  it("复盘页接入异常闭环，服务端提供登记、处理、关闭和授权接口", () => {
    expect(readFileSync("src/components/org/CoachingWorkspace.tsx", "utf8")).toContain("<CoachingExceptions data={data} />");
    const component = readFileSync("src/components/org/CoachingExceptions.tsx", "utf8");
    expect(component).toContain("trpc.coaching.createException.useMutation");
    expect(component).toContain("trpc.coaching.recordException.useMutation");
    expect(component).toContain("trpc.coaching.revealException.useMutation");
    const router = readFileSync("api/coachingRouter.ts", "utf8");
    expect(router).toContain("createException: tutorQuery");
    expect(router).toContain("recordException: tutorQuery");
    expect(router).toContain("revealException: tutorQuery");
  });
});
