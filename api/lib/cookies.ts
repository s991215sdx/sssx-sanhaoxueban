import type { CookieOptions } from "hono/utils/cookie";

/**
 * 按「真实请求协议」决定会话 cookie 的 Secure / SameSite：
 * - HTTPS（Kimi 平台、反向代理后）：Secure + SameSite=None（跨站 OAuth 回流需要）；
 * - HTTP（IP 直连部署，如 http://106.52.8.20:3000）：不置 Secure + SameSite=Lax——
 *   否则浏览器在 HTTP 下不会回传会话 cookie，登录后立即掉线。
 * 信任 X-Forwarded-Proto（反向代理场景），否则取请求 URL 的实际协议。
 */
export function getSessionCookieOptions(req: Request): CookieOptions {
  const fwd = req.headers.get("x-forwarded-proto");
  const proto = (fwd ?? new URL(req.url).protocol.replace(":", "")).toLowerCase();
  const secure = proto === "https";

  return {
    httpOnly: true,
    path: "/",
    sameSite: secure ? "None" : "Lax",
    secure,
  };
}
