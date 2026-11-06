import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { getTableConfig } from "drizzle-orm/mysql-core";
import { assessmentActivities, orgPointAccounts, orgPointLedger } from "@db/schema";
import { ASSESSMENT_PACKAGES, COMPREHENSIVE_KINDS, assessmentCredits, fullCoverageCredits, phaseForVisit, recommendedOrgPoints, selectionFor, validateSessionPhase } from "@contracts/orgService";
import { createAssessmentActivity } from "./assessmentActivities";
import { initializeOrgPoints, ledgerDelta, refundOriginalDebitTx, writeLedger, type PointTx } from "./orgPoints";
import { saveCourseSession } from "./coachingService";
import { clearAssessmentAssignment, prepareAssessmentSubmission, rememberAssessmentAssignment } from "../src/lib/assessmentSubmission";

function storageMock() {
  const values = new Map<string, string>();
  return { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); }, removeItem: (key: string) => { values.delete(key); }, clear: () => values.clear() };
}

describe("新表时间一致性", () => {
  it("保留 CURRENT_TIMESTAMP 默认值，同时由应用显式写入创建与更新时间", () => {
    const migration = readFileSync("db/migrations/0046_org_service_p1.sql", "utf8");
    expect(migration).toContain("`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP");
    const createdColumn = getTableConfig(assessmentActivities).columns.find((column) => column.name === "created_at");
    const createdAt = createdColumn?.defaultFn?.() as Date;
    expect(Math.abs(createdAt.getTime() - Date.now())).toBeLessThan(2000);
    const db = drizzle.mock();
    const activity = db.insert(assessmentActivities).values({ orgId: 7, createdBy: 9, requestKey: "time-consistency-test", title: "时间验证" }).toSQL();
    expect(activity.sql).toContain("`created_at`");
    const account = db.insert(orgPointAccounts).values({ orgId: 7, ownerUserId: 0, balance: 0 }).toSQL();
    expect(account.sql).toContain("`created_at`");
    expect(account.sql).toContain("`updated_at`");
  });
});

