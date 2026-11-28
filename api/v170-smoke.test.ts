/* v170 冒烟：伴学师「邀请学员默认可看报告」的历史字段与迁移仍保留；
   v297 起，经伴学师自己的码注册的学员固定带完整报告权限，旧默认配置不再影响新注册。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v170/v297 邀请学员报告权限", () => {
  it("users 表历史字段 + 迁移三件套", () => {
    const schema = readFileSync("db/schema.ts", "utf-8");
    if (!/inviteReportDefault: boolean\("invite_report_default"\)/.test(schema)) throw new Error("schema 缺字段");
    const mig = readFileSync("db/migrations/0030_invite_report_default.sql", "utf-8");
    if (!/ADD `invite_report_default` boolean NOT NULL DEFAULT false/.test(mig)) throw new Error("迁移 SQL 缺失");
    const emb = readFileSync("api/migrationsEmbedded.ts", "utf-8");
    if (!emb.includes("0030_invite_report_default")) throw new Error("内嵌迁移缺 0030");
  });

  it("v297 注册时固定写入完整报告权限", () => {
    const src = readFileSync("api/inviteRegistration.ts", "utf-8");
    if (!/reportAccess: true/.test(src)) throw new Error("注册未写完整报告权限");
    if (/reportAccess: tutor\?\.inviteReportDefault/.test(src)) throw new Error("旧默认开关仍在影响新注册");
    if (!/tx\.insert\(studentTutor\)/.test(src)) throw new Error("注册未写 student_tutor");
  });

  it("存量兼容：无显式分配记录不收紧", () => {
    const src = readFileSync("api/tutorAccess.ts", "utf-8");
    if (!/if \(!row\) return \{ allowed: true/.test(src)) throw new Error("缺存量放行分支");
  });

  it("管理端：保留旧接口，列表展示扫码报告全开", () => {
    const admin = readFileSync("api/adminRouter.ts", "utf-8");
    if (!/setTutorInviteReportDefault: adminQuery/.test(admin)) throw new Error("旧设置 mutation 不应破坏兼容");
    const page = readFileSync("src/pages/Admin.tsx", "utf-8") + readFileSync("src/components/admin/TutorsTab.tsx", "utf-8");
    if (!/自己的码 · 报告全开/.test(page)) throw new Error("前端缺扫码报告全开标识");
    if (/默认无报告/.test(page)) throw new Error("前端仍展示已失效的默认无报告开关");
  });

  it("v297 邀请关系优先于分配开关，0060 迁移完整登记", () => {
    const access = readFileSync("api/tutorAccess.ts", "utf-8");
    if (!/isInviteeOfTutor/.test(access) || !/via: "invite"/.test(access)) throw new Error("缺邀请关系报告权限优先分支");
    const admin = readFileSync("api/adminRouter.ts", "utf-8");
    if (!/报告始终可看；如需限制，请先更换学员的注册渠道/.test(admin)) throw new Error("缺扫码学员权限收回保护");
    const migration = readFileSync("db/migrations/0060_coach_invite_report_full.sql", "utf-8");
    if (!/UPDATE `student_tutor` `st`/.test(migration) || !/SET `st`\.`report_access` = true/.test(migration)) throw new Error("0060 未回补历史渠道权限");
    const embedded = readFileSync("api/migrationsEmbedded.ts", "utf-8");
    if (!embedded.includes('"idx": 62, "when": 1794808121739, "tag": "0060_coach_invite_report_full"')) throw new Error("0060 内嵌日志缺失");
    if (!embedded.includes('"0060_coach_invite_report_full":')) throw new Error("0060 内嵌 SQL 缺失");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 未递增");
  });
});
