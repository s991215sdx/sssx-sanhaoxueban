import type { FetchCreateContextFnOptions } from "@trpc/server/adapters/fetch";
import * as cookie from "cookie";
import type { User } from "@db/schema";
import { SsoSession } from "@contracts/constants";
import { authenticateRequest } from "./kimi/auth";
import { verifySsoSession } from "./ssoSessions";

export type TrpcContext = {
  req: Request;
  resHeaders: Headers;
  user?: User;
  /** v158：一体通 SSO 短会话（ticket 兑换，10 分钟有效，仅绑定一个学员）。与登录态互不影响。 */
  sso?: { studentId: number; name: string };
};

export async function createContext(
  opts: FetchCreateContextFnOptions,
): Promise<TrpcContext> {
  const ctx: TrpcContext = { req: opts.req, resHeaders: opts.resHeaders };
  try {
    ctx.user = await authenticateRequest(opts.req.headers);
  } catch {
    // Authentication is optional here
  }
  try {
    const token = cookie.parse(opts.req.headers.get("cookie") || "")[SsoSession.cookieName];
    if (token) {
      const sso = verifySsoSession(token);
      if (sso) ctx.sso = sso;
    }
  } catch {
    // SSO 会话解析失败按无会话处理
  }
  return ctx;
}
