/* v157 冒烟：学员详情抽屉支持 URL 参数直达——/admin?student=<id>、/tutor?student=<id>。
   点击学员写入参数，关闭抽屉清除参数；刷新或转发链接可直接打开对应学员详情。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v157 详情抽屉 URL 参数联动", () => {
  const admin = readFileSync("src/pages/Admin.tsx", "utf-8");
  const tutor = readFileSync("src/pages/Tutor.tsx", "utf-8");

  it("Admin 学员列表：detailId 来自 student 参数且有校验", () => {
    if (!/useSearchParams/.test(admin)) throw new Error("缺：useSearchParams");
    if (!/searchParams\.get\("student"\)/.test(admin)) throw new Error("缺：读取 student 参数");
    if (!/ studentParam && \/\^\\d\+\$\//.test(admin)) throw new Error("缺：参数数字校验");
    if (!/onClick=\{\(\) => openDetail\(s\.userId\)\}/.test(admin)) throw new Error("缺：点击写入参数");
    if (!/<StudentDetailDrawer userId=\{detailId\} source="admin" onClose=\{closeDetail\} \/>/.test(admin))
      throw new Error("缺：admin 抽屉 closeDetail");
  });

  it("Tutor 伴学工作台：同样的参数联动", () => {
    if (!/useSearchParams/.test(tutor)) throw new Error("缺：useSearchParams");
    if (!/searchParams\.get\("student"\)/.test(tutor)) throw new Error("缺：读取 student 参数");
    if (!/ studentParam && \/\^\\d\+\$\//.test(tutor)) throw new Error("缺：参数数字校验");
    if (!/onClick=\{\(\) => openDetail\(s\.userId\)\}/.test(tutor)) throw new Error("缺：点击写入参数");
    if (!/<StudentDetailDrawer userId=\{detailId\} source="coach" onClose=\{closeDetail\} \/>/.test(tutor))
      throw new Error("缺：coach 抽屉 closeDetail");
  });

  it("版本标记已递增", () => {
    const r = readFileSync("api/router.ts", "utf-8");
    if (!r.includes('const BUILD_TAG = "v157-2026-10-14";')) throw new Error("BUILD_TAG 未递增到 v157");
  });
});
