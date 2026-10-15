/* v172 冒烟：院校库（0030_university_lib，掌上高考院校基础信息总表 2991 所）——
   查大学按省份归类 + 层次/性质/特色标签过滤，供测评报告「目标院校规划」与伴学师演示调用；
   查专业页签按自然科学(理工农医)/社会科学(经管法教)/人文科学(文哲史艺)三大领域分组。
   要求：迁移三处同步、查询走 tutorQuery、导入走 adminQuery 且分块 ≤300 行。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v172 院校库 + 查大学/查专业分组", () => {
  const mig = readFileSync("db/migrations/0030_university_lib.sql", "utf-8");
  const schema = readFileSync("db/schema.ts", "utf-8");
  const router = readFileSync("api/libraryRouter.ts", "utf-8");
  const embedded = readFileSync("api/migrationsEmbedded.ts", "utf-8");
  const journal = readFileSync("db/migrations/meta/_journal.json", "utf-8");
  const page = readFileSync("src/pages/Library.tsx", "utf-8");

  it("迁移建表 university_lib 并带省份索引", () => {
    if (!mig.includes("CREATE TABLE `university_lib`")) throw new Error("缺表：university_lib");
    if (!mig.includes("university_lib_name_unique")) throw new Error("缺：院校名唯一键");
    if (!mig.includes("university_lib_province_idx")) throw new Error("缺：省份索引");
    if (!journal.includes("0030_university_lib")) throw new Error("journal 未登记 0030");
    if (!embedded.includes("0030_university_lib")) throw new Error("embedded 未登记 0030");
    if (!schema.includes("export const universityLib")) throw new Error("schema 缺 universityLib");
  });

  it("查询走 tutorQuery，导入走 adminQuery 且分块 ≤300", () => {
    if (!router.includes("universities: tutorQuery")) throw new Error("缺：院校查询");
    if (!router.includes("universitiesImport: adminQuery")) throw new Error("缺：院校导入");
    if (!router.includes(".max(300)")) throw new Error("缺：300 行分块上限");
    if (!router.includes("universityProvinces: tutorQuery")) throw new Error("缺：省份导航");
    if (!router.includes("university: tutorQuery")) throw new Error("缺：院校详情");
  });

  it("查大学页签：省份归类 + 过滤 + 导入", () => {
    if (!page.includes('label: "查大学"')) throw new Error("缺：查大学标签");
    if (!page.includes("universityProvinces.useQuery")) throw new Error("缺：省份导航查询");
    if (!page.includes("trpc.library.universities.useQuery")) throw new Error("缺：院校查询");
    if (!page.includes("导入院校库 JSON")) throw new Error("缺：院校导入按钮");
    if (!page.includes("985") || !page.includes("211") || !page.includes("双一流")) throw new Error("缺：特色标签过滤");
  });

  it("查专业页签按三大领域分组", () => {
    if (!page.includes('label: "查专业"')) throw new Error("缺：查专业标签");
    for (const g of ["自然科学", "社会科学", "人文科学"]) {
      if (!page.includes(g)) throw new Error(`缺领域：${g}`);
    }
    if (!page.includes("理学", 0) || !/menleis: \["经济学"/.test(page)) throw new Error("缺：领域门类映射");
  });
});
