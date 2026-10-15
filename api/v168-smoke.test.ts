/* v168 冒烟：一体通用户级免登 ticket（mode=user）——
   一体通工作台点「三好学伴」签发用户级 ticket，三好按手机号匹配员工账号直接种登录态。
   要求：mode=user 分支按 phone 匹配 tutor/admin（排除软删）、8 小时会话 cookie、
   未匹配显示开通提示、学生级（student_id）逻辑不变。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v168 用户级免登 ticket", () => {
  const src = readFileSync("api/internal.ts", "utf-8");

  it("识别 mode=user 并按手机号匹配员工账号", () => {
    if (!/data\.mode === "user"/.test(src)) throw new Error("缺：mode=user 分支");
    if (!/eq\(users\.phone, phone\)/.test(src)) throw new Error("缺：按手机号匹配");
    if (!/inArray\(users\.role, \["tutor", "admin"\]/.test(src)) throw new Error("缺：限定员工角色");
    if (!/isNull\(users\.deletedAt\)/.test(src)) throw new Error("缺：排除软删");
  });

  it("种 8 小时登录态并 302 首页", () => {
    if (!/maxAge: 8 \* 60 \* 60/.test(src)) throw new Error("缺：8 小时会话");
    if (!/Session\.cookieName/.test(src)) throw new Error("缺：正式登录态 cookie");
    if (!/return c\.redirect\("\/"\)/.test(src)) throw new Error("缺：302 首页");
  });

  it("未匹配显示开通提示", () => {
    if (!/一体通账号未开通三好学伴权限/.test(src)) throw new Error("缺：未开通提示");
  });

  it("学生级 ticket 逻辑不变", () => {
    if (!/c\.redirect\(`\/sso\/view\/\$\{studentId\}`\)/.test(src)) throw new Error("缺：学生级 302 学员详情");
    if (!/SsoSession\.cookieName/.test(src)) throw new Error("缺：学生级 SSO 短会话");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!/^const BUILD_TAG = "v\d+-/m.test(r)) throw new Error("BUILD_TAG 缺失");
  });
});
