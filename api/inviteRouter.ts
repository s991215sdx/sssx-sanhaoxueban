import { randomBytes } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { desc, eq, or, sql } from "drizzle-orm";
import { INVITE_CHANNEL_KINDS, INVITE_GRADES, normalizeInviteCode } from "@contracts/invite";
import { DEFAULT_INVITE_MODULES } from "@contracts/studentModules";
import { inviteChannels, inviteRegistrations, studentProfile, users } from "@db/schema";
import { createRouter, publicQuery, tutorQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { hashPassword, setSessionCookie } from "./auth-router";
import { signSessionToken } from "./kimi/session";
import { env } from "./lib/env";

const PHONE_RE = /^1[3-9]\d{9}$/;
/* 渠道码字母表：去掉 0/o、1/l/i 等易混淆字符，10 位约 2.8e15 空间 */
const CODE_ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

function newInviteCode(): string {
  const bytes = randomBytes(10);
  let out = "";
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

function badRequest(message: string): never {
  throw new TRPCError({ code: "BAD_REQUEST", message });
}

export const inviteRouter = createRouter({
  /** 管理员/伴学师：新建注册邀请渠道（返回含渠道码的记录，前端据此生成二维码）。伴学师建的码归属自己。 */
  createChannel: tutorQuery
    .input((v: unknown) => v as { name: string; kind: string; note?: string })
    .mutation(async ({ ctx, input }) => {
      const name = (input.name ?? "").trim();
      if (name.length < 2 || name.length > 64) badRequest("渠道名 2～64 个字，比如「地推-万达广场点位」");
      const kind = (INVITE_CHANNEL_KINDS as readonly string[]).includes(input.kind) ? input.kind : "其他";
      const note = (input.note ?? "").trim().slice(0, 255) || null;
      const tutorId = ctx.user.role === "tutor" ? ctx.user.id : null;
      const db = getDb();
      for (let i = 0; i < 5; i++) {
        const code = newInviteCode();
        try {
          await db.insert(inviteChannels).values({ code, name, kind, note, tutorId, createdBy: ctx.user.id });
          const row = (await db.select().from(inviteChannels).where(eq(inviteChannels.code, code)).limit(1))[0];
          if (row) return row;
        } catch {
          /* 渠道码极小概率撞车：换码重试 */
        }
      }
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "生成渠道码失败，请再试一次" });
    }),

  /** 管理员看全部渠道；伴学师只看自己创建的（含各渠道累计注册数 + 最近 50 条注册记录）。 */
  channels: tutorQuery.query(async ({ ctx }) => {
    const db = getDb();
    const where =
      ctx.user.role === "admin"
        ? undefined
        : or(eq(inviteChannels.tutorId, ctx.user.id), eq(inviteChannels.createdBy, ctx.user.id));
    const [channels, counts, recent] = await Promise.all([
      db.select().from(inviteChannels).where(where).orderBy(desc(inviteChannels.createdAt)),
      db
        .select({ channelId: inviteRegistrations.channelId, c: sql<number>`count(*)` })
        .from(inviteRegistrations)
        .groupBy(inviteRegistrations.channelId),
      db.select().from(inviteRegistrations).orderBy(desc(inviteRegistrations.createdAt)).limit(50),
    ]);
    const totalMap = new Map(counts.map((r) => [Number(r.channelId), Number(r.c)]));
    const mine = new Set(channels.map((c) => c.id));
    return {
      channels: channels.map((c) => ({ ...c, registrations: totalMap.get(c.id) ?? 0 })),
      recent: ctx.user.role === "admin" ? recent : recent.filter((r) => mine.has(r.channelId)),
    };
  }),

  /** 管理员/伴学师：停用/启用渠道——停用后对应二维码立即失效，不再接受新注册。伴学师只能动自己的码。 */
  setChannelActive: tutorQuery
    .input((v: unknown) => v as { id: number; active: boolean })
    .mutation(async ({ input, ctx }) => {
      const db = getDb();
      if (ctx.user.role !== "admin") {
        const ch = (await db.select().from(inviteChannels).where(eq(inviteChannels.id, input.id)).limit(1))[0];
        if (!ch || (ch.tutorId !== ctx.user.id && ch.createdBy !== ctx.user.id)) {
          badRequest("这张二维码不在你名下");
        }
      }
      await db.update(inviteChannels).set({ active: !!input.active }).where(eq(inviteChannels.id, input.id));
      return { ok: true as const };
    }),

  /** 公开：扫码落地页校验渠道码（只回渠道名与类型，不泄露任何其他信息）。 */
  channelInfo: publicQuery
    .input((v: unknown) => v as { code: string })
    .query(async ({ input }) => {
      const code = normalizeInviteCode(input.code ?? "");
      if (!code) badRequest("二维码无效");
      const db = getDb();
      const ch = (await db.select().from(inviteChannels).where(eq(inviteChannels.code, code)).limit(1))[0];
      if (!ch) throw new TRPCError({ code: "NOT_FOUND", message: "二维码无效，请确认是否扫对了" });
      if (!ch.active) badRequest("这张二维码已停用，请联系发码的工作人员换一张新的");
      return { name: ch.name, kind: ch.kind };
    }),

  /**
   * 公开：扫码注册（邀请制唯一注册入口）。
   * 校验渠道码 → 录基础信息（家长称呼/学生姓名/年级/手机号/密码）→ 建账号 + 预填档案 → 直接登录。
   * 注册记录绑定渠道，用于渠道效果统计；手机号已注册则提示直接登录。
   */
  registerWithInvite: publicQuery
    .input(
      (v: unknown) =>
        v as { code: string; parentName: string; studentName: string; grade: string; phone: string; password: string },
    )
    .mutation(async ({ ctx, input }) => {
      const code = normalizeInviteCode(input.code ?? "");
      const parentName = (input.parentName ?? "").trim().slice(0, 64);
      const studentName = (input.studentName ?? "").trim().slice(0, 64);
      const grade = (input.grade ?? "").trim();
      const phone = (input.phone ?? "").trim();
      const password = input.password ?? "";

      if (!parentName) badRequest("请填写家长称呼，比如「乐乐妈妈」");
      if (!studentName) badRequest("请填写孩子姓名");
      if (!(INVITE_GRADES as readonly string[]).includes(grade)) badRequest("请选择孩子年级");
      if (!PHONE_RE.test(phone)) badRequest("手机号格式不对，检查一下");
      if (password.length < 6 || password.length > 64) badRequest("密码需要 6～64 个字符");

      const db = getDb();
      const ch = (await db.select().from(inviteChannels).where(eq(inviteChannels.code, code)).limit(1))[0];
      if (!ch) throw new TRPCError({ code: "NOT_FOUND", message: "二维码无效，请确认是否扫对了" });
      if (!ch.active) badRequest("这张二维码已停用，请联系发码的工作人员换一张新的");

      const existing = await db.select({ id: users.id }).from(users).where(eq(users.phone, phone)).limit(1);
      if (existing[0]) badRequest("这个手机号已经注册过了，直接去登录页登录就好");

      const passwordHash = hashPassword(password);
      let userId = 0;
      try {
        const [{ id }] = await db
          .insert(users)
          .values({ unionId: `phone:${phone}`, phone, passwordHash, name: studentName, lastSignInAt: new Date() })
          .$returningId();
        userId = Number(id);
      } catch {
        badRequest("这个手机号已经注册过了，直接去登录页登录就好");
      }
      /* 预填学习档案（姓名+年级；默认只开测评中心；伴学师渠道自动挂到该伴学师名下）。
         注册时已录基础信息 → onboarded=true，登录后直达测评中心 */
      try {
        await db.insert(studentProfile).values({
          userId,
          name: studentName,
          grade,
          enabledModules: DEFAULT_INVITE_MODULES,
          tutorId: ch.tutorId ?? null,
          onboarded: true,
        });
      } catch {
        /* 档案建失败不阻断注册，welcome 引导会兜底补齐 */
      }
      await db.insert(inviteRegistrations).values({
        channelId: ch.id,
        channelCode: ch.code,
        parentName,
        studentName,
        phone,
        grade,
        userId,
      });

      const token = await signSessionToken({ unionId: `phone:${phone}`, clientId: env.appId });
      setSessionCookie(ctx, token);
      return { ok: true as const, name: studentName };
    }),
});
