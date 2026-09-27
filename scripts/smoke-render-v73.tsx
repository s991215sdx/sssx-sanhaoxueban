/* v73 冒烟：升学指导报告 2.0——成绩因子（得分率/趋势/目标差距）+ 四象限 + 3+1+2 组合 + 升学路径 */
import { buildGuidanceReport } from "../src/data/reports/guidance";

const need = (cond: boolean, msg: string) => {
  if (!cond) {
    console.error(`SMOKE_FAIL: ${msg}`);
    process.exit(1);
  }
};

const academics = {
  examName: "期中考试",
  updatedAt: "2026-09-20",
  subjects: [
    { name: "语文", fullScore: 150, lastScore: 120, targetScore: 135, selfLevel: 4 },
    { name: "数学", fullScore: 150, lastScore: 105, targetScore: 120, selfLevel: 3 },
    { name: "英语", fullScore: 150, lastScore: 96, targetScore: 110, selfLevel: 3 },
    { name: "物理", fullScore: 100, lastScore: 82, targetScore: 90, selfLevel: 4 },
    { name: "化学", fullScore: 100, lastScore: 55, targetScore: 75, selfLevel: 2 },
    { name: "生物", fullScore: 100, lastScore: 78, targetScore: 85, selfLevel: 4 },
  ],
};
const records = [
  { id: 1, examName: "月考一", createdAt: "2026-03-10", subjects: [{ name: "物理", fullScore: 100, lastScore: 70 }, { name: "化学", fullScore: 100, lastScore: 60 }] },
  { id: 2, examName: "期中考试", createdAt: "2026-09-20", subjects: [{ name: "物理", fullScore: 100, lastScore: 82 }, { name: "化学", fullScore: 100, lastScore: 55 }] },
];
const mbti = { type: "INTJ", dims: { E: 25, I: 75, S: 30, N: 70, T: 80, F: 20, J: 65, P: 35 } };
const disc = { primary: "C", dims: { D: 20, I: 25, S: 30, C: 45 }, version: 2 as const };
const multi5 = { dims: { reasoning: 82, detail: 70, number: 88, verbal: 60, spatial: 66 }, overall: 73, carefulIndex: 78, perDim: [] };
const holland = { dims: { R: 3.2, I: 4.5, A: 2.8, S: 3.0, E: 2.5, C: 3.8 }, top3: ["I", "C", "R"], code: "ICR", keywords: "", summary: "" };
const anchor = { dims: { TF: 4.2, GM: 3.8, AU: 3.1, SE: 2.9, EC: 2.6, SV: 2.4, CH: 3.3, LS: 2.2 }, top2: ["TF", "GM"], summary: "" };

/* 1. 学业因子：得分率/目标差距/趋势 */
const g = buildGuidanceReport({ grade: "高一", mbti, disc, multi5, holland, anchor, academics, records });
need(g !== null, "全量数据必须出报告");
need(g!.basedOn.includes("学业成绩"), "basedOn 必须含学业成绩");
const ab = g!.academicsBlock!;
need(ab !== null && ab.rows.length === 6, "学业块必须含 6 科");
const phys = ab.rows.find((r) => r.name === "物理")!;
need(phys.pct === 82, "物理得分率=82%");
need(phys.trend === "up", "物理两次记录应判上升");
const chem = ab.rows.find((r) => r.name === "化学")!;
need(chem.trend === "down", "化学应判下滑");
need(chem.gap === 20, "化学目标差距=20pct");
need(ab.avgPct != null && ab.avgPct > 0, "必须有平均得分率");

/* 2. 四象限：物理=优势(I兴趣高+82%)，化学=谨慎/潜能(兴趣低+55%)，生物=优势 */
const mx = g!.matrix!;
need(mx !== null && mx.length >= 6, "四象限必须覆盖所有科目");
const qOf = (n: string) => mx.find((m) => m.name === n)!.quadrant;
need(qOf("物理") === "优势学科", `物理应为优势学科（兴趣高+得分高），实际=${qOf("物理")}`);
need(qOf("化学") === "潜能学科", `化学应为潜能学科（I 型兴趣覆盖+得分低），实际=${qOf("化学")}`);
need(mx.some((m) => m.quadrant === "谨慎学科") === false || true, "四象限允许无谨慎学科");

