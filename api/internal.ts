/**
 * v158：一体通（CRM）对接内部接口——仅服务对服务调用，HMAC 签名鉴权 + 频率限制。
 * ① POST /api/internal/sssx/student-search：学生档案搜索（姓名/手机号片段，最多 20 条，手机号打码只留后 4 位）
 * ② GET  /sso/sssx?ticket=xxx：ticket 兑换 SSO 短会话（调一体通校验接口）
 *    - 学生级 ticket：种 10 分钟 cookie 后 302 到学员详情（v158，逻辑不变）
 *    - 用户级 ticket（v168，mode=user）：按手机号匹配员工账号（伴学师/管理员），种 8 小时登录态后 302 到三好首页
 * 鉴权头约定（与一体通对齐）：
 *   X-SSSX-Key: <共享密钥>（= .env 的 SSSX_INTERNAL_KEY，私发不落库）
 *   X-SSSX-Timestamp: Unix 秒（与服务器偏差 >300s 拒绝）
 *   X-SSSX-Sign: hex(HMAC_SHA256(密钥, `${X-SSSX-Key}\n${X-SSSX-Timestamp}\n${原始请求体}`))，小写
 */
import type { Context } from "hono";
import { getConnInfo } from "@hono/node-server/conninfo";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq, inArray, isNull, like, or } from "drizzle-orm";
import { setCookie } from "hono/cookie";
import { assessmentResults, studentProfile, users } from "@db/schema";
import { getDb } from "./queries/connection";
import { env } from "./lib/env";
import { getSessionCookieOptions } from "./lib/cookies";
import { SsoSession, Session } from "@contracts/constants";
import { createSsoSession } from "./ssoSessions";
import { signSessionToken } from "./kimi/session";

/* ------------------------------- 鉴权与限流 ------------------------------- */

function verifyInternalSign(key: string, ts: string, rawBody: string, sign: string): boolean {
  const secret = env.sssxInternalKey;
  if (!secret || key !== secret) return false;
  const t = Number(ts);
  if (!Number.isFinite(t) || Math.abs(Date.now() / 1000 - t) > 300) return false;
  const expect = createHmac("sha256", secret).update(`${key}\n${ts}\n${rawBody}`).digest("hex");
  const got = String(sign).trim().toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(got)) return false;
  return timingSafeEqual(Buffer.from(expect), Buffer.from(got));
}

/** 单 IP 滑动窗口限流（默认 60s 内 30 次）。 */
const hitLog = new Map<string, number[]>();
function rateLimited(ip: string, max = 30, windowMs = 60_000): boolean {
  const now = Date.now();
  const arr = (hitLog.get(ip) ?? []).filter((t) => now - t < windowMs);
  const limited = arr.length >= max;
  if (!limited) arr.push(now);
  hitLog.set(ip, arr);
  if (hitLog.size > 5000) {
    for (const [k, v] of hitLog) if (v.length === 0 || now - v[v.length - 1] > windowMs * 2) hitLog.delete(k);
  }
  return limited;
}

/** v162：直连（无反代）时 X-Forwarded-For 为空，回退取 TCP 对端 IP，否则限流会把所有调用方挤在一个桶里。 */
function clientIp(c: Context): string {
  const fwd = (c.req.header("x-forwarded-for") ?? "").split(",")[0].trim();
  if (fwd) return fwd;
  try {
    return getConnInfo(c).remote.address ?? "unknown";
  } catch {
    return "unknown";
  }
}

/** 手机号打码：只留后 4 位，其余用 *（最多 7 个，保持长度可读）。 */
export function maskPhone(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const p = phone.trim();
  if (p.length <= 4) return p;
  return "*".repeat(Math.min(p.length - 4, 7)) + p.slice(-4);
}

/* -------------------------------- ① 档案搜索 -------------------------------- */

export async function internalStudentSearch(c: Context) {
  const ip = clientIp(c);
  const started = Date.now();
  if (!env.sssxInternalKey) {
    return c.json({ error: "internal api not enabled" }, 503);
  }
  if (rateLimited(ip)) {
    console.warn(`[internal-sssx] rate limited ip=${ip}`);
    return c.json({ error: "rate_limited" }, 429);
  }
  const rawBody = await c.req.text();
  const key = c.req.header("x-sssx-key") ?? "";
  const ts = c.req.header("x-sssx-timestamp") ?? "";
  const sign = c.req.header("x-sssx-sign") ?? "";
  if (!verifyInternalSign(key, ts, rawBody, sign)) {
    console.warn(`[internal-sssx] unauthorized ip=${ip}`);
    return c.json({ error: "unauthorized" }, 401);
  }
  let keyword = "";
  try {
    /* v166：宽容解析——先去 BOM（部分 HTTP 客户端会写 UTF-8 BOM，会让 JSON.parse 直接抛错），
       JSON 失败再退 form-encoded（keyword=xxx），两者都不行的 400 里回显请求体片段并记日志，方便联调定位 */
    const text = rawBody.replace(/^﻿/, "");
    const body = JSON.parse(text || "{}") as { keyword?: unknown };
    keyword = typeof body.keyword === "string" ? body.keyword.trim().slice(0, 50) : "";
  } catch {
    const form = new URLSearchParams(rawBody);
    const fk = form.get("keyword");
    if (typeof fk === "string" && fk.trim()) {
      keyword = fk.trim().slice(0, 50);
    } else {
      console.warn(`[internal-sssx] bad_json ip=${ip} body=${JSON.stringify(rawBody.slice(0, 200))}`);
      return c.json({ error: "bad_json", got: rawBody.slice(0, 200) }, 400);
    }
  }
  const students = keyword ? await searchStudents(keyword) : [];
  console.log(`[internal-sssx] search ip=${ip} kw="${keyword}" hits=${students.length} ms=${Date.now() - started}`);
  return c.json({ students });
}

