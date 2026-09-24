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
/* 需求6（v52 反转）：图形与图表默认折叠（SSR 输出不带 open 属性） */
if (/<details open=""/.test(full)) throw new Error("仍存在默认展开的折叠块（图形与图表应先折叠）");
need(full, "图形与图表（点击展开）", "图形与图表折叠标题");
console.log("OK 图形与图表默认折叠");
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
need(parentHtml, "明显对着干", "DISC 差值白话");
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

/* 亲子对照（综合详版）：学生 D +100% vs 妈妈 D -83%，差 ≥50% → 明显对着干，倾向度文案 */
need(fullParent, "倾向度差", "综合详版亲子倾向度冲突");
need(fullParent, "双极倾向度口径", "亲子对照图口径说明");
console.log("OK v44 亲子对照倾向度口径");

/* ===== v45 增量断言：行为特征轴值跟轴走 + 动物象徽 + 家长版 DISC 详版 ===== */
/* 图 2 动物象徽：dataV2 的 DISC = most 全 D / least 全 C → D +100%（正值，动物徽章「虎」）、C -100%（负值，普通圆点） */
const discSvg = discTab.slice(discTab.indexOf("行为之镜 · DISC 四因子倾向度"));
const legendIdx = discSvg.indexOf("虎 = D（老虎）");
if (legendIdx < 0) throw new Error("DISC 动物象徽图例缺失");
if (!discSvg.includes("枭 = C（猫头鹰）")) throw new Error("DISC 动物象徽图例（猫头鹰）缺失");
/* 正值落点应渲染「虎」字徽章（在图例之前、svg 区域内） */
const svgArea = discSvg.slice(0, legendIdx);
if (!svgArea.includes(">虎<")) throw new Error("D +100% 正值落点缺少老虎象徽");
if (svgArea.includes(">枭<")) throw new Error("C -100% 负值落点不应渲染动物象徽");
console.log("OK v45 动物象徽（正值标注动物）");

/* 家长版 DISC 行为详版：几位家长几份详版，标注家长版 */
const parentDetailCount = parentHtml.split("家长版 · ").length - 1;
if (parentDetailCount !== 1) throw new Error(`家长版详版应渲染 1 份（dataV2 有 1 位家长），实际 ${parentDetailCount}`);
for (const kw of ["家长版 · 妈妈", "的行为之镜 · DISC 四因子倾向度（家长版）", "管教风格", "与孩子（", "管教建议"]) need(parentHtml, kw, "家长版 DISC 详版");
/* 家长详版同样含行为特征轴与双反弹区 */
need(parentHtml, "行为特征轴 · 双极倾向度", "家长详版特征轴");
need(parentHtml, "低反弹区", "家长详版反弹区");
console.log("OK v45 家长版 DISC 行为详版");

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
console.log("OK v45 SCL-90 评估报告 + 综合集成");

/* ===== v46 增量断言：特征轴/对照条方向反转（正值朝左伸向+端、负值朝右伸向-端）+ 家长 tab 先 DISC 后家长卷 ===== */
/* dataV2 DISC 倾向度：D +100% / I 0% / S 0% / C -100% */
const axisSeg = discHtml.slice(discHtml.indexOf("行为特征轴 · 双极倾向度"));
if (!axisSeg.includes("left:0%;width:50%")) throw new Error("特征轴 D +100% 条应满伸左半（left:0%;width:50%）");
if (!axisSeg.includes("left:50%;width:50%")) throw new Error("特征轴 C -100% 条应满伸右半（left:50%;width:50%）");
if (!axisSeg.includes("left:50%;width:0%")) throw new Error("特征轴 0% 条应缩在中线（left:50%;width:0%）");
/* 亲子对照 FactorBars + 家长详版特征轴（妈妈 I +67% → 条落在左半 left:16.5%） */
if (!parentHtml.includes("left:16.5%")) throw new Error("+67% 条应落在左半（left:16.5%），方向仍反");
/* 家长 tab 顺序：先 DISC 解读（对照 + 逐位家长详版），再家长卷内容，最后亲子冲突 */
const idxDiscCmp = parentHtml.indexOf("亲子 DISC 行为风格对照");
const idxParentDetail = parentHtml.indexOf("家长版 · 妈妈");
const idxE3 = parentHtml.indexOf("家庭支持与环境观察（家长卷）");
const idxBlind = parentHtml.indexOf("家长认知对照");
const idxConflict = parentHtml.indexOf("亲子冲突点清单与改进方案");
if (!(idxDiscCmp > -1 && idxParentDetail > idxDiscCmp && idxE3 > idxParentDetail && idxBlind > idxE3 && idxConflict > idxBlind))
  throw new Error(`家长 tab 顺序应为 DISC→家长卷→认知对照→亲子冲突，实际 ${[idxDiscCmp, idxParentDetail, idxE3, idxBlind, idxConflict].join(",")}`);
console.log("OK v46 条方向反转（+朝左/-朝右）+ 家长 tab 先 DISC 解读");

/* ===== v47 增量断言：反弹区说明卡条件显示 + 关键词白话解读 + 管教风格调整 + 「顶牛」通俗化 ===== */
/* 1) 有因子进反弹区 → 说明卡显示（学生 D +100%/C -100%；妈妈 D -83% 均入区） */
need(discHtml, "上下两个灰色「反弹区」怎么看", "学生详版反弹区说明卡");
need(parentHtml, "上下两个灰色「反弹区」怎么看", "家长详版反弹区说明卡");
/* 2) 无因子进反弹区（D +8 / I 0 / S +17 / C -8）→ 说明卡不显示，图上灰带保留 */
const dataNr: any = { ...data, disc: { primary: "S", dims: { D: 13, I: 12, S: 14, C: 11 }, version: 2 } };
const nrHtml = renderToStaticMarkup(
  React.createElement(
    MemoryRouter,
    { initialEntries: ["/report-detail?tab=disc"] },
    React.createElement(ReportView, { data: dataNr, profile: { name: "测试员", grade: "初一", academics }, viewer: "student", onEditAcademics: () => {} }),
  ),
);
if (nrHtml.includes("上下两个灰色「反弹区」怎么看")) throw new Error("无因子进入反弹区时不应显示说明卡");
need(nrHtml, "高反弹区 ≥+80%", "无反弹区时图灰带仍保留");
/* 3) 关键词白话解读（学生/家长共用图表组件，称呼随版本） */
need(discHtml, "这些关键词怎么读", "学生详版关键词解读");
need(parentHtml, "这些关键词怎么读", "家长详版关键词解读");
need(parentHtml, "最贴近妈妈平时样子的词", "家长版解读称呼");
/* 4) 管教风格调整：对照卡（家长 tab 与综合详版）+ 家长详版三点调整 */
need(parentHtml, "（I 型家长）的管教风格怎么调", "对照卡管教风格调整");
need(parentHtml, "的管教风格 · 三点调整", "家长详版三点调整");
need(fullParent, "的管教风格怎么调", "综合详版对照卡管教风格调整");
/* 5) 「顶牛」已全部通俗化 */
if (/顶牛/.test(parentHtml + fullParent + discHtml)) throw new Error("仍有「顶牛」措辞未替换");
console.log("OK v47 反弹区条件显示 + 关键词白话 + 管教风格调整 + 措辞通俗化");

