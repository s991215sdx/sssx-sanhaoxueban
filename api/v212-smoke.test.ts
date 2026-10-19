/* v212 冒烟：移出机构角色口径调整——伴学师、教务可移出机构，仅管理员/超管不可（2026-10-19 唐先生）。
   v206 事故守卫的细化：v206 一刀切拒绝所有非学员角色；v210 放开伴学师/教务，
   机构管理员可在「用户管理」列表把离职伴学师/教务移出本机构（回收站可恢复），
   管理员/超管账号仍绝对不可移出。学员档案校验只对学员角色生效。
   覆盖点：deleteStudent 角色守卫新口径、档案校验按角色区分、前端员工列表移出按钮、BUILD_TAG 递增。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

function need(src: string, needle: string, label: string) {
  if (!src.includes(needle)) throw new Error(`缺 ${label}：${needle}`);
}

describe("v212 伴学师/教务可移出机构", () => {
  const coach = read("api/coachRouter.ts");
  const admin = read("src/pages/Admin.tsx");
  const router = read("api/router.ts");

  it("守卫：仅管理员/超管拒绝移出", () => {
    need(coach, 'if (target.role === "admin") throw new Error("该账号是管理员/超管，不能移出机构', "管理员/超管守卫");
  });

  it("档案校验只对学员角色生效（伴学师/教务无档案可移出）", () => {
    need(coach, 'if (!profile && target.role === "user") throw new Error("只有学员（有学员档案的账号）可以删除")', "按角色区分档案校验");
  });

  it("无机构账号可移出到回收站（公海），旧 orgId 守卫已移除", () => {
    if (coach.includes("该账号不属于任何机构（平台/无机构账号），不能从机构中移除")) {
      throw new Error("旧的无机构拒绝守卫必须移除（v210 口径：移出到公海）");
    }
  });

  it("前端：用户管理列表对伴学师/教务显示移出机构按钮", () => {
    need(admin, '(u.role === "tutor" || u.role === "jiaowu") && <DeleteStudentButton', "员工列表移出按钮");
  });

  it("BUILD_TAG 不低于 v212", () => {
    const v = Number(router.match(/const BUILD_TAG = "v(\d+)-/)?.[1] ?? 0);
    if (v < 212) throw new Error(`BUILD_TAG 低于 v212（当前 v${v}）`);
  });
});
