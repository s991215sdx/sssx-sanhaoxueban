/* v158 冒烟：一体通（CRM）对接——内部档案搜索接口 + SSO ticket 免登短会话。
   安全要求覆盖：HMAC-SHA256 签名 + 时间窗、单 IP 频率限制（30 次/分钟）、手机号打码只留后 4 位、
   ticket 一次性（由一体通校验接口保证）+ 10 分钟短会话仅可读绑定的学员、访问日志留痕。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v158 一体通对接", () => {
  const internal = readFileSync("api/internal.ts", "utf-8");
  const boot = readFileSync("api/boot.ts", "utf-8");
  const ctx = readFileSync("api/context.ts", "utf-8");
  const router = readFileSync("api/router.ts", "utf-8");
  const app = readFileSync("src/App.tsx", "utf-8");
  const view = readFileSync("src/pages/SsoStudentView.tsx", "utf-8");

  it("① 档案搜索接口：HMAC 签名 + 限流 + 打码 + 20 条上限", () => {
    if (!boot.includes('app.post("/api/internal/sssx/student-search"')) throw new Error("缺：搜索路由挂载");
    if (!/createHmac\("sha256"/.test(internal)) throw new Error("缺：HMAC-SHA256");
    if (!/x-sssx-key/.test(internal) || !/x-sssx-timestamp/.test(internal) || !/x-sssx-sign/.test(internal))
      throw new Error("缺：鉴权头解析");
    if (!/timingSafeEqual/.test(internal)) throw new Error("缺：签名常量时间比较");
    if (!/300\)/.test(internal)) throw new Error("缺：时间戳窗口（300s）");
    if (!/max = 30, windowMs = 60_000/.test(internal)) throw new Error("缺：30 次/分钟限流");
    if (!/slice\(-4\)/.test(internal)) throw new Error("缺：手机号只留后 4 位");
    if (!/\.limit\(20\)/.test(internal)) throw new Error("缺：20 条上限");
    if (!/console\.log\(`\[internal-sssx\]/.test(internal)) throw new Error("缺：访问日志");
    if (!/role, "user"\)/.test(internal)) throw new Error("缺：只搜学员（role=user）");
    if (!/isNull\(users\.deletedAt\)/.test(internal)) throw new Error("缺：排除已删除学员");
  });

  it("② ticket 兑换：校验接口 + 10 分钟 cookie + 302 落地", () => {
    if (!boot.includes('app.get("/sso/sssx"')) throw new Error("缺：ticket 路由挂载");
    if (!/yititongTicketUrl/.test(internal)) throw new Error("缺：一体通校验接口地址（env）");
    if (!/AbortSignal\.timeout\(10_000\)/.test(internal)) throw new Error("缺：校验接口超时");
    if (!/data\.valid !== true/.test(internal)) throw new Error("缺：valid 判定");
    if (!/SsoSession\.cookieName/.test(internal)) throw new Error("缺：SSO cookie");
    if (!/c\.redirect\(`\/sso\/view\/\$\{studentId\}`\)/.test(internal)) throw new Error("缺：302 落地");
    if (!/链接已失效/.test(internal)) throw new Error("缺：失效提示页");
  });

  it("SSO 短会话：内存存储 10 分钟 + tRPC 上下文解析 + 最小权限校验", () => {
    const sessions = readFileSync("api/ssoSessions.ts", "utf-8");
    if (!/SsoSession\.maxAgeMs/.test(sessions)) throw new Error("缺：10 分钟有效期");
    if (!/randomBytes\(32\)/.test(sessions)) throw new Error("缺：随机 token");
    if (!/verifySsoSession/.test(ctx)) throw new Error("缺：上下文解析 SSO cookie");
    const ssoRouter = readFileSync("api/ssoRouter.ts", "utf-8");
    if (!/ctx\.sso\.studentId !== input\.userId/.test(ssoRouter)) throw new Error("缺：仅绑定学员可见");
    if (!/sso: ssoRouter/.test(router)) throw new Error("缺：sso 路由注册");
  });

  it("前端：公开路由 + 只读视图（无编辑入口）", () => {
    if (!/path="\/sso\/view\/:studentId"/.test(app)) throw new Error("缺：公开路由");
    if (!/trpc\.sso\.studentDetail\.useQuery/.test(view)) throw new Error("缺：SSO 数据源");
    if (/saveAcademics|ResetPassword|DeleteStudent|useMutation/.test(view)) throw new Error("残留：编辑/变更入口");
    if (!/只读/.test(view)) throw new Error("缺：只读标识");
  });

  it("版本标记已递增", () => {
    if (!/const BUILD_TAG = "v\d+-/.test(router)) throw new Error("BUILD_TAG 未递增");
  });
});
