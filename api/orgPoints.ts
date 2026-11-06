import { randomUUID } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, asc, desc, eq } from "drizzle-orm";
import { orgPointAccounts, orgPointLedger } from "@db/schema";
import { users } from "@db/schema";
import { DEFAULT_ORG_POINTS } from "@contracts/orgService";
import type { getDb } from "./queries/connection";

export type PointDb = ReturnType<typeof getDb>;
export type PointTx = Parameters<Parameters<PointDb["transaction"]>[0]>[0];
export type PointAccount = typeof orgPointAccounts.$inferSelect;

export function ledgerDelta(account: Pick<PointAccount, "balance">, delta: number): number {
  if (!Number.isSafeInteger(delta) || delta === 0) throw new TRPCError({ code: "BAD_REQUEST", message: "积分变动必须是非零整数" });
  const next = account.balance + delta;
  if (!Number.isSafeInteger(next) || next < 0) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "个人可用积分不足，请联系机构管理员分配" });
  }
  return next;
}

async function lockAccounts(tx: PointTx, orgId: number, ownerIds: number[]): Promise<Map<number, PointAccount>> {
  const rows = await tx.select().from(orgPointAccounts)
    .where(eq(orgPointAccounts.orgId, orgId)).orderBy(asc(orgPointAccounts.ownerUserId)).for("update");
  const wanted = new Set(ownerIds);
  return new Map(rows.filter((r) => wanted.has(r.ownerUserId)).map((r) => [r.ownerUserId, r]));
}

async function ensureAccount(db: PointDb, orgId: number, ownerUserId: number): Promise<void> {
  await db.insert(orgPointAccounts).values({ orgId, ownerUserId, balance: 0, initialized: ownerUserId === 0 ? false : true })
    .onDuplicateKeyUpdate({ set: { ownerUserId } });
}

type EntryMeta = {
  activityId?: number | null;
  assignmentId?: number | null;
  studentUserId?: number | null;
  kind?: string | null;
  reason?: string;
  relatedAccountId?: number | null;
  relatedLedgerId?: number | null;
};

/** 调用方必须已锁定账户。余额、账户与流水在同一事务内更新。 */
export async function writeLedger(
  tx: PointTx,
  account: PointAccount,
  delta: number,
  input: { actorUserId: number; type: string; eventGroup: string; eventKey: string } & EntryMeta,
): Promise<typeof orgPointLedger.$inferSelect> {
  const existing = (await tx.select().from(orgPointLedger).where(eq(orgPointLedger.eventKey, input.eventKey)).limit(1))[0];
  if (existing) return existing;
  const after = ledgerDelta(account, delta);
  await tx.update(orgPointAccounts).set({ balance: after }).where(and(eq(orgPointAccounts.id, account.id), eq(orgPointAccounts.balance, account.balance)));
  account.balance = after;
  const [row] = await tx.insert(orgPointLedger).values({
    orgId: account.orgId, accountId: account.id, ownerUserId: account.ownerUserId,
    actorUserId: input.actorUserId, eventGroup: input.eventGroup, eventKey: input.eventKey,
    type: input.type, amount: delta, balanceBefore: after - delta, balanceAfter: after,
    relatedAccountId: input.relatedAccountId ?? null, relatedLedgerId: input.relatedLedgerId ?? null,
    activityId: input.activityId ?? null, assignmentId: input.assignmentId ?? null,
    studentUserId: input.studentUserId ?? null, kind: input.kind ?? null, reason: input.reason ?? "",
  }).$returningId();
  return { ...input, id: row.id, orgId: account.orgId, accountId: account.id, ownerUserId: account.ownerUserId,
    amount: delta, balanceBefore: after - delta, balanceAfter: after,
    relatedAccountId: input.relatedAccountId ?? null, relatedLedgerId: input.relatedLedgerId ?? null,
    activityId: input.activityId ?? null, assignmentId: input.assignmentId ?? null,
    studentUserId: input.studentUserId ?? null, kind: input.kind ?? null, reason: input.reason ?? "", createdAt: new Date() };
}

/** 只有首次初始化发放；重复调用、资料编辑或刷新绝不再次赠送。 */
export async function initializeOrgPoints(db: PointDb, orgId: number, actorUserId: number, amount = DEFAULT_ORG_POINTS) {
  if (!Number.isSafeInteger(amount) || amount < 0 || amount > 100_000_000) throw new TRPCError({ code: "BAD_REQUEST", message: "初始积分须为 0～1 亿的整数" });
  await ensureAccount(db, orgId, 0);
  return db.transaction(async (tx) => {
    const accounts = await lockAccounts(tx, orgId, [0]);
    const pool = accounts.get(0)!;
    if (pool.initialized) return { initialized: false as const, balance: pool.balance };
    const eventKey = `org:init:${orgId}`;
    if (amount > 0) await writeLedger(tx, pool, amount, { actorUserId, type: "initial_grant", eventGroup: eventKey, eventKey, reason: "机构首次初始化积分" });
    await tx.update(orgPointAccounts).set({ initialized: true }).where(eq(orgPointAccounts.id, pool.id));
    return { initialized: true as const, balance: pool.balance };
  });
}

