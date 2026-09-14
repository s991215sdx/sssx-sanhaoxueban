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
import { scoreDiscV2, DISC_V2_GROUPS, DISC_PARENT_V2_GROUPS, isDiscV2Answers, discTendencyFromDims, discTendencyFromV2, discBand, discTendencyText } from "../contracts/assessments";
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
if (!discHtml.includes("+100%")) throw new Error("V2 DISC 双极图未显示 +100% 落点");
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
  discParents: [{ label: "妈妈", result: { primary: "I", dims: { D: 2, I: 20, S: 6, C: 8 }, summary: "I 主导型", version: 2 }, createdAt: new Date() }],
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
for (const kw of ["亲子冲突点清单与改进方案", "家庭支持与环境观察（家长卷）", "家长认知对照", "亲子 DISC 行为风格对照", "答题明细 · 家长卷", "答题明细 · 家长 DISC", "严重亲子冲突信号", "家长更乐观"]) {
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

/* ===== v39 增量断言：去重 + 红色强化 + 对照卡 + 通俗化 ===== */
/* 综合详版：亲子 DISC 对照图只出现一次（条件章不再重复） */
const compareCount = fullParent.split("亲子 DISC 行为风格对照").length - 1;
if (compareCount !== 1) throw new Error(`综合详版亲子 DISC 对照图出现 ${compareCount} 次，应为 1 次`);
/* 家长报告：DISC 强冲突维度红色高亮 + 白话 */
need(parentHtml, "#fbe3df", "家长报告红色高亮");
need(parentHtml, "明显顶牛", "DISC 差值白话");
need(parentHtml, "爱热闹、爱表达", "DISC 维度白话注释");
/* 认知对照卡：并排对照 + 白话含义 */
need(parentHtml, "家长的估计", "认知对照卡");
need(parentHtml, "孩子的实际感受", "认知对照卡");
need(parentHtml, "对照的事：", "认知对照卡镜子题");
need(parentHtml, "家长以为没问题，其实孩子觉得难", "认知对照卡白话");
/* 冲突清单红色强化：严重亲子冲突条目为 hot 红卡 */
need(parentHtml, "ring-[#b91c1c]/50", "冲突清单红色强化");
console.log("OK v39 去重/红色强化/对照卡/通俗化");

/* ===== v40 增量断言：框架图分数徽章 + 双心理量表学生版 ===== */
import { scoreMentalSdq, scoreMentalPa, MENTAL_SDQ_QUESTION_COUNT, MENTAL_PA_QUESTION_COUNT, isMentalSdq, isMentalPa } from "../contracts/mentalHealth";
import { scoreScl90, scl90FactorLevel, SCL90_QUESTIONS, MENTAL_SCL90_QUESTION_COUNT, MENTAL_PA_SECTIONS, MENTAL_SDQ_AGE, MENTAL_SCL90_DISCLAIMER } from "../contracts/mentalHealth";
import { DISC_V2_GROUPS } from "../contracts/assessments";

/* SDQ 计分：全 0 → 亲社会反向？亲社会 0 题全 0 则 prosocial=0「明显」偏低 */
const sdqCalm = scoreMentalSdq(Array.from({ length: MENTAL_SDQ_QUESTION_COUNT }, () => 0));
if (sdqCalm.totalDiff !== 0 + 0 + 0 + 0 + 5) { /* conduct 第7题反向=2, hyper 21/25 反向各2, peer 11/14 反向各2 → 见下 */ }
/* 手工核对：全 0 作答 → 反向题得 2：q7(conduct)、q11(peer)、q14(peer)、q21(hyper)、q25(hyper)
   → conduct=2, peer=4, hyper=4, emotion=0, prosocial=0；totalDiff=10 */
if (sdqCalm.dims.conduct !== 2 || sdqCalm.dims.peer !== 4 || sdqCalm.dims.hyper !== 4 || sdqCalm.dims.emotion !== 0 || sdqCalm.dims.prosocial !== 0 || sdqCalm.totalDiff !== 10) {
  throw new Error(`SDQ 反向计分错误 ${JSON.stringify(sdqCalm.dims)} total=${sdqCalm.totalDiff}`);
}
/* 安全预警题：末题 1 → selfHarm + 高风险 */
const sdqRed = scoreMentalSdq(Array.from({ length: MENTAL_SDQ_QUESTION_COUNT }, (_, i) => (i === 25 ? 1 : 0)));
if (!sdqRed.selfHarm || sdqRed.level !== "高风险") throw new Error("SDQ 安全预警红线未触发");
/* PHQ-A 计分：与 V2 同算法，version=pa */
const pa = scoreMentalPa(Array.from({ length: MENTAL_PA_QUESTION_COUNT }, () => 0));
if (pa.version !== "pa" || pa.level !== "良好") throw new Error("PHQ-A 计分错误");
const paRed = scoreMentalPa(Array.from({ length: MENTAL_PA_QUESTION_COUNT }, (_, i) => (i === 8 ? 1 : 0)));
if (!paRed.selfHarm || paRed.level !== "高风险") throw new Error("PHQ-A 第 9 题红线未触发");
if (!isMentalSdq(sdqCalm) || !isMentalPa(pa)) throw new Error("类型守卫错误");
console.log("OK v40 双量表计分与红线");

/* 框架图徽章：分数着色 + 去前缀 */
const profileHtml = render("combined");
for (const kw of ["乐学 3.1/5 · 待提升", "会学 3.3/5 · 待提升", "善学 2.7/5 · 卡点", "条件 2.8/5 · 卡点", "学能 2/5 · 卡点"]) need(profileHtml, kw, "框架图分数徽章");
if (/学业诊断 · (乐学|会学|善学|条件|学能) \d/.test(profileHtml)) throw new Error("框架图仍有「学业诊断 ·」分数前缀");
if (!profileHtml.includes("#fbe3df")) throw new Error("框架图卡点红色缺失");
console.log("OK 框架图分数徽章（去前缀+红黄绿+档位）");

/* 心理三套结果都进报告：mental tab + 综合条件章 + 答题明细 */
const dataMental: any = {
  ...data,
  mentalSdq: sdqRed,
  mentalPa: pa,
  raw: [
    ...data.raw,
    { kind: "mentalsdq", answers: Array.from({ length: MENTAL_SDQ_QUESTION_COUNT }, (_, i) => (i === 25 ? 1 : 0)), createdAt: new Date() },
    { kind: "mentalpa", answers: Array.from({ length: MENTAL_PA_QUESTION_COUNT }, () => 0), createdAt: new Date() },
  ],
};
const renderM = (tab: string) =>
  renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      { initialEntries: [`/report-detail?tab=${tab}`] },
      React.createElement(ReportView, { data: dataMental, profile: { name: "测试员", grade: "初一", academics }, viewer: "student", onEditAcademics: () => {} }),
    ),
  );
