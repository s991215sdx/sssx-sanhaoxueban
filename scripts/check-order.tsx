/** @jsxImportSource react */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import ReportView from "../src/components/reports/ReportView";
import { scoreMbti, scoreDisc } from "../contracts/assessments";
import { scoreE3V37 } from "../contracts/e3v37";
import { scoreHolland } from "../contracts/holland";
import { scoreAnchor } from "../contracts/careerAnchor";
import { scoreMental, MENTAL_V2_QUESTION_COUNT } from "../contracts/mentalHealth";

const mbti = scoreMbti(Array.from({ length: 28 }, (_, i) => (i % 3 === 0 ? 0 : 1)));
const disc = scoreDisc(Array.from({ length: 24 }, (_, i) => i % 2));
const e3 = scoreE3V37({
  stage: "junior", ratings: Array.from({ length: 70 }, (_, i) => (i % 5) + 1),
  motivation: "want", subjects: [] as any, lossReasons: [], scoreTrend: "基本稳定",
  lifeEvents: Array.from({ length: 8 }, () => 0), openAnswers: [],
});
const data: any = { mbti, disc, e3,
  holland: scoreHolland(Array.from({ length: 36 }, (_, i) => (i % 5) + 1)),
  anchor: scoreAnchor(Array.from({ length: 40 }, (_, i) => (i % 5) + 1)),
  mental: scoreMental(Array.from({ length: MENTAL_V2_QUESTION_COUNT }, (_, i) => i % 3)),
  raw: [], discParents: [] };
const html = renderToStaticMarkup(React.createElement(MemoryRouter, { initialEntries: ["/?tab=combined"] },
  React.createElement(ReportView, { data, profile: { name: "测", grade: "初一", academics: null }, viewer: "student" })));

// 冰山顺序检查（限定在第二步卡片内，排除顶部框架图同名文本）
const iceStart = html.indexOf("冰山模型");
const iceEnd = html.indexOf("建议进步方案");
const ice = html.slice(iceStart, iceEnd);
const order = ["学能 · 能力系统","善学 · 加速系统","会学 · 行为系统","乐学 · 动力系统","条件 · 支持系统","心理健康","DISC 行为","MBTI 性格","职业锚","霍兰德兴趣"];
let pos = -1, ok = true;
for (const k of order) { const i = ice.indexOf(k); if (i < 0) { console.log("缺行:", k); ok = false; } else if (i < pos) { console.log("顺序错误:", k); ok = false; } else pos = i; }
console.log("冰山下顺序:", ok ? "OK" : "FAIL");

// 层内倒序检查：乐学行内 韧劲 在 信心 前、信心 在 动力 前；条件行 资源→关系→状态（限定冰山段）
const seg = (a: string, b: string) => { const x = ice.indexOf(a), y = ice.indexOf(b); return x >= 0 && y >= 0 && x < y; };
const lexue = ice.slice(ice.indexOf("乐学 · 动力系统"), ice.indexOf("条件 · 支持系统"));
const cond = ice.slice(ice.indexOf("条件 · 支持系统"), ice.indexOf("心理健康"));
const inSeg = (t: string, a: string, b: string) => { const x = t.indexOf(a), y = t.indexOf(b); return x >= 0 && y >= 0 && x < y; };
const chipPos = (t: string, label: string) => { const m = t.match(new RegExp(">" + label + " [0-9.]")); return m ? t.indexOf(m[0]) : -1; };
console.log("乐学chip 韧劲<信心<动力:", chipPos(lexue,"韧劲") >= 0 && chipPos(lexue,"韧劲") < chipPos(lexue,"信心") && chipPos(lexue,"信心") < chipPos(lexue,"动力"), "(pos:", chipPos(lexue,"韧劲"), chipPos(lexue,"信心"), chipPos(lexue,"动力"), ")");
console.log("会学 会用<记住:", inSeg(ice.slice(ice.indexOf("会学 · 行为系统"), ice.indexOf("乐学 · 动力系统")), "会用", "记住"));
console.log("善学 智学<复盘:", inSeg(ice.slice(ice.indexOf("善学 · 加速系统"), ice.indexOf("会学 · 行为系统")), "智学", "复盘"));
console.log("学能 加工速度<工作记忆:", inSeg(ice.slice(ice.indexOf("学能 · 能力系统"), ice.indexOf("善学 · 加速系统")), "加工速度", "工作记忆"));
console.log("条件 资源<关系:", inSeg(cond, "资源", "关系"), " 关系<状态:", inSeg(cond, "关系", "状态"));

// 折叠层级：图形与图表 / 详细报告文字 / 本章相关测评 三个 summary 并列存在
console.log("三折叠并列:", ["图形与图表（点击展开）","详细报告文字（点击展开）","本章相关测评 · 答题明细（点击展开）"].map(k => html.includes(k)));
// 建议进步方案行序：学能层 在 善学层 前
const plan = html.slice(iceEnd);
const inPlan = (a: string, b: string) => { const x = plan.indexOf(a), y = plan.indexOf(b); return x >= 0 && y >= 0 && x < y; };
console.log("方案表倒序 学能层<善学层:", inPlan("学能层", "善学层"), " 善学层<会学层:", inPlan("善学层", "会学层"), " 会学层<乐学层:", inPlan("会学层", "乐学层"), " 乐学层<条件层:", inPlan("乐学层", "条件层"));
// 框架未测标注
console.log("框架未测徽标:", html.includes("多元智能五项 · 未测") || html.includes("未测"));
// 九宫格已删
console.log("无九宫格卡(性格类型卡):", !html.includes("MBTI 性格类型"));
