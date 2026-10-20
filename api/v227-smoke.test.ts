/* v227 冒烟：机构版本（校园版/机构版）——迁移/契约/接口/超管配置界面/只读视图全链路。
   安全红线：迁移纯加法 + 存量按「有无校园渠道」回填，粤华等存量校园机构零行为变化。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v227 机构版本（edition）", () => {
  it("迁移 0042：纯加法 + 校园渠道回填（存量零变化）", () => {
    const sql = read("db/migrations/0042_org_edition.sql");
    need(sql, "ADD COLUMN `edition` enum('school','org') NOT NULL DEFAULT 'org'", "edition 列带默认机构版");
    need(sql, "SET `edition` = 'school' WHERE EXISTS", "按校园渠道回填校园版");
    need(sql, "c.campus = 1", "回填条件 campus=1");
    const journal = read("db/migrations/meta/_journal.json");
    need(journal, '"0042_org_edition"', "journal 登记");
    const embedded = read("api/migrationsEmbedded.ts");
    need(embedded, '"0042_org_edition"', "内嵌迁移");
    need(embedded, "UPDATE `organizations` SET `edition` = 'school'", "内嵌 SQL 含回填");
    const schema = read("db/schema.ts");
    need(schema, 'mysqlEnum("edition", ["school", "org"])', "schema edition 枚举");
  });

  it("契约 contracts/edition.ts：版本/功能包/归一化/默认全开", () => {
    const c = read("contracts/edition.ts");
    need(c, 'key: "school"', "校园版定义");
    need(c, 'key: "org"', "机构版定义");
    need(c, "normalizeEdition", "版本校验");
    need(c, "normalizeServices", "功能包校验");
    need(c, "defaultServices", "默认功能包");
    need(c, "resolveServices", "生效值解析（默认全开覆盖存储）");
    need(c, "out[s.key] = true", "默认全部开启=存量零行为变化");
  });

  it("org.create：版本二选一 + 功能包 + 校园版自动附带校园渠道", () => {
    const api = read("api/orgRouter.ts");
    need(api, "edition?: string", "create 入参 edition");
    need(api, "services?: unknown", "create 入参 services");
    need(api, "assessKinds?: unknown", "create 入参 assessKinds");
    need(api, 'normalizeEdition(input.edition) ?? "org"', "版本缺省机构版");
    need(api, "校园版自动附带一条校园注册渠道", "校园渠道自动开通");
    need(api, "campus: true", "渠道 campus 标识");
  });

  it("org.update：版本与功能包可改（null=恢复默认全开）", () => {
    const api = read("api/orgRouter.ts");
    need(api, "edition?: string | null", "update 入参 edition");
    need(api, "services?: unknown", "update 入参 services");
    need(api, "版本不对（school=校园版 / org=机构版）", "版本校验报错");
    need(api, "patch.edition = edition", "版本写入");
    need(api, "services?: Record<string, boolean>", "settings.services 读取");
  });

  it("school.context：职员侧下发 edition/services/assessKinds（只读视图数据源）", () => {
    const api = read("api/schoolRouter.ts");
    need(api, "edition: organizations.edition", "查询 edition 列");
    need(api, "services = resolveServices(edition, stored?.services)", "功能包生效值");
    need(api, "assessKinds", "开放测评下发");
  });

  it("超管界面：开通二选一 + 功能勾选 + 机构列表版本标识", () => {
    const tab = read("src/components/admin/OrgAdminTab.tsx");
    need(tab, "EditionPicker", "版本选择器");
    need(tab, "ServiceChecklist", "功能勾选");
    need(tab, "AssessKindPicker", "测评勾选");
    need(tab, '"school" | "org"', "版本状态类型");
    need(tab, "校园版", "列表版本标识");
    need(tab, "edition,", "保存传 edition");
    need(tab, "services: Object.fromEntries", "保存传 services");
  });

  it("机构管理员只读视图：版本与功能卡片（无修改入口）", () => {
    const card = read("src/components/admin/OrgFeaturesCard.tsx");
    need(card, "由平台超管统一管理", "只读提示");
    need(card, "ctx.services?.[s.key] ?? true", "缺省全开渲染");
    const admin = read("src/pages/Admin.tsx");
    need(admin, "OrgFeaturesCard", "机构后台挂载");
    const school = read("src/components/admin/SchoolConsole.tsx");
    need(school, '"features"', "学校控制台菜单项");
    need(school, "版本与功能", "菜单文案");
  });

  it("版本号递增 v227", () => {
    const router = read("api/router.ts");
    need(router, 'BUILD_TAG = "v227-', "BUILD_TAG 已升 v227");
  });
});
