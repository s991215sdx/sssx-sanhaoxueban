import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getTableConfig } from "drizzle-orm/mysql-core";
import { coachingCases, coachingCheckins, coachingEvents, coachingMonthlyReports, coachingQualityReviews, courseParticipants, courseSessions, users } from "@db/schema";
import { coachingQualityLevel, type CoachingQualityScores } from "@contracts/orgService";
import { buildCoachingMonthlyMetrics, coachingMonthRange, pushCoachingMonthlyReport, saveCoachingMonthlyReport, shiftCoachingMonth } from "./coachingMonthly";
import { assignQualityReview, closeQualityReview, qualityScoreTotal, qualitySummary, submitQualityReview, submitSelfQualityReview, validateQualityScores } from "./coachingQuality";
import type { StaffUser } from "./orgAccess";

const admin = { id: 9, role: "admin", orgId: 7 } as StaffUser;
const tutor = { id: 19, role: "tutor", orgId: 7 } as StaffUser;
const peer = { id: 29, role: "tutor", orgId: 7 } as StaffUser;
const baseCase = { id: 91, orgId: 7, studentUserId: 301, coachId: 19, supervisorId: 19, serviceStart: "2026-01-15", status: "active" } as typeof coachingCases.$inferSelect;
const scores: CoachingQualityScores = { plan: 18, execution: 18, archive: 18, family: 18, review: 18 };
const qualityInput = { scores, findings: "已核对计划、课堂与家校档案，事实记录完整", improvementActions: "下月继续复核两项行动证据" };
type Db = Parameters<typeof saveCoachingMonthlyReport>[0];
type Source = Parameters<typeof buildCoachingMonthlyMetrics>[0];
type QualityRow = typeof coachingQualityReviews.$inferSelect;

function emptySource(): Source {
  return { studentUserId: 301, checkins: [], tasks: [], supervisions: [], sessions: [], participants: [], deliverables: [] };
}
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
    return Object.assign(Promise.resolve(), { $returningId: async () => [{ id: 601 }] });
  } }));
  return { insert, inserted };
}
function updateMock() {
  const patches: Record<string, unknown>[] = [];
  const update = vi.fn(() => ({ set: (patch: Record<string, unknown>) => ({ where: async () => { patches.push(patch); return { affectedRows: 1 }; } }) }));
  return { update, patches };
}
function dbMock(rootRows: (table: unknown) => unknown[], txRows: (table: unknown) => unknown[]) {
  const tx = { select: selectMock(txRows), ...insertMock(), ...updateMock() };
  const db = { select: selectMock(rootRows), transaction: vi.fn(async (callback: (transaction: unknown) => unknown) => callback(tx)) };
  return { db: db as unknown as Db, tx, transaction: db.transaction };
}
function qualityRow(patch: Partial<QualityRow> = {}): QualityRow {
  return { id: 501, caseId: 91, orgId: 7, reviewType: "peer", reviewerId: 29, periodKey: "2026-11", frameworkVersion: "1.0", version: 1,
    previousId: null, planScore: null, executionScore: null, archiveScore: null, familyScore: null, reviewScore: null,
    findings: "", improvementActions: "", status: "pending", dueAt: new Date("2026-11-15T10:00:00+08:00"), assignedBy: 9,
    submittedAt: null, closedBy: null, closedAt: null, closeEvidence: "", createdAt: new Date(), updatedAt: new Date(), ...patch };
}
const monthlyInput = { caseId: 91, month: "2026-11", goalProgress: "目标推进事实", academicProgress: "本月暂无同口径成绩新数据",
  taskExecution: "任务执行事实", learningMethod: "费曼输出与订正事实", habitFamily: "习惯与家校配合事实",
  meetingNotes: "已确认下月安排", nextActions: ["完成错题复验并保留记录"], familyAction: "每周核对一次行动证据" };