const mentalTab = renderM("mental");
for (const kw of ["学生版 A（SDQ 长处与困难问卷）", "学生版 B（PHQ-A + GAD-7）", "通用版（PHQ-9 + GAD-7）", "困难总分", "PHQ-A 青少年抑郁筛查"]) need(mentalTab, kw, "mental tab 三量表");
const combinedM = renderM("combined");
for (const kw of ["心理健康 · 学生版 A（SDQ 长处与困难问卷）", "心理健康 · 学生版 B（PHQ-A + GAD-7）", "心理健康 · 通用版"]) need(combinedM, kw, "综合报告心理三卡");
need(combinedM, "SDQ 长处与困难问卷）· 26 题", "SDQ 答题明细");
need(combinedM, "学生版 B（PHQ-A + GAD-7）· 16 题", "PHQ-A 答题明细");
/* 三甲医院措辞全灭 */
if (/三甲医院/.test(mentalTab + combinedM)) throw new Error("仍有「三甲医院」措辞");
need(mentalTab + combinedM, "国际通用筛查工具", "国际通用措辞");
need(mentalTab + combinedM, "12356", "心理援助热线保留");
console.log("OK v40 三量表进报告 + 措辞");

/* ===== v41 增量断言：心理报告详细解读 + 答题明细折叠 ===== */
need(mentalTab, "这些分数怎么看", "心理报告·分数指南");
need(mentalTab, "分数是「信号」不是「判决」", "心理报告·分数指南白话");
need(mentalTab, "每个观测点在观察什么", "SDQ 维度说明");
need(mentalTab, "观察什么：", "SDQ 观察点");
need(mentalTab, "分数代表什么：", "SDQ 分数含义");
need(mentalTab, "每道题在观察什么", "PHQ-A/GAD-7 观测点说明");
need(mentalTab, "第 9 题（红线）：", "PHQ 红线观测点");
need(mentalTab, "综合分级意味着什么", "分级总表");
need(mentalTab, "答题明细 · 学生版 A（SDQ，点击展开）", "SDQ 明细折叠");
need(mentalTab, "答题明细 · 学生版 B（PHQ-A，点击展开）", "PHQ-A 明细折叠");
need(mentalTab, "答题明细 · 通用版（PHQ-9 + GAD-7，点击展开）", "通用版明细折叠");
/* 综合报告条件章：心理三套明细挂在条件章折叠（answerKindsForSection 含新 kind） */
need(combinedM, "ansblk-mentalsdq", "综合条件章 SDQ 明细块");
need(combinedM, "ansblk-mentalpa", "综合条件章 PHQ-A 明细块");
console.log("OK v41 心理详细解读 + 明细折叠");