describe("机构测评计价与课程节奏", () => {
  it("完整理论覆盖每人 299，200 人 59,800，默认取整 60,000", () => {
    expect(fullCoverageCredits()).toBe(299);
    expect(fullCoverageCredits() * 200).toBe(59_800);
    expect(recommendedOrgPoints(200)).toBe(60_000);
  });

  it("MBTI、DISC、家长 DISC 免费，选科组合免费，综合包 199", () => {
    expect(assessmentCredits("mbti")).toBe(0);
    expect(assessmentCredits("disc")).toBe(0);
    expect(assessmentCredits("discparent")).toBe(0);
    expect(assessmentCredits("e3")).toBe(10);
    expect(selectionFor("xuanke_free")?.price).toBe(0);
    const comprehensive = ASSESSMENT_PACKAGES.find((item) => item.key === "learning_comprehensive");
    expect(comprehensive?.price).toBe(199);
    expect(new Set(comprehensive?.kinds).size).toBe(COMPREHENSIVE_KINDS.length);
  });

  it("前三个月只能一对一＋督学；后期小组须填写原因并确认", () => {
    expect(validateSessionPhase({ phase: "early", hasCoachUnit: true, hasSupervision: true, format: "one_to_one" })).toBeNull();
    expect(validateSessionPhase({ phase: "early", hasCoachUnit: false, hasSupervision: true, format: "supervision" })).toContain("前三个月");
    expect(validateSessionPhase({ phase: "early", hasCoachUnit: true, hasSupervision: true, format: "salon" })).toContain("前三个月");
    expect(validateSessionPhase({ phase: "late", hasCoachUnit: true, hasSupervision: true, format: "workshop" })).toContain("变更原因");
    expect(validateSessionPhase({ phase: "late", hasCoachUnit: true, hasSupervision: true, format: "workshop", lateChangeReason: "阶段评估通过", lateChangeConfirmedBy: 8 })).toBeNull();
    expect(validateSessionPhase({ phase: "late", hasCoachUnit: false, hasSupervision: true, format: "supervision" })).toBeNull();
    expect(phaseForVisit("2026-08-01", new Date("2026-10-31T12:00:00+08:00"))).toBe("early");
    expect(phaseForVisit("2026-08-01", new Date("2026-11-01T00:00:00+08:00"))).toBe("late");
  });

  it("综合包与单项重复时，在访问数据库前拒绝发起", async () => {
    const input = { requestKey: "request-key-123456", studentIds: [101], selections: ["learning_comprehensive", "e3"], title: "重复测试" };
    await expect(createAssessmentActivity({} as never, { id: 9, orgId: 7, role: "admin" } as never, input)).rejects.toThrow("重复测评");
  });

  it("唯一键竞争下，同一发起标识返回原活动且不重复建单", async () => {
    const old = { id: 88, orgId: 7, createdBy: 9, requestKey: "request-key-123456" };
    const reads = [[], [{ id: 101, orgId: 7, role: "user", deletedAt: null }], [old]];
    const db = {
      select: () => ({ from: () => ({ where: () => ({ limit: async () => reads.shift() ?? [] }) }) }),
      transaction: vi.fn().mockRejectedValue(Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY" })),
    };
    const result = await createAssessmentActivity(db as never, { id: 9, orgId: 7, role: "admin" } as never,
      { requestKey: "request-key-123456", studentIds: [101], selections: ["e3"], title: "重试测试" });
    expect(result).toEqual({ activityId: 88, duplicate: true });
    expect(db.transaction).toHaveBeenCalledOnce();
  });

  it("跨机构旧分配关系不能绕过机构边界", async () => {
    const { assertStudentAccess } = await import("./orgAccess");
    const db = { select: vi.fn(() => ({ from: () => ({ where: () => ({ limit: async () => [{ id: 101, orgId: 8, role: "user", deletedAt: null }] }) }) })) };
    await expect(assertStudentAccess(db as never, { id: 9, orgId: 7, role: "tutor" }, 101)).rejects.toThrow("其他机构");
    expect(db.select).toHaveBeenCalledOnce();
  });

  it("完成课堂时，出席学员没有独立行动会被服务端拒绝", async () => {
    const coachingCase = { id: 1, orgId: 7, studentUserId: 101, coachId: 9, supervisorId: 9, serviceStart: "2026-01-01" };
    const db = { select: () => ({ from: () => ({ where: () => ({ limit: async () => [coachingCase] }) }) }) };
    const input = {
      caseId: 1, startAt: new Date("2026-11-05T10:00:00+08:00"), format: "one_to_one" as const, status: "completed" as const,
      sharedSummary: "已完成心智成长练习与督学验收",
      supervision: { selfStudyMinutes: 60, alignment: "任务对齐", checks: "过程检查", exitCheck: "离店验收", followUp: "明日复习" },
      units: [{ courseKey: "mindset", title: "心法课·心智成长", learningPoints: "能表达情绪与需要", practiceEvidence: "完成情境练习" }],
      participants: [{ studentUserId: 101, attendance: "present" }],
    };
    await expect(saveCourseSession(db as never, { id: 9, orgId: 7, role: "admin" } as never, input)).rejects.toThrow("独立的可验证行动");
  });
});

function pointsTx(initialBalance = 100) {
  const account = { id: 1, orgId: 7, ownerUserId: 9, balance: initialBalance, initialized: true, createdAt: new Date(), updatedAt: new Date() };
  const ledger: Record<string, unknown>[] = [];
  const ledgerReads: Record<string, unknown>[][] = [];
  const tx = {
    select: () => ({
      from: (table: unknown) => {
        if (table === orgPointLedger) return { where: () => ({ limit: async () => ledgerReads.shift() ?? [] }) };
        if (table === orgPointAccounts) return { where: () => ({ orderBy: () => ({ for: async () => [account] }) }) };
        throw new Error("unexpected select table");
      },
    }),
    update: (table: unknown) => ({
      set: (patch: Record<string, unknown>) => ({
        where: async () => {
          if (table !== orgPointAccounts) throw new Error("unexpected update table");
          Object.assign(account, patch);
          return { affectedRows: 1 };
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        $returningId: async () => {
          if (table !== orgPointLedger) throw new Error("unexpected insert table");
          const row = { ...values, id: ledger.length + 1, createdAt: new Date() };
          ledger.push(row);
          return [{ id: row.id }];
        },
        onDuplicateKeyUpdate: async () => {},
      }),
    }),
  };
  return { tx: tx as unknown as PointTx, raw: tx, account, ledger, ledgerReads };
}

describe("积分账务幂等（模拟事务，不冒充真实数据库并发验证）", () => {
  it("余额不能为负，零变动不入流水", () => {
    expect(ledgerDelta({ balance: 100 }, -40)).toBe(60);
    expect(() => ledgerDelta({ balance: 0 }, -1)).toThrow("积分不足");
    expect(() => ledgerDelta({ balance: 0 }, 0)).toThrow("非零整数");
  });

  it("同一扣费事件重试不重复扣款", async () => {
    const mock = pointsTx(100);
    const meta = { actorUserId: 8, type: "assessment_debit", eventGroup: "debit:1", eventKey: "debit:1" };
    mock.ledgerReads.push([]);
    await writeLedger(mock.tx, mock.account, -40, meta);
    expect(mock.account.balance).toBe(60);
    mock.ledgerReads.push([mock.ledger[0]]);
    await writeLedger(mock.tx, mock.account, -40, meta);
    expect(mock.account.balance).toBe(60);
    expect(mock.ledger).toHaveLength(1);
  });

  it("原路退款只发生一次，第二次返回原余额", async () => {
    const mock = pointsTx(100);
    mock.ledgerReads.push([]);
    await writeLedger(mock.tx, mock.account, -40, { actorUserId: 8, type: "assessment_debit", eventGroup: "debit:1", eventKey: "debit:1" });
    const original = mock.ledger[0];
    mock.ledgerReads.push([original], [], []);
    const first = await refundOriginalDebitTx(mock.tx, { eventKey: "debit:1", actorUserId: 8, reason: "未开始取消" });
    expect(first.refunded).toBe(true);
    expect(mock.account.balance).toBe(100);
    const refund = mock.ledger[1];
    mock.ledgerReads.push([original], [refund]);
    const second = await refundOriginalDebitTx(mock.tx, { eventKey: "debit:1", actorUserId: 8, reason: "重复取消" });
    expect(second.refunded).toBe(false);
    expect(mock.account.balance).toBe(100);
    expect(mock.ledger).toHaveLength(2);
  });

  it("零积分初始化只完成初始化，不写非零流水，重复调用不再发放", async () => {
    const mock = pointsTx(0);
    mock.account.ownerUserId = 0;
    mock.account.initialized = false;
    const db = { ...mock.raw, transaction: async (callback: (tx: PointTx) => unknown) => callback(mock.tx) };
    const first = await initializeOrgPoints(db as never, 7, 1, 0);
    const second = await initializeOrgPoints(db as never, 7, 1, 60_000);
    expect(first.initialized).toBe(true);
    expect(second.initialized).toBe(false);
    expect(mock.account.initialized).toBe(true);
    expect(mock.account.balance).toBe(0);
    expect(mock.ledger).toHaveLength(0);
  });
});

describe("学员提交任务标识与提交键", () => {
  beforeEach(() => { vi.stubGlobal("sessionStorage", storageMock()); });

  it("提交自动携带 assignmentId，相同任务与答案复用提交键", () => {
    rememberAssessmentAssignment("mbti", 321);
    const init = { body: JSON.stringify({ "0": { json: { kind: "mbti", answers: [1, 2] } } }) };
    const first = prepareAssessmentSubmission("/api/trpc/assessment.submit?batch=1", init);
    const firstJson = JSON.parse(String(first.body))["0"].json;
    expect(first.assignmentId).toBe(321);
    expect(firstJson.assignmentId).toBe(321);
    expect(firstJson.submissionKey).toHaveLength(36);
    const second = prepareAssessmentSubmission("/api/trpc/assessment.submit?batch=1", init);
    expect(JSON.parse(String(second.body))["0"].json.submissionKey).toBe(firstJson.submissionKey);
    clearAssessmentAssignment("mbti");
    const retest = prepareAssessmentSubmission("/api/trpc/assessment.submit?batch=1", init);
    expect(retest.assignmentId).toBeNull();
    expect(JSON.parse(String(retest.body))["0"].json.assignmentId).toBeUndefined();
    expect(JSON.parse(String(retest.body))["0"].json.submissionKey).not.toBe(firstJson.submissionKey);
  });

  it("扫码提交的嵌套 input 同样携带任务标识", () => {
    rememberAssessmentAssignment("disc", 654);
    const init = { body: JSON.stringify({ "0": { json: { input: { kind: "disc", answers: [1] } } } }) };
    const prepared = prepareAssessmentSubmission("/api/trpc/assessment.submitByPass?batch=1", init);
    const json = JSON.parse(String(prepared.body))["0"].json.input;
    expect(json.assignmentId).toBe(654);
    expect(json.submissionKey).toBeTruthy();
  });
});
