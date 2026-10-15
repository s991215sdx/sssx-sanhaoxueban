/* v170 冒烟：伴学师「邀请学员默认可看报告」——
   users 加 invite_report_default；开启后扫其二维码注册的新学员自动带报告权限；
   存量无显式分配记录的关系保持放行（v169 收紧修正）。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v170 邀请学员默认可看报告", () => {
  it("users 表新字段 + 迁移三件套", () => {
    const schema = readFileSync("db/schema.ts", "utf-8");
    if (!/inviteReportDefault: boolean\("invite_report_default"\)/.test(schema)) throw new Error("schema 缺字段");
    const mig = readFileSync("db/migrations/0030_invite_report_default.sql", "utf-8");
    if (!/ADD `invite_report_default` boolean NOT NULL DEFAULT false/.test(mig)) throw new Error("迁移 SQL 缺失");
    const emb = readFileSync("api/migrationsEmbedded.ts", "utf-8");
    if (!emb.includes("0030_invite_report_default")) throw new Error("内嵌迁移缺 0030");
  });

  it("注册时按伴学师默认配置写入分配记录", () => {
    const src = readFileSync("api/inviteRouter.ts", "utf-8");
    if (!/reportAccess: tutor\?\.inviteReportDefault \?\? false/.test(src)) throw new Error("注册未按默认配置写权限");
    if (!/db\.insert\(studentTutor\)/.test(src)) throw new Error("注册未写 student_tutor");
  });

  it("存量兼容：无显式分配记录不收紧", () => {
    const src = readFileSync("api/tutorAccess.ts", "utf-8");
    if (!/if \(!row\) return \{ allowed: true/.test(src)) throw new Error("缺存量放行分支");
  });

  it("管理端：伴学师列表开关", () => {
    const admin = readFileSync("api/adminRouter.ts", "utf-8");
    if (!/setTutorInviteReportDefault: adminQuery/.test(admin)) throw new Error("缺设置 mutation");
    const page = readFileSync("src/pages/Admin.tsx", "utf-8");
    if (!/setTutorInviteReportDefault\.useMutation/.test(page)) throw new Error("前端缺开关");
    if (!/邀请学员默认可看报告/.test(page)) throw new Error("前端缺开关文案");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/const BUILD_TAG = "v\d+-/.test(r)) throw new Error("BUILD_TAG 未递增");
  });
});