describe("月报月份与真实指标边界", () => {
  it("月份切换支持跨年，闰年和当月边界准确", () => {
    expect(shiftCoachingMonth("2026-12", 1)).toBe("2027-01");
    expect(shiftCoachingMonth("2026-01", -1)).toBe("2025-12");
    expect(coachingMonthRange("2024-02")).toEqual({ start: "2024-02-01", end: "2024-02-29", endExclusive: "2024-03-01" });
    expect(coachingMonthRange("2023-02").end).toBe("2023-02-28");
    expect(() => coachingMonthRange("2026-13")).toThrow("月份格式");
  });

  it("无数据指标返回 null，不伪写为 0%", () => {
    const result = buildCoachingMonthlyMetrics(emptySource(), "2026-11");
    expect(result).toMatchObject({ checkinDays: 0, averageCompletion: null, averageAccuracy: null, taskVerificationRate: null, feedbackRate: null });
  });

  it("同一检验日只采用最新版本，旧版本不拉低平均值", () => {
    const source = emptySource();
    source.checkins = [
      { id: 1, checkDate: "2026-11-01", version: 1, completionRate: 20, accuracyRate: 30, feynmanOutput: "", traces: [] },
      { id: 2, checkDate: "2026-11-01", version: 2, completionRate: 80, accuracyRate: 90, feynmanOutput: "能独立讲解错题", traces: ["draft"] },
      { id: 3, checkDate: "2026-11-02", version: 1, completionRate: 100, accuracyRate: 100, feynmanOutput: "能复述课堂重点", traces: ["draft", "notes", "mindmap", "errorbook", "review"] },
    ] as Source["checkins"];
    expect(buildCoachingMonthlyMetrics(source, "2026-11")).toMatchObject({ checkinDays: 2, averageCompletion: 90, averageAccuracy: 95, feynmanDays: 2, fullTraceDays: 1 });
  });

  it("已验收但缺证据或结果的任务仍不计入验收", () => {
    const source = emptySource();
    source.tasks = [
      { dueDate: "2026-11-02", status: "verified", evidence: "", result: "已完成" },
      { dueDate: "2026-11-03", status: "verified", evidence: "复验照片", result: "" },
      { dueDate: "2026-11-04", status: "verified", evidence: "复验照片", result: "同类题正确" },
      { dueDate: "2026-12-01", status: "verified", evidence: "下月任务", result: "不归本月" },
    ] as Source["tasks"];
    expect(buildCoachingMonthlyMetrics(source, "2026-11")).toMatchObject({ tasksDue: 3, tasksVerified: 1, taskVerificationRate: 33.3 });
  });

  it("跨主档课堂按编号去重，其他学员家庭附件不能冒充本学员反馈", () => {
    const source = emptySource();
    const first = { id: 11, caseId: 91, status: "completed", startAt: new Date("2026-11-05T10:00:00+08:00") } as Source["sessions"][number];
    const second = { id: 12, caseId: 92, status: "completed", startAt: new Date("2026-11-06T10:00:00+08:00") } as Source["sessions"][number];
    source.sessions = [first, second, second];
    source.participants = [
      { id: 101, sessionId: 11, studentUserId: 301, feedbackVersion: 0 },
      { id: 102, sessionId: 12, studentUserId: 301, feedbackVersion: 0 },
      { id: 103, sessionId: 12, studentUserId: 999, feedbackVersion: 1 },
    ] as Source["participants"];
    source.deliverables = [{ participantId: 103, visibility: "family", pushedAt: new Date() }];
    expect(buildCoachingMonthlyMetrics(source, "2026-11")).toMatchObject({ completedSessions: 2, feedbackSessions: 0, feedbackRate: 0 });
    source.deliverables = [{ participantId: 102, visibility: "family", pushedAt: new Date() }, { participantId: 102, visibility: "family", pushedAt: new Date() }];
    expect(buildCoachingMonthlyMetrics(source, "2026-11")).toMatchObject({ completedSessions: 2, feedbackSessions: 1, feedbackRate: 50 });
  });

  it("课堂和督学按 Asia/Shanghai 日期归月", () => {
    const source = emptySource();
    source.sessions = [{ id: 11, status: "completed", startAt: new Date("2026-02-28T16:30:00.000Z") }] as Source["sessions"];
    source.supervisions = [{ status: "completed", visitAt: new Date("2026-02-28T15:30:00.000Z") }] as Source["supervisions"];
    expect(buildCoachingMonthlyMetrics(source, "2026-02")).toMatchObject({ completedSessions: 0, completedSupervisions: 1 });
    expect(buildCoachingMonthlyMetrics(source, "2026-03")).toMatchObject({ completedSessions: 1, completedSupervisions: 0 });
  });
});

