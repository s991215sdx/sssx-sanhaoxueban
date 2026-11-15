/**
 * v286 冒烟：家长 DISC 读本合订本（上段 DISC / 下段沟通建议）+ 导出 PDF + /pd 结果页。
 *
 * 断言分三层：
 * 1. 内容层——只给一份家长作答，锦囊引擎就该出「家长个人版」这一本，且不需要孩子的数据；
 * 2. 渲染层——抽屉、/pd 结果页、打印页三处共用同一个 Reader（不许各写一套）；
 * 3. 通道层——/pd-report 打印页在路由里公开，PDF 端点认「查看钥匙」也认 Cookie。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { buildCommKit } from "../contracts/familyCommKit";
import { DISC_PARENT_V2_GROUPS, scoreDiscV2 } from "../contracts/assessments";

const read = (p: string) => readFileSync(p, "utf8");
const reader = read("src/components/reports/ParentDiscReader.tsx");
const drawer = read("src/components/coach/ParentDiscPanel.tsx");
const join = read("src/pages/ParentDiscJoin.tsx");
const print = read("src/pages/ParentDiscPrint.tsx");
const app = read("src/App.tsx");
const pdfHandler = read("api/reportPdf.ts");
const profileRouter = read("api/profileRouter.ts");
const router = read("api/router.ts");
const kit = read("src/components/reports/FamilyCommKit.tsx");

describe("v286 家长 DISC 融合读本", () => {
  it("只有一份家长作答时，锦囊就出「家长个人版」这一本，不需要孩子数据", () => {
    /* 造一份真实结构的 V2 作答：24 组每组都选第 0 个词「最像」、第 3 个「最不像」 */
    const answers = {
      most: DISC_PARENT_V2_GROUPS.map(() => 0),
      least: DISC_PARENT_V2_GROUPS.map(() => 3),
    };
    const result = scoreDiscV2(answers, DISC_PARENT_V2_GROUPS);
    const out = buildCommKit({ parents: [{ label: "妈妈", result }] });
    const parentBooks = out.books.filter((b) => b.key === "parent");
    expect(parentBooks.length).toBe(1);
    expect(parentBooks[0].ready).toBe(true);
    expect(parentBooks[0].sections.length).toBeGreaterThanOrEqual(6);
    /* 学生那几本必须如实标「出不来」，不能靠家长数据硬凑 */
    expect(out.books.find((b) => b.key === "trio")?.ready).toBe(false);
  });

  it("一套渲染两段：上段搬原有 DISC 报告，下段铺锦囊七节", () => {
    expect(reader).toContain('id="pd-part-1"');
    expect(reader).toContain('id="pd-part-2"');
    expect(reader).toContain("StandaloneParentDiscReport");
    expect(reader).toContain("buildCommKit({ parents: [{ label, result }] })");
    expect(reader).toContain("KitBlockView");
    /* 段与段之间要有过渡，不能硬切 */
    expect(reader).toContain("为什么后面还有一半");
    /* 纸面分页：段头不留在页底、目录卡整块不拆；不强行另起一页（会留半页空白） */
    expect(reader).toContain("print:break-after-avoid");
    expect(reader).toContain("print:break-inside-avoid");
  });

  it("后台抽屉改成上下两段，并给出导出 PDF", () => {
    expect(drawer).toContain("ParentDiscReader");
    expect(drawer).not.toContain("StandaloneParentDiscReport");
    expect(drawer).toContain("downloadParentDiscPdf");
    expect(drawer).toContain("导出 PDF");
  });

  it("/pd 交卷后的结果页与回看页都给整本，不只给 DISC", () => {
    expect(join).toContain("ParentDiscReader");
    expect(join).not.toContain("StandaloneParentDiscReport");
    /* 交卷结果页与「查看我的报告」两处都要有 */
    expect(join.match(/<ParentDiscReader/g)?.length).toBe(2);
    expect(join).toContain("submit.data.id");
    expect(join).toContain("review?.viewKey");
  });

  it("打印页公开可进，并给 PDF 端点留出数据就绪标记", () => {
    expect(app).toContain('path="/pd-report"');
    expect(print).toContain('id="pd-print-root"');
    expect(print).toContain('data-ready="1"');
    expect(print).toContain("data-pd-error");
    expect(print).toContain("printMode");
  });

  it("PDF 端点认 /pd-report：有钥匙免登录，没钥匙走 Cookie；等数据到位再出纸", () => {
    expect(pdfHandler).toContain('"/pd-report"');
    expect(pdfHandler).toContain("hasViewKey");
    expect(pdfHandler).toContain('k=[0-9a-f]{8,}');
    expect(pdfHandler).toContain('#pd-print-root[data-ready="1"]');
    expect(pdfHandler).toContain("preferCSSPageSize");
  });

  it("回看接口补上本地时间文本，前端不再自己算时区", () => {
    expect(profileRouter).toContain("createdAtText: sql<string>`date_format(");
    expect(join).toContain("rd.createdAtText");
    expect(join).not.toContain("toLocaleString");
  });

  it("锦囊块渲染只留一份实现（FamilyCommKit 导出给读本复用）", () => {
    expect(kit).toContain("export function KitBlockView");
    expect(kit).not.toContain("function Block({ b }");
  });

  it("版本号已升到 v286", () => {
    expect(router).toContain('const BUILD_TAG = "v287-2026-11-15"');
  });
});
