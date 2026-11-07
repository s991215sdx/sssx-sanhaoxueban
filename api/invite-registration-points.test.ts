import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { inviteRegistrations, organizations, orgPointAccounts, orgPointLedger, studentProfile, studentTutor, users } from "@db/schema";
import { DEFAULT_CAMPUS_USER_LIMIT, CAMPUS_USER_LIMIT_OPTIONS, campusUserLimit } from "@contracts/edition";
import { DEFAULT_ORG_POINTS, inviteAssessmentQuote } from "@contracts/orgService";
import { createInviteRegistration, debitInviteRegistrationTx, duplicateInviteEntry, type InviteRegistrationChannel } from "./inviteRegistration";
import { debitPoints, type PointDb, type PointTx } from "./orgPoints";

const channel = (overrides: Partial<InviteRegistrationChannel> = {}): InviteRegistrationChannel => ({
  id: 41, code: "v254testcode", name: "积分回归渠道", orgId: 7, tutorId: 9, createdBy: 9,
  assessmentAccess: true, assessmentKinds: ["mbti", "disc", "e3"], ...overrides,
});

describe("渠道注册计价", () => {
  it("未绑套餐也明确包含默认学科四维 10 积分", () => {
    expect(inviteAssessmentQuote(false, [])).toMatchObject({ total: 10, kinds: ["subject4d"] });
    expect(inviteAssessmentQuote(true, [])).toMatchObject({ total: 10, kinds: ["subject4d"] });
  });

  it("MBTI、DISC、家长 DISC 免费，E3 加默认学科四维共 20", () => {
    expect(inviteAssessmentQuote(true, ["mbti", "disc", "discparent"]).total).toBe(10);
    expect(inviteAssessmentQuote(true, ["mbti", "disc", "e3"]).total).toBe(20);
  });

  it("重复 kind、全部测评与 mental 四量表展开都不重复计费", () => {
    expect(inviteAssessmentQuote(true, ["subject4d", "e3", "e3"]).total).toBe(20);
    expect(inviteAssessmentQuote(true, ["all"]).total).toBe(130);
    expect(inviteAssessmentQuote(true, ["mental"]).total).toBe(50);
    expect(inviteAssessmentQuote(true, ["mental", "mentalsdq", "mentalpa", "scl90"]).total).toBe(50);
  });

  it("新机构默认 10,000；已有机构的重复初始化仍由唯一初始化状态防重", () => {
    expect(DEFAULT_ORG_POINTS).toBe(10_000);
    const src = readFileSync("api/orgPoints.ts", "utf8");
    expect(src).toContain("if (pool.initialized) return");
  });
});