/* ===== v49 增量断言：邀请制注册（渠道码契约层） ===== */
import { INVITE_CHANNEL_KINDS, INVITE_GRADES, INVITE_CODE_RE, normalizeInviteCode } from "../contracts/invite";
if (INVITE_CHANNEL_KINDS.join("") !== "地推异业合作线上社群老带新其他") throw new Error("渠道类型选项异常");
if (INVITE_GRADES.length !== 12 || INVITE_GRADES[0] !== "一年级" || INVITE_GRADES[11] !== "高三") throw new Error("年级选项异常");
if (!INVITE_CODE_RE.test("abc2345678") || INVITE_CODE_RE.test("AB") || INVITE_CODE_RE.test("短")) throw new Error("渠道码格式校验异常");
if (normalizeInviteCode("  AbC2345678 ") !== "abc2345678") throw new Error("渠道码归一化异常");
console.log("OK v49 邀请制注册契约层");

/* ===== v50 增量断言：学员功能开关契约层 ===== */
import { STUDENT_MODULE_KEYS, DEFAULT_INVITE_MODULES, moduleForPath, sanitizeModules } from "../contracts/studentModules";
if (STUDENT_MODULE_KEYS.join(",") !== "preview,gaps,papers,treehole,companion,report") throw new Error("学员模块 key 异常");
if (DEFAULT_INVITE_MODULES.join("") !== "assessments") throw new Error("邀请注册默认模块应为仅测评中心");
if (moduleForPath("/") !== "home") throw new Error("首页归属异常");
if (moduleForPath("/learn/3") !== "gaps" || moduleForPath("/gaps") !== "gaps") throw new Error("查漏/变式训练归属异常");
if (moduleForPath("/report-detail") !== "report" || moduleForPath("/preview/x") !== "preview") throw new Error("报告/预习归属异常");
if (moduleForPath("/assessments") !== "assessments") throw new Error("测评中心归属异常");
if (moduleForPath("/admin") !== null || moduleForPath("/tutor") !== null || moduleForPath("/welcome") !== null) throw new Error("后台/工作台/引导不受开关限制");
if (sanitizeModules(["preview", "hack", "gaps", 1]).join(",") !== "preview,gaps") throw new Error("模块过滤异常");
console.log("OK v50 学员功能开关契约层");

/* ===== v51 增量断言 ===== */
/* 1) 框架图：二级考察点 chips 已全部删除（kp 不再上框架图）。
   截取框架图渲染片段（SystemFramework 根节点 → 底部说明文字之后）做断言，避开报告其他章节的 kp 明细。 */
import SystemFramework from "../src/components/reports/SystemFramework";
const fwHtml = renderToStaticMarkup(
  React.createElement(SystemFramework, { status: (undefined as any) }),
);
const fwWithStatus = renderToStaticMarkup(
  React.createElement(SystemFramework, {
    status: {
      academics: { filled: true, note: "期中", subjects: [{ name: "数学", last: 100, target: 112 }] },
      e3: { done: true, scores: { 乐学: 3.4, 会学: 3.8, 善学: 3.3 }, conditionAvg: 3.1, aptitudeAvg: 2.7,
        units: { 动力: { score: 3.4 }, 信心: { score: 3.2 }, 韧劲: { score: 3 }, 学懂: { score: 3.3 }, 记住: { score: 4 }, 会用: { score: 4.3 }, 计划: { score: 3.3 }, 复盘: { score: 3.3 }, 智学: { score: 3.8 }, 状态: { score: 3.1 }, 关系: { score: 2.8 }, 资源: { score: 3.3 }, 注意力: { score: 2 }, 工作记忆: { score: 4 }, 加工速度: { score: 2 } } },
      multi5: { done: true, note: "综合 3.8", subs: ["语言 4", "逻辑 3.6"] },
      mbti: { done: true, note: "INTJ", subs: ["E55·I45"] },
      disc: { done: true, note: "D", subs: ["D+50%"] },
      holland: { done: true, note: "研究型", subs: ["R 4.2"] },
      anchor: { done: true, note: "技术型", subs: ["TF 4.0"] },
    } as any,
  }),
);
for (const seg of [fwHtml, fwWithStatus]) {
  if (seg.includes("→")) throw new Error("已测节点不应再有可点击箭头");
  if (/语文|数学 100/.test(seg)) throw new Error("成绩二级 chip 仍渲染");
}
need(fwWithStatus, "乐学 · 动力系统", "框架图乐学段");
need(fwWithStatus, "多元五项 · 综合 3.8", "框架图五项徽标");
/* 2) 多元智能八维彻底下线：框架图/报告不再出现该词 */
if (/多元智能八维|多元八维/.test(full)) throw new Error("报告仍出现多元智能八维");
/* 3) 训练方案库：三阶九能组织 + 典型问题 + 简要方案，数据与方法库全对上 */
import TrainingPlanLibrary from "../src/components/TrainingPlanLibrary";
import { THREE_TIER_PLANS, THREE_TIER_STYLE } from "../src/data/training/threeTierPlans";
import { E3V37_ABILITY_TRAINING } from "../src/data/training/e3v37Training";
import { METHOD_BY_ID } from "../src/data/training/methods";
const libHtml = renderToStaticMarkup(React.createElement(TrainingPlanLibrary));
need(libHtml, "学习力陪跑训练方案（三阶九能）", "训练方案库标题");
need(libHtml, "简要方案 · 点开看详细做法", "简要方案按钮");
need(libHtml, "1 阶 · 乐学 · 动力系统", "乐学段");
need(libHtml, "3 阶 · 善学 · 加速系统", "善学段");
if (THREE_TIER_PLANS.length !== 9) throw new Error("三阶九能应为 9 个方案");
for (const p of THREE_TIER_PLANS) {
  if (!THREE_TIER_STYLE[p.tier]) throw new Error(`三阶样式缺失：${p.tier}`);
  if (p.questions.length < 3) throw new Error(`典型问题不足：${p.ability}`);
  const rx = E3V37_ABILITY_TRAINING[p.ability];
  if (!rx || !rx.rationale) throw new Error(`简要方案缺失：${p.ability}`);
  if (rx.methodIds.length === 0) throw new Error(`训练方法缺失：${p.ability}`);
  for (const id of rx.methodIds) if (!METHOD_BY_ID.has(id)) throw new Error(`方法不存在：${p.ability} → ${id}`);
}
/* 4) 邀请注册落地页：极简表单（手机号+密码，保留 2980 文案，不再收集姓名/年级/家长称呼） */
/* 落地页 SSR 首帧为渠道码校验 loading，改为静态源码断言（表单字段 + 2980 文案） */
import { readFileSync } from "node:fs";
import { join } from "node:path";
const inviteSrc = readFileSync(join(__dirname, "../src/pages/InviteRegister.tsx"), "utf8");
need(inviteSrc, "价值 2980 元的学习力系统测评", "落地页保留 2980 文案");
need(inviteSrc, "phone", "落地页手机号字段");
if (/孩子姓名|孩子年级|家长称呼/.test(inviteSrc)) throw new Error("注册落地页仍收集姓名/年级/家长称呼");
/* 后端：极简注册输入契约 + 迁移 0017 三处同步 */
import { readFileSync as rf2 } from "node:fs";
const routerSrc = rf2(join(__dirname, "../api/inviteRouter.ts"), "utf8");
need(routerSrc, "v as { code: string; phone: string; password: string }", "极简注册输入契约");
if (/parentName.*badRequest|studentName.*badRequest/.test(routerSrc)) throw new Error("后端仍强收家长称呼/学生姓名");
const embSrc = rf2(join(__dirname, "../api/migrationsEmbedded.ts"), "utf8");
need(embSrc, "0017_invite_v51_minimal", "内嵌迁移 0017");
need(embSrc, 'MODIFY `parent_name`', "0017 放宽 parent_name");
const journalSrc = rf2(join(__dirname, "../db/migrations/meta/_journal.json"), "utf8");
need(journalSrc, "0017_invite_v51_minimal", "journal 0017");
console.log("OK v51 框架图去二级关注点 + 八维下线 + 极简注册 + 三阶九能训练方案库");

