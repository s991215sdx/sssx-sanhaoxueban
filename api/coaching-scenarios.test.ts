import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { getTableConfig } from "drizzle-orm/mysql-core";
import { coachingCaseScenarios, coachingEvents } from "@db/schema";
import { normalizeCoachingScenarios } from "@contracts/orgService";
import { syncCoachingScenariosTx } from "./coachingService";
import type { PointTx } from "./orgPoints";

type ScenarioRow = { id: number; scenario: string; endedAt: Date | null };

function scenarioTx(rows: ScenarioRow[]) {
  const updates: Record<string, unknown>[] = [];
  const insertedScenarios: Record<string, unknown>[] = [];
  const events: Record<string, unknown>[] = [];
  const tx = {
    select: vi.fn(() => ({
      from: (table: unknown) => {
        expect(table).toBe(coachingCaseScenarios);
        return { where: () => ({ for: async () => rows }) };
      },
    })),
    update: vi.fn((table: unknown) => {
      expect(table).toBe(coachingCaseScenarios);
      return { set: (patch: Record<string, unknown>) => ({ where: async () => { updates.push(patch); } }) };
    }),
    insert: vi.fn((table: unknown) => ({
      values: async (values: Record<string, unknown>) => {
        if (table === coachingCaseScenarios) insertedScenarios.push(values);
        else if (table === coachingEvents) events.push(values);
        else throw new Error("unexpected insert table");
      },
    })),
  };
  return { tx: tx as unknown as PointTx, updates, insertedScenarios, events };
}

const input = { caseId: 91, orgId: 7, actorUserId: 9 };

describe("陪跑四类服务场景", () => {
  it("按 A—D 排序并去重，拒绝无效场景", () => {
    expect(normalizeCoachingScenarios(["D", "A", "D", "B"])).toEqual(["A", "B", "D"]);
    expect(normalizeCoachingScenarios([])).toEqual([]);
    expect(() => normalizeCoachingScenarios(["A", "新生接手"])).toThrow("无效");
  });

  it("A＋B 改为 B＋C 时结束 A、新增 C，并保留事件和原因", async () => {
    const mock = scenarioTx([{ id: 1, scenario: "A", endedAt: null }, { id: 2, scenario: "B", endedAt: null }]);
    const result = await syncCoachingScenariosTx(mock.tx, { ...input, scenarios: ["C", "B"], reason: "转入周末与全日制组合服务" });
    expect(result).toEqual({ active: ["B", "C"], added: ["C"], removed: ["A"] });
    expect(mock.updates).toHaveLength(1);
    expect(mock.updates[0]).toMatchObject({ activeKey: null, endedBy: 9, changeReason: "转入周末与全日制组合服务" });
    expect(mock.updates[0].endedAt).toBeInstanceOf(Date);
    expect(mock.insertedScenarios).toHaveLength(1);
    expect(mock.insertedScenarios[0]).toMatchObject({ caseId: 91, orgId: 7, scenario: "C", activeKey: "91:C", createdBy: 9 });
    expect(mock.events).toHaveLength(1);
    expect(mock.events[0]).toMatchObject({ type: "scenario_changed" });
    expect(mock.events[0].content).toContain("新增 C 全日制型");
    expect(mock.events[0].content).toContain("停用 A 晚自习型");
    expect(mock.events[0].content).toContain("转入周末与全日制组合服务");
  });

  it("停用已有场景未填写原因时，在任何写操作前拒绝", async () => {
    const mock = scenarioTx([{ id: 1, scenario: "A", endedAt: null }, { id: 2, scenario: "B", endedAt: null }]);
    await expect(syncCoachingScenariosTx(mock.tx, { ...input, scenarios: ["B"], reason: " " })).rejects.toThrow("须填写调整原因");
    expect(mock.updates).toHaveLength(0);
    expect(mock.insertedScenarios).toHaveLength(0);
    expect(mock.events).toHaveLength(0);
  });

  it("没有场景变化时不新增历史或事件", async () => {
    const mock = scenarioTx([{ id: 1, scenario: "A", endedAt: null }, { id: 2, scenario: "B", endedAt: null }]);
    const result = await syncCoachingScenariosTx(mock.tx, { ...input, scenarios: ["B", "A", "B"] });
    expect(result).toEqual({ active: ["A", "B"], added: [], removed: [] });
    expect(mock.updates).toHaveLength(0);
    expect(mock.insertedScenarios).toHaveLength(0);
    expect(mock.events).toHaveLength(0);
  });

  it("不允许空场景或非法场景进入写操作", async () => {
    const mock = scenarioTx([]);
    await expect(syncCoachingScenariosTx(mock.tx, { ...input, scenarios: [] })).rejects.toThrow("至少选择一种");
    await expect(syncCoachingScenariosTx(mock.tx, { ...input, scenarios: ["A", "X"] })).rejects.toThrow("无效");
    expect(mock.tx.select).not.toHaveBeenCalled();
    expect(mock.insertedScenarios).toHaveLength(0);
  });
});

describe("0048 场景周期迁移", () => {
  it("使用 CURRENT_TIMESTAMP、场景周期唯一键与查询索引，不回填旧主档", () => {
    const migration = readFileSync("db/migrations/0048_coaching_service_scenarios.sql", "utf8");
    expect(migration).toContain("`started_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP");
    expect(migration).toContain("`created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP");
    expect(migration).toContain("UNIQUE(`active_key`)");
    expect(migration).toContain("(`case_id`,`ended_at`,`scenario`)");
    expect(migration).toContain("(`org_id`,`scenario`,`ended_at`)");
    expect(migration).not.toContain("INSERT INTO `coaching_case_scenarios`");
    const journal = JSON.parse(readFileSync("db/migrations/meta/_journal.json", "utf8")) as { entries: { idx: number; tag: string }[] };
    expect(journal.entries.at(-1)).toMatchObject({ idx: 48, tag: "0048_coaching_service_scenarios" });
  });

  it("Drizzle 同时保留数据库默认值与应用显式时间", () => {
    const columns = getTableConfig(coachingCaseScenarios).columns;
    for (const name of ["started_at", "created_at"]) {
      const column = columns.find((item) => item.name === name);
      expect(column?.hasDefault).toBe(true);
      const value = column?.defaultFn?.() as Date;
      expect(value).toBeInstanceOf(Date);
      expect(Math.abs(value.getTime() - Date.now())).toBeLessThan(2000);
    }
  });
});
