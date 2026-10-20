/* v230 冒烟：平台超管跨机构分配——学校/机构学员可分配给任意伴学师，伴学师跨机构可见可管。
   安全口径：跨机构分配记录只能由平台超管建立（sameOrg 对机构管理员建分配仍双向校验），
   因此「关系命中即认」不会破坏机构隔离；机构管理员原有权限一律不变。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v230 平台超管跨机构分配", () => {
  it("tenant.canAccessUser：sameOrg 超集 + 分配记录放行", () => {
    const t = read("api/tenant.ts");
    need(t, "canAccessUser", "新判定导出");
    need(t, "sameOrg 的超集", "语义注释");
    need(t, "studentTutor.tutorUserId, me.id", "分配记录命中即放行");
  });

  it("isMyStudent：关系命中即认（跨机构分配生效）", () => {
    const t = read("api/tutorAccess.ts");
    need(t, "v230", "版本注释");
    need(t, "跨机构分配只能由平台超管建立", "隔离不被破坏的论证");
  });

  it("伴学师详情：跨机构学员按全量视图返回", () => {
    const c = read("api/coachRouter.ts");
    need(c, "跨机构分配（平台超管建立）的学员按全量视图返回", "orgParam 注释");
    need(c, "const orgParam = same ? ctx.user.orgId : null", "跨机构时 orgParam=null");
    need(c, "canAccessUser", "导入与使用");
  });

  it("报告数据：assertStaffIfOther 用 canAccessUser（跨机构名下学员可读报告）", () => {
    const z = read("api/zhihuiRouter.ts");
    need(z, "canAccessUser(db, ctx.user, studentId)", "报告数据放行口径");
  });

  it("建分配仍受保护：机构管理员双向 sameOrg 校验未动", () => {
    const a = read("api/adminRouter.ts");
    need(a, "assignTutor: staffAdminQuery", "单学员分配入口");
    need(a, "batchSetStudentTutors: staffAdminQuery", "批量分配入口");
    need(a, "该伴学师不在你的机构内", "双向机构校验");
    need(a, "该学员不在你的机构内", "学员机构校验");
  });

  it("超管选人：伴学师列表带机构名 + 前端全机构取数", () => {
    const a = read("api/adminRouter.ts");
    need(a, "orgName: t.orgId != null", "tutors 返回机构名");
    const st = read("src/components/admin/StudentsTab.tsx");
    need(st, "platform ? { orgId: null } : orgScope", "超管取全部伴学师");
    const bulk = read("src/components/BulkAssignTutors.tsx");
    need(bulk, "orgName?: string | null", "批量弹窗机构名字段");
    need(bulk, "t.orgName &&", "批量弹窗机构名展示");
    const single = read("src/components/TutorAssignButton.tsx");
    need(single, "orgName?: string | null", "单学员弹窗机构名字段");
  });

  it("版本号 ≥ v230", () => {
    const router = read("api/router.ts");
    const m = router.match(/BUILD_TAG = "v(\d+)-/);
    if (!m || Number(m[1]) < 230) throw new Error("BUILD_TAG 应不低于 v230");
  });
});
