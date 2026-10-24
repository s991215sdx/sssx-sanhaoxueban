/* v223 冒烟：测评中心（目录 + 组选批量推送）——迁移/接口/解锁机制/前端入口全链路。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v223 测评中心（目录 + 组选推送）", () => {
  it("迁移 0040 建 campus_assess_pushes 表 + journal + 嵌入 + schema", () => {
    const sql = read("db/migrations/0040_campus_assess_push.sql");
    need(sql, "CREATE TABLE `campus_assess_pushes`", "推送记录表");
    need(sql, "`kinds` json NOT NULL", "kinds 列");
    const journal = read("db/migrations/meta/_journal.json");
    need(journal, '"0040_campus_assess_push"', "journal 登记");
    const embedded = read("api/migrationsEmbedded.ts");
    need(embedded, '"0040_campus_assess_push"', "内嵌迁移");
    const schema = read("db/schema.ts");
    need(schema, 'mysqlTable("campus_assess_pushes"', "schema 表");
  });

  it("schoolRouter：targets/push/logs 三接口 + 权限与解锁", () => {
    const api = read("api/schoolRouter.ts");
    need(api, "assessCenter: createRouter", "测评中心路由");
    need(api, "normalizeAssessKinds(input.kinds)", "kinds 归一化");
    need(api, "campusAssessPushes", "推送记录写入");
    need(api, "releasedAssessments: merged", "并入已解锁测评（union 不收回）");
    need(api, 'ctx.user.role === "tutor"', "tutor 限名下学生");
    need(api, "推送对象必须是本校校园学生", "校园范围校验");
    need(api, "requireStaff(ctx)", "仅教职人员");
  });

  it("前端：侧栏入口 + 目录（组合/单项/效果图/详情）+ 推送面板", () => {
    // v232：菜单数据抽到 schoolNav.ts，页面标题仍在 SchoolConsole
    const navSrc = read("src/components/admin/schoolNav.ts");
    need(navSrc, '{ key: "assess", label: "测评中心"', "侧栏导航项");
    const consoleSrc = read("src/components/admin/SchoolConsole.tsx");
    need(consoleSrc, "assess: { crumb", "页面标题");
    need(consoleSrc, "<AssessCenter", "组件挂载");
    const center = read("src/components/admin/AssessCenter.tsx");
    need(center, "组合测评", "组合 tab");
    need(center, "单项测评", "单项 tab");
    need(center, "查看详情", "详情入口");
    need(center, "加入推送", "加入推送");
    need(center, "为什么测", "评估介绍");
    need(center, "理论支撑", "理论支撑");
    need(center, "trpc.school.assessCenter.push.useMutation", "推送接口");
    need(center, "trpc.school.assessCenter.targets.useQuery", "目标列表");
    need(center, "推送记录", "记录面板");
  });

  it("报告效果图素材齐备", () => {
    for (const name of ["xuanke", "subject", "holland", "e3", "multi5", "mental", "parent"]) {
      read(`public/assess/${name}.png`);
    }
  });
});