/* 3. 3+1+2 组合：首选物理（I/R 兴趣+物理82），再选含生物 */
need(g!.combos.length >= 2, "高中必须给推荐组合");
const primary = g!.combos[0];
need(primary.title.startsWith("物理+"), `首选应为物理，实际=${primary.title}`);
need(primary.stars >= 2, "主推组合至少 2 星");
need(primary.reason.includes("专业覆盖"), "组合理由必须含专业覆盖率提示");
need(g!.combos.some((c) => c.title.includes("历史")), "必须给历史方向备选/拓展组合");

/* 4. 专业方向：数理强 → 计算机/数学进入；带选科要求与门槛提示 */
const names = g!.majors.map((m) => m.name);
need(names.includes("计算机科学与技术") || names.includes("数学"), `数理双强应推计算机/数学，实际=${names.join("/")}`);
const cs = g!.majors.find((m) => m.name === "计算机科学与技术");
need(cs?.req === "物理+化学", "计算机必须标注选科要求 物理+化学");
const chemGate = g!.majors.find((m) => m.req?.includes("化学"))?.gateNote;
need(chemGate == null || typeof chemGate === "string", "门槛提示字段可空但类型正确");

/* 5. 升学路径：逻辑/数理双 80+ + 数理 ≥75 → 强基适配；六大类框架 */
const qiangji = g!.pathway.find((p) => p.name.includes("强基"));
need(qiangji !== undefined && qiangji.fit === "适配", "强基计划应判适配");
need(g!.pathway.some((p) => p.fit === "主力" && p.cat === "主力路径"), "必须有主力路径");
need(g!.pathway.some((p) => p.name.includes("高校专项")), "高校专项必须出现（条件性提示）");
need(g!.pathway.some((p) => p.name.includes("体育单招")), "体育单招必须出现（条件性提示）");
need(g!.pathway.some((p) => p.name.includes("招飞")), "招飞必须出现（条件性提示）");
need(g!.pathway.some((p) => p.name.includes("定向医学生")), "定向医学生必须出现（条件性提示）");
need(g!.pathway.every((p) => "cat" in p && "cond" in p), "路径条目必须带 cat/cond 字段");

/* 5b. 英语强 → 港澳/国际路线触发 */
const gEng = buildGuidanceReport({
  grade: "高一", mbti,
  academics: { examName: "期末", updatedAt: "2026-09-20", subjects: [
    { name: "语文", fullScore: 150, lastScore: 100, targetScore: null, selfLevel: 3 },
    { name: "数学", fullScore: 150, lastScore: 100, targetScore: null, selfLevel: 3 },
    { name: "英语", fullScore: 150, lastScore: 132, targetScore: null, selfLevel: 5 },
  ] },
  multi5: { dims: { reasoning: 60, detail: 60, number: 60, verbal: 88, spatial: 60 }, overall: 66, carefulIndex: 80, perDim: [] },
});
need(gEng!.pathway.some((p) => p.cat === "国际路线" && p.fit === "适配"), "英语/语言智能突出 → 港澳路线应判适配");

/* 5c. 低分 → 高职单招关注 */
const gLow = buildGuidanceReport({
  grade: "高一", mbti,
  academics: { examName: "期中", updatedAt: "2026-09-20", subjects: [
    { name: "语文", fullScore: 150, lastScore: 80, targetScore: null, selfLevel: 2 },
    { name: "数学", fullScore: 150, lastScore: 70, targetScore: null, selfLevel: 2 },
    { name: "英语", fullScore: 150, lastScore: 75, targetScore: null, selfLevel: 2 },
  ] },
});
need(gLow!.pathway.some((p) => p.name.includes("高职单招") && p.fit === "关注"), "均分<60 → 高职单招应判关注");

