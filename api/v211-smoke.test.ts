/* v211 冒烟：报告「真下载」——服务端 Playwright 渲染 PDF + 前端下载/打印拆分。
   问题（孙冬晓 2026-10-19）：报告页「下载 / 打印」按钮实际只有打印（window.print），没有下载。
   口径：
   - 服务端 /api/report-pdf：白名单页面（/zhihui-report、/report-detail）+ Cookie 透传 + Playwright 渲染 A4 PDF；
   - playwright-core 用 createRequire 运行时加载（不打进 esbuild bundle），Chromium 用服务器已装内核；
   - 前端 src/lib/reportPdf.ts 下载 Blob；选科报告页拆成「下载 PDF / 打印」两个按钮；
   - ReportView「下载报告」优先服务端 PDF（注意 /report-detail 仅本人数据，伴学师视角仅 zhihui 可用），失败回退打印。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v211 报告 PDF 下载", () => {
  const api = read("api/reportPdf.ts");
  const boot = read("api/boot.ts");
  const helper = read("src/lib/reportPdf.ts");
  const zh = read("src/pages/ZhihuiReport.tsx");
  const rv = read("src/components/reports/ReportView.tsx");
  const pkg = read("package.json");
  const router = read("api/router.ts");

  it("服务端端点：白名单 + Cookie 透传 + Playwright", () => {
    if (!/PDF_PATH_WHITELIST = \["\/zhihui-report", "\/report-detail"\]/.test(api)) throw new Error("缺：路径白名单");
    if (!/addCookies/.test(api)) throw new Error("缺：Cookie 透传");
    if (!/page\.pdf\(\{ format: "A4"/.test(api)) throw new Error("缺：A4 PDF 渲染");
    if (!/req\("playwright-core"\)/.test(api)) throw new Error("缺：运行时加载");
    if (!/app\.get\("\/api\/report-pdf", reportPdfHandler\)/.test(boot)) throw new Error("缺：端点挂载");
  });

  it("前端：下载 helper + 双按钮 + ReportView 接入", () => {
    if (!/downloadReportPdf/.test(helper)) throw new Error("缺：下载 helper");
    if (!/下载 PDF/.test(zh) || !/打印/.test(zh)) throw new Error("缺：双按钮");
    if (!/downloadReportPdf\(/.test(rv)) throw new Error("缺：ReportView 接入");
    if (!/playwright-core/.test(pkg)) throw new Error("缺：package.json 依赖");
  });

  it("BUILD_TAG 已递增到 v211", () => {
    const v = Number(router.match(/const BUILD_TAG = "v(\d+)-/)?.[1] ?? 0);
    if (v < 211) throw new Error(`BUILD_TAG 未递增到 v211（当前 v${v}）`);
  });
});