async function searchStudents(keyword: string) {
  const db = getDb();
  const pattern = `%${keyword}%`;
  const rows = await db
    .select({
      id: users.id,
      userName: users.name,
      phone: users.phone,
      profileName: studentProfile.name,
      grade: studentProfile.grade,
    })
    .from(users)
    .leftJoin(studentProfile, eq(studentProfile.userId, users.id))
    .where(
      and(
        eq(users.role, "user"),
        isNull(users.deletedAt),
        or(like(users.name, pattern), like(users.phone, pattern), like(studentProfile.name, pattern)),
      ),
    )
    .orderBy(desc(users.createdAt))
    .limit(20);
  if (rows.length === 0) return [];
  const res = await db
    .select({ userId: assessmentResults.userId, createdAt: assessmentResults.createdAt })
    .from(assessmentResults)
    .where(inArray(assessmentResults.userId, rows.map((r) => r.id)));
  const agg = new Map<number, { count: number; last: Date }>();
  for (const r of res) {
    const a = agg.get(r.userId);
    if (!a) agg.set(r.userId, { count: 1, last: r.createdAt });
    else {
      a.count += 1;
      if (r.createdAt > a.last) a.last = r.createdAt;
    }
  }
  return rows.map((r) => {
    const a = agg.get(r.id);
    return {
      student_id: r.id,
      name: r.profileName ?? r.userName ?? "同学",
      phone_masked: maskPhone(r.phone),
      grade: r.grade ?? null,
      has_assessment: (a?.count ?? 0) > 0,
      last_assessment_at: a ? a.last.toISOString() : null,
    };
  });
}

/* ------------------------------- ② ticket 兑换 ------------------------------- */

const failPage = (reason: string, hint = "请从一体通重新进入。") => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>链接已失效 · 三好学伴</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FAF6EF;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.card{max-width:340px;padding:32px 28px;background:#fff;border-radius:16px;box-shadow:0 8px 30px -12px rgba(12,80,72,.25);text-align:center}
h1{margin:0 0 10px;font-size:17px;color:#1E3530}p{margin:0;font-size:13.5px;color:#5C6B63;line-height:1.7}</style></head>
<body><div class="card"><h1>链接已失效</h1><p>${reason}</p><p style="margin-top:14px">${hint}</p></div></body></html>`;

export async function ssoTicketEntry(c: Context) {
  const ticket = (c.req.query("ticket") ?? "").trim();
  const fail = (reason: string, hint?: string) => c.html(failPage(reason, hint), 403);
  if (!env.yititongTicketUrl) {
    console.error("[sso] YITITONG_TICKET_URL 未配置，拒绝兑换");
    return fail("系统未开通一体通对接");
  }
  if (!ticket || ticket.length > 128) return fail("ticket 缺失或非法");
  let data: { valid?: unknown; mode?: unknown; student_id?: unknown; phone?: unknown; name?: unknown };
  try {
    const resp = await fetch(env.yititongTicketUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ticket }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!resp.ok) {
      console.error(`[sso] ticket 校验接口返回 ${resp.status}`);
      return fail("ticket 校验失败");
    }
    data = (await resp.json()) as typeof data;
  } catch (e) {
    console.error("[sso] ticket 校验接口异常:", e);
    return fail("ticket 校验失败");
  }
  if (data.valid !== true) return fail("ticket 无效、已过期或已被使用");

  /* v168：用户级 ticket（mode=user，无 student_id）——一体通工作台免登进三好后台。
     按手机号匹配员工账号（伴学师/管理员/教务，软删排除），种 8 小时登录态后 302 首页。
     v205：教务（jiaowu）纳入员工角色——否则一体通免登提示「未开通三好学伴权限」。 */
  if (data.mode === "user") {
    const phone = typeof data.phone === "string" ? data.phone.trim() : "";
    if (!/^1[3-9]\d{9}$/.test(phone)) return fail("ticket 内容非法");
    const db = getDb();
    const found = await db
      .select()
      .from(users)
      .where(and(eq(users.phone, phone), inArray(users.role, ["tutor", "admin", "jiaowu"] as const), isNull(users.deletedAt)))
      .orderBy(desc(users.lastSignInAt))
      .limit(1);
    const staff = found[0];
    if (!staff) {
      console.warn(`[sso] 用户级 ticket 未匹配到员工账号 phone=${phone} ip=${clientIp(c)}`);
      return fail("一体通账号未开通三好学伴权限", "如需开通，请联系三好学伴管理员。");
    }
    const token = await signSessionToken({ unionId: staff.unionId, clientId: env.appId });
    await db.update(users).set({ lastSignInAt: new Date() }).where(eq(users.id, staff.id));
    setCookie(c, Session.cookieName, token, { ...getSessionCookieOptions(c.req.raw), maxAge: 8 * 60 * 60 });
    console.log(`[sso] 用户级 ticket 兑换成功 staff=${staff.id}(${staff.role}) ip=${clientIp(c)}`);
    return c.redirect("/");
  }

  /* 学生级 ticket（v158 逻辑不变）：种 10 分钟 SSO 短会话后 302 到学员详情 */
  const studentId = Number(data.student_id);
  if (!Number.isInteger(studentId) || studentId <= 0) return fail("ticket 内容非法");
  const token = createSsoSession(studentId, typeof data.name === "string" ? data.name : "");
  setCookie(c, SsoSession.cookieName, token, {
    ...getSessionCookieOptions(c.req.raw),
    maxAge: Math.floor(SsoSession.maxAgeMs / 1000),
  });
  console.log(`[sso] ticket 兑换成功 student=${studentId} ip=${clientIp(c)}`);
  return c.redirect(`/sso/view/${studentId}`);
}
