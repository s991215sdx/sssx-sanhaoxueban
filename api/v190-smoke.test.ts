/* v190 冒烟：机构管理员可见范围与历史无机构学员兼容。
   v256 修订：同手机号的每个机构身份分别隔离，无机构旧学员必须存在本机构关系才可访问。
   普通账号、伴学师及统计严格限定本机构；平台超管（orgId=null）全量不变。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v190/v256 机构与历史无机构学员范围", () => {
  const tenant = read("api/tenant.ts");
  const detail = read("api/studentDetail.ts");
  const admin = read("api/adminRouter.ts");
  const recycle = read("api/recycle.ts");
  const router = read("api/router.ts");

  it("tenant：普通账号限本机构，无机构旧学员按关系放行", () => {
    need(tenant, "return eq(users.orgId, orgId)", "orgScope 严格机构口径");
    need(tenant, "target.orgId === me.orgId", "sameOrg 同机构判断");
    need(tenant, "target.orgId != null", "有机构目标必须匹配");
    need(tenant, "listUnboundOrgStudentIds", "无机构旧学员关系范围");
  });

  it("listStudents 当前机构与旧关系范围合并搜索", () => {
    need(detail, "listUnboundOrgStudentIds(db, orgId)", "无机构旧学员关系范围");
    need(detail, "and(scope, searchCond)", "机构范围与搜索条件合并");
  });

  it("getStudentDetail 统一使用 sameOrg 当前身份边界", () => {
    need(detail, "sameOrg(db, { orgId }, userId)", "详情统一机构校验");
  });

  it("admin.users 机构管理员搜索只限本机构账号", () => {
    need(admin, "and(orgScope(orgId), notDeleted, searchCond)", "用户列表 whereCond");
    need(admin, 'import { isPlatformAdmin, listOrgStudentIds, maskPhone, orgScope, sameOrg } from "./tenant"', "adminRouter 引入机构范围");
  });

  it("admin.tutors / overview 统计口径同步", () => {
    need(admin, "and(eq(users.role, \"tutor\"), orgScope(orgId))", "伴学师列表范围");
    need(admin, ".where(orgScope(orgId))", "overview 业务量统计范围");
  });

  it("recycle 回收站：无机构旧学员按本机构关系可见", () => {
    need(recycle, "orgId == null || u.orgId === orgId || (u.orgId == null && legacyIds?.has(u.id))", "回收站过滤口径");
  });

  it("BUILD_TAG 已递增到 v190", () => {
    const v = Number(router.match(/const BUILD_TAG = "v(\d+)-/)?.[1] ?? 0);
    if (v < 190) throw new Error(`BUILD_TAG 未递增到 v190（当前 v${v}）`);
  });
});
