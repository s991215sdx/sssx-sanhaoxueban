import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getTableConfig, MySqlDialect } from "drizzle-orm/mysql-core";
import {
  coachingExceptions, coachingHandoffs, coachingNotifications, coachingNotificationSettings,
  coachingQualityReviews, coachingTasks, courseSessions, studySupervisionRecords,
} from "@db/schema";
import {
  isShanghaiQuietTime, nextShanghaiOpening, shanghaiDate, shiftShanghaiDate,
} from "@contracts/orgService";
import {
  buildCoachingOperations, buildCoachingStaffLoads, remindCoachingOperation,
  type CoachingOperationSource,
} from "./coachingOperations";
import {
  coachingNotificationInbox, markCoachingNotificationRead, queueCoachingNotification,
  retryCoachingNotification, transferCoachingNotificationManual,
} from "./coachingNotifications";
import { listCoachingCases } from "./coachingService";
import type { StaffUser } from "./orgAccess";

vi.mock("./coachingService", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./coachingService")>();
  return { ...actual, listCoachingCases: vi.fn() };
});

const tutor = { id: 19, role: "tutor", orgId: 7 } as StaffUser;
const admin = { id: 9, role: "admin", orgId: 7 } as StaffUser;
const now = new Date("2026-11-08T10:00:00+08:00");
const baseCase = { id: 91, orgId: 7, studentUserId: 301, coachId: 19, supervisorId: 19, status: "active" } as CoachingOperationSource["cases"][number];
Object.assign(baseCase, { studentName: "测试学员" });

function operationSource(): CoachingOperationSource {
  return { cases: [{ ...baseCase }], tasks: [], handoffs: [], quality: [], exceptions: [], sessions: [], supervisions: [] };
}

