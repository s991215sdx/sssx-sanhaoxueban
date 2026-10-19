/* v224 冒烟：机构专属入口品牌化——迁移/接口/登录页/管理面板全链路。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v224 入口品牌化（按域名）", () => {
  it("迁移 0041 + journal + 嵌入 + schema", () => {
    const sql = read("db/migrations/0041_portal_branding.sql");
    need(sql, "ADD COLUMN `portal_host` varchar(128) NULL", "portal_host 列");
    need(sql, "ADD COLUMN `portal_footer` varchar(64) NOT NULL DEFAULT '上上升学'", "portal_footer 列带默认");
    need(sql, "CREATE UNIQUE INDEX `organizations_portal_host_uidx`", "域名唯一索引");
    const journal = read("db/migrations/meta/_journal.json");
    need(journal, '"0041_portal_branding"', "journal 登记");
    const embedded = read("api/migrationsEmbedded.ts");
    need(embedded, '"0041_portal_branding"', "内嵌迁移");
    need(embedded, "organizations_portal_host_uidx", "内嵌 SQL 含唯一索引");
    const schema = read("db/schema.ts");
    need(schema, 'portalHost: varchar("portal_host", { length: 128 })', "schema portal_host");
    need(schema, 'portalFooter: varchar("portal_footer", { length: 64 }).notNull().default("上上升学")', "schema portal_footer");
  });

  it("公开接口 portalBranding：域名规范化 + 未配置返回 null", () => {
    const api = read("api/router.ts");
    need(api, "portalBranding: publicQuery", "公开查询");
    need(api, "replace(/^https?:\\/\\//", "去协议");
    need(api, "replace(/:\\d+$", "去端口");
    need(api, "eq(organizations.portalHost, host)", "按域名查机构");
    need(api, 'footer: org.portalFooter || "上上升学"', "底部署名缺省");
    need(api, "logoUrl: org.logoUrl || null", "Logo 可空");
  });

  it("org.update：域名规范化 + 唯一性校验", () => {
    const api = read("api/orgRouter.ts");
    need(api, "portalHost?: string | null", "入参 portalHost");
    need(api, "portalFooter?: string | null", "入参 portalFooter");
    need(api, "专属入口域名格式不对", "域名格式校验");
    need(api, "已被其他机构占用", "域名唯一性冲突提示");
  });

  it("登录页：Logo 按域名替换 + 底部署名可配置 + ?portal= 预览", () => {
    const login = read("src/pages/Login.tsx");
    need(login, "trpc.portalBranding.useQuery", "登录页查 branding");
    need(login, 'get("portal")', "?portal= 预览参数");
    need(login, "portal?.logoUrl", "机构 Logo 替换默认图标");
    need(login, 'portal?.footer ?? "上上升学"', "底部署名可配置");
  });

  it("管理面板：编辑品牌含专属入口字段", () => {
    const tab = read("src/components/admin/OrgAdminTab.tsx");
    need(tab, "portalHost: string | null", "OrgRow 类型");
    need(tab, "专属入口域名", "域名输入框");
    need(tab, "登录页底部署名", "底部署名输入框");
    need(tab, "portalHost: portalHost.trim() || null", "保存传参");
  });
});