describe("月报版本与家庭推送", () => {
  it("下月动作只允许 1—3 条，非法输入不会开启事务", async () => {
    for (const nextActions of [[], ["一", "二", "三", "四"]]) {
      const mock = dbMock((table) => table === coachingCases ? [baseCase] : [], () => []);
      await expect(saveCoachingMonthlyReport(mock.db, tutor, { ...monthlyInput, nextActions })).rejects.toThrow("1—3 条");
      expect(mock.transaction).not.toHaveBeenCalled();
    }
  });

  it("每次保存追加版本并保留数据快照，不覆盖旧月报", async () => {
    const previous = { id: 500, version: 1 } as QualityRow;
    const mock = dbMock((table) => table === coachingCases ? [baseCase] : [],
      (table) => table === coachingMonthlyReports ? [previous] : table === coachingCases ? [baseCase] : []);
    await expect(saveCoachingMonthlyReport(mock.db, tutor, monthlyInput)).resolves.toEqual({ id: 601, version: 2 });
    const report = mock.tx.inserted.find((row) => row.table === coachingMonthlyReports)!;
    expect(report.values).toMatchObject({ caseId: 91, orgId: 7, month: "2026-11", version: 2, previousId: 500, nextActions: monthlyInput.nextActions });
    expect(report.values.metricSnapshot).toMatchObject({ baselineMonth: "2026-01", current: { month: "2026-11" }, previous: { month: "2026-10" } });
    expect(mock.tx.inserted.find((row) => row.table === coachingEvents)?.values.visibility).toBe("internal");
  });

  it("重复推送幂等，不写第二次推送事件", async () => {
    const report = { id: 601, caseId: 91, month: "2026-11", version: 2, pushedAt: new Date() } as typeof coachingMonthlyReports.$inferSelect;
    const mock = dbMock((table) => table === coachingMonthlyReports ? [report] : table === coachingCases ? [baseCase] : [], () => []);
    await expect(pushCoachingMonthlyReport(mock.db, tutor, 601)).resolves.toEqual({ id: 601, version: 2, duplicate: true });
    expect(mock.transaction).not.toHaveBeenCalled();
  });

  it("首次推送锁定版本并写入家庭可见时间", async () => {
    const report = { id: 601, caseId: 91, month: "2026-11", version: 2, pushedAt: null } as typeof coachingMonthlyReports.$inferSelect;
    const rows = (table: unknown) => table === coachingMonthlyReports ? [report] : table === coachingCases ? [baseCase] : [];
    const mock = dbMock(rows, rows);
    await expect(pushCoachingMonthlyReport(mock.db, tutor, 601)).resolves.toEqual({ id: 601, version: 2, duplicate: false });
    expect(mock.tx.patches[0].pushedAt).toBeInstanceOf(Date);
    expect(mock.tx.inserted.find((row) => row.table === coachingEvents)?.values.content).toContain("V2");
  });
});