/* ===== v52 增量断言 ===== */
/* 1) 框架图：底色统一红黄绿（E3V37_LEVEL_STYLE 浅底）——乐学 3.4 待提升用黄底黄字，且不再有 tier 绿/蓝/金 */
const fw52 = renderToStaticMarkup(
  React.createElement(SystemFramework, {
    status: {
      e3: { done: true, scores: { 乐学: 3.4, 会学: 3.9, 善学: 2.9 }, conditionAvg: 3.1, aptitudeAvg: 2.7,
        units: { 动力: { score: 3.4 }, 信心: { score: 3.9 }, 韧劲: { score: 2.9 } } },
      mental: { done: true, note: "SDQ「关注」", tone: "warn" },
    } as any,
  }),
);
need(fw52, "#f5e7c1", "待提升黄底");
need(fw52, "#8a6d1a", "待提升深色字");
need(fw52, "#fbe3df", "卡点红底");
need(fw52, "#8f1313", "卡点深红字");
need(fw52, "#f0f7dd", "正常绿底");
need(fw52, "SDQ「关注」", "心理健康关注徽标");
if (fw52.includes("#7cb83c\" bg") || fw52.includes("#3d8ec4") || fw52.includes("#e3edf6") || fw52.includes("#f5eecb")) throw new Error("框架图仍有 tier 绿/蓝/金底色");
/* 2) 综合详版：九能雷达已删，体检一张图在图形与图表折叠内；折叠默认收起 */
if (/九能雷达/.test(full)) throw new Error("综合详版仍出现九能雷达");
need(full, "三阶九能体检一张图", "体检一张图");
if (full.includes("图形与图表（默认展开")) throw new Error("图形与图表应默认折叠");
need(full, "总策略：", "综合结论总策略一句话");
need(full, "主卡点：", "总览主卡点");
if (full.includes("建议进步方案（哪层不行补哪层）")) throw new Error("（哪层不行补哪层）未删除");
need(full, "答题明细（仅对应问题，点击展开）", "答题明细仅对应问题");
console.log("OK v52 框架图红黄绿统一底色 + 雷达换体检图 + 折叠默认收起 + 总策略总述");

/* ===== v53 增量断言：忘记密码/重置密码/自行改密 ===== */
const readSrc = (rel: string) => readFileSync(join(__dirname, rel), "utf8");
/* 1) 后端：本人改密（验原密码）+ 伴学师/管理员重置为 123456 */
const profileSrc = readSrc("../api/profileRouter.ts");
need(profileSrc, "changePassword", "profileRouter.changePassword");
need(profileSrc, "scryptSync", "改密需校验原密码哈希");
const coachSrc = readSrc("../api/coachRouter.ts");
need(coachSrc, "resetStudentPassword", "coachRouter.resetStudentPassword");
need(coachSrc, 'hashPassword("123456")', "重置默认密码 123456");
need(coachSrc, "这位同学不在你的伴学名单里", "伴学师仅名下学员校验");
/* 2) 前端：登录页忘记密码引导 + 我的页修改密码 + 重置按钮组件 */
const loginSrc = readSrc("../src/pages/Login.tsx");
need(loginSrc, "忘记密码", "登录页忘记密码入口");
need(loginSrc, "123456", "忘记密码弹层含默认密码说明");
const profileCardSrc = readSrc("../src/components/companion/ProfileCard.tsx");
need(profileCardSrc, "修改登录密码", "我的档案卡修改密码");
need(profileCardSrc, "changePassword", "我的档案卡调用改密接口");
const resetBtnSrc = readSrc("../src/components/ResetPasswordButton.tsx");
need(resetBtnSrc, "resetStudentPassword", "重置按钮调用接口");
const tutorSrc = readSrc("../src/pages/Tutor.tsx");
need(tutorSrc, "ResetPasswordButton", "伴学学员卡重置入口");
const adminSrc = readSrc("../src/pages/Admin.tsx");
need(adminSrc, "ResetPasswordButton", "管理员学员列表重置入口");
console.log("OK v53 忘记密码引导 + 重置为 123456 + 自行改密");

/* ===== v54 增量断言：报告由伴学师把关（默认不推送） ===== */
const readSrc55 = (rel: string) => readFileSync(join(__dirname, rel), "utf8");
/* 1) DB：schema + 迁移 0018 三处同步 */
const schemaSrc = readSrc55("../db/schema.ts");
need(schemaSrc, 'reportReleased: boolean("report_released")', "schema report_released 列");
need(schemaSrc, '.notNull().default(false)', "默认不推送");
const embSrc55 = readSrc55("../api/migrationsEmbedded.ts");
need(embSrc55, "0018_report_released", "内嵌迁移 0018");
need(embSrc55, "report_released", "0018 SQL 内容");
const journalSrc55 = readSrc55("../db/migrations/meta/_journal.json");
need(journalSrc55, "0018_report_released", "journal 0018");
/* 2) 后端：推送/收回接口 + 名单校验 + 列表字段 */
const coachSrc55 = readSrc55("../api/coachRouter.ts");
need(coachSrc55, "setReportAccess", "coachRouter.setReportAccess");
need(coachSrc55, "reportReleased: !!input.released", "写入推送开关");
const detailSrc = readSrc55("../api/studentDetail.ts");
need(detailSrc, "reportReleased: p.reportReleased", "学员列表带 reportReleased");
/* 3) 前端：学生端两报告页门禁 + 伴学/管理端推送按钮 */
const gateSrc = readSrc55("../src/components/ReportLockedGate.tsx");
need(gateSrc, "profile.reportReleased", "门禁判断");
const panelSrc = readSrc55("../src/components/ReportLockedPanel.tsx");
need(panelSrc, "请伴学师推送报告", "面板含请求推送按钮");
need(panelSrc, "requestReportPush", "面板调用请求接口");
const rdSrc = readSrc55("../src/pages/ReportDetail.tsx");
need(rdSrc, "OPEN_TABS", "详版报告按 tab 白名单");
need(rdSrc, '"mbti"', "白名单含 mbti");
need(rdSrc, '"discparent"', "白名单含家长 DISC");
need(rdSrc, "ReportLockedPanel", "未开放 tab 渲染请求面板");
need(rdSrc, "!OPEN_TABS.includes(tab)", "未推送且非白名单则锁定");
const rSrc = readSrc55("../src/pages/Report.tsx");
need(rSrc, "ReportLockedGate", "学力报告页加门禁");
const btnSrc = readSrc55("../src/components/ReportAccessButton.tsx");
need(btnSrc, "setReportAccess", "推送按钮调用接口");
const tutorSrc55 = readSrc55("../src/pages/Tutor.tsx");
need(tutorSrc55, "ReportAccessButton", "伴学学员卡推送入口");
const adminSrc54 = readSrc55("../src/pages/Admin.tsx");
need(adminSrc54, "ReportAccessButton", "管理员列表推送入口");
console.log("OK v54 报告伴学师把关（迁移 0018 + 门禁 + 推送开关）");
/* v55 增量断言 */

