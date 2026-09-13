/** @jsxImportSource react */
/* v36 冒烟：renderToStaticMarkup 渲染 ReportView，验证本轮五项调整
   1. 冰山/方案表答题明细 = 折叠式直出（不再跳转）；2. 框架图已测徽章无链接；
   3. 层内重点项按红黄绿着色；4. 先抓这三件事已删；5. 模块章分项介绍已删；6. 图表折叠默认展开。 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import ReportView from "../src/components/reports/ReportView";
import { scoreMbti, scoreDisc, MBTI_QUESTIONS, DISC_QUESTIONS } from "../contracts/assessments";
import { scoreE3V37 } from "../contracts/e3v37";
import { scoreHolland } from "../contracts/holland";
import { scoreAnchor } from "../contracts/careerAnchor";
import { scoreMulti5, MULTI5_QUESTIONS } from "../contracts/multi5";
import { scoreMental, MENTAL_V2_QUESTION_COUNT } from "../contracts/mentalHealth";
import { MBTI_REPORTS, DISC_REPORTS, buildCombinedReport } from "../src/data/reports";

/* 三档色值（与 e3v37Theme 一致）：用于断言层内重点项按红黄绿着色 */
const E3V37_BAD = "#8f1313";
const E3V37_MID = "#8a6d1a";
const E3V37_OK = "#5a9326";

const ratings70 = Array.from({ length: 70 }, (_, i) => (i % 5) + 1);
const mbti = scoreMbti(Array.from({ length: 28 }, (_, i) => (i % 3 === 0 ? 0 : 1)));
const disc = scoreDisc(Array.from({ length: 24 }, (_, i) => i % 2));
const e3 = scoreE3V37({
  stage: "junior",
  ratings: ratings70,
  motivation: "want",
  subjects: [{ name: "数学", like: 4, master: 3, perform: 3, rank: 3, weak: true }] as any,
  lossReasons: [],
  scoreTrend: "基本稳定",
  lifeEvents: Array.from({ length: 8 }, () => 0),
  openAnswers: [],
});
const academics = {
  examName: "期中考试",
  subjects: [
    { name: "语文", selfLevel: 3, fullScore: 120, lastScore: 96, targetScore: 108 },
    { name: "数学", selfLevel: 3, fullScore: 120, lastScore: 100, targetScore: 112 },
  ],
  updatedAt: Date.now(),
} as any;

const data: any = {
  mbti, disc, e3,
  multi5: scoreMulti5(MULTI5_QUESTIONS.map((q: any) => q.answer ?? 0)),
  holland: scoreHolland(Array.from({ length: 36 }, (_, i) => (i % 5) + 1)),
  anchor: scoreAnchor(Array.from({ length: 40 }, (_, i) => (i % 5) + 1)),
  mental: scoreMental(Array.from({ length: MENTAL_V2_QUESTION_COUNT }, (_, i) => i % 3)),
  raw: [
    { kind: "e3", answers: { stage: "junior", ratings: ratings70, motivation: "want", subjects: [], lossReasons: [], scoreTrend: "", lifeEvents: [], openAnswers: [] }, createdAt: new Date() },
    { kind: "mbti", answers: Array.from({ length: 28 }, () => 0), createdAt: new Date() },
    { kind: "disc", answers: Array.from({ length: 24 }, () => 0), createdAt: new Date() },
    { kind: "multi5", answers: MULTI5_QUESTIONS.map((q: any) => q.answer ?? 0), createdAt: new Date() },
    { kind: "anchor", answers: Array.from({ length: 40 }, () => 3), createdAt: new Date() },
    { kind: "holland", answers: Array.from({ length: 36 }, () => 3), createdAt: new Date() },
    { kind: "mental", answers: Array.from({ length: MENTAL_V2_QUESTION_COUNT }, () => 1), createdAt: new Date() },
  ],
  discParents: [],
};

const render = (tab: string, opts: { viewer?: "student" | "tutor"; withAcad?: boolean } = {}) =>
  renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      { initialEntries: [`/report-detail?tab=${tab}`] },
      React.createElement(ReportView, {
        data,
        profile: { name: "测试员", grade: "初一", academics: opts.withAcad === false ? undefined : academics },
        viewer: opts.viewer ?? "student",
        onEditAcademics: () => {},
      }),
    ),
  );

const need = (html: string, kw: string, where: string) => {
  if (!html.includes(kw)) throw new Error(`${where} 缺少: ${kw}`);
  console.log(`OK [${where}] ${kw}`);
};

