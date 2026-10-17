/* v190 冒烟：机构管理员可见范围 = 本机构 + 无机构（org_id IS NULL）用户。
   背景（2026-10-17 孙冬晓确认）：学生 13537126329 通过公开邀请码注册、未分机构（org_id NULL），
   做完 8 个测评后机构管理员在总览用户列表/学员列表完全搜不到——v179 的严格隔离口径把
   「无机构」学员整体隐藏了。本次修订：机构管理员范围统一为 tenant.orgScope（本机构 + 无机构），
   其他机构的账号仍严格隔离；平台超管（orgId=null）全量不变。
   覆盖点：tenant.orgScope / sameOrg、studentDetail.listStudents + getStudentDetail、
   adminRouter.users（模糊搜索口径）、adminRouter.tutors、adminRouter.overview 统计、recycle 回收站。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v190 机构范围含无机构用户", () => {
  const tenant = read("api/tenant.ts");
  const detail = read("api/studentDetail.ts");
  const admin = read("api/adminRouter.ts");
  const recycle = read("api/recycle.ts");
  const router = read("api/router.ts");

  it("tenant：orgScope = 本机构 + org_id IS NULL；sameOrg 同步放行", () => {
    need(tenant, "or(eq(users.orgId, orgId), isNull(users.orgId))", "orgScope 口径");
    need(tenant, "t.orgId === me.orgId || t.orgId == null", "sameOrg 放行无机构目标");
  });

  it("listStudents 机构分支用 orgScope", () => {
    need(detail, "where(orgScope(orgId))", "listStudents orgScope 过滤");
    need(detail, 'import { orgScope } from "./tenant"', "studentDetail 引入 orgScope");
  });

  it("getStudentDetail：无机构学员放行、跨机构拒绝", () => {
    need(detail, "target.orgId !== orgId && target.orgId != null", "详情校验 v190 口径");
  });

  it("admin.users 机构管理员搜索范围 = 本机构 + 无机构", () => {
    need(admin, "and(orgScope(orgId), notDeleted, searchCond)", "用户列表 whereCond");
    need(admin, 'import { isPlatformAdmin, orgScope, sameOrg } from "./tenant"', "adminRouter 引入 orgScope");
  });

  it("admin.tutors / overview 统计口径同步", () => {
    need(admin, "and(eq(users.role, \"tutor\"), orgScope(orgId))", "伴学师列表范围");
    need(admin, ".where(orgScope(orgId))", "overview 业务量统计范围");
  });

  it("recycle 回收站：无机构学员对本机构管理员可见", () => {
    need(recycle, "orgId == null || u.orgId === orgId || u.orgId == null", "回收站过滤口径");
  });

  it("BUILD_TAG 已递增到 v190", () => {
    const v = Number(router.match(/const BUILD_TAG = "v(\d+)-/)?.[1] ?? 0);
    if (v < 190) throw new Error(`BUILD_TAG 未递增到 v190（当前 v${v}）`);
  });
});
