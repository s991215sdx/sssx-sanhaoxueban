import * as cookie from "cookie";
import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { Session } from "@contracts/constants";
import { organizations, users } from "@db/schema";
import { getSessionCookieOptions } from "./lib/cookies";
import { createRouter, authedQuery, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { signSessionToken } from "./kimi/session";
import { env } from "./lib/env";

/* ── 密码散列（scrypt + 随机盐，格式 s1$salt$hash） ─────────────── */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 32).toString("hex");
  return `s1$${salt}$${hash}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [v, salt, hash] = stored.split("$");
  if (v !== "s1" || !salt || !hash) return false;
  const calc = scryptSync(password, salt, 32);
  const expect = Buffer.from(hash, "hex");
  return calc.length === expect.length && timingSafeEqual(calc, expect);
}

/* ── 简单限流：同一手机号 10 分钟内最多尝试 10 次 ──────────────── */
const attempts = new Map<string, { count: number; resetAt: number }>();
function checkThrottle(phone: string) {
  const now = Date.now();
  const rec = attempts.get(phone);
  if (rec && now < rec.resetAt) {
    if (rec.count >= 10) {
      throw new TRPCError({
        code: "TOO_MANY_REQUESTS",
        message: "尝试太多次啦，休息 10 分钟再来",
      });
    }
    rec.count++;
  } else {
    attempts.set(phone, { count: 1, resetAt: now + 10 * 60 * 1000 });
  }
}

const PHONE_RE = /^1[3-9]\d{9}$/;

export function setSessionCookie(ctx: { req: Request; resHeaders: Headers }, token: string) {
  const opts = getSessionCookieOptions(ctx.req.headers);
  ctx.resHeaders.append(
    "set-cookie",
    cookie.serialize(Session.cookieName, token, {
      httpOnly: opts.httpOnly,
      path: opts.path,
      sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
      secure: opts.secure,
      maxAge: Session.maxAgeMs / 1000,
    }),
  );
}

export const authRouter = createRouter({
  me: authedQuery.query(async (opts) => {
    const u = opts.ctx.user!;
    const { passwordHash: _ph, ...safe } = u;
    /* V59 SaaS：带出机构品牌信息（登录后全站展示机构商标/名称）；平台超管 org 为 null */
    if (u.orgId == null) return { ...safe, org: null };
    const db = getDb();
    const org = await db.query.organizations.findFirst({ where: eq(organizations.id, u.orgId) });
    return {
      ...safe,
      org: org ? { name: org.name, brandName: org.brandName, logoUrl: org.logoUrl, active: org.active } : null,
    };
  }),

  /**
   * 手机号 + 密码登录。v49 起为邀请制：不再自动注册——
   * 未注册的手机号需先扫描管理员发放的「注册邀请二维码」（invite.registerWithInvite 注册）。
   */
  loginPhone: publicQuery
    .input((v: unknown) => v as { phone: string; password: string })
    .mutation(async ({ ctx, input }) => {
      const phone = (input.phone ?? "").trim();
      const password = input.password ?? "";
      if (!PHONE_RE.test(phone)) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "手机号格式不对，检查一下" });
      }
      if (password.length < 6 || password.length > 64) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "密码需要 6～64 个字符" });
      }
      checkThrottle(phone);

      const db = getDb();
      const found = await db.select().from(users).where(eq(users.phone, phone)).limit(1);
      const user = found[0];

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "这个手机号还没有注册——三好学伴采用邀请制，请扫描管理员发放的注册二维码完成注册后再登录",
        });
      }
      if (!user.passwordHash || !verifyPassword(password, user.passwordHash)) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "密码不对，再想想～" });
      }

      await db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, user.id));
      const token = await signSessionToken({ unionId: user.unionId, clientId: env.appId });
      setSessionCookie(ctx, token);
      return { ok: true, isNewUser: false, name: user.name };
    }),

  // 注意：logout 用公开过程——即使会话过期也要能清掉 cookie，否则前端会出现「退不出」。
  logout: publicQuery.mutation(async ({ ctx }) => {
    const opts = getSessionCookieOptions(ctx.req.headers);
    ctx.resHeaders.append(
      "set-cookie",
      cookie.serialize(Session.cookieName, "", {
        httpOnly: opts.httpOnly,
        path: opts.path,
        sameSite: opts.sameSite?.toLowerCase() as "lax" | "none",
        secure: opts.secure,
        maxAge: 0,
      }),
    );
    return { success: true };
  }),
});