/* 双模式全 tab 白屏检查 */
for (const viewer of ["student", "tutor"] as const) {
  for (const tab of ["combined", "e3", "mbti", "disc", "multi5", "anchor", "holland", "mental", "academics"]) {
    const html = render(tab, { viewer });
    if (html.length < 200) throw new Error(`${viewer}/${tab} 渲染内容过短`);
  }
}
console.log("双模式全 tab 白屏检查 OK");

const full = render("combined");
/* 需求1/3：冰山与方案表 = 折叠式答题明细（直出在行内，不再跳转链接） */
need(full, "答题明细（点击展开）", "综合详版");
if (full.includes("答题明细 →")) throw new Error("仍存在跳转式「答题明细 →」链接");
console.log("OK 无跳转式答题明细链接");
for (const id of ["ansblk-e3-lexue", "ansblk-e3-huixue", "ansblk-e3-shanxue", "ansblk-e3-tiaojian", "ansblk-e3-xueneng", "ansblk-mental", "ansblk-mbti", "ansblk-multi5", "ansblk-anchor", "ansblk-holland"]) {
  need(full, `id="${id}"`, "综合详版");
}
/* 需求3：层内重点项红黄绿着色（inline style 色值） */
need(full, E3V37_BAD, "综合详版");
need(full, E3V37_MID, "综合详版");
need(full, E3V37_OK, "综合详版");
/* 需求4：先抓这三件事已删 */
if (full.includes("先抓这三件事")) throw new Error("仍存在「先抓这三件事」");
console.log("OK 先抓这三件事已删除");
/* 需求2：框架图已测徽章不再链接（hint 文案更新，无 tab 跳转提示） */
need(full, "灰虚线徽章可直接点击开始测评", "框架图");
if (full.includes("点击任意徽章")) throw new Error("仍存在「点击任意徽章」链接提示");
console.log("OK 框架图图表链接提示已移除");
/* 需求6：图形与图表默认展开（SSR 输出 open 属性） */
if (!/<details open=""/.test(full)) throw new Error("图形与图表未默认展开");
console.log("OK 图形与图表默认展开");
/* 需求5：模块章分项介绍卡已删（数据层断言：三个模块章不再有可见 items） */
const combined = buildCombinedReport(mbti, MBTI_REPORTS[mbti.type], disc, DISC_REPORTS[disc.primary], e3, { academics });
for (const sys of ["乐学", "会学", "善学"]) {
  const sec = combined.sections.find((s) => s.title.includes(`${sys}模块`));
  if (!sec) throw new Error(`缺少${sys}模块章`);
  if (sec.items?.length) throw new Error(`${sys}模块章仍存在分项介绍 items`);
  if (!(sec.detailItems?.length ?? 0)) throw new Error(`${sys}模块章详细报告文字缺失`);
  console.log(`OK ${sys}模块章分项介绍已删，详细文字保留`);
}

/* 无成绩态保持：未填写 + 去填写链接 */
const noAcad = render("combined", { withAcad: false });
need(noAcad, "未填写", "综合详版(无成绩)");
need(noAcad, "去填写成绩与目标", "综合详版(无成绩)");
if (noAcad.includes("各科均已达标")) throw new Error("无成绩时不应显示「各科均已达标」");
console.log("OK 无成绩时显示未填写而非已达标");

/* ===== v37 增量断言：DISC V2 + 打印隐藏 ===== */
import { scoreDiscV2, DISC_V2_GROUPS, DISC_PARENT_V2_GROUPS, isDiscV2Answers } from "../contracts/assessments";
import { buildAnswerBlocks } from "../src/components/reports/answerBlocks";

/* DISC V2 题库结构：24 组 × 4 词，每组 D/I/S/C 各一；家长版同构 */
for (const [name, groups] of [["学生版", DISC_V2_GROUPS], ["家长版", DISC_PARENT_V2_GROUPS]] as const) {
  if (groups.length !== 24) throw new Error(`${name} DISC V2 应为 24 组`);
  for (const [i, g] of groups.entries()) {
    if (g.words.length !== 4 || g.types.length !== 4) throw new Error(`${name} 第 ${i + 1} 组应为 4 词`);
    if (new Set(g.types).size !== 4) throw new Error(`${name} 第 ${i + 1} 组维度应 D/I/S/C 各一`);
  }
  console.log(`OK ${name} DISC V2 题库 24 组 × 4 词结构`);
}

