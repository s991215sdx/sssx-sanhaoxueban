/* v175 冒烟：智慧生涯规划 ——
   1) 学科四维测评（9 科 × 4 维 × 3 题 = 108 题）题库、计分、解释文案齐备；
   2) 0035 迁移（kind 枚举加 subject4d + student_expectations 表）三处同步；
   3) profileRouter 支持 kind=subject4d 的答题/提交/最新结果；
   4) 测评中心入口（AssessmentCenter）+ 答题组件 Subject4dQuiz；
   5) 智慧生涯规划报告页 ZhihuiReport + 报告数据接口 zhihuiRouter + 报告区入口卡片；
   6) 越权防护：查看/代编他人数据须伴学师或管理员。
   要求：BUILD_TAG 已递增。 */
import { describe, it } from "vitest";
import { readFileSync } from "fs";

describe("v175 智慧生涯规划", () => {
  const bank = readFileSync("contracts/subject4d.ts", "utf-8");
  const mig = readFileSync("db/migrations/0035_subject4d_expectations.sql", "utf-8");
  const journal = readFileSync("db/migrations/meta/_journal.json", "utf-8");
  const embedded = readFileSync("api/migrationsEmbedded.ts", "utf-8");
  const schema = readFileSync("db/schema.ts", "utf-8");
  const profile = readFileSync("api/profileRouter.ts", "utf-8");
  const zhihui = readFileSync("api/zhihuiRouter.ts", "utf-8");
  const router = readFileSync("api/router.ts", "utf-8");
  const center = readFileSync("src/pages/AssessmentCenter.tsx", "utf-8");
  const quiz = readFileSync("src/components/companion/Subject4dQuiz.tsx", "utf-8");
  const report = readFileSync("src/pages/ZhihuiReport.tsx", "utf-8");
  const detail = readFileSync("src/pages/ReportDetail.tsx", "utf-8");
  const app = readFileSync("src/App.tsx", "utf-8");

  it("四维题库：9 科 × 12 题 = 108 题 + 计分 + 解释", () => {
    if (!bank.includes("SUBJECT4D_BANK")) throw new Error("缺题库");
    if (!bank.includes("SUBJECT4D_INTERP")) throw new Error("缺解释文案");
    if (!bank.includes("scoreSubject4d")) throw new Error("缺计分函数");
    const subjects = ["语文", "数学", "英语", "物理", "化学", "生物", "历史", "地理", "政治"];
    for (const s of subjects) {
      if (!bank.includes(`"${s}"`)) throw new Error(`题库缺科目 ${s}`);
    }
  });

  it("0035 迁移三处同步（kind 枚举 + 期望表）", () => {
    if (!mig.includes("subject4d")) throw new Error("迁移缺 subject4d");
    if (!mig.includes("student_expectations")) throw new Error("迁移缺期望表");
    if (!journal.includes("0035_subject4d_expectations")) throw new Error("journal 未登记 0035");
    if (!embedded.includes("0035_subject4d_expectations")) throw new Error("embedded 未登记 0035");
    if (!schema.includes('"subject4d"')) throw new Error("schema kind 枚举缺 subject4d");
    if (!schema.includes("studentExpectations")) throw new Error("schema 缺期望表定义");
  });

  it("嵌入迁移表完整：journal 每条都有对应 SQL（0029/0030 回归）", () => {
    for (const tag of ["0029_tutor_report_access", "0030_invite_report_default"]) {
      if (!embedded.includes(`"${tag}":`)) throw new Error(`MIGRATION_SQL 缺 ${tag}`);
    }
    // 多条语句必须带 statement-breakpoint 分隔（执行器按此切分）
    const m29 = embedded.match(/"0029_tutor_report_access": "([^"]*)"/);
    if (!m29 || !m29[1]!.includes("statement-breakpoint")) throw new Error("0029 缺 statement-breakpoint");
    // 0031+ 迁移须兼容正式服 MySQL 5.7：禁止 8.0 表达式默认值 (now())
    for (const tag of ["0031_zhihui_libs", "0032_university_lib", "0033_scores_years_careers", "0034_careers_unify_expand", "0035_subject4d_expectations"]) {
      const mm = embedded.match(new RegExp(`"${tag}": "([^]*)"`, "s"));
      if (mm && mm[1]!.includes("DEFAULT (now())")) throw new Error(`${tag} 含 MySQL5.7 不兼容的 DEFAULT (now())`);
    }
  });

  it("profileRouter 支持 subject4d 答题/提交/最新结果", () => {
    if (!profile.includes('"subject4d"')) throw new Error("kindSchema 缺 subject4d");
    if (!profile.includes('input.kind === "subject4d"')) throw new Error("缺提交分支");
    if (!profile.includes("scoreSubject4d")) throw new Error("未接入计分");
    if (!profile.includes('key === "subject4d"')) throw new Error("latest 查询缺 subject4d");
  });

  it("测评中心入口 + 答题组件", () => {
    if (!center.includes("Subject4dQuiz")) throw new Error("测评中心未挂答题组件");
    if (!center.includes('"subject4d"')) throw new Error("测评中心缺 subject4d 条目");
    if (!quiz.includes("quizDraft")) throw new Error("答题组件缺断点续答");
  });

  it("报告页 + 数据接口 + 越权防护 + 入口卡片", () => {
    if (!zhihui.includes("reportData")) throw new Error("缺报告数据接口");
    if (!zhihui.includes("expectationsSet")) throw new Error("缺期望保存接口");
    if (!zhihui.includes("assertStaffIfOther")) throw new Error("缺越权防护");
    if (!router.includes("zhihuiRouter")) throw new Error("router 未挂载 zhihuiRouter");
    if (!report.includes("智慧生涯规划报告")) throw new Error("报告页缺标题");
    if (!detail.includes("/zhihui-report")) throw new Error("测评报告区缺入口卡片");
    if (!app.includes('path="/zhihui-report"')) throw new Error("App 未注册报告路由");
    if (!app.includes('"/zhihui-report"')) throw new Error("staffPaths 未放行报告页");
  });

  it("BUILD_TAG 已递增到 v175", () => {
    if (!router.includes('const BUILD_TAG = "v177-2026-10-16";')) throw new Error("BUILD_TAG 未递增到 v175");
  });
});