describe("质量五模块、角色和整改版本", () => {
  it("共享框架严格校验整数和单项 20 分上限", () => {
    expect(qualityScoreTotal(validateQualityScores(scores))).toBe(90);
    expect(qualityScoreTotal({ plan: 20, execution: 20, archive: 20, family: 20, review: 20 })).toBe(100);
    for (const invalid of [{ ...scores, plan: 21 }, { ...scores, family: -1 }, { ...scores, review: 18.5 }]) expect(() => validateQualityScores(invalid)).toThrow("整数");
  });

  it("红黄绿阈值正确，待评分记录不计算总分", () => {
    expect(coachingQualityLevel(90).key).toBe("green");
    expect(coachingQualityLevel(89).key).toBe("yellow");
    expect(coachingQualityLevel(75).key).toBe("yellow");
    expect(coachingQualityLevel(74).key).toBe("red");
    expect(qualitySummary(qualityRow())).toBeNull();
    expect(qualitySummary(qualityRow({ planScore: 18, executionScore: 18, archiveScore: 18, familyScore: 18, reviewScore: 18 }))).toMatchObject({ total: 90, level: { key: "green" } });
  });

  it("仅管理员可安排，跨机构和角色不匹配均被拒绝", async () => {
    const input = { caseId: 91, reviewType: "peer" as const, reviewerId: 29, periodKey: "2026-11", dueAt: new Date("2026-11-15T10:00:00+08:00") };
    const ordinary = dbMock(() => [], () => []);
    await expect(assignQualityReview(ordinary.db, tutor, input)).rejects.toThrow("仅机构管理员");
    expect(ordinary.transaction).not.toHaveBeenCalled();
    const otherOrg = dbMock((table) => table === coachingCases ? [{ ...baseCase, orgId: 8 }] : [], () => []);
    await expect(assignQualityReview(otherOrg.db, admin, input)).rejects.toThrow("主档不存在");
    const selfAsPeer = dbMock((table) => table === coachingCases ? [baseCase] : table === users ? [{ id: 19, role: "tutor" }] : [], () => []);
    await expect(assignQualityReview(selfAsPeer.db, admin, { ...input, reviewerId: 19 })).rejects.toThrow("互查人不能");
    const tutorSupervisor = dbMock((table) => table === coachingCases ? [baseCase] : table === users ? [{ id: 29, role: "tutor" }] : [], () => []);
    await expect(assignQualityReview(tutorSupervisor.db, admin, { ...input, reviewType: "supervisor" })).rejects.toThrow("管理员");
  });

  it("管理员可安排同伴互查，初始待办不生成虚假分数", async () => {
    const mock = dbMock((table) => table === coachingCases ? [baseCase] : table === users ? [{ id: 29, role: "tutor" }] : [], () => []);
    await expect(assignQualityReview(mock.db, admin, { caseId: 91, reviewType: "peer", reviewerId: 29, periodKey: "2026-11", dueAt: new Date("2026-11-15T10:00:00+08:00") })).resolves.toEqual({ id: 601, version: 1, status: "pending" });
    const review = mock.tx.inserted.find((row) => row.table === coachingQualityReviews)!;
    expect(review.values).toMatchObject({ reviewType: "peer", reviewerId: 29, status: "pending", version: 1 });
    expect(review.values).not.toHaveProperty("planScore");
    expect(mock.tx.inserted.find((row) => row.table === coachingEvents)?.values.content).not.toContain(qualityInput.findings);
  });

  it("当前负责人可直接自查，更正追加版本；非负责人和已关闭周期不能改", async () => {
    const existing = qualityRow({ reviewType: "self", reviewerId: 19, status: "submitted", version: 1 });
    const mock = dbMock((table) => table === coachingCases ? [baseCase] : [], (table) => table === coachingQualityReviews ? [existing] : []);
    await expect(submitSelfQualityReview(mock.db, tutor, { caseId: 91, periodKey: "2026-11", ...qualityInput })).resolves.toEqual({ id: 601, version: 2, status: "submitted" });
    expect(mock.tx.inserted.find((row) => row.table === coachingQualityReviews)?.values).toMatchObject({ version: 2, previousId: 501, planScore: 18, status: "submitted" });
    const notOwner = dbMock((table) => table === coachingCases ? [baseCase] : [], () => []);
    await expect(submitSelfQualityReview(notOwner.db, admin, { caseId: 91, periodKey: "2026-11", ...qualityInput })).rejects.toThrow("当前主教或督学");
    const closed = dbMock((table) => table === coachingCases ? [baseCase] : [], (table) => table === coachingQualityReviews ? [{ ...existing, status: "closed" }] : []);
    await expect(submitSelfQualityReview(closed.db, tutor, { caseId: 91, periodKey: "2026-11", ...qualityInput })).rejects.toThrow("已整改关闭");
  });

  it("被指派人完成原待办；非指派人或其他机构不能提交", async () => {
    const pending = qualityRow();
    const rows = (table: unknown) => table === coachingQualityReviews ? [pending] : [];
    const mock = dbMock(rows, rows);
    await expect(submitQualityReview(mock.db, peer, { reviewId: 501, ...qualityInput })).resolves.toEqual({ id: 501, version: 1, status: "submitted" });
    expect(mock.tx.patches[0]).toMatchObject({ status: "submitted", planScore: 18 });
    expect(mock.tx.inserted.some((row) => row.table === coachingQualityReviews)).toBe(false);
    const wrong = dbMock(rows, rows);
    await expect(submitQualityReview(wrong.db, tutor, { reviewId: 501, ...qualityInput })).rejects.toThrow("分配给自己");
    expect(wrong.transaction).not.toHaveBeenCalled();
    const otherOrg = dbMock((table) => table === coachingQualityReviews ? [{ ...pending, orgId: 8 }] : [], () => []);
    await expect(submitQualityReview(otherOrg.db, peer, { reviewId: 501, ...qualityInput })).rejects.toThrow("不存在");
  });

  it("已提交检查更正时追加版本，不覆盖原记录", async () => {
    const submitted = qualityRow({ status: "submitted", planScore: 18, executionScore: 18, archiveScore: 18, familyScore: 18, reviewScore: 18 });
    const rows = (table: unknown) => table === coachingQualityReviews ? [submitted] : [];
    const mock = dbMock(rows, rows);
    await expect(submitQualityReview(mock.db, peer, { reviewId: 501, ...qualityInput })).resolves.toEqual({ id: 601, version: 2, status: "submitted" });
    expect(mock.tx.inserted.find((row) => row.table === coachingQualityReviews)?.values).toMatchObject({ version: 2, previousId: 501, status: "submitted" });
    expect(mock.tx.patches).toHaveLength(0);
  });

  it("整改关闭必须有证据，只有已提交记录能关闭", async () => {
    const submitted = qualityRow({ status: "submitted" });
    const rows = (table: unknown) => table === coachingQualityReviews ? [submitted] : [];
    const mock = dbMock(rows, rows);
    await expect(closeQualityReview(mock.db, peer, { reviewId: 501, closeEvidence: "已补齐档案 V2 并由主管复验" })).resolves.toEqual({ id: 501, status: "closed" });
    expect(mock.tx.patches[0]).toMatchObject({ status: "closed", closedBy: 29, closeEvidence: "已补齐档案 V2 并由主管复验" });
    const missing = dbMock(rows, rows);
    await expect(closeQualityReview(missing.db, peer, { reviewId: 501, closeEvidence: " " })).rejects.toThrow("关闭证据");
    expect(missing.transaction).not.toHaveBeenCalled();
    const pendingRows = (table: unknown) => table === coachingQualityReviews ? [qualityRow({ status: "pending" })] : [];
    const pending = dbMock(pendingRows, pendingRows);
    await expect(closeQualityReview(pending.db, peer, { reviewId: 501, closeEvidence: "重复关闭" })).rejects.toThrow("只有已提交");
    const wrong = dbMock(rows, rows);
    await expect(closeQualityReview(wrong.db, tutor, { reviewId: 501, closeEvidence: "越权关闭" })).rejects.toThrow("仅管理员或该检查人");
  });
});

