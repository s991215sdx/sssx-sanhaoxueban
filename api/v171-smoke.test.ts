/* v171 冒烟：智慧生涯 · 数据底座三库（0031_zhihui_libs）——
   伴学师/管理员可查询专业底层库、职业库、广东院校专业分数库与 12 学科门类；
   管理员可分块导入专业库/分数库 JSON、编辑职业库、维护分年级规划模板；
   学员未来期望允许留空、伴学师后台代编（source=tutor）。
   要求：迁移三处同步（migrations/meta/_journal.json + api/migrationsEmbedded.ts + db/schema.ts）、
   查询走 tutorQuery（伴学师+管理员双角色）、导入走 adminQuery、职业种子 20 条随迁移插入。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v171 智慧生涯数据底座三库", () => {
  const mig = readFileSync("db/migrations/0031_zhihui_libs.sql", "utf-8");
  const schema = readFileSync("db/schema.ts", "utf-8");
  const router = readFileSync("api/libraryRouter.ts", "utf-8");
  const app = readFileSync("api/router.ts", "utf-8");
  const embedded = readFileSync("api/migrationsEmbedded.ts", "utf-8");
  const journal = readFileSync("db/migrations/meta/_journal.json", "utf-8");
  const page = readFileSync("src/pages/Library.tsx", "utf-8");

  it("迁移建齐 5 张表并带索引", () => {
    for (const t of ["major_lib", "career_lib", "gd_scores", "grade_plans", "student_aspirations"]) {
      if (!mig.includes(`CREATE TABLE \`${t}\``)) throw new Error(`缺表：${t}`);
    }
    if (!mig.includes("major_lib_code_unique")) throw new Error("缺：专业 code 唯一键");
    if (!mig.includes("gd_scores_school_idx")) throw new Error("缺：分数库院校索引");
    if (!mig.includes("student_aspirations_user_unique")) throw new Error("缺：期望 user 唯一键");
  });

  it("迁移三处同步（journal / embedded / schema）", () => {
    if (!journal.includes("0031_zhihui_libs")) throw new Error("journal 未登记 0029");
    if (!embedded.includes("0031_zhihui_libs")) throw new Error("embedded 未登记 0029");
    for (const t of ["majorLib", "careerLib", "gdScores", "gradePlans", "studentAspirations"]) {
      if (!schema.includes(`export const ${t} =`)) throw new Error(`schema 缺：${t}`);
    }
  });

  it("职业种子 20 条随迁移插入", () => {
    const n = (mig.match(/INSERT INTO `career_lib`/g) ?? []).length;
    if (n !== 20) throw new Error(`职业种子应为 20 条，实际 ${n}`);
  });

  it("查询走 tutorQuery（伴学师+管理员），导入/编辑走 adminQuery", () => {
    if (!router.includes("tutorQuery")) throw new Error("缺 tutorQuery");
    if (!router.includes("adminQuery")) throw new Error("缺 adminQuery");
    // 期望代编必须记录来源与操作人
    if (!/source: "tutor" as const/.test(router)) throw new Error("缺：source=tutor");
    if (!router.includes("updatedBy: ctx.user.id")) throw new Error("缺：updatedBy");
  });

  it("分块导入上限 2000 行/块，分数库支持清空重导", () => {
    if (!router.includes(".max(2000)")) throw new Error("缺：2000 行分块上限");
    if (!/clear: z\.boolean\(\)/.test(router)) throw new Error("缺：clear 参数");
    if (!router.includes("if (input.clear) await db.delete(gdScores)")) throw new Error("缺：清空逻辑");
  });

  it("路由挂载 library 且 BUILD_TAG 递增", () => {
    if (!app.includes("library: libraryRouter")) throw new Error("主路由未挂载 library");
    if (!app.includes('const BUILD_TAG = "v176-2026-10-16";')) throw new Error("BUILD_TAG 未递增到 v175");
  });

  it("前端四标签页 + 导入仅管理员可见", () => {
    for (const t of ["专业底层库", "职业库", "院校专业分数库", "12 学科门类"]) {
      if (!page.includes(t)) throw new Error(`缺标签：${t}`);
    }
    if (!page.includes("ImportButton label=\"导入专业库 JSON\"")) throw new Error("缺：专业库导入按钮");
    if (!page.includes("isAdmin &&")) throw new Error("缺：管理员可见性判断");
    if (!page.includes("trpc.library.majors.useQuery")) throw new Error("缺：专业库查询");
  });
});
