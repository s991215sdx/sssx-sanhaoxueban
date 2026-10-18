/* v200 冒烟：新增「教务」(jiaowu) 角色——最小权限的学员分配台。
   权限口径（孙冬晓 2026-10-18）：
   - 只能：搜索学员（支持按手机号搜，但任何接口返回的号码必须脱敏）+ 分配/更换伴学师
     + 给伴学师开启/关闭某学员的报告查看权限（grantReportAccess）；
   - 不能：看到完整手机号、决定伴学师「邀请学员默认可看报告」(setTutorInviteReportDefault 保持 admin-only)、
     其余一切管理接口（回收站/重置密码/删除/角色设置/总览统计/邀请渠道等一律 admin-only）。
   覆盖点：DB 枚举迁移、staffAdminQuery 白名单、手机号脱敏、学员列表服务端搜索、
   前端教务受限视图（隐藏敏感操作）、RoleGate 只允许 /admin。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v200 教务(jiaowu)角色", () => {
  const schema = read("db/schema.ts");
  const migration = read("db/migrations/0037_jiaowu_role.sql");
  const embedded = read("api/migrationsEmbedded.ts");
  const middleware = read("api/middleware.ts");
  const admin = read("api/adminRouter.ts");
  const tenant = read("api/tenant.ts");
  const detail = read("api/studentDetail.ts");
  const app = read("src/App.tsx");
  const adminPage = read("src/pages/Admin.tsx");
  const coach = read("api/coachRouter.ts");
  const router = read("api/router.ts");

  it("DB：users.role 枚举含 jiaowu + 迁移三件套", () => {
    need(schema, '"user", "tutor", "admin", "jiaowu"', "schema 角色枚举");
    need(migration, "enum('user','tutor','admin','jiaowu')", "0037 迁移 SQL");
    need(embedded, '"0037_jiaowu_role"', "内嵌迁移");
  });

  it("中间件：staffAdminQuery = admin+jiaowu", () => {
    need(middleware, 'requireAnyRole(["admin", "jiaowu"])', "staffAdminQuery 角色白名单");
    need(middleware, "export const staffAdminQuery", "staffAdminQuery 导出");
  });

  it("接口白名单：学员/伴学师/分配/报告权限对教务开放，默认报告开关仍为 admin-only", () => {
    need(admin, "students: staffAdminQuery", "学员列表开放");
    need(admin, "tutors: staffAdminQuery", "伴学师列表开放");
    need(admin, "assignTutor: staffAdminQuery", "分配伴学师开放");
    need(admin, "setStudentTutors: staffAdminQuery", "多伴学师分配开放");
    need(admin, "grantReportAccess: staffAdminQuery", "报告权限开放");
    need(admin, "setTutorInviteReportDefault: adminQuery", "默认报告开关仍 admin-only");
    need(admin, "overview: adminQuery", "总览统计仍 admin-only");
    /* 回收站/删除/恢复在 coachRouter，tutorQuery 仅 tutor+admin——天然不含教务 */
    need(coach, "recycleBin: tutorQuery", "回收站仍 tutor/admin-only");
  });

  it("手机号脱敏：教务视角 maskPhone；搜索服务端按真实号码匹配", () => {
    need(tenant, "export function maskPhone", "maskPhone helper");
    need(admin, 'if (ctx.user.role === "jiaowu") return items.map((s) => ({ ...s, phone: maskPhone(s.phone) }))', "学员列表脱敏");
    need(detail, "listStudents(db: Db, orgId?: number | null, search?: string)", "listStudents 服务端搜索参数");
    need(detail, 'or(like(users.name, likeKw), like(users.phone, likeKw))', "服务端姓名/手机号 LIKE");
  });

  it("setRole：教务仅平台超管可设置", () => {
    need(admin, 'role: "user" | "tutor" | "admin" | "jiaowu"', "setRole 输入含 jiaowu");
    need(admin, '仅平台超管可设置教务角色', "设置教务的平台超管限制");
  });

  it("前端：教务强制落 /admin，学员页隐藏敏感操作", () => {
    need(app, 'user?.role === "jiaowu"', "App 门禁识别教务");
    need(app, 'if (location.pathname !== "/admin") return <Navigate to="/admin" replace />;', "教务只允许 /admin");
    need(adminPage, "jiaowu = false", "StudentsTab 受限模式开关");
    need(adminPage, '{!jiaowu && (', "敏感操作对教务隐藏");
    need(adminPage, "detailId !== null && !jiaowu", "教务无详情抽屉");
    need(adminPage, 'search: kw || undefined', "学员搜索走服务端");
  });

  it("BUILD_TAG 已递增到 v200", () => {
    const v = Number(router.match(/const BUILD_TAG = "v(\d+)-/)?.[1] ?? 0);
    if (v < 200) throw new Error(`BUILD_TAG 未递增到 v200（当前 v${v}）`);
  });
});