describe("上海时区、待办边界与改派负荷", () => {
  it("跨午夜静默与次日开启时间不依赖服务器时区", () => {
    const late = new Date("2026-11-08T23:30:00+08:00");
    const afterMidnight = new Date("2026-11-09T00:30:00+08:00");
    const opening = new Date("2026-11-09T07:00:00+08:00");
    expect(isShanghaiQuietTime(late, "22:00", "07:00")).toBe(true);
    expect(isShanghaiQuietTime(afterMidnight, "22:00", "07:00")).toBe(true);
    expect(isShanghaiQuietTime(opening, "22:00", "07:00")).toBe(false);
    expect(nextShanghaiOpening(afterMidnight, "22:00", "07:00").toISOString()).toBe(opening.toISOString());
    expect(isShanghaiQuietTime(late, "22:00", "22:00")).toBe(false);
    expect(shanghaiDate(new Date("2026-11-08T16:00:00.000Z"))).toBe("2026-11-09");
    expect(shiftShanghaiDate("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("只返回本人的今日、逾期与未来待办，暂停和结课不混入分母", () => {
    const source = operationSource();
    source.cases.push(
      { ...baseCase, id: 92, status: "paused" },
      { ...baseCase, id: 93, status: "closed" },
    );
    source.tasks = [
      { id: 1, caseId: 91, title: "昨日行动", verifierId: 19, dueDate: "2026-11-07", status: "pending" },
      { id: 2, caseId: 91, title: "今日行动", verifierId: 19, dueDate: "2026-11-08", status: "submitted" },
      { id: 3, caseId: 91, title: "他人的行动", verifierId: 29, dueDate: "2026-11-08", status: "pending" },
      { id: 4, caseId: 91, title: "已验收行动", verifierId: 19, dueDate: "2026-11-07", status: "verified" },
      { id: 5, caseId: 92, title: "暂停主档行动", verifierId: 19, dueDate: "2026-11-08", status: "pending" },
      { id: 6, caseId: 93, title: "结课主档行动", verifierId: 19, dueDate: "2026-11-08", status: "pending" },
    ] as CoachingOperationSource["tasks"];
    source.sessions = [{ id: 11, caseId: 91, coachId: 19, startAt: new Date("2026-11-15T18:00:00+08:00"), status: "draft", format: "one_to_one" }] as CoachingOperationSource["sessions"];
    const result = buildCoachingOperations(source, 19, now);
    expect(result.items.map((item) => item.key)).toEqual(["task:1", "task:2", "session:11"]);
    expect(result.summary).toMatchObject({ today: 1, overdue: 1, upcoming: 1, risks: 0 });
    expect(buildCoachingOperations(source, 29, now).items.map((item) => item.key)).toEqual(["task:3"]);
  });

  it("异常待办只含通用标题，不泄露原始标题、正文或心理细节", () => {
    const source = operationSource();
    source.exceptions = [{ id: 21, caseId: 91, severity: "S4", category: "wellbeing", sensitive: true,
      status: "open", assigneeId: 19, dueAt: now, createdAt: now,
      title: "不应出现的敏感标题", detail: "不应出现的心理事实" } as unknown as CoachingOperationSource["exceptions"][number]];
    const item = buildCoachingOperations(source, 19, now).items[0];
    expect(item).toMatchObject({ category: "risk", sensitive: true, title: "需要立即处理的服务异常" });
    expect(JSON.stringify(item)).not.toContain("不应出现");
    expect(JSON.stringify(item)).not.toContain("心理事实");
  });

  it("建议负荷和逾期只预警，改派接收后才按新负责人重算", () => {
    const source = operationSource();
    const staff = [{ id: 19, name: "原督学", role: "tutor" }, { id: 29, name: "新督学", role: "tutor" }];
    source.handoffs = [{ id: 31, caseId: 91, type: "H5", toUserId: 29, status: "pending", dueAt: now }] as CoachingOperationSource["handoffs"];
    const before = buildCoachingStaffLoads(source, staff, 1, now);
    expect(before.find((row) => row.userId === 19)).toMatchObject({ activeCases: 1, caseOverload: false });
    expect(before.find((row) => row.userId === 29)).toMatchObject({ activeCases: 0, todayTodos: 1 });
    source.cases[0].coachId = 29;
    source.cases[0].supervisorId = 29;
    source.handoffs[0].status = "accepted";
    const after = buildCoachingStaffLoads(source, staff, 1, now);
    expect(after.find((row) => row.userId === 19)).toMatchObject({ activeCases: 0, todayTodos: 0 });
    expect(after.find((row) => row.userId === 29)).toMatchObject({ activeCases: 1, todayTodos: 0, caseOverload: false });
    expect(buildCoachingStaffLoads(source, staff, 0, now).find((row) => row.userId === 29)?.caseOverload).toBe(true);
    source.tasks = [{ id: 1, caseId: 91, title: "逾期行动", verifierId: 29, dueDate: "2026-11-07", status: "pending" }] as CoachingOperationSource["tasks"];
    expect(buildCoachingStaffLoads(source, staff, 20, now).find((row) => row.userId === 29)).toMatchObject({ overdue: true, overdueTodos: 1 });
  });
});

type Notice = typeof coachingNotifications.$inferSelect;
function notification(patch: Partial<Notice> = {}): Notice {
  return {
    id: 1, orgId: 7, caseId: 91, recipientId: 19, type: "test", channel: "in_app", title: "测试通知", body: "通用提示",
    priority: "normal", status: "pending", notBefore: new Date("2026-11-08T08:00:00+08:00"), sentAt: null,
    deliveredAt: null, readAt: null, failedAt: null, failureReason: "", retryCount: 0, manualReason: "", manualAt: null,
    idempotencyKey: "notice:1", createdBy: 9, createdAt: now, updatedAt: now, ...patch,
  };
}

/** 仅模拟 Drizzle 的查询接口；权限判断、状态迁移与幂等仍执行真实业务函数。 */
function notificationDb(initial: Notice[] = [], extraRows = new Map<unknown, unknown[]>()) {
  const rows = initial.map((row) => ({ ...row }));
  const settings = { id: 1, orgId: 7, quietStart: "22:00", quietEnd: "07:00", suggestedCaseLoad: 20,
    updatedBy: null, createdAt: now, updatedAt: now };
  const dialect = new MySqlDialect();
  const patches: Record<string, unknown>[] = [];
  function matches(row: Record<string, unknown>, condition: unknown): boolean {
    if (!condition) return true;
    const parsed = dialect.sqlToQuery(condition as never);
    const statement = parsed.sql.startsWith("(") && parsed.sql.endsWith(")") ? parsed.sql.slice(1, -1) : parsed.sql;
    const expressions = statement.split(" and ");
    let parameterIndex = 0;
    return expressions.every((expression) => {
      const equal = /([a-z_]+)`?\s*=\s*\?/i.exec(expression);
      const lessOrEqual = /([a-z_]+)`?\s*<=\s*\?/i.exec(expression);
      const included = /([a-z_]+)`?\s+in\s+\(([^)]+)\)/i.exec(expression);
      const column = (equal ?? lessOrEqual ?? included)?.[1];
      if (!column) throw new Error(`测试数据库暂不支持条件：${parsed.sql}；参数：${JSON.stringify(parsed.params)}`);
      const key = column.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
      const actual = row[key];
      if (included) {
        const count = (included[2].match(/\?/g) ?? []).length;
        const values = parsed.params.slice(parameterIndex, parameterIndex + count);
        parameterIndex += count;
        return values.includes(actual);
      }
      const expected = parsed.params[parameterIndex++];
      if (lessOrEqual) return new Date(actual as string | Date).getTime() <= new Date(expected as string | Date).getTime();
      return actual === expected;
    });
  }
  function sourceFor(table: unknown): Record<string, unknown>[] {
    if (table === coachingNotifications) return rows as unknown as Record<string, unknown>[];
    if (table === coachingNotificationSettings) return [settings as unknown as Record<string, unknown>];
    return (extraRows.get(table) ?? []) as Record<string, unknown>[];
  }
  const db = {
    select: vi.fn(() => ({ from: (table: unknown) => {
      let selected = sourceFor(table);
      const query = {
        where(condition: unknown) { selected = sourceFor(table).filter((row) => matches(row, condition)); return query; },
        orderBy() { return query; },
        leftJoin() { return query; },
        innerJoin() { return query; },
        limit(count: number) { return Promise.resolve(selected.slice(0, count)); },
        then(resolve: (value: unknown[]) => unknown, reject?: (reason: unknown) => unknown) {
          return Promise.resolve(selected).then(resolve, reject);
        },
      };
      return query;
    } })),
    insert: vi.fn((table: unknown) => {
      expect(table).toBe(coachingNotifications);
      return { values: (values: Record<string, unknown>) => {
        const row = notification({ ...values, id: Math.max(0, ...rows.map((item) => item.id)) + 1 } as Partial<Notice>);
        rows.push(row);
        return Object.assign(Promise.resolve(), { $returningId: async () => [{ id: row.id }] });
      } };
    }),
    update: vi.fn((table: unknown) => {
      expect(table).toBe(coachingNotifications);
      return { set: (patch: Record<string, unknown>) => ({ where: async (condition: unknown) => {
        patches.push(patch);
        const targets = rows.filter((row) => matches(row as unknown as Record<string, unknown>, condition));
        for (const target of targets) Object.assign(target, patch);
        return { affectedRows: targets.length };
      } }) };
    }),
  };
  return { db: db as unknown as Parameters<typeof queueCoachingNotification>[0], rows, patches };
}

describe("站内通知幂等、权限与状态记录", () => {
  it("普通通知跨午夜等待，紧急通知立即发送；重复键不重复创建", async () => {
    const mock = notificationDb();
    const late = new Date("2026-11-09T00:30:00+08:00");
    const input = { orgId: 7, caseId: 91, recipientId: 19, type: "handoff", title: "常规交接", body: "请进入工作台处理",
      idempotencyKey: "handoff:1", now: late };
    const queued = await queueCoachingNotification(mock.db, input);
    expect(queued).toMatchObject({ status: "pending", duplicate: false });
    expect(mock.rows[0].notBefore.toISOString()).toBe(new Date("2026-11-09T07:00:00+08:00").toISOString());
    expect(mock.rows[0].sentAt).toBeNull();
    await expect(queueCoachingNotification(mock.db, input)).resolves.toMatchObject({ duplicate: true });
    expect(mock.rows).toHaveLength(1);
    await queueCoachingNotification(mock.db, { ...input, idempotencyKey: "exception:urgent", priority: "urgent", title: "需要立即处理的服务异常" });
    expect(mock.rows[1]).toMatchObject({ status: "sent", priority: "urgent" });
    expect(mock.rows[1].sentAt?.toISOString()).toBe(late.toISOString());
  });

  it("发送、送达、已读分别留痕；他人通知不可读", async () => {
    const mock = notificationDb([
      notification({ id: 1, status: "pending", notBefore: new Date("2026-11-08T08:00:00+08:00") }),
      notification({ id: 2, status: "sent", sentAt: new Date("2026-11-08T08:30:00+08:00"), idempotencyKey: "notice:2" }),
      notification({ id: 3, status: "pending", notBefore: new Date("2026-11-09T08:00:00+08:00"), idempotencyKey: "notice:3" }),
    ]);
    const inbox = await coachingNotificationInbox(mock.db as Parameters<typeof coachingNotificationInbox>[0], tutor);
    expect(inbox.items.filter((item) => item.status === "delivered")).toHaveLength(2);
    expect(mock.rows.find((row) => row.id === 1)).toMatchObject({ status: "delivered" });
    expect(mock.rows.find((row) => row.id === 1)?.sentAt).not.toBeNull();
    expect(mock.rows.find((row) => row.id === 1)?.deliveredAt).not.toBeNull();
    expect(mock.rows.find((row) => row.id === 2)?.sentAt?.toISOString()).toBe(new Date("2026-11-08T08:30:00+08:00").toISOString());
    expect(mock.rows.find((row) => row.id === 3)?.status).toBe("pending");
    expect(inbox.unread).toBe(2);
    expect(inbox.channelNote).toContain("不代表已发送微信或短信");
    await markCoachingNotificationRead(mock.db as Parameters<typeof markCoachingNotificationRead>[0], tutor, 1);
    expect(mock.rows.find((row) => row.id === 1)?.readAt).toBeInstanceOf(Date);
    await expect(markCoachingNotificationRead(mock.db as Parameters<typeof markCoachingNotificationRead>[0], { id: 29, role: "tutor", orgId: 7 }, 1)).rejects.toThrow("通知不存在");
    await expect(markCoachingNotificationRead(mock.db as Parameters<typeof markCoachingNotificationRead>[0], tutor, 3)).rejects.toThrow("尚未送达");
  });

  it("失败通知可重试或转人工，正常通知不能伪造失败处置", async () => {
    const failed = notification({ id: 4, status: "failed", failureReason: "站内投递异常", failedAt: now, retryCount: 2, idempotencyKey: "notice:4" });
    const mock = notificationDb([failed]);
    await expect(retryCoachingNotification(mock.db as Parameters<typeof retryCoachingNotification>[0], tutor, 1)).rejects.toThrow("通知不存在");
    const manual = await transferCoachingNotificationManual(mock.db as Parameters<typeof transferCoachingNotificationManual>[0], admin, { notificationId: 4, reason: "改由督学电话提醒" });
    expect(manual.ok).toBe(true);
    expect(mock.rows[0]).toMatchObject({ status: "manual", manualReason: "改由督学电话提醒" });
    await expect(retryCoachingNotification(mock.db as Parameters<typeof retryCoachingNotification>[0], tutor, 4)).rejects.toThrow("只有发送失败");

    const retryMock = notificationDb([notification({ id: 5, status: "failed", failureReason: "真实投递失败", idempotencyKey: "notice:5" })]);
    expect(retryMock.rows[0].retryCount).toBe(0);
    const result = await retryCoachingNotification(retryMock.db as Parameters<typeof retryCoachingNotification>[0], admin, 5);
    expect(result).toMatchObject({ ok: true, retryCount: 1 });
    expect(retryMock.rows[0]).toMatchObject({ retryCount: 1, deliveredAt: null, readAt: null, failedAt: null, failureReason: "" });
    expect(["sent", "pending"]).toContain(retryMock.rows[0].status);
  });

  it("本人重复提醒只创建一条；不能替他人的待办提醒", async () => {
    const source = operationSource();
    source.tasks = [{ id: 41, caseId: 91, title: "今日错题复验", verifierId: 19, dueDate: "2026-11-08", status: "pending" }] as CoachingOperationSource["tasks"];
    vi.mocked(listCoachingCases).mockResolvedValue([{ coachingCase: source.cases[0], studentName: "测试学员", grade: null, serviceScenarios: ["A"] }]);
    const extraRows = new Map<unknown, unknown[]>([
      [coachingTasks, source.tasks], [coachingHandoffs, []], [coachingQualityReviews, []],
      [coachingExceptions, []], [courseSessions, []], [studySupervisionRecords, []],
    ]);
    const mock = notificationDb([], extraRows);
    const first = await remindCoachingOperation(mock.db as Parameters<typeof remindCoachingOperation>[0], tutor, "task:41");
    const second = await remindCoachingOperation(mock.db as Parameters<typeof remindCoachingOperation>[0], tutor, "task:41");
    expect(first.duplicate).toBe(false);
    expect(second.duplicate).toBe(true);
    expect(mock.rows).toHaveLength(1);
    await expect(remindCoachingOperation(mock.db as Parameters<typeof remindCoachingOperation>[0], { ...tutor, id: 29 }, "task:41")).rejects.toThrow("不属于当前账号");
    expect(mock.rows).toHaveLength(1);
  });
});

describe("0053 迁移与页面接线", () => {
  it("通知表、机构设置、索引和 CURRENT_TIMESTAMP 均已登记内嵌", () => {
    const migration = readFileSync("db/migrations/0053_coaching_operations.sql", "utf8");
    expect(migration.match(/DEFAULT CURRENT_TIMESTAMP/g)).toHaveLength(4);
    expect(migration).toContain("(`recipient_id`,`status`,`not_before`)");
    expect(migration).toContain("(`idempotency_key`)");
    const journal = JSON.parse(readFileSync("db/migrations/meta/_journal.json", "utf8")) as { entries: { idx: number; tag: string }[] };
    expect(journal.entries.at(-1)).toMatchObject({ idx: 53, tag: "0053_coaching_operations" });
    expect(readFileSync("api/migrationsEmbedded.ts", "utf8")).toContain('"0053_coaching_operations":');
    expect(readFileSync("api/initDb.ts", "utf8")).toContain('"0053": async () =>');
    expect(getTableConfig(coachingNotifications).indexes.map((index) => index.config.name)).toContain("coaching_notifications_recipient_status_idx");
    expect(getTableConfig(coachingNotificationSettings).indexes.map((index) => index.config.name)).toContain("coaching_notification_settings_org_unique");
    const handoffInbox = readFileSync("src/components/org/CoachingHandoffInbox.tsx", "utf8");
    expect(handoffInbox).toContain("utils.coaching.operations.invalidate()");
    expect(handoffInbox).toContain("utils.coaching.staffWorkloads.invalidate()");
  });
});
