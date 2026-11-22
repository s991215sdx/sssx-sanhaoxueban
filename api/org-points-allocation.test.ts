import { describe, expect, it } from "vitest";
import { orgPointAccounts, orgPointLedger, users } from "@db/schema";
import { allocateOrgPoints, initializeOrgPoints, type PointDb, type PointTx } from "./orgPoints";

function walletDb(initialized: boolean, role: "admin" | "tutor" = "admin", accountExists = true) {
  const pool = { id: 1, orgId: 7, ownerUserId: 0, balance: initialized ? 15_000 : 0, initialized, createdAt: new Date(), updatedAt: new Date() };
  const target = { id: 2, orgId: 7, ownerUserId: 23, balance: 0, initialized: true, createdAt: new Date(), updatedAt: new Date() };
  const accounts = accountExists ? [pool, target] : [pool];
  const ledger: Record<string, unknown>[] = [];
  const ledgerReads: Record<string, unknown>[][] = [];
  let updateIndex = 0;
  const tx = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === users) return { limit: async () => [{ id: 23, orgId: 7, role, deletedAt: null }] };
          if (table === orgPointAccounts) return { orderBy: () => ({ for: async () => accounts }) };
          if (table === orgPointLedger) return { limit: async () => ledgerReads.shift() ?? [] };
          throw new Error("unexpected select table");
        },
      }),
    }),
    update: (table: unknown) => ({
      set: (patch: Record<string, unknown>) => ({
        where: async () => {
          if (table !== orgPointAccounts) throw new Error("unexpected update table");
          const account = "initialized" in patch ? accounts[0] : accounts[Math.min(updateIndex++, 1)];
          Object.assign(account, patch);
          return { affectedRows: 1 };
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        onDuplicateKeyUpdate: async () => {
          if (table === orgPointAccounts && values.ownerUserId === target.ownerUserId && !accounts.includes(target)) accounts.push(target);
        },
        $returningId: async () => {
          if (table !== orgPointLedger) throw new Error("unexpected insert table");
          const id = ledger.length + 1;
          ledger.push({ ...values, id });
          return [{ id }];
        },
      }),
    }),
  };
  const db = { ...tx, transaction: async (callback: (tx: PointTx) => unknown) => { updateIndex = 0; return callback(tx as unknown as PointTx); } };
  return { db: db as unknown as PointDb, pool, target, ledger, ledgerReads };
}

describe("机构初始化与个人钱包分配", () => {
  it("新机构省略金额时首次发放 15,000，重复初始化不补发", async () => {
    const mock = walletDb(false);
    mock.ledgerReads.push([]);
    const first = await initializeOrgPoints(mock.db, 7, 1);
    const second = await initializeOrgPoints(mock.db, 7, 1);
    expect(first).toEqual({ initialized: true, balance: 15_000 });
    expect(second).toEqual({ initialized: false, balance: 15_000 });
    expect(mock.pool.balance).toBe(15_000);
    expect(mock.ledger).toHaveLength(1);
    expect(mock.ledger[0]).toMatchObject({ amount: 15_000, type: "initial_grant", eventKey: "org:init:7" });
  });

  it("管理员可从本机构池分给本人，双边各记一笔且总余额不变", async () => {
    const mock = walletDb(true);
    mock.ledgerReads.push([], []);
    const result = await allocateOrgPoints(mock.db, { orgId: 7, actorUserId: 23, tutorUserId: 23, amount: 1000 });
    expect(result).toMatchObject({ ok: true, balance: 1000, poolBalance: 14_000 });
    expect(mock.pool.balance).toBe(14_000);
    expect(mock.target.balance).toBe(1000);
    expect(mock.ledger.map((entry) => entry.amount)).toEqual([-1000, 1000]);
    expect(mock.pool.balance + mock.target.balance).toBe(15_000);
  });

  it("从未有钱包的伴学师也能首次收款，双流水完整且总余额不变", async () => {
    const mock = walletDb(true, "tutor", false);
    mock.ledgerReads.push([], []);
    const result = await allocateOrgPoints(mock.db, { orgId: 7, actorUserId: 1, tutorUserId: 23, amount: 2000 });
    expect(result).toMatchObject({ ok: true, balance: 2000, poolBalance: 13_000 });
    expect(mock.target.balance).toBe(2000);
    expect(mock.ledger.map((entry) => entry.type)).toEqual(["allocation_out", "allocation_in"]);
    expect(mock.ledger.map((entry) => entry.amount)).toEqual([-2000, 2000]);
    expect(mock.pool.balance + mock.target.balance).toBe(15_000);
  });
});
