import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { coachingCases, coachingCaseProfiles, coachingEvents } from "@db/schema";
import { getTableConfig } from "drizzle-orm/mysql-core";
import { JOURNAL_ENTRIES, MIGRATION_SQL } from "./migrationsEmbedded";
import { saveCoachingCaseProfile } from "./coachingProfile";
import type { StaffUser } from "./orgAccess";
import { PARENT_CARDS, cardForDate, compareLatestE3, resolveGrowthStage, stageForAge, towerPosition, type E3ResultSnapshot } from "../src/components/org/knowledgeBase";

const tutor = { id: 19, role: "tutor", orgId: 7 } as StaffUser;
const baseCase = { id: 91, orgId: 7, studentUserId: 301, coachId: 19, supervisorId: 19 } as typeof coachingCases.$inferSelect;
type Db = Parameters<typeof saveCoachingCaseProfile>[0];
const profileInput = { caseId: 91, birthDate: "2012-06-08", studentInfo: "喜欢篮球", threeParty: "学生、家长、伴学师访谈已核对", parentProfile: "母亲可每晚陪十分钟", attention: "先倾听再给建议", commAdvice: "每次只约定一个小行动" };

function profileDb(row = baseCase) {
  const inserted: { table: unknown; values: Record<string, unknown>; set?: Record<string, unknown> }[] = [];
  const transaction = vi.fn(async (callback: (tx: unknown) => unknown) => callback({
    insert: (table: unknown) => ({ values: (values: Record<string, unknown>) => {
      if (table === coachingEvents) { inserted.push({ table, values }); return Promise.resolve(); }
      return { onDuplicateKeyUpdate: async (options: { set: Record<string, unknown> }) => {
        inserted.push({ table, values, set: options.set }); return { affectedRows: 1 };
      } };
    } }),
  }));
  const db = {
    select: () => ({ from: () => ({ where: () => ({ limit: async () => [row] }) }) }),
    transaction,
  };
  return { db: db as unknown as Db, inserted, transaction };
}
function e3(id: number, score: number, version = "3.7"): E3ResultSnapshot {
  return { id, createdAt: new Date(`2026-11-${String(id).padStart(2, "0")}`), result: {
    version,
    abilities: ["乐学", "会学", "善学"].map((system) => ({ label: `${system}能力`, system, score, level: "正常" })),
    systems: { condition: { cells: [{ label: "家庭支持", score: score + 0.2, level: "正常" }] } },
  } };
}

describe("成长地图与每日家长卡片", () => {
  it("阶段边界左闭右开，最后一段封闭，负数与超龄取相邻段", () => {
    const expected: [number, string][] = [[0, "respond"], [1, "trial"], [3, "choice"], [5, "habit"], [9, "social"], [12, "identity"], [14, "confirm"], [17, "recode"], [20, "independent"], [-2, "respond"], [99, "independent"], [Number.NaN, "respond"]];
    for (const [age, key] of expected) expect(stageForAge(age).key).toBe(key);
  });

  it("有效生日优先，未来或无效生日回退年级，未知信息不猜测", () => {
    const today = new Date(2026, 10, 12);
    expect(resolveGrowthStage({ birthDate: "2013-11-13", grade: "初三" }, today)).toMatchObject({ age: 12, source: "birthday", stage: { key: "identity" } });
    expect(resolveGrowthStage({ birthDate: "2013-11-12", grade: "初一" }, today)?.age).toBe(13);
    expect(resolveGrowthStage({ birthDate: "2030-01-01", grade: "初三" }, today)).toMatchObject({ age: 14, source: "grade", stage: { key: "confirm" } });
    expect(resolveGrowthStage({ birthDate: "2026-02-30", grade: "五年级" }, today)?.age).toBe(10);
    expect(resolveGrowthStage({ birthDate: null, grade: "未知" }, today)).toBeNull();
  });

  it("18 张卡片跨日轮换并循环，正文无书目和页码", () => {
    expect(PARENT_CARDS).toHaveLength(18);
    const first = cardForDate(new Date(2026, 0, 1));
    expect(cardForDate(new Date(2026, 0, 2)).id).not.toBe(first.id);
    expect(cardForDate(new Date(2026, 0, 19)).id).toBe(first.id);
    for (const card of PARENT_CARDS) {
      const text = JSON.stringify(card);
      expect(text).not.toMatch(/冲突背后有礼物|P\d{3}|第\s*\d+\s*页/);
      expect(card.steps.length).toBeGreaterThanOrEqual(3);
      expect(card.practice.length).toBeGreaterThan(5);
    }
  });
});

