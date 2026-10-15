/* v169 冒烟：伴学师报告查看权限（B 端付费控制）——
   student_tutor 加 report_access + 有效期；伴学师视角无权限时详情只下发测评清单；
   分配面板带报告开关+有效期；学员列表有「分配报告」入口。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v169 伴学师报告权限", () => {
  it("student_tutor 表结构与迁移三件套", () => {
    const schema = readFileSync("db/schema.ts", "utf-8");
    if (!/reportAccess: boolean\("report_access"\)/.test(schema)) throw new Error("schema 缺 report_access");
    if (!/reportAccessExpiresAt: timestamp\("report_access_expires_at"\)/.test(schema)) throw new Error("schema 缺有效期列");
    const mig = readFileSync("db/migrations/0029_tutor_report_access.sql", "utf-8");
    if (!/ADD `report_access` boolean NOT NULL DEFAULT true/.test(mig)) throw new Error("迁移 SQL 缺 report_access");
    const emb = readFileSync("api/migrationsEmbedded.ts", "utf-8");
    if (!emb.includes("0029_tutor_report_access")) throw new Error("内嵌迁移缺 0029");
  });

  it("详情限流：无权限只下发测评清单（名称+时间）", () => {
    const src = readFileSync("api/studentDetail.ts", "utf-8");
    if (!/getTutorReportAccess/.test(src)) throw new Error("缺权限判定接入");
    if (!/assessments\.raw = rows\.map\(\(r\) => \(\{ kind: r\.kind, answers: null/.test(src))
      throw new Error("缺限流清单下发");
    if (!/reportAccess,/.test(src)) throw new Error("缺 reportAccess 字段返回");
  });

  it("分配可带权限：setStudentTutors 新契约 + grantReportAccess", () => {
    const admin = readFileSync("api/adminRouter.ts", "utf-8");
    if (!/tutors\?: \{ tutorUserId: number; reportAccess\?: boolean; expiresAt\?: string \| null \}\[\]/.test(admin))
      throw new Error("setStudentTutors 缺 tutors 新契约");
    if (!/grantReportAccess: adminQuery/.test(admin)) throw new Error("缺 grantReportAccess");
    if (!/reportAccess: grant, reportAccessExpiresAt: expiresAt/.test(admin)) throw new Error("grant 未写权限字段");
  });

  it("前端：分配面板报告开关 + 分配报告入口 + 详情拦截", () => {
    const assign = readFileSync("src/components/TutorAssignButton.tsx", "utf-8");
    if (!/ReportExpirySelect/.test(assign)) throw new Error("分配面板缺有效期选择");
    if (!/setStudentTutors\.useMutation/.test(assign)) throw new Error("分配面板未接新契约");
    const grant = readFileSync("src/components/ReportGrantButton.tsx", "utf-8");
    if (!/grantReportAccess\.useMutation/.test(grant)) throw new Error("分配报告未接 mutation");
    const drawer = readFileSync("src/components/StudentDetailDrawer.tsx", "utf-8");
    if (!/reportLimited/.test(drawer)) throw new Error("详情抽屉缺限流分支");
    if (!/测评记录/.test(drawer)) throw new Error("详情抽屉缺测评记录区");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!r.includes('const BUILD_TAG = "v169-2026-10-15";')) throw new Error("BUILD_TAG 未递增到 v169");
  });
});