console.log("RENDER_SMOKE_V55_OK");

/* v55：请求推送闭环 */
const profileSrc55 = readSrc55("../api/profileRouter.ts");
need(profileSrc55, "requestReportPush", "profileRouter.requestReportPush");
need(profileSrc55, "reportPushRequestedAt", "记录请求时间");
need(coachSrc55, "reportPushRequestedAt: null", "推送后自动清空请求");
need(schemaSrc, "reportPushRequestedAt", "schema 请求时间列");
need(embSrc55, "0019_report_push_request", "内嵌迁移 0019");
need(journalSrc55, "0019_report_push_request", "journal 0019");
need(detailSrc, "reportPushRequestedAt: p.reportPushRequestedAt", "学员列表带请求标记");
need(tutorSrc55, "家长请求推送报告", "伴学卡请求提醒");
console.log("OK v55 MBTI/DISC 直接可看 + 一键请伴学师推送（迁移 0019）");

/* ================= v56 增量断言 ================= */
const readSrc56 = (rel: string) => readFileSync(join(__dirname, rel), "utf8");
/* 1) 迁移 0020：三处同步 */
const schemaSrc56 = readSrc56("../db/schema.ts");
need(schemaSrc56, 'export const studentTutor = mysqlTable("student_tutor"', "schema student_tutor 表");
need(schemaSrc56, "studentUserId", "关联学员");
const embSrc56 = readSrc56("../api/migrationsEmbedded.ts");
need(embSrc56, "0020_student_tutor", "内嵌迁移 0020");
const journalSrc56 = readSrc56("../db/migrations/meta/_journal.json");
need(journalSrc56, "0020_student_tutor", "journal 0020");
/* 2) 后端：多对多分配 + 归属判定 */
const adminSrc56 = readSrc56("../api/adminRouter.ts");
need(adminSrc56, "setStudentTutors", "管理员多分配接口");
need(adminSrc56, "UNIQUE" === "UNIQUE" ? "studentTutor" : "", "伴学师列表含多对多并集");
const accessSrc = readSrc56("../api/tutorAccess.ts");
need(accessSrc, "isMyStudent", "归属判定助手");
need(accessSrc, "studentTutor", "判定查多对多表");
const coachSrc56 = readSrc56("../api/coachRouter.ts");
need(coachSrc56, "isMyStudent", "伴学接口用归属判定");
need(coachSrc56, "s.tutorIds.includes(ctx.user.id)", "名下学员含多对多");
const detailSrc56 = readSrc56("../api/studentDetail.ts");
need(detailSrc56, "tutors: { id: number; name: string }[]", "学员列表带全部伴学师");
/* 3) 前端：Admin 多分配 + 双向搜索 + 首页文案 + 综合测评向导 */
const assignSrc = readSrc56("../src/components/TutorAssignButton.tsx");
need(assignSrc, "setStudentTutors", "分配按钮调多分配接口");
const adminPageSrc = readSrc56("../src/pages/Admin.tsx");
need(adminPageSrc, "TutorAssignButton", "学员列表用多分配按钮");
need(adminPageSrc, "搜索姓名 / 手机号", "管理员学员搜索");
const tutorPageSrc56 = readSrc56("../src/pages/Tutor.tsx");
need(tutorPageSrc56, "搜索学员姓名 / 手机号", "伴学师学员搜索");
const loginSrc56 = readSrc56("../src/pages/Login.tsx");
need(loginSrc56, "先测评，再设计，向未来", "首页新标语");
need(loginSrc56, "个性化学习成长伙伴", "首页新副标");
const suiteSrc = readSrc56("../src/components/assessment/CombinedSuite.tsx");
need(suiteSrc, "综合学习力系统测评", "向导标题");
need(suiteSrc, "基本信息", "第一步基本信息");
need(suiteSrc, '"mbti"', "含 MBTI 步骤");
need(suiteSrc, '"disc"', "含 DISC 步骤");
need(suiteSrc, '"e3"', "含学习力诊断步骤");
need(suiteSrc, '"academics"', "含学业目标步骤");
need(suiteSrc, '"multi5"', "含智能五项步骤");
const acSrc = readSrc56("../src/pages/AssessmentCenter.tsx");
need(acSrc, "CombinedSuite", "测评中心接导向导");
need(acSrc, "综合学习力系统测评", "测评中心顶部入口");
console.log("OK v56 多伴学师分配 + 双向搜索 + 新标语 + 综合测评向导（迁移 0020）");

console.log("RENDER_SMOKE_V56_OK");

/* ================= v57 增量断言 ================= */
const readSrc57 = (rel: string) => readFileSync(join(__dirname, rel), "utf8");
/* 1) 后端：AI 问诊 + 规则兜底 + 容错 */
const coachSrc57 = readSrc57("../api/coachRouter.ts");
need(coachSrc57, "askAdvice", "coach.askAdvice 问诊接口");
need(coachSrc57, "tryChat", "AI 调用");
need(coachSrc57, "matchAbility", "规则兜底匹配");
need(coachSrc57, "AI 通道暂不可用", "兜底文案");
const accessSrc57 = readSrc57("../api/tutorAccess.ts");
need(accessSrc57, "listStudentTutorLinks", "分配表容错读取");
const detailSrc57 = readSrc57("../api/studentDetail.ts");
need(detailSrc57, "listStudentTutorLinks", "学员列表用容错读取");
const adminSrc57 = readSrc57("../api/adminRouter.ts");
need(adminSrc57, "listStudentTutorLinks", "伴学师列表用容错读取");
/* 2) 前端：陪跑训练专栏 + AI 问诊 + 按学员对策 + 分配按钮修复 */
const tutorSrc57 = readSrc57("../src/pages/Tutor.tsx");
need(tutorSrc57, "陪跑训练专栏", "专栏切换");
need(tutorSrc57, "AiCoachPanel", "AI 问诊接入");
need(tutorSrc57, "StudentAdvicePanel", "学员卡对策面板");
need(tutorSrc57, "搜索学员姓名 / 手机号", "学员搜索保留");
const aiSrc = readSrc57("../src/components/coach/AiCoachPanel.tsx");
need(aiSrc, "askAdvice", "问诊面板调接口");
need(aiSrc, "关联学员", "可带入学员上下文");
need(aiSrc, "规则匹配", "降级标注");
const adviceSrc = readSrc57("../src/components/coach/StudentAdvicePanel.tsx");
need(adviceSrc, "score < 3.8", "按诊断弱项匹配");
need(adviceSrc, "AbilityPlanCard", "复用训练卡");
const cardSrc = readSrc57("../src/components/training/AbilityPlanCard.tsx");
need(cardSrc, "简要方案", "单能训练卡");
const libSrc = readSrc57("../src/components/TrainingPlanLibrary.tsx");
need(libSrc, "AbilityPlanCard", "方案库复用单能卡");
const assignSrc57 = readSrc57("../src/components/TutorAssignButton.tsx");
need(assignSrc57, "toggleOpen", "打开时初始化勾选");
if (/useEffect/.test(assignSrc57)) throw new Error("分配按钮不应再依赖 useEffect 初始化");
console.log("OK v57 陪跑训练专栏 + AI 问诊 + 按学员症状对策 + v56 容错修复");
console.log("RENDER_SMOKE_V57_OK_BASE");

