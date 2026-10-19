/* v225 冒烟：专属入口域名登录限制——绑定机构的入口域名只放行本机构账号。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v225 专属入口登录限制", () => {
  it("portalOrgByHost：规范化 + 按 portal_host 查机构", () => {
    const helper = read("api/portalBranding.ts");
    need(helper, "export function normalizeHost", "规范化函数");
    need(helper, 'replace(/^https?:\\/\\//', "去协议");
    need(helper, "replace(/:\\d+$", "去端口");
    need(helper, "export async function portalOrgByHost", "查询函数");
    need(helper, "eq(organizations.portalHost, host)", "按域名匹配");
    need(helper, "HOST_RE.test(host)", "host 合法性校验");
  });

  it("loginPhone：入口域名收敛候选账号 + 非本机构明确拒绝", () => {
    const auth = read("api/auth-router.ts");
    need(auth, 'ctx.req.headers.get("host")', "从请求头取域名（服务端判定，不可伪造）");
    need(auth, "portalOrgByHost", "入口机构解析");
    need(auth, "allCandidates.filter((u) => u.orgId === portalOrg.id)", "候选收敛本机构");
    need(auth, "本站是「", "非本机构拒绝提示");
    need(auth, "请使用本校（机构）账号登录", "引导语");
  });

  it("router.ts：branding 接口复用同一 helper", () => {
    const router = read("api/router.ts");
    need(router, 'import { portalOrgByHost } from "./portalBranding"', "复用 helper");
  });
});
