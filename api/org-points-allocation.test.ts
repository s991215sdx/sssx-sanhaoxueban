import { describe, expect, it } from "vitest";
import { orgPointAccounts, orgPointLedger, users } from "@db/schema";
import { allocateOrgPoints, initializeOrgPoints, type PointDb, type PointTx } from "./orgPoints";

function walletDb(initialized: boolean) {
  const pool = { id: 1, orgId: 7, ownerUserId: 0, balance: initialized ? 10_000 : 0, initialized, createdAt: new Date(), updatedAt: new Date() };
  const admin = { id: 2, orgId: 7, ownerUserId: 23, balance: 0, initialized: true, createdAt: new Date(), updatedAt: new Date() };
  const accounts = [pool, admin];
  const ledger: Record<string, unknown>[] = [];
  const ledgerReads: Record<string, unknown>[][] = [];
  let updateIndex = 0;
  const tx = {
    select: () => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === users) return { limit: async () => [{ id: 23, orgId: 7, role: "admin", deletedAt: null }] };
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
          const target = "initialized" in patch ? accounts[0] : accounts[Math.min(updateIndex++, 1)];
          Object.assign(target, patch);
          return { affectedRows: 1 };
        },
      }),
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        onDuplicateKeyUpdate: async () => {},
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
  return { db: db as unknown as PointDb, pool, admin, ledger, ledgerReads };
}

describe("机构初始化与管理员个人钱包", () => {
  it("新机构省略金额时首次发放 10,000，重复初始化不补发", async () => {
    const mock = walletDb(false);
    mock.ledgerReads.push([]);
    const first = await initializeOrgPoints(mock.db, 7, 1);
    const second = await initializeOrgPoints(mock.db, 7, 1);
    expect(first).toEqual({ initialized: true, balance: 10_000 });
    expect(second).toEqual({ initialized: false, balance: 10_000 });
    expect(mock.pool.balance).toBe(10_000);
    expect(mock.ledger).toHaveLength(1);
    expect(mock.ledger[0]).toMatchObject({ amount: 10_000, type: "initial_grant", eventKey: "org:init:7" });
  });

  it("管理员可从本机构池分给本人，双边各记一笔且总余额不变", async () => {
    const mock = walletDb(true);
    mock.ledgerReads.push([], []);
    const result = await allocateOrgPoints(mock.db, { orgId: 7, actorUserId: 23, tutorUserId: 23, amount: 1000 });
    expect(result).toMatchObject({ ok: true, balance: 1000, poolBalance: 9000 });
    expect(mock.pool.balance).toBe(9000);
    expect(mock.admin.balance).toBe(1000);
    expect(mock.ledger.map((entry) => entry.amount)).toEqual([-1000, 1000]);
    expect(mock.pool.balance + mock.admin.balance).toBe(10_000);
  });
});