/* ================= v58 增量断言：答题明细显示原答案+选项文案，反向题保留原答案标注换算分 ================= */
const readSrc58 = (rel: string) => readFileSync(join(__dirname, rel), "utf8");
const assert58 = { ok: (cond: unknown, msg: string) => { if (!cond) throw new Error(msg); } };
/* 1) 报告答题明细数据源：likertAns + 三套 1-5 文案 + 反向标注 */
const abSrc = readSrc58("../src/components/reports/answerBlocks.ts");
need(abSrc, "likertAns", "明细答案文案化函数");
need(abSrc, '"从不", "很少", "有时", "经常", "总是"', "频率量表文案");
need(abSrc, '"完全不符合", "不太符合", "一般", "比较符合", "非常符合"', "职业锚量表文案");
need(abSrc, '"完全不喜欢", "不太喜欢", "一般", "比较喜欢", "非常喜欢"', "霍兰德量表文案");
need(abSrc, "反向题，计 ${6 - v} 分", "反向题标注换算分");
need(abSrc, "ans: likertAns(v, FREQ5, q.reverse)", "E3 明细用原答案+换算分");
need(abSrc, "ans: likertAns(v, FIT5, q.reverse)", "职业锚明细用原答案+换算分");
need(abSrc, "ans: likertAns(v, LIKE5)", "霍兰德明细用原答案");
/* 2) 附录三阶九能表：作答列（原答案） + 得分列（换算） */
const astSrc = readSrc58("../src/components/reports/AbilityScoreTable.tsx");
need(astSrc, "作答（原答案）", "附录作答列");
need(astSrc, "得分（换算）", "附录得分列标注换算");
need(astSrc, "反向计分", "附录反向题标注");
/* 3) 伴学卡折叠明细（死代码兜底也保持口径一致） */
const adSrc = readSrc58("../src/components/companion/AnswerDetail.tsx");
need(adSrc, "labels={FREQ5}", "E3 明细传频率文案");
need(adSrc, "labels={FIT5}", "智能五项明细文案");
need(adSrc, "（计 {adj} 分）", "反向题显示换算分");
/* 4) 行为断言：E3 反向题 raw=5 时显示原答案与换算分 */
const blk58 = buildAnswerBlocks([
  {
    kind: "e3",
    createdAt: "2026-09-20T08:00:00Z",
    answers: {
      stage: "junior",
      ratings: [
        ...Array.from({ length: 69 }, (_, i) => (i === 13 ? 5 : 4)), // 第 14 题=反向题，选 5(总是)
      ],
      motivation: "B",
      lifeEvents: [],
      openAnswers: [],
    },
  },
]);
const lexue = blk58.find((b) => b.key === "e3-lexue");
if (!lexue) throw new Error("缺乐学明细块");
const q14 = lexue.rows.find((r) => r.no === 14);
if (!q14) throw new Error("缺第 14 题行");
assert58.ok(q14.ans.includes("总是"), "反向题答案应显示原填选项文案: " + q14.ans);
assert58.ok(q14.ans.includes("计 1 分"), "反向题应标注换算分: " + q14.ans);
assert58.ok(q14.bad, "5(总是) 反向题换算 1 分应标红");
const q1 = lexue.rows.find((r) => r.no === 1);
assert58.ok(q1 && q1.ans.includes("经常") && !q1.ans.includes("反向"), "正向题应显示 4 · 经常: " + (q1 && q1.ans));
const anchorBlk = buildAnswerBlocks([
  { kind: "anchor", createdAt: "2026-09-20T08:00:00Z", answers: Array.from({ length: 40 }, (_, i) => (i === 0 ? 1 : 3)) },
]);
const a1 = anchorBlk[0]?.rows.find((r) => r.no === 1);
assert58.ok(a1 && a1.ans.includes("完全不符合"), "职业锚应显示选项文案: " + (a1 && a1.ans));
/* 5) 系统排查修复：报告页门禁与 ReportLockedGate 同口径 fail-open，且无档案行不被永久锁死 */
const rdSrc58 = readSrc58("../src/pages/ReportDetail.tsx");
need(rdSrc58, "!profile || !!profile.reportReleased", "无档案行视为未锁定（fail-open）");
need(rdSrc58, "isLoading || profileLoading", "等档案加载完再判定，避免闪锁");
console.log("OK v58 答题明细显示原答案（反向题标注换算分）");
console.log("OK v58-fix 报告门禁 fail-open 与门禁组件口径一致");

/* ================= v59：SaaS 机构隔离 + 管理员兼伴学师问诊豁免 ================= */
const readSrc59 = (rel: string) => readFileSync(join(__dirname, rel), "utf8");

/* 1) 租户守卫：tenant.ts 导出 orgOf / isPlatformAdmin / sameOrg */
const tenantSrc = readSrc59("../api/tenant.ts");
need(tenantSrc, "export function isPlatformAdmin", "tenant.ts 平台超管判定");
need(tenantSrc, "export async function sameOrg", "tenant.ts 同机构校验");
need(tenantSrc, "return user.orgId ?? null;", "tenant.ts orgOf 语义");

/* 2) adminRouter：机构过滤 + 平台超管自举 + 分配同机构校验 */
const admSrc59 = readSrc59("../api/adminRouter.ts");
need(admSrc59, "claimPlatformAdmin: adminQuery.mutation", "平台超管自举过程");
need(admSrc59, "isNull(users.orgId)", "平台超管=orgId IS NULL 判定");
need(admSrc59, "listStudents(getDb(), scope)", "学员列表按作用域（本机构/超管选机构）");
need(admSrc59, "getStudentDetail(getDb(), input.userId, ctx.user.orgId)", "学员详情限本机构");
need(admSrc59, "仅平台超管可设置管理员", "机构内禁止私设管理员");
need(admSrc59, "sameOrg(db, ctx.user, input.userId)", "setRole 同机构校验");
need(admSrc59, "该伴学师不在你的机构内", "assignTutor 同机构校验");
need(admSrc59, "用户 ${id} 不在你的机构内", "setStudentTutors 逐人同机构校验");
need(admSrc59, "innerJoin(users", "overview 业务量按机构统计");
need(admSrc59, "orgId == null", "平台超管 overview 返回空");

