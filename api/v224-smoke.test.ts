/* v224 冒烟：测评中心补全（全量目录 + 封面/内页双图 + 机构开放测评配置）+ 侧栏隐形滚条。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v224 测评中心补全 + 机构开放测评配置", () => {
  it("侧栏滚条隐形但保留滚动", () => {
    const layout = read("src/components/Layout.tsx");
    need(layout, "overflow-y-auto", "侧栏可滚动");
    need(layout, "[scrollbar-width:none]", "滚条宽度隐藏");
    need(layout, "[&::-webkit-scrollbar]:hidden", "webkit 滚条隐藏");
    if (layout.includes("[scrollbar-width:thin]")) throw new Error("旧式细滚条未移除");
  });

  it("超管可配机构开放测评（orgRouter.update assessKinds）", () => {
    const org = read("api/orgRouter.ts");
    need(org, "assessKinds", "update 入参");
    need(org, "normalizeAssessKinds(input.assessKinds)", "kind 归一化校验");
    need(org, 'assess: { kinds }', "写入 settings.assess.kinds");
    const schema = read("db/schema.ts");
    need(schema, "assess?: { kinds?: string[] }", "settings 类型扩展");
  });

  it("测评中心按机构开放配置过滤 + 推送限界", () => {
    const api = read("api/schoolRouter.ts");
    need(api, "orgOpenAssessKinds", "开放测评读取");
    need(api, "openKinds", "targets 返回开放清单");
    need(api, "以下测评未对本校开放", "推送越界拦截");
  });

  it("前端目录：11 项全量 + 双图切换 + 开放过滤", () => {
    const center = read("src/components/admin/AssessCenter.tsx");
    for (const k of ["mbti", "disc", "anchor", "subject", "e3parent", "discparent"]) {
      need(center, `key: "${k}"`, `目录项 ${k}`);
    }
    need(center, "imgs: [string, string]", "双图字段");
    need(center, "ShotSwitch", "双图切换组件");
    need(center, "封面", "封面页签");
    need(center, "报告页", "报告内页页签");
    need(center, "openKinds", "开放过滤");
    const orgTab = read("src/components/admin/OrgAdminTab.tsx");
    need(orgTab, "开放全部测评", "超管全部开关");
    need(orgTab, "INVITE_ASSESS_KINDS", "超管勾选清单");
  });

  it("报告效果图素材齐备（封面 + 内页双图）", () => {
    for (const name of ["xuanke", "subject", "holland", "e3", "multi5", "mental", "parent", "mbti", "disc", "anchor"]) {
      read(`public/assess/${name}.png`);
      read(`public/assess/${name}-cover.png`);
    }
  });
});
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
    const router = read("api/router.ts");
    need(router, "portalBranding: publicQuery", "公开查询");
    need(router, "portalOrgByHost", "用 helper 查机构");
    need(router, 'footer: org.portalFooter || "上上升学"', "底部署名缺省");
    need(router, "logoUrl: org.logoUrl || null", "Logo 可空");
    const helper = read("api/portalBranding.ts");
    need(helper, 'replace(/^https?:\\/\\//', "去协议");
    need(helper, "replace(/:\\d+$", "去端口");
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