/* ===== v42 增量断言 ===== */
/* 1) SCL-90 计分手工核对：全 1 → 良好/阴性；第 15 题=2 → 自伤红线 */
const sclAll1 = Array.from({ length: MENTAL_SCL90_QUESTION_COUNT }, () => 1);
const sclCalm = scoreScl90(sclAll1);
if (sclCalm.total !== 90 || sclCalm.gsi !== 1 || sclCalm.positiveCount !== 0 || sclCalm.screeningPositive || sclCalm.level !== "良好")
  throw new Error(`SCL-90 全 1 计分错误: ${JSON.stringify({ total: sclCalm.total, gsi: sclCalm.gsi, pos: sclCalm.positiveCount, sp: sclCalm.screeningPositive, lv: sclCalm.level })}`);
if (Object.values(sclCalm.factors).some((v) => v !== 1)) throw new Error("SCL-90 全 1 因子分应为全 1");
const sclSelfHarm = scoreScl90(sclAll1.map((v, i) => (i === 14 ? 2 : v)));
if (!sclSelfHarm.selfHarm || sclSelfHarm.level !== "高风险") throw new Error("SCL-90 第 15 题红线未触发");
if (sclSelfHarm.positiveCount !== 1 || sclSelfHarm.psdi !== 2) throw new Error("SCL-90 阳性项目/PSDI 计分错误");
/* 全 3 → 阳性 + 高风险；因子全 3.00 中度 */
const sclAll3 = scoreScl90(Array.from({ length: MENTAL_SCL90_QUESTION_COUNT }, () => 3));
if (sclAll3.total !== 270 || !sclAll3.screeningPositive || sclAll3.level !== "高风险") throw new Error("SCL-90 全 3 筛选阳性/高风险错误");
if (sclAll3.factors.hostility !== 3 || sclAll3.factorLevels.hostility !== "中度") throw new Error("SCL-90 全 3 因子分级错误");
/* 因子归属抽查：F6 敌对 6 题（11,24,63,67,74,81）全 5 分 → hostility=5 严重，其余不受影响 */
const sclHostile = sclAll1.map((v, i) => ([10, 23, 62, 66, 73, 80].includes(i) ? 5 : v));
const sclH = scoreScl90(sclHostile);
if (sclH.factors.hostility !== 5 || sclH.factorLevels.hostility !== "严重") throw new Error(`SCL-90 敌对因子计分错误: ${sclH.factors.hostility}`);
if (sclH.factors.somatization !== 1) throw new Error("SCL-90 敌对计分串扰了躯体化");
/* 分级边界：附件口径 2.50=轻度、3.0=中度 */
if (scl90FactorLevel(2.5) !== "轻度" || scl90FactorLevel(3.0) !== "中度" || scl90FactorLevel(1.99) !== "正常" || scl90FactorLevel(4.0) !== "偏重")
  throw new Error("SCL-90 分级边界错误");
/* 第 15 题 safety 标记 */
if (!SCL90_QUESTIONS[14].safety || SCL90_QUESTIONS[14].text !== "想结束自己的生命") throw new Error("SCL-90 第 15 题安全标记缺失");
if (new Set(SCL90_QUESTIONS.map((q) => q.factor)).size !== 10) throw new Error("SCL-90 因子数不为 10");
console.log("OK v42 SCL-90 计分/红线/分级");

/* 2) GAD-7 已恢复原版标准措辞（信效度依据） */
const gad7 = MENTAL_PA_SECTIONS[1].questions.map((q) => q.text);
if (gad7[0] !== "感到紧张、焦虑或急切" || gad7[6] !== "感到似乎将有可怕的事情发生而害怕") throw new Error(`GAD-7 措辞非原版: ${gad7[0]}`);
if (JSON.stringify(gad7).includes("学习、考试、和同学相处")) throw new Error("GAD-7 仍有学生化括号");
if (MENTAL_PA_SECTIONS[1].description.includes("按学生日常语境")) throw new Error("GAD-7 描述仍有学生化措辞");
console.log("OK v42 GAD-7 原版措辞");

/* 3) SDQ 低龄口径：家长引导填写 */
if (!MENTAL_SDQ_AGE.includes("11 岁以下请家长引导填写")) throw new Error("SDQ 年龄口径未更新");
console.log("OK v42 SDQ 家长引导填写");

