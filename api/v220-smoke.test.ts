/* v220 冒烟：学校版专版（粤华打样）——选科意向三轮、预警中心、一生一策成长档案、
   未参测催办、团体统计、心理测评学年合规。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v220 学校版专版", () => {
  it("迁移 0038 建表 + journal + 嵌入 + schema", () => {
    const sql = read("db/migrations/0038_school_v220.sql");
    need(sql, "CREATE TABLE `subject_intentions`", "选科意向表");
    need(sql, "CREATE TABLE `intention_rounds`", "意向轮次表");
    need(sql, "CREATE TABLE `warning_events`", "预警表");
    need(sql, "CREATE TABLE `reminders`", "催办提醒表");
    const journal = read("db/migrations/meta/_journal.json");
    need(journal, '"0038_school_v220"', "journal 登记");
    const embedded = read("api/migrationsEmbedded.ts");
    need(embedded, '"0038_school_v220"', "内嵌迁移");
    const schema = read("db/schema.ts");
    need(schema, 'mysqlTable("subject_intentions"', "schema 意向表");
    need(schema, 'mysqlTable("warning_events"', "schema 预警表");
  });

  it("schoolRouter：意向提交（custom 必填理由）+ 轮次唯一开放", () => {
    const api = read("api/schoolRouter.ts");
    need(api, '"custom" && input.reason.trim().length < 5', "自定义理由校验");
    need(api, "eq(intentionRounds.status, \"open\")", "仅开放轮可提交");
    need(api, 'set({ status: "closed" })', "开新轮关旧轮");
    need(api, "campusStudents", "校园生范围");
    need(api, "eq(inviteChannels.campus, true)", "campus 渠道判定");
  });

  it("schoolRouter：预警规则与权限", () => {
    const api = read("api/schoolRouter.ts");
    need(api, "MENTAL_KINDS", "心理红线扫描");
    need(api, "lifeEventLevel", "E3 生活事件红线");
    need(api, "leXue.score < 3.0", "乐学动力预警");
    need(api, "prev - now >= 10", "成绩下滑≥10个百分点");
    need(api, "studentTutor.tutorUserId", "伴学师名下范围");
    need(api, 'createHash("sha256")', "档案校验码");
  });

  it("心理测评学年一次拦截（仅校园生）", () => {
    const api = read("api/profileRouter.ts");
    need(api, "本学年已完成该心理筛查（每学年一次）", "拦截文案");
    need(api, "new Date(y, 8, 1)", "学年 9月1日 起算");
    need(api, "ch?.campus", "仅校园渠道生效");
  });

  it("前端：管理端校园面板 + 报告页意向入口", () => {
    const admin = read("src/pages/Admin.tsx");
    need(admin, "SchoolPanel", "校园管理 tab");
    need(admin, '"school"', "tab key");
    const zhihui = read("src/pages/ZhihuiReport.tsx");
    need(zhihui, "SubjectIntentionCard", "报告页意向入口");
    const card = read("src/components/SubjectIntentionCard.tsx");
    need(card, "school.intentions.submit", "意向提交调用");
    need(card, "no-print", "打印隐藏");
    const panel = read("src/components/admin/SchoolPanel.tsx");
    need(panel, "school.warnings.reevaluate", "预警扫描");
    need(panel, "school.archive.portfolio", "成长档案");
    need(panel, "school.unassessed.remind", "一键催办");
  });

  it("BUILD_TAG 已递增到 v220", () => {
    const router = read("api/router.ts");
    const v = Number(router.match(/const BUILD_TAG = "v(\d+)-/)?.[1] ?? 0);
    if (v < 220) throw new Error(`BUILD_TAG 未递增到 v220（当前 v${v}）`);
    need(router, "schoolRouter", "路由注册");
  });
});