/* DISC V2 计分：全选 D 词为最像、C 词为最不像 → D=24 分、version=2 */
const mostD = DISC_V2_GROUPS.map((g) => g.types.indexOf("D"));
const leastC = DISC_V2_GROUPS.map((g) => g.types.indexOf("C"));
const dv2 = scoreDiscV2({ most: mostD, least: leastC });
if (dv2.version !== 2 || dv2.primary !== "D" || dv2.dims.D !== 24 || dv2.dims.C !== 0) {
  throw new Error(`DISC V2 计分异常: ${JSON.stringify(dv2.dims)} primary=${dv2.primary} version=${dv2.version}`);
}
console.log("OK DISC V2 计分（极值作答 → D=24/C=0/version=2）");
if (!isDiscV2Answers({ most: mostD, least: leastC })) throw new Error("isDiscV2Answers 误判");
if (isDiscV2Answers([0, 1, 0])) throw new Error("isDiscV2Answers 把旧版数组误判为 V2");
console.log("OK isDiscV2Answers 判别");

/* 答题明细：V2 学生/家长作答均可出块；旧版数组仍兼容 */
const blkV2 = buildAnswerBlocks([
  { kind: "disc", answers: { most: mostD, least: leastC }, createdAt: new Date() },
  { kind: "discparent", answers: { label: "妈妈", answers: { most: mostD, least: leastC } }, createdAt: new Date() },
  { kind: "disc", answers: Array.from({ length: 24 }, () => 0), createdAt: new Date() },
]);
if (!blkV2.some((b) => b.rows[0]?.ans.includes("最像"))) throw new Error("学生 V2 答题明细缺少最像标注");
if (!blkV2.some((b) => b.title.includes("妈妈") && b.rows[0]?.ans.includes("最不像"))) throw new Error("家长 V2 答题明细异常");
if (!blkV2.some((b) => (b.note ?? "").includes("旧版题目"))) throw new Error("旧版 DISC 明细未标注旧版");
console.log("OK 答题明细 V2/旧版兼容（学生+家长+旧版）");

/* V2 结果渲染：disc tab 白屏 + 量尺 24 不溢出 */
const dataV2: any = { ...data, disc: dv2, raw: [...data.raw, { kind: "disc", answers: { most: mostD, least: leastC }, createdAt: new Date() }] };
const discHtml = renderToStaticMarkup(
  React.createElement(
    MemoryRouter,
    { initialEntries: ["/report-detail?tab=disc"] },
    React.createElement(ReportView, { data: dataV2, profile: { name: "测试员", grade: "初一", academics }, viewer: "student", onEditAcademics: () => {} }),
  ),
);
if (discHtml.length < 200) throw new Error("V2 DISC tab 渲染内容过短");
if (!discHtml.includes("24 分")) throw new Error("V2 DISC 倾向图未显示 24 分落点");
console.log("OK V2 DISC tab 渲染（量尺 24）");
/* 旧版结果显示「旧版题目」重测提示 */
const oldDiscHtml = render("disc");
need(oldDiscHtml, "旧版题目", "旧版 DISC tab");

/* 打印隐藏：综合详版+简版的答题明细折叠与附录得分表带 print:hidden；E3 tab 附录正常打印 */
if (!/print:hidden/.test(full)) throw new Error("综合详版缺少 print:hidden");
const lite = render("combined&view=lite");
need(lite, "print:hidden", "一页简版");
const e3Html = render("e3");
if (!e3Html.includes("附录 · 三阶九能观察点得分表")) throw new Error("E3 tab 附录缺失");
const e3AppendixSeg = e3Html.slice(e3Html.indexOf("附录 · 三阶九能观察点得分表") - 200, e3Html.indexOf("附录 · 三阶九能观察点得分表") + 100);
if (/print:hidden/.test(e3AppendixSeg)) throw new Error("E3 tab 附录不应打印隐藏");
console.log("OK 打印隐藏（详版/简版隐藏，E3 tab 附录保留）");

/* ===== v38 增量断言：家长报告栏目 + 综合亲子对照章 + 附录整章不打印 + 分学段题目 ===== */
import { E3V37_QUESTIONS_PRIMARY, E3V37_QUESTIONS_JUNIOR } from "../contracts/e3v37";