/** 带事务快照与机构行锁串行模拟的内存实现；真实 MySQL 并发仍需集成验证。 */
function registrationDb(initialBalance: number, options: { edition?: "org" | "school"; campusUserLimit?: number | null; initialUserCount?: number; walletAvailable?: boolean } = {}) {
  const payer = { id: 9, orgId: 7, role: "tutor", deletedAt: null, inviteReportDefault: true };
  const account = { id: 1, orgId: 7, ownerUserId: 9, balance: initialBalance, initialized: true, createdAt: new Date(), updatedAt: new Date() };
  const org = { id: 7, edition: options.edition ?? "org", settings: options.campusUserLimit == null ? null : { campusUserLimit: options.campusUserLimit } };
  const existingUsers = Array.from({ length: options.initialUserCount ?? 0 }, (_, index) => ({ id: index + 1, unionId: `existing:${index}`, orgId: 7, role: "user" }));
  const state = {
    users: [...existingUsers] as Record<string, unknown>[], profiles: [] as Record<string, unknown>[], tutors: [] as Record<string, unknown>[],
    registrations: [] as Record<string, unknown>[], ledger: [] as Record<string, unknown>[], nextUserId: existingUsers.length + 1,
  };
  const tx = {
    select: (selection: Record<string, unknown> = {}) => ({
      from: (table: unknown) => ({
        where: () => {
          if (table === organizations) return { for: async () => [org] };
          if (table === users) {
            const rows = "c" in selection
              ? [{ c: state.users.filter((row) => row.orgId === 7 && row.role === "user").length }]
              : [payer];
            return {
              limit: async () => rows,
              then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => Promise.resolve(rows).then(resolve, reject),
            };
          }
          if (table === orgPointLedger) return { limit: async () => [...state.ledger] };
          if (table === orgPointAccounts) {
            if (options.walletAvailable === false) throw new Error("校园版不应读取积分钱包");
            return { orderBy: () => ({ for: async () => [account] }) };
          }
          throw new Error("unexpected select table");
        },
      }),
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
      values: (values: Record<string, unknown>) => {
        const execute = async () => {
          if (table === users) {
            if (state.users.some((row) => row.unionId === values.unionId)) throw Object.assign(new Error("Duplicate entry"), { code: "ER_DUP_ENTRY" });
            const id = state.nextUserId++;
            state.users.push({ role: "user", ...values, id });
            return [{ id }];
          }
          if (table === studentProfile) { state.profiles.push(values); return []; }
          if (table === studentTutor) { state.tutors.push(values); return []; }
          if (table === inviteRegistrations) { state.registrations.push(values); return []; }
          if (table === orgPointLedger) {
            const id = state.ledger.length + 1;
            state.ledger.push({ ...values, id });
            return [{ id }];
          }
          throw new Error("unexpected insert table");
        };
        return {
          $returningId: execute,
          then: (resolve: (value: unknown) => unknown, reject: (reason: unknown) => unknown) => execute().then(resolve, reject),
        };
      },
    }),
  };
  const snapshot = () => ({
    users: structuredClone(state.users), profiles: structuredClone(state.profiles), tutors: structuredClone(state.tutors),
    registrations: structuredClone(state.registrations), ledger: structuredClone(state.ledger), nextUserId: state.nextUserId,
    balance: account.balance,
  });
  let queue = Promise.resolve();
  const db = {
    transaction: (callback: (tx: PointTx) => unknown) => {
      const execute = async () => {
        const before = snapshot();
        try { return await callback(tx as unknown as PointTx); }
        catch (error) {
          Object.assign(state, { users: before.users, profiles: before.profiles, tutors: before.tutors,
            registrations: before.registrations, ledger: before.ledger, nextUserId: before.nextUserId });
          account.balance = before.balance;
          throw error;
        }
      };
      const result = queue.then(execute);
      queue = result.then(() => undefined, () => undefined);
      return result;
    },
  };
  return { db: db as unknown as PointDb, tx: tx as unknown as PointTx, state, account };
}

