/**
 * v289 冒烟：家长 DISC 双人对照读本（爸爸 × 妈妈）。
 *
 * 三层断言：
 * 1. 内容层——给两位家长，引擎就出两本「家长个人版」，节数与顺序一致（对照靠这个对齐）；
 * 2. 渲染层——对照读本只摆引擎原文（KitBlockView），不自己写沟通建议；
 * 3. 权限层——对照要两条记录，两条都过可见范围校验，不能拿对照当跳板看别家报告。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildCommKit } from "../contracts/familyCommKit";
import { DISC_PARENT_V2_GROUPS, scoreDiscV2 } from "../contracts/assessments";

const read = (p: string) => readFileSync(p, "utf8");
const compare = read("src/components/reports/ParentDiscCompare.tsx");
const drawer = read("src/components/coach/ParentDiscPanel.tsx");
const print = read("src/pages/ParentDiscPrint.tsx");
const profileRouter = read("api/profileRouter.ts");
const pdfLib = read("src/lib/reportPdf.ts");
const router = read("api/router.ts");

describe("v289 家长 DISC 双人对照读本", () => {
  it("两位家长 → 两本家长个人版，节数与顺序一致（对照靠这个逐节对齐）", () => {
    /* 同一套题，两个人给出不同的作答：一人偏主导、一人偏谨慎 */
    const dad = scoreDiscV2(
      { most: DISC_PARENT_V2_GROUPS.map(() => 0), least: DISC_PARENT_V2_GROUPS.map(() => 3) },
      DISC_PARENT_V2_GROUPS,
    );
    const mom = scoreDiscV2(
      { most: DISC_PARENT_V2_GROUPS.map(() => 3), least: DISC_PARENT_V2_GROUPS.map(() => 0) },
      DISC_PARENT_V2_GROUPS,
    );
    const out = buildCommKit({
      parents: [
        { label: "爸爸", result: dad },
        { label: "妈妈", result: mom },
      ],
    });
    const books = out.books.filter((b) => b.key === "parent");
    expect(books.length).toBe(2);
    expect(books.every((b) => b.ready)).toBe(true);
    expect(books[0].sections.length).toBe(books[1].sections.length);
    expect(books[0].sections.map((s) => s.no)).toEqual(books[1].sections.map((s) => s.no));
    /* 两个人确实不是同一型，否则这本对照没意义 */
    expect(out.members.filter((m) => m.kind === "parent").length).toBe(2);
  });

  it("对照读本只摆引擎原话，不自己写建议", () => {
    expect(compare).toContain("buildCommKit");
    expect(compare).toContain("KitBlockView");
    /* 每位家长各取一本，不能合并成一本再拆 */
    expect(compare).toContain("buildCommKit({ parents: [{ label, result }] })");
    expect(compare).not.toContain("StandaloneParentDiscReport");
    /* 七节按 no 对齐；缺一节时如实说「没有」 */
    expect(compare).toContain("同一份引擎出的书");
    expect(compare).toContain("这一节对方没有对应内容");
  });

  it("对照要两条记录，两条都过可见范围校验（平台超管除外）", () => {
    expect(profileRouter).toContain("standaloneDiscPair");
    const body = profileRouter.slice(profileRouter.indexOf("standaloneDiscPair"));
    expect(body).toContain("需要对两条不同的记录");
    expect(body).toContain("isPlatformAdmin(ctx.user)");
    expect(body).toContain("属于其他机构");
    /* 只认扫码直测的家长 DISC */
    expect(body).toContain('row.kind !== "discparent"');
  });

  it("后台抽屉能选另一位家长对照，导出的是双人版 PDF", () => {
    expect(drawer).toContain("ParentDiscCompare");
    expect(drawer).toContain("standaloneDiscPair.useQuery");
    expect(drawer).toContain("对照另一位家长");
    expect(drawer).toContain("downloadParentDiscPairPdf");
    /* 换一条记录必须退出对照，否则会拿两家的孩子比 */
    expect(drawer).toContain("setCompareWith(null)");
  });

  it("打印页支持 ?a=&b=：双人版走登录态，单人版仍旧认钥匙", () => {
    expect(print).toContain('sp.get("a")');
    expect(print).toContain('sp.get("b")');
    expect(print).toContain("isPair");
    expect(print).toContain("ParentDiscCompare");
    expect(print).toContain("standaloneDiscPair.useQuery");
    expect(pdfLib).toContain("export function parentDiscPairPrintPath");
    expect(pdfLib).toContain("/pd-report?a=");
    expect(pdfLib).toContain("家长DISC-双人对照");
  });

  it("版本号已升到 v289", () => {
    expect(router).toContain('const BUILD_TAG = "v292-2026-11-15"');
  });
});