/* 4) DISC 双极倾向度口径（v44：国际通行净分倾向度 + 上下双反弹区 + 行为特征轴） */
/* 契约层：倾向度换算 */
const tV2 = discTendencyFromDims({ D: 24, I: 12, S: 12, C: 0 }, 2);
if (tV2.D !== 100 || tV2.I !== 0 || tV2.C !== -100) throw new Error(`V2 倾向度换算错误: ${JSON.stringify(tV2)}`);
const tV1 = discTendencyFromDims({ D: 12, I: 6, S: 6, C: 0 });
if (tV1.D !== 100 || tV1.C !== -100) throw new Error(`V1 倾向度换算错误: ${JSON.stringify(tV1)}`);
const tRaw = discTendencyFromV2({ most: DISC_V2_GROUPS.map((g) => g.types.indexOf("D")), least: DISC_V2_GROUPS.map((g) => g.types.indexOf("C")) });
if (tRaw.D !== 100 || tRaw.C !== -100) throw new Error(`原始作答倾向度错误: ${JSON.stringify(tRaw)}`);
if (discBand(80) !== "强" || discBand(60) !== "明显" || discBand(30) !== "中等" || discBand(10) !== "轻微") throw new Error("discBand 分档错误");
if (discTendencyText(50) !== "+50%" || discTendencyText(-66) !== "-66%" || discTendencyText(0) !== "0%") throw new Error("discTendencyText 格式错误");
console.log("OK v44 DISC 倾向度契约层");

const discTab = renderToStaticMarkup(
  React.createElement(
    MemoryRouter,
    { initialEntries: ["/report-detail?tab=disc"] },
    React.createElement(ReportView, { data: dataV2, profile: { name: "测试员", grade: "初一", academics }, viewer: "student", onEditAcademics: () => {} }),
  ),
);
for (const kw of [
  "行为之镜 · DISC 四因子倾向度",
  "高反弹区",
  "低反弹区",
  "行为特征轴 · 双极倾向度",
  "掌控 D+",
  "D- 配合",
  "外向 I+",
  "沉稳 S+",
  "严谨 C+",
  "净分倾向度",
  "未做常模转换",
  "合计恒为 0",
  "D 型（掌控型）",
  "+100%",
  "-100%",
]) need(discTab, kw, "DISC 双极图+口径");
if (/校园中的我|被压在身后|被压在背后的我/.test(discTab)) throw new Error("DISC 双图/自创概念仍在");
if (/各 0—24 分|归一到 0—24/.test(discTab)) throw new Error("DISC 旧单极口径仍在");
/* dataV2 的 DISC：most 全 D / least 全 C → D +100% 进高反弹区、C -100% 进低反弹区 */
if (!discTab.includes("果敢可能反成专断")) throw new Error("DISC 高反弹区提示缺失");
if (!discTab.includes("关键时刻可能掉链子")) throw new Error("DISC 低反弹区提示缺失（C 灵活到散漫）");
console.log("OK v44 DISC 双极倾向度图+上下反弹区");

/* 亲子对照（综合详版）：学生 D +100% vs 妈妈 D -83%，差 ≥50% → 明显顶牛，倾向度文案 */
need(fullParent, "倾向度差", "综合详版亲子倾向度冲突");
need(fullParent, "双极倾向度口径", "亲子对照图口径说明");
console.log("OK v44 亲子对照倾向度口径");

/* 5) SCL-90 进 mental tab 与综合报告（附件式评估报告） */
const dataScl90: any = {
  ...dataMental,
  mentalScl90: sclAll3,
  raw: [...dataMental.raw, { kind: "scl90", answers: Array.from({ length: MENTAL_SCL90_QUESTION_COUNT }, () => 3), createdAt: new Date() }],
};
const renderS = (tab: string) =>
  renderToStaticMarkup(
    React.createElement(
      MemoryRouter,
      { initialEntries: [`/report-detail?tab=${tab}`] },
      React.createElement(ReportView, { data: dataScl90, profile: { name: "测试员", grade: "高一", academics }, viewer: "student", onEditAcademics: () => {} }),
    ),
  );
const sclTab = renderS("mental");
for (const kw of ["深度评估 · SCL-90 症状自评量表", "计分与标准说明", "心理健康综合评估", "风险指标解读", "筛选阳性", "总分（阳性线", "F1 躯体化", "这个指标在看什么", "你的得分解读", "改善建议", "中国常模", "想结束自己的生命", MENTAL_SCL90_DISCLAIMER.slice(0, 20)]) need(sclTab, kw, "mental tab SCL-90 评估报告");
need(sclTab, "答题明细 · 深度评估（SCL-90，点击展开）", "SCL-90 明细折叠");
const combinedS = renderS("combined");
for (const kw of ["心理健康 · 深度评估（SCL-90 症状自评）", "ansblk-scl90", "270/450", "SCL-90 症状自评量表 · 90 题"]) need(combinedS, kw, "综合报告 SCL-90 卡+明细");
if (/三甲医院/.test(sclTab + combinedS)) throw new Error("仍有「三甲医院」措辞");
need(sclTab, "12356", "热线保留");
console.log("OK v44 SCL-90 评估报告 + 综合集成");

console.log("RENDER_SMOKE_V44_OK");