/* 3) coachRouter：管理员看全机构学员 + 问诊豁免 */
const coachSrc59 = readSrc59("../api/coachRouter.ts");
need(coachSrc59, "listStudents(getDb(), ctx.user.orgId)", "myStudents 限本机构");
need(coachSrc59, "管理员可查本机构任意学员", "studentDetail 管理员豁免");
need(coachSrc59, "管理员（兼伴学师）可带入本机构任意学员", "askAdvice 管理员豁免");
need(coachSrc59, "getStudentDetail(db, input.userId, ctx.user.orgId)", "问诊上下文限本机构");
const sameOrgCount59 = (coachSrc59.match(/sameOrg\(db, ctx\.user/g) ?? []).length;
assert58.ok(sameOrgCount59 >= 5, "coachRouter 管理员路径应有多处 sameOrg 兜底（实际 " + sameOrgCount59 + "）");

/* 4) inviteRouter：渠道归属机构 + 注册继承 */
const invSrc59 = readSrc59("../api/inviteRouter.ts");
need(invSrc59, "orgId: ch.orgId ?? null", "注册学员继承渠道机构");
need(invSrc59, "const orgId = ctx.user.orgId ?? null;", "发码记录机构");
need(invSrc59, "平台超管 god mode：全部渠道", "超管看全部渠道");
need(invSrc59, "这张二维码不在你机构内", "停用码机构校验");
need(invSrc59, "recent.filter((r) => mine.has(r.channelId))", "注册记录限权限范围");

/* 5) auth.me 带机构品牌 + Layout 品牌展示 + 停用提示 */
const meSrc59 = readSrc59("../api/auth-router.ts");
need(meSrc59, "organizations.findFirst", "me 联查机构");
need(meSrc59, "brandName: org.brandName", "me 返回品牌名");
const layoutSrc59 = readSrc59("../src/components/Layout.tsx");
need(layoutSrc59, "user?.org?.brandName ?? \"三好学伴\"", "侧边栏品牌=机构商标");
need(layoutSrc59, "orgPaused", "机构停用提示条");
need(layoutSrc59, "平台超管", "平台超管身份标识");

/* 6) 前端路由：平台超管进机构管理；机构管理员保留四 tab + 自举入口 */
const adminSrc59 = readSrc59("../src/pages/Admin.tsx");
need(adminSrc59, "<OrgAdminTab />", "平台超管路由到机构管理");
need(adminSrc59, "claimPlatformAdmin", "机构管理员升级平台超管入口");
need(adminSrc59, "机构后台不提供此按钮", "机构内禁设管理员");
const orgTabSrc59 = readSrc59("../src/components/admin/OrgAdminTab.tsx");
need(orgTabSrc59, "trpc.org.list.useQuery", "机构列表查询");
need(orgTabSrc59, "trpc.org.create.useMutation", "开通机构");
need(orgTabSrc59, "trpc.org.setActive.useMutation", "停用/启用机构");
need(orgTabSrc59, "trpc.org.resetAdminPassword.useMutation", "重置管理员密码");

/* 7) orgRouter：平台超管守卫 + 开通机构建管理员账号 */
const orgRouterSrc59 = readSrc59("../api/orgRouter.ts");
need(orgRouterSrc59, "requirePlatformAdmin(ctx.user)", "机构路由平台超管守卫");
need(orgRouterSrc59, "role: \"admin\"", "开通机构建机构管理员");
need(orgRouterSrc59, "orgId,", "管理员账号挂机构");
need(orgRouterSrc59, "hashPassword(password)", "管理员初始密码散列");

/* 8) router 注册 + 版本号 */
const routerSrc59 = readSrc59("../api/router.ts");
need(routerSrc59, "org: orgRouter", "orgRouter 注册");
need(routerSrc59, "v63-2026-09-24", "BUILD_TAG 升 v63");

/* ================= v60：平台超管 god mode（放开数据权限 + 任意账号设管理员） ================= */
/* 1) sameOrg：平台超管可管理任意账号 */
need(tenantSrc, "if (me.orgId == null) return true;", "超管 sameOrg 恒真（god mode）");
need(tenantSrc, "平台超管（orgId=null）可管理任意账号", "tenant 注释 god mode");
/* 2) 学员列表/详情：null=全量（超管），number=本机构校验 */
const sdSrc60 = readSrc59("../api/studentDetail.ts");
need(sdSrc60, "orgId == null ? await db.select().from(users)", "listStudents null=全量");
need(sdSrc60, "if (orgId != null)", "getStudentDetail null 不校验（超管）");
need(sdSrc60, "orgName: u.orgId != null ? (orgNameMap.get(u.orgId) ?? null) : null", "学员带机构名");
/* 3) adminRouter：超管看全部伴学师/用户（带机构名）/全局总量 */
need(admSrc59, "平台超管：全部机构", "tutors 超管全量");
need(admSrc59, "平台超管：全系统总量（不过滤机构）", "overview 超管全局");
need(admSrc59, "平台超管：全部机构", "users 超管全量");
need(admSrc59, "orgName: u.orgId != null ? (orgNameMap.get(u.orgId) ?? null) : null", "用户带机构名");
need(admSrc59, "仅平台超管可设置管理员", "机构内仍禁设管理员");
/* 4) 前端：超管面板 = 机构管理 + 数据 tabs + 设为管理员 */
need(adminSrc59, "platform={isPlatformAdmin}", "超管面板 god mode 标记");
need(adminSrc59, "{ key: \"orgs\" as AdminTab, label: \"机构管理\" }", "超管加机构管理 tab");
need(adminSrc59, "设为管理员", "超管可给任意账号开管理员");
need(adminSrc59, "总系统 · 后台管理", "超管面板标题");
need(adminSrc59, "platform && u.orgName", "用户列表机构标注");
need(adminSrc59, "platform && s.orgName", "学员列表机构标注");
/* 5) inviteRouter：超管可管全部渠道 */
need(invSrc59, "ctx.user.orgId != null", "机构管理员才校验渠道归属");

console.log("OK v60 平台超管 god mode：全系统数据可读 + 任意账号设管理员");

/* 9) 迁移 0021：三处同步 */
const migFile59 = readSrc59("../db/migrations/0021_organizations.sql");
need(migFile59, "CREATE TABLE `organizations`", "0021 建机构表");
need(migFile59, "ALTER TABLE `users` ADD `org_id`", "0021 users 加 org_id");
need(migFile59, "ALTER TABLE `invite_channels` ADD `org_id`", "0021 渠道加 org_id");
need(migFile59, "SELECT '默认机构', '三好学伴'", "0021 回填默认机构");
const embedSrc59 = readSrc59("../api/migrationsEmbedded.ts");
need(embedSrc59, '"0021_organizations"', "内嵌迁移含 0021");

console.log("OK v59 SaaS 租户隔离（行级 orgId）全路由过滤");
console.log("OK v59 平台超管总系统（orgRouter + 机构管理面板 + 自举）");
console.log("OK v59 管理员兼伴学师：全机构学员问诊豁免");
console.log("OK v60 平台超管 god mode：全系统数据可读 + 任意账号设管理员");
console.log("RENDER_SMOKE_V60_OK");

/* ================= v61：报告下载乱码修复 + 问诊方法可看详情 + 开方功能 + 三系统分离 ================= */
const readSrc61 = (rel: string) => readFileSync(join(__dirname, rel), "utf8");

/* 1) 报告下载乱码：ReportView 改用独立打印窗口生成器（不再 window.print 打实时 DOM） */
const rvSrc61 = readSrc61("../src/components/reports/ReportView.tsx");
need(rvSrc61, 'from "@/lib/reportDownload"', "ReportView 引入打印窗口生成器");
need(rvSrc61, "downloadReport(title, html, studentName)", "ReportView 下载走生成器");
need(rvSrc61, "e3V37PrintHtml", "E3 报告生成器");
need(rvSrc61, "combinedPrintHtml", "综合报告生成器");
const dlSrc61 = readSrc61("../src/lib/reportDownload.ts");
for (const fn of ["mbtiPrintHtml", "discPrintHtml", "multi5PrintHtml", "anchorPrintHtml", "hollandPrintHtml", "mentalPrintHtml", "e3V37PrintHtml", "combinedPrintHtml", "downloadReport"]) {
  need(dlSrc61, fn, `reportDownload 导出 ${fn}`);
}
console.log("OK v61 报告下载改独立打印窗口（乱码修复）");

/* 2) 问诊建议训练方法可点看具体内容：askAdvice 返回方法清单 */
const coachSrc61 = readSrc61("../api/coachRouter.ts");
need(coachSrc61, 'import { METHOD_BY_ID } from "@/data/training/methods"', "askAdvice 引入方法库");
need(coachSrc61, "ability: hit.ability, methods", "问诊返回 methods 清单");
const coachSrc61b = coachSrc61;
assert58.ok((coachSrc61b.match(/ability: hit\.ability, methods/g) ?? []).length >= 2, "AI 与兜底路径都应带 methods");
console.log("OK v61 问诊建议带训练方法清单（可点看详情）");

/* 3) 开方功能：student_prescriptions 表 + 迁移 0022 三处同步 + 接口 */
const schemaSrc61 = readSrc61("../db/schema.ts");
need(schemaSrc61, 'export const studentPrescriptions = mysqlTable("student_prescriptions"', "schema student_prescriptions 表");
need(schemaSrc61, "tutorUserId", "处方记伴学师");
const mig61 = readSrc61("../db/migrations/0022_student_prescriptions.sql");
need(mig61, "CREATE TABLE `student_prescriptions`", "0022 SQL 建表");
const embSrc61 = readSrc61("../api/migrationsEmbedded.ts");
need(embSrc61, '"0022_student_prescriptions"', "内嵌迁移含 0022");
const journal61 = readSrc61("../db/migrations/meta/_journal.json");
need(journal61, "0022_student_prescriptions", "journal 0022");
need(coachSrc61, "createPrescription: tutorQuery", "开方接口");
need(coachSrc61, "listPrescriptions: tutorQuery", "处方列表接口");
const dashSrc61 = readSrc61("../api/dashboardRouter.ts");
need(dashSrc61, "myPrescriptions: authedQuery", "学员端处方查询");
console.log("OK v61 开方数据链路（迁移 0022 三处同步 + 推送/查询接口）");

/* 4) 前端开方 UI：方法勾选 + 详情框加大 + 两列布局 + 开方确认弹窗 + 学员端处方卡 */
const cardSrc61 = readSrc61("../src/components/training/AbilityPlanCard.tsx");
need(cardSrc61, "selectedIds?: Set<string>", "方法勾选入参");
need(cardSrc61, "onToggleSelect?:", "勾选回调");
const libSrc61 = readSrc61("../src/components/TrainingPlanLibrary.tsx");
need(libSrc61, "PrescriptionComposer", "开方确认弹窗（v61）");
assert58.ok(!libSrc61.includes("lg:grid-cols-2"), "V62 方案库应为一栏布局（不再有 lg:grid-cols-2）");
need(libSrc61, "PrescriptionComposer", "开方确认弹窗");
need(libSrc61, "trpc.coach.createPrescription.useMutation", "确认推送学员端");
need(libSrc61, 'downloadReport("伴学训练处方"', "下载开方单");
const rxCardSrc61 = readSrc61("../src/components/PrescriptionsCard.tsx");
need(rxCardSrc61, "trpc.dashboard.myPrescriptions.useQuery", "学员端拉取处方");
const homeSrc61 = readSrc61("../src/pages/Dashboard.tsx");
need(homeSrc61, "<PrescriptionsCard />", "学员首页挂处方卡");
console.log("OK v61 开方 UI（勾选/两列/确认/下载/学员端处方卡）");

/* 5) 三系统分离：staff 不看学员功能；超管仪表盘 + 分系统查看 */
const layoutSrc61 = readSrc61("../src/components/Layout.tsx");
need(layoutSrc61, 'const isStaff = user?.role === "admin" || user?.role === "tutor"', "Layout staff 判定");
need(layoutSrc61, "{!isStaff && NAV.filter", "staff 隐藏学员导航");
const appSrc61 = readSrc61("../src/App.tsx");
need(appSrc61, "function RoleGate", "RoleGate 角色路由门");
need(appSrc61, "{ enabled: !isStaff }", "staff 跳过学员档案门禁");
const admSrc61 = readSrc61("../api/adminRouter.ts");
need(admSrc61, "ctx.user.orgId ?? input.orgId ?? null", "查询作用域=本机构或超管选机构");
const orgSrc61 = readSrc61("../api/orgRouter.ts");
need(orgSrc61, "dashboard: adminQuery.query", "超管仪表盘接口");
need(orgSrc61, "attemptCount", "仪表盘业务量统计");
const adminPage61 = readSrc61("../src/pages/Admin.tsx");
need(adminPage61, "PlatformDashboard", "仪表盘组件");
need(adminPage61, "查看系统", "分系统选择器");
need(adminPage61, "全部系统（跨机构合计）", "全部系统选项");
need(adminPage61, 'label: "数据仪表盘"', "仪表盘 tab");

console.log("OK v61 报告下载修复 + 问诊方法详情 + 开方推送 + 三系统分离");
console.log("RENDER_SMOKE_V61_OK");

/* ================= v62：答题卷得分表伴学端可查可打印 + 学员卡一行一个 + 方案库一栏 + 答题明细分数段着色 ================= */
const readSrc62 = (rel: string) => readFileSync(join(__dirname, rel), "utf8");

/* 1) 分数段着色：answerBlocks 导出 bandOf，E3/职业锚/霍兰德逐题带 band */
const abSrc62 = readSrc62("../src/components/reports/answerBlocks.ts");
need(abSrc62, 'export type AnswerBand = "bad" | "mid" | "ok"', "分数段类型");
need(abSrc62, "export function bandOf", "bandOf 函数");
need(abSrc62, "score < 3 ? \"bad\" : score < 3.8 ? \"mid\" : \"ok\"", "分段阈值口径");
assert58.ok((abSrc62.match(/band: /g) ?? []).length >= 4, "E3/状态/职业锚/霍兰德均应带 band（实际 " + (abSrc62.match(/band: /g) ?? []).length + "）");
/* 行为断言：1→bad(红)、3→mid(黄)、5→ok(绿)；反向题按换算分 */
const blk62 = buildAnswerBlocks([
  {
    kind: "e3",
    createdAt: "2026-09-24T08:00:00Z",
    answers: {
      stage: "junior",
      ratings: Array.from({ length: 70 }, (_, i) => [1, 3, 5][i % 3]),
      motivation: "B",
      lifeEvents: [],
      openAnswers: [],
    },
  },
]);
const lx62 = blk62.find((b) => b.key === "e3-lexue");
if (!lx62) throw new Error("缺乐学明细块");
const bandOfRow = (no: number) => lx62.rows.find((r) => r.no === no)?.band;
assert58.ok(bandOfRow(1) === "bad", "第1题=1分应为 bad: " + bandOfRow(1));
assert58.ok(bandOfRow(2) === "mid", "第2题=3分应为 mid: " + bandOfRow(2));
assert58.ok(bandOfRow(3) === "ok", "第3题=5分应为 ok: " + bandOfRow(3));
/* 反向题：第14题 raw=1 → 换算 5 分 → ok */
const blk62r = buildAnswerBlocks([
  {
    kind: "e3",
    createdAt: "2026-09-24T08:00:00Z",
    answers: { stage: "junior", ratings: Array.from({ length: 70 }, (_, i) => (i === 13 ? 1 : 4)), motivation: "B", lifeEvents: [], openAnswers: [] },
  },
]);
const q14b = blk62r.find((b) => b.key === "e3-lexue")?.rows.find((r) => r.no === 14);
assert58.ok(q14b?.band === "ok", "反向题 raw=1 换算 5 分应为 ok(绿): " + q14b?.band);

/* 2) 渲染层：ReportView 明细行按 band 三色；伴学卡 AnswerDetail 同步 */
const rvSrc62 = readSrc62("../src/components/reports/ReportView.tsx");
need(rvSrc62, 'row.band === "mid"', "ReportView 明细行黄段");
need(rvSrc62, '"text-[#5a9326]"', "ReportView 明细行绿段");
need(rvSrc62, '"text-[#8f1313]"', "ReportView 明细行红段");
const adSrc62 = readSrc62("../src/components/companion/AnswerDetail.tsx");
need(adSrc62, 'adj < 3\n', "伴学卡分数段判定");
need(adSrc62, '"text-[#8a6d1a]"', "伴学卡黄段");
/* SSR 行为：含 1/3/5 分的 E3 明细应同时出现红黄绿三色类名 */
const data62: any = {
  ...data,
  raw: [{ kind: "e3", answers: { stage: "junior", ratings: Array.from({ length: 70 }, (_, i) => [1, 3, 5][i % 3]), motivation: "B", lifeEvents: [], openAnswers: [] }, createdAt: new Date() }],
};
const html62 = renderToStaticMarkup(
  React.createElement(
    MemoryRouter,
    { initialEntries: ["/report-detail?tab=combined"] },
    React.createElement(ReportView, { data: data62, profile: { name: "测试员", grade: "初一", academics }, viewer: "tutor", onEditAcademics: () => {} }),
  ),
);
for (const cls of ["text-[#8f1313]", "text-[#8a6d1a]", "text-[#5a9326]"]) need(html62, cls, "答题明细三色渲染");
console.log("OK v62 答题明细分数段着色（红<3.0/黄3.0-3.7/绿≥3.8，反向题按换算分）");

/* 3) 伴学端答题卷 · 得分表面板 + 打印生成器 */
const dlSrc62 = readSrc62("../src/lib/reportDownload.ts");
need(dlSrc62, "export function answerSheetsPrintHtml", "答题卷打印生成器");
need(dlSrc62, "三阶九能得分表（", "得分速览表");
need(dlSrc62, "红 <3.0 卡点 · 黄 3.0-3.7 待提升 · 绿 ≥3.8 正常", "打印页分数段口径");
const panelSrc62 = readSrc62("../src/components/AnswerSheetsPanel.tsx");
need(panelSrc62, "buildAnswerBlocks(raw)", "面板构建答题块");
need(panelSrc62, "AbilityScoreTable", "面板含三阶九能得分表");
need(panelSrc62, "全部打印", "一键全部打印");
need(panelSrc62, "BAND_CLASS", "面板分数段着色");
const drawerSrc62 = readSrc62("../src/components/StudentDetailDrawer.tsx");
need(drawerSrc62, "<AnswerSheetsPanel", "学员详情抽屉挂答题卷面板");
/* 生成器行为：块内容进 HTML + 三色 hex */
const sheetHtml = dlEval62(blocks62ForPrint());
function blocks62ForPrint() {
  return [{ title: "E3 学业诊断 · 乐学 第 1-21 题", note: "n", rows: [
    { no: 1, text: "题1", ans: "1 · 从不", band: "bad" as const },
    { no: 2, text: "题2", ans: "3 · 有时", band: "mid" as const },
    { no: 3, text: "题3", ans: "5 · 总是", band: "ok" as const },
  ] }];
}
function dlEval62(blks: { title: string; note?: string; rows: { no: number | string; text: string; ans: string; band?: "bad" | "mid" | "ok" }[] }[]) {
  const { answerSheetsPrintHtml } = require("../src/lib/reportDownload") as typeof import("../src/lib/reportDownload");
  return answerSheetsPrintHtml(blks, null);
}
need(sheetHtml, "E3 学业诊断 · 乐学 第 1-21 题", "打印 HTML 含块标题");
need(sheetHtml, "#8f1313", "打印 HTML 红色段");
need(sheetHtml, "#8a6d1a", "打印 HTML 黄色段");
need(sheetHtml, "#5a9326", "打印 HTML 绿色段");
console.log("OK v62 伴学端答题卷查看 + 单卷/全部打印（独立打印窗口）");

/* 4) 布局：伴学工作台学员卡一行一个；训练方案库一栏 */
const tutorSrc62 = readSrc62("../src/pages/Tutor.tsx");
assert58.ok(!/grid gap-3 sm:grid-cols-2/.test(tutorSrc62), "伴学工作台学员卡应为一行一个（去掉 sm:grid-cols-2）");
const libSrc62b = readSrc62("../src/components/TrainingPlanLibrary.tsx");
assert58.ok(!libSrc62b.includes("lg:grid-cols-2"), "方案库应为一栏布局");
console.log("OK v62 学员卡一行一个 + 方案库一栏");

console.log("RENDER_SMOKE_V62_OK");

/* ================= v63：三阶九能得分表逐题明细默认折叠 ================= */
import AbilityScoreTable from "../src/components/reports/AbilityScoreTable";

const astSrc63 = readSrc62("../src/components/reports/AbilityScoreTable.tsx");
need(astSrc63, "逐题明细默认全部折叠", "明细默认折叠注释");
need(astSrc63, "useState<Set<string>>", "折叠状态管理");
need(astSrc63, "逐题明细", "展开入口文案");
need(astSrc63, "AbilityGroup", "能力组折叠组件");
/* 行为断言：SSR 首帧（折叠态）含小计行、不含逐题题干 */
const astHtml63 = renderToStaticMarkup(
  React.createElement(AbilityScoreTable, {
    e3,
    ratings: Array.from({ length: 70 }, (_, i) => (i % 5) + 1),
  }),
);
need(astHtml63, "附录 · 三阶九能观察点得分表", "得分表标题");
need(astHtml63, "乐学", "乐学组小计");
need(astHtml63, "动力", "能力小计行");
for (const kp of ["学习兴趣", "自信心", "情绪管理"]) {
  if (astHtml63.includes(kp)) throw new Error(`折叠态不应渲染逐题 kp：${kp}`);
}
console.log("OK v63 得分表明细默认折叠（小计直出，点开看逐题）");
console.log("RENDER_SMOKE_V63_OK");