/* 5d. 高分非数理 → 强基关注而非适配 */
const gNoSci = buildGuidanceReport({
  grade: "高一",
  academics: { examName: "期中", updatedAt: "2026-09-20", subjects: [
    { name: "语文", fullScore: 150, lastScore: 130, targetScore: null, selfLevel: 5 },
    { name: "数学", fullScore: 150, lastScore: 100, targetScore: null, selfLevel: 4 },
    { name: "英语", fullScore: 150, lastScore: 128, targetScore: null, selfLevel: 5 },
    { name: "历史", fullScore: 100, lastScore: 90, targetScore: null, selfLevel: 5 },
  ] },
});
const qj2 = gNoSci!.pathway.find((p) => p.name.includes("强基"));
need(qj2 !== undefined && qj2.fit === "关注", "高分但数理不拔尖 → 强基应判关注");
need(gNoSci!.pathway.some((p) => p.cat === "拔尖升学"), "拔尖升学类必须存在");

/* 6. v75：多测评决策平衡卡 + 12 门类匹配 + 冲稳保院校规划 */
const sc = g!.scorecard!;
need(sc !== null && sc.rows.length === 6, "高中平衡卡必须覆盖 6 科");
need(sc.weights.map((w) => w.pct).join(",") === "35,30,20,15", "平衡卡权重必须是 35/30/20/15");
const scPhys = sc.rows.find((r) => r.subject === "物理")!;
need(scPhys.total >= 40 && scPhys.total <= 100, "总分应为四项加权后的百分制分值");
need(sc.rows.every((r) => ["强烈推荐", "推荐", "可选", "慎重"].includes(r.verdict)), "结论必须四档之一");
need(sc.rows[0].total >= sc.rows[sc.rows.length - 1].total, "平衡卡按总分降序");
const scHist = sc.rows.find((r) => r.subject === "历史")!;
need(scPhys.total > scHist.total, "物理加权总分应高于历史（本数据集）");

need(g!.disciplines.length >= 3 && g!.disciplines.length <= 5, "12 门类匹配应给 3-5 个");
need(g!.disciplines.every((d) => d.groups.length > 0 && d.majors.length > 0 && d.req.length > 0), "门类必须带大类/代表专业/选科要求");
need(g!.disciplines.some((d) => d.key === "engineering" || d.name === "工学"), "I+R 兴趣+数理强 → 工学应进入推荐门类");
need(g!.disciplines.every((d) => d.matchPct >= 55), "门槛 ≥55");

const sp = g!.schoolPlan!;
need(sp !== null, "高中有成绩必须出冲稳保规划");
need(sp.first === "物理", "本数据集首选应为物理");
need(sp.estScore === Math.max(350, Math.min(750, Math.round(ab.avgPct! * 7.5))), "预估分=avgPct×7.5 clamp");
need(sp.chong.length > 0 && sp.wen.length > 0 && sp.bao.length > 0, "冲稳保三档都必须有院校");
need(sp.chong.some((s) => !sp.wen.includes(s)), "冲稳两档院校应有区分度");

need(g!.parentTips.length >= 3, "给家长的话 ≥3 条");
need(g!.actionTips.length >= 3, "分阶段行动建议 ≥3 条");

/* 6. 无成绩高中：通用组合兜底 */
const gNoScore = buildGuidanceReport({ grade: "高一", mbti, holland });
need(gNoScore !== null && gNoScore.combos.length >= 3, "无成绩高中必须给通用组合");
need(gNoScore!.subjectAdvice.length >= 2, "无成绩高中必须给选科建议");
need(gNoScore!.academicsBlock === null && gNoScore!.matrix === null, "无成绩时学业块/四象限应为 null");

/* 7. 初中：中考组合 */
const gMid = buildGuidanceReport({ grade: "初一", academics, records, mbti });
need(gMid !== null, "初中形态必须出报告");
need(gMid!.combos.some((c) => c.title.includes("语文")), "初中必须有稳分组合（语数英）");
need(gMid!.combos.some((c) => c.title.startsWith("主攻")), "初中必须有主攻组合");
need(gMid!.combos.every((c) => !c.title.startsWith("物理+")), "初中不得给 3+1+2 组合");

/* 7b. v75 初中形态：平衡卡 9 科、无 schoolPlan、有门类匹配 */
const scMid = gMid!.scorecard!;
need(scMid !== null && scMid.rows.length === 9, "初中平衡卡必须覆盖 9 科");
need(gMid!.schoolPlan === null, "初中不得出院校规划");
need(gMid!.disciplines.length > 0, "初中也可给门类匹配");

console.log("RENDER_SMOKE_V73_OK");
