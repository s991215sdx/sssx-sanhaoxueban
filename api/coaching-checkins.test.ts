import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getTableConfig } from "drizzle-orm/mysql-core";
import { coachingCases, coachingCheckins, coachingEvents, studySupervisionRecords } from "@db/schema";
import { LEARNING_TRACE_KEYS, validateDailyCheckin, type DailyCheckinRuleInput } from "@contracts/orgService";
import { appendDailyCheckinTx, assertCaseAccess, assertCheckinSupervision } from "./coachingService";
import type { StaffUser } from "./orgAccess";
import type { PointTx } from "./orgPoints";

const me = { id: 9, role: "tutor", orgId: 7 } as StaffUser;
const coachingCase = { id: 91, orgId: 7, studentUserId: 301, coachId: 9, supervisorId: 9 } as typeof coachingCases.$inferSelect;
const validInput: DailyCheckinRuleInput & { caseId: number; supervisionId: number } = {
  caseId: 91, supervisionId: 501, checkDate: "2026-11-07", completionRate: 100, accuracyRate: 100,
  actualCompletion: "完成数学第 3 讲 12 题", evidence: "练习册第 18 页草稿与批注", tomorrowFirst: "先完成函数图像同类题复验",
  gapReason: "", errorCause: "", correction: "", followUp: "", followUpDate: "2026-11-07",
  feynmanEnabled: false, feynmanConcept: "", feynmanOutput: "", feynmanStuck: "", feynmanQuestion: "", retestDate: "",
  traces: [...LEARNING_TRACE_KEYS], traceEvidence: "笔记一页、导图一张", traceFollowUp: "", hasPreviousVersion: false,
};

function checkinTx(previous: { id: number; version: number } | null = null) {
  const inserted: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];
  const tx = {
    select: vi.fn(() => ({ from: (table: unknown) => {
      expect(table).toBe(coachingCheckins);
      return { where: () => ({ orderBy: () => ({ limit: () => ({ for: async () => previous ? [previous] : [] }) }) }) };
    } })),
    insert: vi.fn((table: unknown) => ({ values: (values: Record<string, unknown>) => {
      if (table === coachingCheckins) { inserted.push(values); return { $returningId: async () => [{ id: (previous?.id ?? 1000) + 1 }] }; }
      if (table === coachingEvents) { events.push(values); return Promise.resolve(); }
      throw new Error("unexpected insert table");
    } })),
  };
  return { tx: tx as unknown as PointTx, inserted, events };
}

describe("结构化日检验业务规则", () => {
  it("五项痕迹齐全且不启用费曼时可保存完整检验", () => {
    expect(validateDailyCheckin(validInput)).toBeNull();
    expect(validateDailyCheckin({ ...validInput, completionRate: 80, gapReason: "时间分配不合理", followUp: "次日补做两题并验收", followUpDate: "2026-11-08" })).toBeNull();
  });

  it.each([
    [{ completionRate: 80 }, "未完成原因"],
    [{ completionRate: 80, gapReason: "概念不清" }, "补位行动"],
    [{ completionRate: 80, gapReason: "概念不清", followUp: "次日补做", followUpDate: "" }, "补位日期"],
    [{ completionRate: 80, gapReason: "概念不清", followUp: "次日补做", followUpDate: "2026-11-06" }, "不能早于"],
    [{ accuracyRate: 80 }, "错因"],
    [{ accuracyRate: 80, errorCause: "审题偏差" }, "订正情况"],
  ])("服务端拒绝缺少条件必填项：%s", (patch, message) => {
    expect(validateDailyCheckin({ ...validInput, ...patch })).toContain(message);
  });

  it("五项痕迹缺一项也必须写补齐安排，不能用无效痕迹替代", () => {
    expect(validateDailyCheckin({ ...validInput, traces: ["draft", "notes", "mindmap", "errorbook"] })).toContain("缺项补齐安排");
    expect(validateDailyCheckin({ ...validInput, traces: ["draft", "notes", "mindmap", "errorbook"], traceFollowUp: "导图不适用于本次计算练习" })).toBeNull();
    expect(validateDailyCheckin({ ...validInput, traces: ["photo"] })).toContain("类型无效");
  });

  it("启用费曼后必须有知识点、学生原始输出和 A／B／C 评级", () => {
    expect(validateDailyCheckin({ ...validInput, feynmanEnabled: true })).toContain("知识点");
    expect(validateDailyCheckin({ ...validInput, feynmanEnabled: true, feynmanConcept: "函数图像平移" })).toContain("学生自己的讲解");
    expect(validateDailyCheckin({ ...validInput, feynmanEnabled: true, feynmanConcept: "函数图像平移", feynmanOutput: "学生解释横坐标变化" })).toContain("评级");
    expect(validateDailyCheckin({ ...validInput, feynmanEnabled: true, feynmanConcept: "函数图像平移", feynmanOutput: "学生解释横坐标变化", feynmanGrade: "B" })).toBeNull();
  });

  it("同日再次提交必须写修改原因", () => {
    expect(validateDailyCheckin({ ...validInput, hasPreviousVersion: true })).toContain("修改原因");
    expect(validateDailyCheckin({ ...validInput, hasPreviousVersion: true, changeReason: "补录学生现场复验结果" })).toBeNull();
  });
});

