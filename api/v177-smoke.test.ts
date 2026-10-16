/* v177 冒烟：一个手机号可担任多个机构的超级管理员 ——
   1) org.create 不再因手机号已存在而拒绝（已被占用报错移除）；
   2) 重复开通时 unionId 带机构后缀，规避 users.unionId 全局唯一约束；
   3) loginPhone 改为「手机号全候选 + 密码匹配 + 最近使用优先」；
   4) auth.accountsList / accountsSwitch 提供机构切换（同手机号校验）；
   5) 一体通 SSO 按最近活跃选账号。
   要求：BUILD_TAG 已递增。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v177 多机构超管（同手机号多机构）", () => {
  const org = readFileSync("api/orgRouter.ts", "utf-8");
  const auth = readFileSync("api/auth-router.ts", "utf-8");
  const internal = readFileSync("api/internal.ts", "utf-8");
  const layout = readFileSync("src/components/Layout.tsx", "utf-8");
  const router = readFileSync("api/router.ts", "utf-8");

  it("org.create 放开手机号占用并保证 unionId 唯一", () => {
    if (/已被占用/.test(org)) throw new Error("残留：org.create 手机号占用报错");
    if (!/phone:\$\{phone\}:org\$\{orgId\}/.test(org)) throw new Error("缺：重复手机号时 unionId 带机构后缀");
    if (!/role:\s*"admin"[\s\S]{0,40}orgId/.test(org)) throw new Error("缺：机构管理员绑定 orgId");
  });

  it("loginPhone 按密码匹配定位多账号中的正确身份", () => {
    if (!/candidates/.test(auth)) throw new Error("缺：登录全候选查询");
    if (!/verifyPassword\(password, u\.passwordHash\)/.test(auth)) throw new Error("缺：密码匹配过滤");
    if (!/lastSignInAt\?\.getTime\(\)/.test(auth)) throw new Error("缺：同密码多账号时最近使用优先");
  });

  it("accountsList / accountsSwitch 已提供并挂载", () => {
    if (!/accountsList:/.test(auth)) throw new Error("缺：accountsList");
    if (!/accountsSwitch:/.test(auth)) throw new Error("缺：accountsSwitch");
    if (!/target\.phone !== me\.phone/.test(auth)) throw new Error("缺：切换限同手机号校验");
    if (!/auth: authRouter/.test(router)) throw new Error("router 未挂载 authRouter");
  });

  it("前端机构切换器入口存在", () => {
    if (!/function OrgSwitcher/.test(layout)) throw new Error("缺：OrgSwitcher 组件");
    if (!/accountsSwitch\.useMutation/.test(layout)) throw new Error("缺：切换器调用 accountsSwitch");
  });

  it("一体通 SSO 按最近活跃取账号", () => {
    if (!/orderBy\(desc\(users\.lastSignInAt\)\)/.test(internal)) throw new Error("缺：SSO 最近活跃排序");
  });

  it("BUILD_TAG 已递增", () => {
    if (!router.includes('const BUILD_TAG = "v177-2026-10-16"')) throw new Error("BUILD_TAG 未递增");
  });
});
