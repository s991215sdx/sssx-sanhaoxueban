/* v72 冒烟：升学指导报告构建 / 学习力报告摘除锚+霍兰德 / 成绩历史迁移与接口 / 基本信息门禁 */
import { readFileSync } from "node:fs";

const need = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error(`SMOKE_FAIL: ${msg}`);
    process.exit(1);
  }
};
const needSrc = (src: string, kw: string, where: string) => need(src.includes(kw), `${where} 缺少「${kw}」`);

/* ---------- 1. buildGuidanceReport 功能冒烟 ---------- */
const { buildGuidanceReport } = await import("../src/data/reports/guidance");

const g = buildGuidanceReport({
  grade: "高一",
  mbti: { type: "INTJ", dims: { E: 25, I: 75, S: 30, N: 70, T: 80, F: 20, J: 65, P: 35 } },
  disc: { primary: "C", dims: { D: 20, I: 25, S: 30, C: 45 }, version: 2 },
  multi5: {
    dims: { reasoning: 82, detail: 70, number: 88, verbal: 60, spatial: 66 },
    overall: 73,
    carefulIndex: 78,
    perDim: [],
  },
  holland: { dims: { R: 3.2, I: 4.5, A: 2.8, S: 3.0, E: 2.5, C: 3.8 }, top3: ["I", "C", "R"], code: "ICR", keywords: "", summary: "" },
  anchor: { dims: { TF: 4.2, GM: 3.8, AU: 3.1, SE: 2.9, EC: 2.6, SV: 2.4, CH: 3.3, LS: 2.2 }, top2: ["TF", "GM"], summary: "" },
});
need(g !== null, "全量数据必须生成升学指导报告");
need(g!.majors.length >= 3, "专业方向至少 3 个");
need(g!.industries.length >= 3, "行业方向至少 3 个");
need(g!.subjectAdvice.length >= 1, "高中年级必须给选科建议");
need(g!.basedOn.length === 5 && g!.missing.length === 0, "五项齐 basedOn/missing 计数");
const g2 = buildGuidanceReport({});
need(g2 === null, "全空数据必须返回 null");
const g3 = buildGuidanceReport({ grade: "初一", mbti: { type: "INFP", dims: { E: 30, I: 70, S: 45, N: 55, T: 40, F: 60, J: 30, P: 70 } } });
need(g3 !== null && g3.mbtiBlock?.type === "INFP" && g3.missing.length === 4, "仅 MBTI 也可出报告并提示补缺");

/* ---------- 2. 学习力报告摘除 ---------- */
const combinedSrc = readFileSync("src/data/reports/combined.ts", "utf8");
need(!combinedSrc.includes("secCareer"), "combined.ts 不得残留 secCareer");
need(!combinedSrc.includes('title: "兴趣与方向"'), "学习力报告不得再含「兴趣与方向」章节");
need(!combinedSrc.includes("霍兰德职业兴趣\",") && !combinedSrc.includes("label: \"职业锚\""), "学习力报告总览卡不得含锚/霍兰德");
const rvSrc = readFileSync("src/components/reports/ReportView.tsx", "utf8");
needSrc(rvSrc, "{ key: \"guidance\", label: \"升学指导报告\" }", "报告 tab");
needSrc(rvSrc, "<ScoreTrendCard />", "成绩曲线挂载");
needSrc(rvSrc, "<GuidanceTab", "升学 tab 挂载");
need(!rvSrc.includes("HollandRadar holland={data.holland}"), "学习力报告雷达图必须下线");
const sfSrc = readFileSync("src/components/reports/SystemFramework.tsx", "utf8");
need(!sfSrc.includes("holland"), "框架图不得含 holland");
need(!sfSrc.includes("anchor"), "框架图不得含 anchor");

/* ---------- 3. 成绩历史：schema / 迁移 / 接口 ---------- */
const schemaSrc = readFileSync("db/schema.ts", "utf8");
needSrc(schemaSrc, 'mysqlTable("academic_records"', "schema 新表");
const migSrc = readFileSync("api/migrationsEmbedded.ts", "utf8");
needSrc(migSrc, "0023_academic_records", "迁移条目");
needSrc(migSrc, "CREATE TABLE `academic_records`", "迁移 SQL");
const profSrc = readFileSync("api/profileRouter.ts", "utf8");
needSrc(profSrc, "academicRecords:", "成绩历史查询接口");
needSrc(profSrc, "db.insert(academicRecords)", "保存时追加记录");

/* ---------- 4. 基本信息门禁与编辑 ---------- */
const appSrc = readFileSync("src/App.tsx", "utf8");
needSrc(appSrc, "BasicsGate", "测评基本信息门禁");
needSrc(appSrc, "<BasicsGate>", "门禁挂载");
const pcSrc = readFileSync("src/components/companion/ProfileCard.tsx", "utf8");
needSrc(pcSrc, "编辑基本信息", "档案卡编辑入口");
needSrc(pcSrc, "trpc.profile.setup.useMutation", "编辑复用 setup");
const acSrc = readFileSync("src/pages/AssessmentCenter.tsx", "utf8");
needSrc(acSrc, "tab=guidance", "测评中心升学报告入口");
need(!acSrc.includes("disabled={!allRequired}"), "综合报告卡不得再禁用");
needSrc(readFileSync("api/router.ts", "utf8"), "v72-2026-09-24", "BUILD_TAG v72");

console.log("RENDER_SMOKE_V72_OK");