describe("渠道注册积分事务（内存模拟）", () => {
  const input = { unionId: "campus:41:测试学生:1班", phone: "", passwordHash: "hash", name: "测试学生", campus: true, grade: "高一", className: "1班" };

  it("注册成功写入完整档案、归属、渠道记录并只扣一笔 20 积分", async () => {
    const mock = registrationDb(100);
    const result = await createInviteRegistration(mock.db, channel(), input);
    expect(result.userId).toBe(1);
    expect(result.billing).toMatchObject({ credits: 20, billed: true });
    expect(mock.account.balance).toBe(80);
    expect(mock.state.users).toHaveLength(1);
    expect(mock.state.profiles).toHaveLength(1);
    expect(mock.state.tutors).toHaveLength(1);
    expect(mock.state.registrations).toHaveLength(1);
    expect(mock.state.ledger).toHaveLength(1);
    expect(mock.state.ledger[0]).toMatchObject({ amount: -20, eventKey: "invite:channel:41:user:1", kind: "invite_assessment", studentUserId: 1 });
  });

  it("同一扣费事件重试返回原流水，不再次扣款", async () => {
    const mock = registrationDb(100);
    await debitInviteRegistrationTx(mock.tx, channel(), 1);
    await debitInviteRegistrationTx(mock.tx, channel(), 1);
    expect(mock.account.balance).toBe(80);
    expect(mock.state.ledger).toHaveLength(1);
  });

  it("余额不足时整个注册回滚，不留下用户、档案、渠道记录或流水", async () => {
    const mock = registrationDb(10);
    await expect(createInviteRegistration(mock.db, channel(), input)).rejects.toThrow("积分不足");
    expect(mock.account.balance).toBe(10);
    expect(mock.state.users).toHaveLength(0);
    expect(mock.state.profiles).toHaveLength(0);
    expect(mock.state.tutors).toHaveLength(0);
    expect(mock.state.registrations).toHaveLength(0);
    expect(mock.state.ledger).toHaveLength(0);
  });

  it("唯一键竞争只有一个新用户和一笔扣费，失败事务不回滚胜者的数据", async () => {
    const mock = registrationDb(100);
    const results = await Promise.allSettled([
      createInviteRegistration(mock.db, channel(), input),
      createInviteRegistration(mock.db, channel(), input),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected") as PromiseRejectedResult;
    expect(duplicateInviteEntry(rejected.reason)).toBe(true);
    expect(mock.account.balance).toBe(80);
    expect(mock.state.users).toHaveLength(1);
    expect(mock.state.registrations).toHaveLength(1);
    expect(mock.state.ledger).toHaveLength(1);
  });

  it("无机构历史公共渠道不计机构积分", async () => {
    const mock = registrationDb(100);
    const result = await debitInviteRegistrationTx(mock.tx, channel({ orgId: null, tutorId: null, createdBy: 1 }), 1);
    expect(result).toMatchObject({ credits: 0, billed: false, reason: "platform_channel" });
    expect(mock.account.balance).toBe(100);
  });

  it("校园版没有积分钱包也注册成功，绝不扣积分", async () => {
    const mock = registrationDb(0, { edition: "school", campusUserLimit: 1, walletAvailable: false });
    const result = await createInviteRegistration(mock.db, channel(), input);
    expect(result.billing).toMatchObject({ credits: 0, billed: false, reason: "school_edition" });
    expect(mock.state.users).toHaveLength(1);
    expect(mock.state.registrations).toHaveLength(1);
    expect(mock.state.ledger).toHaveLength(0);
    expect(mock.account.balance).toBe(0);
  });

  it("存量未配置上限的校园机构继续免积分注册", async () => {
    const mock = registrationDb(0, { edition: "school", walletAvailable: false });
    const result = await createInviteRegistration(mock.db, channel(), input);
    expect(result.billing.reason).toBe("school_edition");
    expect(mock.state.users).toHaveLength(1);
    expect(mock.state.ledger).toHaveLength(0);
  });

  it("达到校园上限时整笔回滚，不留下新用户、档案、渠道记录或积分流水", async () => {
    const mock = registrationDb(0, { edition: "school", campusUserLimit: 1, initialUserCount: 1, walletAvailable: false });
    await expect(createInviteRegistration(mock.db, channel(), input)).rejects.toThrow("已达 1 人上限");
    expect(mock.state.users).toHaveLength(1);
    expect(mock.state.profiles).toHaveLength(0);
    expect(mock.state.tutors).toHaveLength(0);
    expect(mock.state.registrations).toHaveLength(0);
    expect(mock.state.ledger).toHaveLength(0);
  });

  it("校园不同身份同时注册最多一人成功，且无积分流水", async () => {
    const mock = registrationDb(0, { edition: "school", campusUserLimit: 1, walletAvailable: false });
    const results = await Promise.allSettled([
      createInviteRegistration(mock.db, channel(), input),
      createInviteRegistration(mock.db, channel(), { ...input, unionId: "campus:41:另一学生:1班", name: "另一学生" }),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(1);
    expect(mock.state.users).toHaveLength(1);
    expect(mock.state.registrations).toHaveLength(1);
    expect(mock.state.ledger).toHaveLength(0);
    expect(readFileSync("api/inviteRegistration.ts", "utf8")).toContain('.for("update")');
  });

  it("统一扣费入口也拒绝校园扣费，旧测评提交路径无法绕过", async () => {
    const mock = registrationDb(0, { edition: "school", walletAvailable: false });
    await expect(debitPoints(mock.tx, {
      orgId: 7, payerUserId: 9, actorUserId: 9, amount: 10,
      eventKey: "school-must-not-debit", studentUserId: 1, kind: "e3",
    })).resolves.toBeUndefined();
    expect(mock.state.ledger).toHaveLength(0);
    expect(mock.account.balance).toBe(0);
  });
});

describe("校园注册人数配置", () => {
  it("新开校园默认 200，可选档位完整，存量未配置仍不限", () => {
    expect(DEFAULT_CAMPUS_USER_LIMIT).toBe(200);
    expect(CAMPUS_USER_LIMIT_OPTIONS).toEqual([200, 500, 1000, 2000, 5000]);
    expect(campusUserLimit({ campusUserLimit: 500 })).toBe(500);
    expect(campusUserLimit(null)).toBeNull();
    expect(campusUserLimit({})).toBeNull();
    expect(campusUserLimit({ campusUserLimit: 0 })).toBeNull();
    expect(campusUserLimit({ campusUserLimit: 1.5 })).toBeNull();
  });
});
