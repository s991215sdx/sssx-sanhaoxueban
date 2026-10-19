/* v221 冒烟：机构可调选科成绩权重（0-60%）——存储/接口/计算/入口/文案全链路。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v221 选科成绩权重（机构可调）", () => {
  it("迁移 0039 加 settings 列 + journal + 嵌入 + schema", () => {
    const sql = read("db/migrations/0039_org_settings.sql");
    need(sql, "ALTER TABLE `organizations` ADD COLUMN `settings` json", "settings 列");
    const journal = read("db/migrations/meta/_journal.json");
    need(journal, '"0039_org_settings"', "journal 登记");
    const embedded = read("api/migrationsEmbedded.ts");
    need(embedded, '"0039_org_settings"', "内嵌迁移");
    const schema = read("db/schema.ts");
    need(schema, 'settings: json("settings")', "schema settings 列");
    need(schema, "xuanke?: { scoreWeight?: number }", "settings 类型");
  });

  it("schoolRouter：权重读写接口 + 计算参数化", () => {
    const api = read("api/schoolRouter.ts");
    need(api, "orgXuankeWeights", "权重读取函数");
    need(api, "XUANKE_W_MAX = 60", "上限 60");
    need(api, "campusCombos(s4d: Subject4dResult | null, academics: AcademicsLite, grade: string, scoreW = 0.35)", "组合计算带权重参数");
    need(api, "pot * (1 - scoreW) + g * scoreW", "加权公式参数化");
    need(api, "xuankeWeight: createRouter", "权重接口");
    need(api, "scoreWeight: z.number().int().min(XUANKE_W_MIN).max(XUANKE_W_MAX)", "入参范围校验");
    need(api, 'ctx.user.role !== "admin" || ctx.user.orgId == null', "仅机构管理员可调");
    need(api, "orgWeight(stu.orgId) / 100", "统计按学生机构取权重");
    need(api, "weight(u?.orgId ?? null) / 100", "意向/档案按学生机构取权重");
  });

  it("zhihuiRouter：报告数据带机构权重", () => {
    const api = read("api/zhihuiRouter.ts");
    need(api, "orgXuankeWeights", "引入权重函数");
    need(api, "xuankeScoreWeight", "payload 权重字段");
  });

  it("前端：报告页/测评套件/统计页/后台入口", () => {
    const report = read("src/pages/ZhihuiReport.tsx");
    need(report, "data?.xuankeScoreWeight", "报告页读机构权重");
    need(report, "mkW(scorePct / 100)", "推荐计算用动态权重");
    const suite = read("src/components/assessment/ZhihuiSuite.tsx");
    need(suite, "trpc.school.xuankeWeight.get.useQuery", "测评套件取权重");
    const stats = read("src/components/admin/SelectionStats.tsx");
    need(stats, "XuankeWeightPanel", "统计页快捷通道");
    const admin = read("src/pages/Admin.tsx");
    need(admin, '"xuanke"', "通用版后台 tab");
    need(admin, "XuankeWeightPanel", "后台权重面板");
    const panel = read("src/components/admin/XuankeWeightPanel.tsx");
    need(panel, "trpc.school.xuankeWeight.set.useMutation", "保存接口");
  });

  it("学校版后台含资料库板块", () => {
    const consoleSrc = read("src/components/admin/SchoolConsole.tsx");
    need(consoleSrc, '"library"', "资料库导航项");
    need(consoleSrc, "教学资源", "资料库分组");
    need(consoleSrc, "library: { crumb", "资料库标题");
  });
});