describe("日检验追加版本与关联隔离", () => {
  it("首次写入 V1，同日更正追加 V2 并指回 V1，不更新旧记录", async () => {
    const first = checkinTx();
    const v1 = await appendDailyCheckinTx(first.tx, me, coachingCase, validInput);
    expect(v1).toEqual({ id: 1001, version: 1 });
    expect(first.inserted[0]).toMatchObject({ caseId: 91, orgId: 7, supervisionId: 501, version: 1, previousId: null, createdBy: 9 });

    const second = checkinTx({ id: 1001, version: 1 });
    const v2 = await appendDailyCheckinTx(second.tx, me, coachingCase, { ...validInput, accuracyRate: 80, errorCause: "横坐标符号理解反了", correction: "已完成三道同类题复验", changeReason: "补录离店前复验结果" });
    expect(v2).toEqual({ id: 1002, version: 2 });
    expect(second.inserted[0]).toMatchObject({ version: 2, previousId: 1001, changeReason: "补录离店前复验结果" });
    expect(second.events[0].content).toContain("V2");
    expect(second.tx).not.toHaveProperty("update");
  });

  it("即使绕过前端，服务端也会在写入前拦截同日无原因更正", async () => {
    const mock = checkinTx({ id: 1001, version: 1 });
    await expect(appendDailyCheckinTx(mock.tx, me, coachingCase, validInput)).rejects.toThrow("修改原因");
    expect(mock.inserted).toHaveLength(0);
    expect(mock.events).toHaveLength(0);
  });

  it("拒绝其他主档或其他学员的到店督学记录，接受本主档关联", async () => {
    const dbFor = (record?: { id: number; caseId: number; studentUserId: number }) => ({
      select: () => ({ from: (table: unknown) => {
        expect(table).toBe(studySupervisionRecords);
        return { where: () => ({ limit: async () => record ? [record] : [] }) };
      } }),
    }) as unknown as Parameters<typeof assertCheckinSupervision>[0];
    await expect(assertCheckinSupervision(dbFor({ id: 501, caseId: 92, studentUserId: 301 }), coachingCase, 501)).rejects.toThrow("不匹配");
    await expect(assertCheckinSupervision(dbFor({ id: 501, caseId: 91, studentUserId: 302 }), coachingCase, 501)).rejects.toThrow("不匹配");
    await expect(assertCheckinSupervision(dbFor(), coachingCase, 501)).rejects.toThrow("不匹配");
    await expect(assertCheckinSupervision(dbFor({ id: 501, caseId: 91, studentUserId: 301 }), coachingCase, 501)).resolves.toBeUndefined();
  });

  it("跨机构主档在读取和写入前先被权限层拒绝", async () => {
    const db = { select: () => ({ from: (table: unknown) => {
      expect(table).toBe(coachingCases);
      return { where: () => ({ limit: async () => [{ ...coachingCase, orgId: 8 }] }) };
    } }) } as unknown as Parameters<typeof assertCaseAccess>[0];
    await expect(assertCaseAccess(db, me, 91)).rejects.toThrow("陪跑主档不存在");
  });
});

describe("0049 日检验迁移与页面接线", () => {
  it("使用 CURRENT_TIMESTAMP、同日版本唯一键与机构日期索引，并已内嵌部署", () => {
    const migration = readFileSync("db/migrations/0049_coaching_daily_checkins.sql", "utf8");
    expect(migration).toContain("`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP");
    expect(migration).toContain("UNIQUE(`case_id`,`check_date`,`version`)");
    expect(migration).toContain("(`case_id`,`check_date`,`version`)");
    expect(migration).toContain("(`org_id`,`check_date`)");
    expect(migration).not.toMatch(/UPDATE\s+`coaching_checkins`/i);
    const journal = JSON.parse(readFileSync("db/migrations/meta/_journal.json", "utf8")) as { entries: { idx: number; tag: string }[] };
    expect(journal.entries.find((entry) => entry.idx === 49)).toMatchObject({ idx: 49, tag: "0049_coaching_daily_checkins" });
    expect(readFileSync("api/migrationsEmbedded.ts", "utf8")).toContain('"0049_coaching_daily_checkins":');
    const table = getTableConfig(coachingCheckins);
    expect(table.indexes.map((item) => item.config.name)).toEqual(expect.arrayContaining(["coaching_checkins_case_date_version_unique", "coaching_checkins_case_date_version_idx", "coaching_checkins_org_date_idx"]));
    const column = table.columns.find((item) => item.name === "created_at");
    expect(column?.hasDefault).toBe(true);
    expect(column?.defaultFn?.()).toBeInstanceOf(Date);
  });

  it("复盘页包含结构化日检验，GROW 右侧显示日检验数量", () => {
    expect(readFileSync("src/components/org/CoachingWorkspace.tsx", "utf8")).toContain("<CoachingCheckins data={data} />");
    expect(readFileSync("src/components/org/CoachingCheckins.tsx", "utf8")).toContain("trpc.coaching.saveCheckin.useMutation");
    expect(readFileSync("src/components/org/GrowEditor.tsx", "utf8")).toContain("data?.checkins.length");
    expect(readFileSync("api/coachingRouter.ts", "utf8")).toContain("saveCheckin: tutorQuery.input(dailyCheckinInput)");
  });
});