/* 分学段题目：A/B 项修改已生效，高中/初中不动 */
const pq = (no: number) => E3V37_QUESTIONS_PRIMARY.find((q) => q.no === no)?.text ?? "";
const jq = (no: number) => E3V37_QUESTIONS_JUNIOR.find((q) => q.no === no)?.text ?? "";
if (!pq(50).includes("小学约9—10小时")) throw new Error("小学 q50 睡眠标准未改");
if (pq(4).includes("大学") || !pq(4).includes("中学")) throw new Error("小学 q4 未改");
if (!pq(34).includes("升初中")) throw new Error("小学 q34 未改");
if (!pq(68).includes("连续20分钟")) throw new Error("小学 q68 未改");
if (!jq(4).includes("高中") || jq(4).includes("大学方向")) throw new Error("初中 q4 未改");
console.log("OK 分学段题目修改（小学 q4/q34/q50/q68、初中 q4）");

/* 家长数据注入 */
const e3parentFake: any = {
  version: "3.7",
  summary: "家长了解程度「中」（不了解 3 项），观察与孩子自评的明显差异 1 项。",
  condView: [
    { key: "state", label: "睡眠与作息", parentView: "较好", studentScore: 2.0, studentLevel: "卡点", note: "家长认为较好；学生自评对应题均分 2.0（≤2.0），为明显短板。" },
    { key: "relParent", label: "亲子沟通", parentView: "较差", studentScore: 3.0, studentLevel: "待提升", note: "家长认为亲子沟通状况较差，需优先核实并处理。" },
  ],
  blindSpots: [{ key: "P1", kp: "学习兴趣", parentScore: 5, studentScore: 2, gap: 3 }],
  overestimates: [{ key: "P1", kp: "学习兴趣", parentScore: 5, studentScore: 2, gap: 3 }],
  underestimates: [],
  unknownCount: 3,
  unknownLevel: "中",
  severeConflict: true,
};
const dataParent: any = {
  ...data,
  e3parent: e3parentFake,
  discParents: [{ label: "妈妈", result: disc, createdAt: new Date() }],
  raw: [...data.raw, { kind: "e3parent", answers: { family: {}, condObserve: {}, mirror: [] }, createdAt: new Date() }],
};
const renderP = (tab: string) =>
  renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      { initialEntries: [`/report-detail?tab=${tab}`] },
      React.createElement(ReportView, { data: dataParent, profile: { name: "测试员", grade: "初一", academics }, viewer: "student", onEditAcademics: () => {} }),
    ),
  );

/* 家长报告 tab：四大版块 + 答题明细折叠 */
const parentHtml = renderP("parent");
for (const kw of ["亲子冲突点清单与改进方案", "家庭支持与环境观察（家长卷）", "家长认知对照", "亲子 DISC 行为风格对照", "答题明细 · 家长卷", "答题明细 · 家长 DISC", "严重亲子冲突信号", "家长高估"]) {
  need(parentHtml, kw, "家长报告 tab");
}
/* 旧 ?tab=discparent 深链兼容 */
const legacyTabHtml = renderP("discparent");
need(legacyTabHtml, "亲子冲突点清单与改进方案", "旧 discparent tab 兼容");
/* 无家长数据态 */
const emptyParent = render("parent");
need(emptyParent, "家长报告还没有数据", "家长报告(空态)");

/* 综合详版：亲子对照章（条件大类）+ 图表 + 答题明细 */
const fullParent = renderP("combined");
need(fullParent, "亲子对照与沟通建议（家长卷 × 家长 DISC）", "综合详版亲子章");
need(fullParent, "冲突点清单", "综合详版亲子章");
need(fullParent, "沟通优化建议", "综合详版亲子章");
need(fullParent, "亲子 DISC 行为风格对照", "综合详版亲子章图表");

/* 一页简版：亲子摘要卡（前 3 条冲突 + 核心建议） */
const liteParent = renderP("combined&view=lite");
need(liteParent, "亲子对照 · 摘要", "简版摘要卡");
need(liteParent, "核心建议", "简版摘要卡");

/* 附录章整章不打印（详版）：章节头部包在 print:hidden 内 */
const apxIdx = fullParent.lastIndexOf("附录 · 三阶九能观察点得分表");
if (apxIdx < 0) throw new Error("综合详版缺少附录章");
if (!fullParent.slice(Math.max(0, apxIdx - 400), apxIdx).includes('class="print:hidden"')) {
  throw new Error("综合详版附录章未整章 print:hidden");
}
console.log("OK 综合详版附录章整章不打印");

console.log("RENDER_SMOKE_V38_OK");
