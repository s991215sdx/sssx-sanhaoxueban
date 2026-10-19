/* v209 冒烟：粤华学生「所有报告」页脚统一挂学校品牌 + 页码居中。
   需求（孙冬晓 2026-10-19）：打印时页脚要有「东莞粤华学校 · 生涯规划测评」，
   页码从右侧移到中间（双面打印左右页脚对齐）。
   口径：ReportBrandCtx（null=不变，仅校园渠道学生注入品牌）；
   覆盖 olive book（OPage）与选科及升学规划报告（zh Page）两类页脚。
   版本注记：与唐海陵 v208（综合学习力报告打印分页修复）同日撞号，本特性顺延为 v209。 */
import { describe, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p: string) => readFileSync(join(root, p), "utf8");

describe("v209 报告页脚品牌 + 页码居中", () => {
  const olive = read("src/components/reports/olive/OliveBook.tsx");
  const zh = read("src/pages/ZhihuiReport.tsx");
  const rv = read("src/components/reports/ReportView.tsx");
  const invite = read("api/inviteRouter.ts");
  const router = read("api/router.ts");

  it("品牌 Context 存在且 OPage 页脚可替换", () => {
    if (!/ReportBrandCtx = createContext/.test(olive)) throw new Error("缺：ReportBrandCtx");
    if (!/brand \?\? foot/.test(olive)) throw new Error("缺：OPage 品牌替换");
  });

  it("页码居中（olive + zh 双口径，含移动端回退）", () => {
    if (!/\.ob-pno \{ position: absolute; left: 50%/.test(olive)) throw new Error("缺：ob 页码居中");
    if (!/<span className="ob-pno">/.test(olive)) throw new Error("缺：ob 页码类名");
    if (!/\.pno \{ position: absolute; left: 50%/.test(zh)) throw new Error("缺：zh 页码居中");
    if (!/<span className="pno">/.test(zh)) throw new Error("缺：zh 页码类名");
  });

  it("ReportView / ZhihuiReportBody 注入品牌，studentCampus 返回 brand", () => {
    if (!/ReportBrandCtx\.Provider value=\{reportBrand\}/.test(rv)) throw new Error("缺：ReportView 注入");
    if (!/ReportBrandCtx\.Provider value=\{reportBrand\}/.test(zh)) throw new Error("缺：ZhihuiReportBody 注入");
    if (!/brand: ch\?\.campus/.test(invite)) throw new Error("缺：studentCampus 品牌返回");
  });

  it("BUILD_TAG 已递增到 v209", () => {
    const v = Number(router.match(/const BUILD_TAG = "v(\d+)-/)?.[1] ?? 0);
    if (v < 209) throw new Error(`BUILD_TAG 未递增到 v209（当前 v${v}）`);
  });
});
