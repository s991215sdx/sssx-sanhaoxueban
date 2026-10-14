/**
 * v158：一体通（CRM）对接内部接口——仅服务对服务调用，HMAC 签名鉴权 + 频率限制。
 * ① POST /api/internal/sssx/student-search：学生档案搜索（姓名/手机号片段，最多 20 条，手机号打码只留后 4 位）
 * ② GET  /sso/sssx?ticket=xxx：ticket 兑换 SSO 短会话（调一体通校验接口），种 10 分钟 cookie 后 302 到学员详情
 * 鉴权头约定（与一体通对齐）：
 *   X-SSSX-Key: <共享密钥>（= .env 的 SSSX_INTERNAL_KEY，私发不落库）
 *   X-SSSX-Timestamp: Unix 秒（与服务器偏差 >300s 拒绝）
 *   X-SSSX-Sign: hex(HMAC_SHA256(密钥, `${X-SSSX-Key}\n${X-SSSX-Timestamp}\n${原始请求体}`))，小写
 */
import type { Context } from "hono";
import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq, inArray, isNull, like, or } from "drizzle-orm";
import { setCookie } from "hono/cookie";
import { assessmentResults, studentProfile, users } from "@db/schema";
import { getDb } from "./queries/connection";
import { env } from "./lib/env";
import { getSessionCookieOptions } from "./lib/cookies";
import { SsoSession } from "@contracts/constants";
import { createSsoSession } from "./ssoSessions";

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

function clientIp(c: Context): string {
  return (c.req.header("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
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
    const body = JSON.parse(rawBody || "{}") as { keyword?: unknown };
    keyword = typeof body.keyword === "string" ? body.keyword.trim().slice(0, 50) : "";
  } catch {
    return c.json({ error: "bad_json" }, 400);
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

const failPage = (reason: string) => `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>链接已失效 · 三好学伴</title>
<style>body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#FAF6EF;font-family:system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif}
.card{max-width:340px;padding:32px 28px;background:#fff;border-radius:16px;box-shadow:0 8px 30px -12px rgba(12,80,72,.25);text-align:center}
h1{margin:0 0 10px;font-size:17px;color:#1E3530}p{margin:0;font-size:13.5px;color:#5C6B63;line-height:1.7}</style></head>
<body><div class="card"><h1>链接已失效</h1><p>${reason}</p><p style="margin-top:14px">请从一体通重新进入。</p></div></body></html>`;

export async function ssoTicketEntry(c: Context) {
  const ticket = (c.req.query("ticket") ?? "").trim();
  const fail = (reason: string) => c.html(failPage(reason), 403);
  if (!env.yititongTicketUrl) {
    console.error("[sso] YITITONG_TICKET_URL 未配置，拒绝兑换");
    return fail("系统未开通一体通对接");
  }
  if (!ticket || ticket.length > 128) return fail("ticket 缺失或非法");
  let data: { valid?: unknown; student_id?: unknown; name?: unknown };
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