describe("E3 塔位与同口径复测", () => {
  it("读取真实 label 字段，缺数据不生成默认塔位", () => {
    expect(towerPosition([{ label: "学习动力", score: 4 }, { label: "计划执行", score: 3.5 }])).toEqual({ humanistic: 4, psychoanalytic: 5, behavioral: 2 });
    expect(towerPosition([])).toEqual({ humanistic: null, psychoanalytic: null, behavioral: null });
    expect(towerPosition([{ label: "学习动力", score: 3 }])).toMatchObject({ humanistic: 2, behavioral: null });
  });

  it("只选最近两份 V3.7，旧版不参与比较", () => {
    const comparison = compareLatestE3([e3(1, 2.5), e3(2, 4.9, "v27"), e3(3, 3.5), e3(4, 4)])!;
    expect(comparison.previous.id).toBe(3);
    expect(comparison.current.id).toBe(4);
    expect(comparison.dimensions).toEqual([
      { key: "境", before: 3.7, current: 4.2, delta: 0.5 },
      { key: "心", before: 3.5, current: 4, delta: 0.5 },
      { key: "脑", before: 3.5, current: 4, delta: 0.5 },
      { key: "行", before: 3.5, current: 4, delta: 0.5 },
    ]);
    expect(compareLatestE3([e3(1, 3), e3(2, 4, "v27")])).toBeNull();
  });
});

describe("内部画像保存与 0058 迁移", () => {
  it("upsert 使用主档真实机构，事件不复制敏感正文", async () => {
    const mock = profileDb();
    await expect(saveCoachingCaseProfile(mock.db, tutor, profileInput)).resolves.toEqual({ ok: true });
    const profile = mock.inserted.find((row) => row.table === coachingCaseProfiles)!;
    expect(profile.values).toMatchObject({ orgId: 7, caseId: 91, updatedBy: 19, birthDate: "2012-06-08" });
    expect(profile.set?.updatedAt).toBeInstanceOf(Date);
    const event = mock.inserted.find((row) => row.table === coachingEvents)!;
    expect(event.values.visibility).toBe("internal");
    expect(JSON.stringify(event.values)).not.toContain(profileInput.threeParty);
  });

  it("越权或跨机构主档在事务前被拒绝，不写任何记录", async () => {
    const mock = profileDb({ ...baseCase, orgId: 8 });
    await expect(saveCoachingCaseProfile(mock.db, tutor, profileInput)).rejects.toThrow("陪跑主档不存在");
    expect(mock.transaction).not.toHaveBeenCalled();
    expect(mock.inserted).toHaveLength(0);
  });

  it("Drizzle 表结构与 SQL 同步，时间默认值为 CURRENT_TIMESTAMP", () => {
    const config = getTableConfig(coachingCaseProfiles);
    expect(config.columns.map((column) => column.name)).toEqual(expect.arrayContaining(["org_id", "case_id", "birth_date", "three_party", "comm_advice"]));
    const sql = readFileSync(new URL("../db/migrations/0058_coaching_case_profiles.sql", import.meta.url), "utf8");
    expect(sql.match(/DEFAULT CURRENT_TIMESTAMP/g)).toHaveLength(2);
    expect(sql).toContain("UNIQUE(`case_id`)");
    expect(JOURNAL_ENTRIES.at(-1)).toMatchObject({ idx: 58, tag: "0058_coaching_case_profiles" });
    expect(MIGRATION_SQL["0058_coaching_case_profiles"]).toContain("CREATE TABLE `coaching_case_profiles`");
  });
});
