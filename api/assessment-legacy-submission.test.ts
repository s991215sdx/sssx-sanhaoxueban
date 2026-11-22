import { describe, expect, it, vi } from "vitest";
import { assessmentResults } from "@db/schema";
import { persistAssessmentResult } from "./assessmentPersistence";

/** 仅模拟 Drizzle 查询链；积分扣费使用真实实现，确保能复现旧账号无钱包时的拦截。 */
function mockDb(reads: unknown[][]) {
  const inserts: { table: unknown; values: Record<string, unknown> }[] = [];
  const db = {
    select: vi.fn(() => {
      const result = reads.shift() ?? [];
      const query = {
        from: () => query,
        innerJoin: () => query,
        leftJoin: () => query,
        where: () => query,
        orderBy: () => query,
        limit: () => query,
        for: async () => result,
        then: (resolve: (rows: unknown[]) => unknown, reject?: (error: unknown) => unknown) => Promise.resolve(result).then(resolve, reject),
      };
      return query;
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => {
        inserts.push({ table, values });
        return { $returningId: async () => [{ id: 901 }] };
      },
    }),
    transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db)),
  };
  return { db: db as never, inserts };
}

describe("旧版注册渠道的 E3 提交兼容", () => {
  it("未直接归属机构的存量学员挂在旧版 user 账号名下时，不被新积分钱包误拦截", async () => {
    /* 对应正式故障结构：student.org_id=null，profile.tutor_id 指向旧版 role=user 账号，
       该账号 org_id=1 且机构池已初始化，但没有个人钱包。 */
    const mock = mockDb([
      [], // submissionKey 尚未提交
      [], // 无新版测评任务
      [{ orgId: null, edition: null }], // 学员版本：未直接归属机构
      [{ orgId: null }], // legacyPayer 再查学员归属
      [{ tutorId: 26652365 }], // 旧版主管账号
      [{ orgId: 1, role: "user", deletedAt: null }],
      [{ initialized: true }], // 修复前会继续找到已初始化机构池
      [], // 修复前真实 debitPoints 找不到个人钱包并在此抛错
    ]);

    const saved = await persistAssessmentResult(mock.db, {
      userId: 26652941,
      outcome: { kind: "e3", result: { abilities: [] } },
      answers: { stage: "junior", ratings: Array(70).fill(3) },
      submissionKey: "legacy-e3-submit-regression-20261107",
    });

    expect(saved).toMatchObject({ kind: "e3", resultId: 901, assignmentId: null });
    expect(mock.inserts).toHaveLength(1);
    expect(mock.inserts[0]).toMatchObject({ table: assessmentResults });
  });
});
