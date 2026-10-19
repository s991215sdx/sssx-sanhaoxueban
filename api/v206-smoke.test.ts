/* v206 冒烟：学员「按机构移除」守卫——只移出本机构，绝不动全局身份（2026-10-19 唐海陵超管误删事故）。
   事故复盘：平台超管账号（orgId IS NULL）因历史遗留有一条学员档案，借 v190「无机构学员对机构管理员可见」
   出现在粤华机构学员列表里，机构管理员点「删除」把全系统唯一的管理员账号软删了。
   口径：
   - 非学员角色（伴学师/管理员/教务）一律拒绝按学员移除；
   - 无机构账号（orgId IS NULL）拒绝移除——不属于任何机构；
   - 同手机号名下还有其他机构账号时，只软删本机构这一行，响应带 removedOrgOnly + siblingOrgs，
     前端据此提示「仅移出本机构，其他机构不受影响」；
   - 前端按钮语义改为「移出机构」，确认文案说明多机构影响范围。
   覆盖点：deleteStudent 守卫三件套、多机构同胞检测、前端按钮与成功提示、BUILD_TAG 递增。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v206 学员按机构移除守卫", () => {
  const coach = read("api/coachRouter.ts");
  const btn = read("src/components/DeleteStudentButton.tsx");
  const router = read("api/router.ts");

  it("守卫①：非学员角色拒绝移除", () => {
    need(coach, 'if (target.role !== "user") throw new Error("该账号是伴学师/管理员/教务，不能按学员移除', "角色守卫");
  });

  it("守卫②：无机构账号（含平台超管）拒绝移除", () => {
    need(coach, 'if (target.orgId == null) throw new Error("该账号不属于任何机构（平台/无机构账号），不能从机构中移除")', "无机构守卫");
  });

  it("守卫③：同手机号多机构账号只移出本机构，并返回其他机构名", () => {
    need(coach, "siblingOrgs: string[] = []", "同胞机构数组");
    need(coach, "isNull(users.deletedAt), ne(users.id, target.id)", "只统计其他存活账号");
    need(coach, "removedOrgOnly: siblingOrgs.length > 0, siblingOrgs", "响应带移出范围");
  });

  it("目标查询带出 role/orgId/phone 供守卫判断", () => {
    need(coach, "deletedAt: users.deletedAt, role: users.role, orgId: users.orgId, phone: users.phone", "目标字段完整");
  });

  it("前端：按钮改「移出机构」+ 多机构成功提示", () => {
    need(btn, "移出机构", "按钮文案");
    need(btn, "res.removedOrgOnly", "成功回调区分移出范围");
    need(btn, "该账号还在：", "多机构提示");
    need(btn, "确认移出", "确认按钮");
  });

  it("BUILD_TAG 已递增到 v206", () => {
    const v = Number(router.match(/const BUILD_TAG = "v(\d+)-/)?.[1] ?? 0);
    if (v < 206) throw new Error(`BUILD_TAG 未递增到 v206（当前 v${v}）`);
  });
});
