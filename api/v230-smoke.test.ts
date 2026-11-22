/* v230 的跨机构读取规则由 v256 修订：身份按机构隔离，历史关系不能绕过；
   平台超管仍有独立全局管理视图，机构身份不继承这个权限。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v256 多身份租户边界", () => {
  it("tenant.canAccessUser：管理员限本机构，伴学师限当前身份名下", () => {
    const t = read("api/tenant.ts");
    need(t, "canAccessUser", "统一访问判定");
    need(t, "me.role === \"tutor\"", "伴学师名下校验");
    need(t, "return sameOrg(db, me, targetUserId)", "管理员机构校验");
  });

  it("isMyStudent：先检查机构边界，再检查分配关系", () => {
    const t = read("api/tutorAccess.ts");
    need(t, "旧跨机构关系不能越权", "v256 边界注释");
    need(t, "student.orgId !== tutor.orgId", "异机构拒绝");
  });

  it("伴学师详情：始终按当前机构校验", () => {
    const c = read("api/coachRouter.ts");
    need(c, "getStudentDetail(db, input.userId, ctx.user.orgId", "当前机构详情");
    need(c, "isMyStudent(db, ctx.user", "当前 users.id 名下校验");
    need(c, "canAccessUser", "管理员统一访问校验");
  });

  it("报告数据：assertStaffIfOther 继续使用 canAccessUser", () => {
    const z = read("api/zhihuiRouter.ts");
    need(z, "canAccessUser(db, ctx.user, studentId)", "报告机构边界");
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