describe("0052 迁移、页面接线与家庭隔离", () => {
  it("两张新表、索引、CURRENT_TIMESTAMP 与内嵌迁移一致", () => {
    const migration = readFileSync("db/migrations/0052_coaching_monthly_quality.sql", "utf8");
    for (const table of ["coaching_monthly_reports", "coaching_quality_reviews"]) expect(migration).toContain(`CREATE TABLE IF NOT EXISTS \`${table}\``);
    expect(migration).toContain("DEFAULT CURRENT_TIMESTAMP");
    expect(migration).toContain("(`case_id`,`month`,`version`)");
    expect(migration).toContain("(`case_id`,`review_type`,`reviewer_id`,`period_key`,`version`)");
    const journal = JSON.parse(readFileSync("db/migrations/meta/_journal.json", "utf8")) as { entries: { idx: number; tag: string }[] };
    expect(journal.entries.find((entry) => entry.idx === 52)).toMatchObject({ idx: 52, tag: "0052_coaching_monthly_quality" });
    expect(readFileSync("api/migrationsEmbedded.ts", "utf8")).toContain('"0052_coaching_monthly_quality":');
    expect(readFileSync("api/initDb.ts", "utf8")).toContain('"0052": async () =>');
    expect(getTableConfig(coachingMonthlyReports).indexes.map((index) => index.config.name)).toContain("coaching_monthly_reports_case_month_version_unique");
    expect(getTableConfig(coachingQualityReviews).indexes.map((index) => index.config.name)).toContain("coaching_quality_reviews_reviewer_status_idx");
  });

  it("工作台、家庭月报和质量待办已接线，家庭服务不读取质量表", () => {
    const workspace = readFileSync("src/components/org/CoachingWorkspace.tsx", "utf8");
    const family = readFileSync("src/pages/FamilyCoaching.tsx", "utf8");
    const service = readFileSync("api/coachingService.ts", "utf8");
    const router = readFileSync("api/coachingRouter.ts", "utf8");
    expect(workspace).toContain("<CoachingQualityInbox />");
    expect(workspace).toContain("<CoachingMonthlyQuality");
    expect(family).toContain("data.monthlyReports");
    expect(family).toContain("家长本月 1 件配合事");
    expect(service).toContain("isNotNull(coachingMonthlyReports.pushedAt)");
    expect(service).not.toContain("coachingQualityReviews");
    for (const endpoint of ["monthlyPreview", "saveMonthlyReport", "pushMonthlyReport", "qualityInbox", "assignQualityReview", "submitSelfQualityReview", "submitQualityReview", "closeQualityReview"]) expect(router).toContain(`${endpoint}:`);
    expect(readFileSync("api/router.ts", "utf8")).toContain('BUILD_TAG = "v264-2026-11-08"');
  });
});