export async function allocateOrgPoints(db: PointDb, input: { orgId: number; actorUserId: number; tutorUserId: number; amount: number }) {
  if (input.actorUserId === input.tutorUserId) throw new TRPCError({ code: "FORBIDDEN", message: "不能给自己分配积分" });
  if (!Number.isSafeInteger(input.amount) || input.amount <= 0 || input.amount > 10_000_000) throw new TRPCError({ code: "BAD_REQUEST", message: "分配积分须为 1～1000 万的整数" });
  const [recipient] = await db.select({ id: users.id, orgId: users.orgId, role: users.role, deletedAt: users.deletedAt }).from(users).where(eq(users.id, input.tutorUserId)).limit(1);
  if (!recipient || recipient.deletedAt || recipient.orgId !== input.orgId || !["tutor", "admin"].includes(recipient.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "只能分配给本机构在职伴学师或管理员" });
  }
  await ensureAccount(db, input.orgId, input.tutorUserId);
  return db.transaction(async (tx) => {
    const accounts = await lockAccounts(tx, input.orgId, [0, input.tutorUserId]);
    const pool = accounts.get(0);
    const target = accounts.get(input.tutorUserId);
    if (!pool?.initialized || !target) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "请由平台超管先初始化本机构积分" });
    const eventGroup = `allocation:${randomUUID()}`;
    await writeLedger(tx, pool, -input.amount, { actorUserId: input.actorUserId, type: "allocation_out", eventGroup, eventKey: `${eventGroup}:out`, relatedAccountId: target.id, reason: "分配给伴学师" });
    await writeLedger(tx, target, input.amount, { actorUserId: input.actorUserId, type: "allocation_in", eventGroup, eventKey: `${eventGroup}:in`, relatedAccountId: pool.id, reason: "机构分配积分" });
    return { ok: true as const, balance: target.balance, poolBalance: pool.balance };
  });
}

export async function adjustOrgPoints(db: PointDb, input: { orgId: number; actorUserId: number; delta: number; reason: string }) {
  if (!input.reason.trim()) throw new TRPCError({ code: "BAD_REQUEST", message: "调整积分必须填写原因" });
  await ensureAccount(db, input.orgId, 0);
  return db.transaction(async (tx) => {
    const pool = (await lockAccounts(tx, input.orgId, [0])).get(0)!;
    if (!pool.initialized) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "该机构尚未初始化积分" });
    const eventKey = `org:adjust:${randomUUID()}`;
    await writeLedger(tx, pool, input.delta, { actorUserId: input.actorUserId, type: "platform_adjustment", eventGroup: eventKey, eventKey, reason: input.reason.trim() });
    return { ok: true as const, balance: pool.balance };
  });
}

export async function debitPoints(tx: PointTx, input: { orgId: number; payerUserId: number; actorUserId: number; amount: number; eventKey: string } & EntryMeta): Promise<void> {
  if (input.amount === 0) return;
  const payer = (await lockAccounts(tx, input.orgId, [input.payerUserId])).get(input.payerUserId);
  if (!payer) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "伴学师暂无积分钱包，请联系机构管理员分配" });
  await writeLedger(tx, payer, -input.amount, { ...input, actorUserId: input.actorUserId, type: "assessment_debit", eventGroup: input.eventKey });
}

/** 退款只能沿原扣费流水退回原钱包；重复取消命中唯一事件键，不二次入账。 */
export async function refundOriginalDebitTx(tx: PointTx, input: { eventKey: string; actorUserId: number; reason: string }) {
  const original = (await tx.select().from(orgPointLedger).where(eq(orgPointLedger.eventKey, input.eventKey)).limit(1))[0];
  if (!original || original.type !== "assessment_debit") throw new TRPCError({ code: "NOT_FOUND", message: "未找到原扣费流水" });
  const [oldRefund] = await tx.select({ id: orgPointLedger.id }).from(orgPointLedger).where(eq(orgPointLedger.eventKey, `refund:${original.eventKey}`)).limit(1);
  const accounts = await lockAccounts(tx, original.orgId, [original.ownerUserId]);
  const payer = accounts.get(original.ownerUserId);
  if (!payer) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "原积分钱包不存在，无法退款" });
  if (oldRefund) return { ok: true as const, refunded: false as const, balance: payer.balance };
  const eventKey = `refund:${original.eventKey}`;
  await writeLedger(tx, payer, -original.amount, { actorUserId: input.actorUserId, type: "assessment_refund", eventGroup: original.eventGroup, eventKey,
    relatedLedgerId: original.id, activityId: original.activityId, assignmentId: original.assignmentId, studentUserId: original.studentUserId, kind: original.kind, reason: input.reason });
  return { ok: true as const, refunded: true as const, balance: payer.balance };
}

export async function refundOriginalDebit(db: PointDb, input: { eventKey: string; actorUserId: number; reason: string }) {
  return db.transaction((tx) => refundOriginalDebitTx(tx, input));
}

export async function pointOverview(db: PointDb, orgId: number) {
  const accounts = await db.select({ account: orgPointAccounts, name: users.name, role: users.role }).from(orgPointAccounts)
    .leftJoin(users, eq(orgPointAccounts.ownerUserId, users.id)).where(eq(orgPointAccounts.orgId, orgId)).orderBy(asc(orgPointAccounts.ownerUserId));
  const ledger = await db.select().from(orgPointLedger).where(eq(orgPointLedger.orgId, orgId)).orderBy(desc(orgPointLedger.id)).limit(150);
  const pool = accounts.find((r) => r.account.ownerUserId === 0)?.account;
  return {
    initialized: !!pool?.initialized,
    poolBalance: pool?.balance ?? 0,
    totalBalance: accounts.reduce((s, r) => s + r.account.balance, 0),
    accounts: accounts.map((r) => ({ ...r.account, name: r.account.ownerUserId === 0 ? "机构未分配池" : (r.name ?? `用户 ${r.account.ownerUserId}`), role: r.role })),
    ledger,
  };
}

export async function walletBalance(db: PointDb, orgId: number, ownerUserId: number) {
  const [account] = await db.select().from(orgPointAccounts).where(and(eq(orgPointAccounts.orgId, orgId), eq(orgPointAccounts.ownerUserId, ownerUserId))).limit(1);
  return { balance: account?.balance ?? 0, initialized: !!account };
}
