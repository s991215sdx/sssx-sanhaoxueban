/* v174 冒烟：资料库第三轮——
   1) 职业库分类统一 13 大类的 remap + 新增 53 职业（0034 迁移，幂等）；
   2) careers 查询支持 category 前缀参数（修分类 chips 只过滤当前页的 bug）；
   3) 院校卡片点击新标签页打开掌上高考详情页，库内详情改为入口按钮；
   4) 分数库/页签导航 sticky 置顶 + 数据原件在线 Excel 链接（/files 静态目录）。
   要求：迁移三处同步、BUILD_TAG 已递增。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v174 资料库第三轮", () => {
  const mig = readFileSync("db/migrations/0034_careers_unify_expand.sql", "utf-8");
  const router = readFileSync("api/libraryRouter.ts", "utf-8");
  const embedded = readFileSync("api/migrationsEmbedded.ts", "utf-8");
  const journal = readFileSync("db/migrations/meta/_journal.json", "utf-8");
  const page = readFileSync("src/pages/Library.tsx", "utf-8");
  const vite = readFileSync("api/lib/vite.ts", "utf-8");
  const app = readFileSync("api/router.ts", "utf-8");

  it("0034 迁移：19 条 remap + 53 条新职业，三处同步", () => {
    const updates = (mig.match(/UPDATE `career_lib` SET `category`/g) ?? []).length;
    if (updates !== 19) throw new Error(`remap 条数 ${updates} != 19`);
    const inserts = (mig.match(/INSERT INTO `career_lib`/g) ?? []).length;
    if (inserts !== 53) throw new Error(`新职业条数 ${inserts} != 53`);
    if (!mig.includes("ON DUPLICATE KEY UPDATE")) throw new Error("缺幂等保护");
    if (!journal.includes("0034_careers_unify_expand")) throw new Error("journal 未登记 0034");
    if (!embedded.includes("0034_careers_unify_expand")) throw new Error("embedded 未登记 0034");
  });

  it("careers 查询支持 category 前缀参数", () => {
    if (!router.includes("category: z.string().optional()")) throw new Error("缺 category 参数");
    if (!router.includes("like(careerLib.category, `${input.category}%`)")) throw new Error("缺前缀匹配");
    if (!page.includes("category: group || undefined")) throw new Error("前端未传 category");
  });

  it("院校卡片点击打开掌上高考新标签页", () => {
    if (!page.includes("window.open(u.detailUrl")) throw new Error("缺卡片外链");
    if (!page.includes("查看库内详情")) throw new Error("缺库内详情入口");
  });

  it("导航 sticky 置顶 + 数据原件在线 Excel", () => {
    if (!page.includes("sticky top-0 z-30")) throw new Error("缺页签导航 sticky");
    if (!page.includes("sticky top-[52px]")) throw new Error("缺分数库筛选栏 sticky");
    if (!page.includes("/files/gd-2026-expert.xlsx")) throw new Error("缺数据原件链接");
    if (!vite.includes('serveStatic({ root: "./data-files"')) throw new Error("缺 /files 静态目录");
  });

  it("BUILD_TAG 已递增到 v175", () => {
    if (!app.includes('const BUILD_TAG = "v178-2026-10-16";')) throw new Error("BUILD_TAG 未递增到 v175");
  });
});
