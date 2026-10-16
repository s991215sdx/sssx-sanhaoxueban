/* v173 冒烟：资料库第二轮六点反馈——
   1) 查专业改掌上高考模式（门类侧栏 + 专业类分组 + 搜索切表格，不跳转就地介绍）；
   2) 查大学关键词搜索补省份字段（选广东+985 不再 0 结果）；
   3) 分数库按 Excel 式样三年分/位/批次/人数/计划 + 默认按 2026 预估位次排序；
   4) 职业库新增 28 个热门与新兴职业（幂等种子）；
   5) 12 门类页签点击大类就地展开介绍。
   要求：迁移三处同步、新查询走 tutorQuery、BUILD_TAG 已递增。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v173 资料库第二轮修复", () => {
  const mig = readFileSync("db/migrations/0033_scores_years_careers.sql", "utf-8");
  const schema = readFileSync("db/schema.ts", "utf-8");
  const router = readFileSync("api/libraryRouter.ts", "utf-8");
  const embedded = readFileSync("api/migrationsEmbedded.ts", "utf-8");
  const journal = readFileSync("db/migrations/meta/_journal.json", "utf-8");
  const page = readFileSync("src/pages/Library.tsx", "utf-8");
  const app = readFileSync("api/router.ts", "utf-8");

  it("0033 迁移：gd_scores 补三年明细列 + 职业库种子，三处同步", () => {
    for (const col of ["g_count", "y1_count", "y1_batch", "y1_plan", "y2_count", "y3_count", "y3_max", "y3_max_rank", "y3_batch", "y3_plan"]) {
      if (!mig.includes(`ADD \`${col}\``)) throw new Error(`缺列：${col}`);
    }
    const careerSeeds = (mig.match(/INSERT INTO `career_lib`/g) ?? []).length;
    if (careerSeeds < 28) throw new Error(`职业种子不足 28 条，实际 ${careerSeeds}`);
    if (!mig.includes("ON DUPLICATE KEY UPDATE")) throw new Error("种子缺幂等保护");
    if (!journal.includes("0033_scores_years_careers")) throw new Error("journal 未登记 0033");
    if (!embedded.includes("0033_scores_years_careers")) throw new Error("embedded 未登记 0033");
    for (const f of ["y1Count", "y1Batch", "y1Plan", "y2Count", "y3Count", "y3Max", "y3MaxRank", "y3Plan", "gCount"]) {
      if (!schema.includes(f)) throw new Error(`schema 缺字段：${f}`);
    }
  });

  it("查专业掌上高考模式：门类侧栏 + 详情 + 按门类分组查询", () => {
    if (!router.includes("majorsByMenlei: tutorQuery")) throw new Error("缺：按门类查专业");
    if (!/major: tutorQuery/.test(router)) throw new Error("缺：专业详情查询");
    if (!page.includes("MENLEI_INTRO")) throw new Error("缺：门类一句话介绍");
    if (!page.includes("MajorTable")) throw new Error("缺：搜索时表格组件");
    if (!page.includes("majorNav.useQuery")) throw new Error("缺：门类导航查询");
  });

  it("查大学搜索补省份字段", () => {
    if (!router.includes("like(universityLib.province, kw)")) throw new Error("关键词搜索未含省份字段");
  });

  it("分数库：三年双层表头 + 排序选择器（默认 est26）", () => {
    if (!router.includes('sort: z.enum(["est26", "y1Min", "y1Rank", "y2Min", "y3Min"])')) throw new Error("缺：排序枚举参数");
    if (!page.includes("YearCells")) throw new Error("缺：年度单元格组件");
    if (!page.includes("2026 预估位次 低→高")) throw new Error("缺：默认排序选项");
    if (!page.includes("人数")) throw new Error("缺：录取人数列");
  });

  it("12 门类页签点击就地展开介绍", () => {
    if (!page.includes("DisciplinesPanel")) throw new Error("缺：门类面板组件");
    if (!page.includes("全部专业 →")) throw new Error("缺：跳查专业入口");
  });

  it("BUILD_TAG 已递增到 v175", () => {
    if (!app.includes('const BUILD_TAG = "v176-2026-10-16";')) throw new Error("BUILD_TAG 未递增到 v175");
  });
});
