/* v179 冒烟：机构数据严格隔离 + 报告排版调整 ——
   1) 数据隔离（核心安全修复）：机构管理员只能看到本机构数据——
      listStudents 不再放行 org_id IS NULL 的「平台直客」；
      tenant.sameOrg 不再对 NULL 机构账号放行；
      getStudentDetail 严格校验目标学员属于本机构；
      zhihuiRouter.assertStaffIfOther 增加 sameOrg 机构校验（原来只看角色）。
      【v190 修订】无机构（org_id IS NULL）账号/学员改对本机构管理员可见（owner 确认）：
      公开邀请码注册的学员不分机构，继续隐藏会导致做完测评却在列表消失；
      其他机构仍严格隔离。口径见 tenant.orgScope。
   2) 报告排版：HollandHexMap 重排为 RIASEC 两排等宽卡片；
      六型学科地图并入三好生涯报告雷达图同页；移除该报告的多元智能参考页；页码重编。
   要求：BUILD_TAG 递增到 v178。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v179 机构数据严格隔离 + 报告排版", () => {
  const detail = readFileSync("api/studentDetail.ts", "utf-8");
  const tenant = readFileSync("api/tenant.ts", "utf-8");
  const zhihuiRouter = readFileSync("api/zhihuiRouter.ts", "utf-8");
  const hex = readFileSync("src/components/reports/HollandHexMap.tsx", "utf-8");
  const zhihui = readFileSync("src/pages/ZhihuiReport.tsx", "utf-8");
  const router = readFileSync("api/router.ts", "utf-8");

  it("v256：listStudents 限当前机构及有本机构关系的无机构旧学员", () => {
    if (!/listUnboundOrgStudentIds\(db, orgId\)/.test(detail)) throw new Error("缺：无机构旧学员按本机构关系过滤");
    if (/where\(eq\(users\.orgId, orgId\)\)/.test(detail)) throw new Error("残留：listStudents 独占机构过滤");
  });

  it("v256：sameOrg 不公开无机构账号，只按本机构关系放行", () => {
    if (!/target\.orgId === me\.orgId/.test(tenant) || !/listUnboundOrgStudentIds/.test(tenant))
      throw new Error("缺：sameOrg 当前机构与旧关系校验");
  });

  it("v256：getStudentDetail 统一 sameOrg 校验", () => {
    if (!/sameOrg\(db, \{ orgId \}, userId\)/.test(detail))
      throw new Error("缺：getStudentDetail 当前机构校验");
  });

  it("智慧生涯接口带机构校验", () => {
    if (!/canAccessUser|sameOrg/.test(zhihuiRouter)) throw new Error("缺：zhihuiRouter 引入机构校验");
    if (!/await assertStaffIfOther/.test(zhihuiRouter)) throw new Error("缺：assertStaffIfOther 异步机构校验");
    if (!/该学员不在你的机构内/.test(zhihuiRouter)) throw new Error("缺：跨机构拒绝提示");
  });

  it("HollandHexMap 两排等宽卡片（v180 起顺序改为 常规/现实/研究 + 艺术/社会/企业）", () => {
    if (!/\["C", "R", "I"\]/.test(hex) || !/\["A", "S", "E"\]/.test(hex))
      throw new Error("缺：两排布局（v180 顺序）");
    if (/蜂窝/.test(hex)) throw new Error("残留：蜂窝字样");
  });

  it("三好生涯报告：地图并入雷达页、移除多元页、页码 5+idx", () => {
    if (/Multi5TalentMaps/.test(zhihui)) throw new Error("残留：三好生涯报告中的多元智能页");
    if (/\{7 \+ idx\}/.test(zhihui)) throw new Error("残留：旧页码 7+idx");
    if (!/\{5 \+ idx\}/.test(zhihui)) throw new Error("缺：页码重编 5+idx");
  });

  it("BUILD_TAG 已递增", () => {
    if (Number(router.match(/const BUILD_TAG = "v(\d+)-/)?.[1] ?? 0) < 179) throw new Error("BUILD_TAG 未递增到 v179");
  });
});
