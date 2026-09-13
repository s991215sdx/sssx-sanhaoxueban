/**
 * 测评报告「下载 / 打印」工具：把当前 tab 的报告内容生成一份独立的
 * 打印友好 HTML（inline 样式、白底），window.open 写入后触发打印，
 * 用户可另存为 PDF。所有动态文本均经过 HTML 转义防注入。
 */
import { MBTI_REPORTS, DISC_REPORTS, DISC_THEORY } from "@/data/reports";
import type { CombinedReport, CombinedSection } from "@/data/reports";
import type { MbtiResult, DiscResult } from "@contracts/assessments";
import { isE3V37Result } from "@contracts/e3v37";
import type { E3V37Result } from "@contracts/e3v37";
import type { MultiResult } from "@contracts/multi";
import { MULTI_DIM_ORDER, MULTI_DIM_LABEL, MULTI_DIM_TRAIT } from "@contracts/multi";
import { buildMulti5Report, type Multi5Result } from "@contracts/multi5";
import { buildAnchorReport, type AnchorResult } from "@contracts/careerAnchor";
import { buildHollandReport, type HollandResult } from "@contracts/holland";
import { buildMentalReport, type MentalResult } from "@contracts/mentalHealth";
import type { AcademicsData } from "@contracts/academics";
import { defaultFullScore } from "@contracts/academics";

/* ---------------- 基础工具 ---------------- */

/** HTML 转义（防注入）。 */
export function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** 报告富文本：先转义，再把 **加粗** 转成 <strong>，换行转 <br/>。 */
function rich(s: string): string {
  return esc(s)
    .replace(/\*\*!!(.+?)!!\*\*/g, '<strong style="color:#cf6a3c">$1</strong>') // 红色警示：卡点/重大问题
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>");
}

const POLE_LABEL: Record<string, string> = {
  E: "外向",
  I: "内向",
  S: "实感",
  N: "直觉",
  T: "思考",
  F: "情感",
  J: "计划",
  P: "灵活",
};

/** 可视化横条图（打印版保留图表样式：色块 + 数值，不做字符降级）。 */
function barRow(label: string, value: number, max: number, extra = ""): string {
  const pct = Math.max(0, Math.min(100, (value / Math.max(1, max)) * 100));
  return `<div class="bar-row"><span class="bar-label">${esc(label)}</span><span class="bar-track"><span class="bar-fill" style="width:${pct.toFixed(1)}%"></span></span><span class="bar-val">${esc(value)}${extra}</span></div>`;
}

function h2(t: string): string {
  return `<h2>${rich(t)}</h2>`;
}
function para(t: string): string {
  return `<p>${rich(t)}</p>`;
}
function bulletList(items: string[], ordered = false): string {
  const tag = ordered ? "ol" : "ul";
  return `<${tag}>${items.map((t) => `<li>${rich(t)}</li>`).join("")}</${tag}>`;
}

/* ---------------- 各 tab 的正文 HTML ---------------- */

export function mbtiPrintHtml(result: MbtiResult): string {
  const report = MBTI_REPORTS[result.type];
  if (!report) return para(`暂时读不到 ${esc(result.type)} 的详细报告。`);
  const dims = (["EI", "SN", "TF", "JP"] as const)
    .map((pair) => {
      const [a, b] = pair.split("");
      return barRow(`${POLE_LABEL[a]} ${a} ↔ ${POLE_LABEL[b]} ${b}`, result.dims[a as keyof typeof result.dims], Math.max(1, result.dims[a as keyof typeof result.dims] + result.dims[b as keyof typeof result.dims]), ` / ${result.dims[b as keyof typeof result.dims]}`);
    })
    .join("");
  return [
    h2(`${report.type} · ${report.name}`),
    para(report.headline),
    para(`标签：${report.tags.map(esc).join("、")}`),
    h2("四维度对比"),
    dims,
    h2(`和你同类型的人 · ${report.figure.name}（${report.figure.title}）`),
    para(`「${report.figure.quote}」`),
    h2("你的性格特征"),
    bulletList(report.traits, true),
    h2("你的性格优势"),
    bulletList(report.strengths, true),
    h2("可以留意的小角落"),
    bulletList(report.weaknesses, true),
    h2("学习中的你 · 优势"),
    bulletList(report.studyStrengths, true),
    h2("学习中的你 · 可能的盲点"),
    bulletList(report.studyBlindspots, true),
    h2("校园里的你 · 五个场景"),
    ...report.scenes.map((s) => `<div class="box"><b>${esc(s.scene)}</b>${para(s.text)}</div>`),
    h2("给你的发展建议"),
    bulletList(report.suggestions, true),
  ].join("\n");
}

export function discPrintHtml(result: DiscResult): string {
  const report = DISC_REPORTS[result.primary];
  if (!report) return para("暂时读不到 DISC 详细报告。");
  const dims = (["D", "I", "S", "C"] as const)
    .map((k) => barRow(`${k} · ${DISC_THEORY.find((t) => t.type === k)?.name ?? ""}`, result.dims[k], 24))
    .join("");
  return [
    h2(`${report.type} · ${report.name}`),
    para(report.headline),
    para(`关键词：${report.keywords.map(esc).join("、")}`),
    h2("四维得分"),
    dims,
    h2("基本情况解读"),
    para(report.overview),
    h2("校园里的你 · 五个场景"),
    ...report.scenes.map((s) => `<div class="box"><b>${esc(s.scene)}</b>${para(s.text)}</div>`),
    h2("压力下的你"),
    para(report.underPressure),
    h2("这些行为可能会绊住你"),
    bulletList(report.obstacles, true),
    h2("你需要的支持"),
    bulletList(report.supports, true),
    h2("你最喜欢的老师风格"),
    para(report.teacherFit),
    h2("大家这样和你相处最有效"),
    bulletList(report.communicationTips, true),
    h2("关于 DISC"),
    ...DISC_THEORY.map((t) => `<div class="box"><b>${t.type} · ${esc(t.name)}</b>${para(t.text)}</div>`),
    para("类型没有好坏之分。DISC 最核心的价值在于：人的行为是可以调整和改变的，当前类型只代表当前状态，会随着场景、年龄和经历而变化。"),
  ].join("\n");
}

export function multiPrintHtml(result: MultiResult): string {
  const rows = MULTI_DIM_ORDER.map((k) =>
    barRow(`${MULTI_DIM_LABEL[k]}${result.top3.includes(k) ? "（优势）" : ""}`, Number(result.dims[k].toFixed(1)), 5, " / 5"),
  ).join("");
  const detail = MULTI_DIM_ORDER.map(
    (k) => `<div class="box"><b>${esc(MULTI_DIM_LABEL[k])} · ${result.dims[k].toFixed(1)} / 5</b>${para(MULTI_DIM_TRAIT[k])}</div>`,
  ).join("");
  return [
    h2("多元智能 · 加德纳八大智能"),
    para(`优势智能 Top3：${result.top3.map((k) => `${MULTI_DIM_LABEL[k]} ${result.dims[k].toFixed(1)}`).join("、")}`),
    para(result.summary),
    h2("八维得分（雷达图打印版）"),
    rows,
    h2("八维明细"),
    detail,
  ].join("\n");
}

export function multi5PrintHtml(result: Multi5Result): string {
  const report = buildMulti5Report(result);
  const rows = report.dims.map((d) => barRow(`${d.label}（${d.band}）`, d.score, 100, " / 100")).join("");
  const detail = report.dims
    .map(
      (d) => `<div class="box"><b>${esc(d.label)} · ${d.score} 分（${esc(d.band)}）</b>
${para(`特征：${d.feature}`)}
<p><b>评估结果</b></p>${bulletList(d.evalPoints)}
<p><b>学习建议</b></p>${bulletList(d.studyAdvice)}
<p><b>职业建议</b></p>${bulletList(d.careerAdvice)}
<p><b>成长建议</b></p>${bulletList(d.growthAdvice)}</div>`,
    )
    .join("\n");
  return [
    h2("多元智能五项客观题测评"),
    `<div class="cards">
<div class="card"><div class="card-label">综合水平</div><div class="card-value">${esc(report.overall)}</div><div class="card-note">五维均值（百分制）</div></div>
<div class="card"><div class="card-label">细心指数</div><div class="card-value">${esc(report.carefulIndex)}%</div><div class="card-note">全卷答题正确率</div></div>
<div class="card"><div class="card-label">最强维度</div><div class="card-value">${esc(report.dims.find((d) => d.key === report.topKey)?.label ?? "")}</div><div class="card-note">五维中的最高分</div></div>
</div>`,
    para(report.theoryNote),
    h2("五维得分（百分制）"),
    rows,
    h2("五维明细报告"),
    detail,
  ].join("\n");
}

export function anchorPrintHtml(result: AnchorResult): string {
  const report = buildAnchorReport(result);
  const rows = [...report.table]
    .sort((a, b) => b.score - a.score)
    .map((t) => barRow(`${t.code} ${t.label}${t.isTop ? "（Top2）" : ""}`, t.score, 5, " / 5"))
    .join("");
  const detail = report.top2
    .map(
      (t) => `<div class="box"><b>${esc(t.code)} · ${esc(t.label)} · ${t.score.toFixed(1)} 分</b>
${para(`特征：${t.feature}`)}
<p><b>更愿意从事的工作</b></p>${para(t.workStyle)}
<p><b>期望被认可的方式</b></p>${para(t.recognition)}
<p><b>对学习的影响与建议</b></p>${bulletList(t.studyImpact)}
<p><b>主要职业领域</b></p>${para(t.careerFields.join("、"))}</div>`,
    )
    .join("\n");
  const table = [...report.table]
    .sort((a, b) => b.score - a.score)
    .map((t) => `<div class="box"><b>${esc(t.code)} · ${esc(t.label)}${t.isTop ? "（Top2）" : ""} · ${t.score.toFixed(1)} 分</b>${para(t.trait)}</div>`)
    .join("");
  return [
    h2("职业锚测评（施恩 Schein · 选做）"),
    para(result.summary),
    h2("八型得分"),
    rows,
    h2("最突出两项详细解析"),
    detail,
    h2("八型简表"),
    table,
    para(report.theoryNote),
  ].join("\n");
}

export function hollandPrintHtml(result: HollandResult): string {
  const report = buildHollandReport(result);
  const rows = report.dims
    .map((d) => barRow(`${d.key} ${d.label}${d.isTop ? "（兴趣代码内）" : ""}`, d.score, 5, " / 5"))
    .join("");
  const top = report.top3
    .map((t, i) => `<div class="box"><b>第 ${i + 1} 位 · ${esc(t.key)} ${esc(t.label)} · ${t.score.toFixed(1)} 分</b>${para(t.focus)}</div>`)
    .join("");
  const detail = report.dims
    .map(
      (d) => `<div class="box"><b>${esc(d.key)} · ${esc(d.label)} · ${d.score.toFixed(1)} 分</b>
${para(d.trait)}
<p><b>对学习的影响与学科关联</b></p>${bulletList(d.studyImpact)}
<p><b>匹配职业方向</b></p>${para(d.careers.join("、"))}
<p><b>对应大学专业举例</b></p>${para(d.majors.join("、"))}</div>`,
    )
    .join("\n");
  return [
    h2("霍兰德职业兴趣测评（Holland SDS · 选做）"),
    `<div class="cards">
<div class="card"><div class="card-label">职业兴趣代码</div><div class="card-value">${esc(report.code)}</div><div class="card-note">得分最高的前三型</div></div>
<div class="card"><div class="card-label">个性关键词</div><div class="card-value">${esc(report.keywords)}</div><div class="card-note">由前三型组合</div></div>
</div>`,
    para(result.summary),
    h2("六型得分"),
    rows,
    h2("兴趣代码重点解读"),
    top,
    h2("六型详细分析"),
    detail,
    para(report.relationNote),
  ].join("\n");
}

export function mentalPrintHtml(result: MentalResult): string {
  const report = buildMentalReport(result);
  const rows = report.factors
    .map((f) => barRow(`${f.factor} ${f.label}（${f.band}）`, f.score, 5, " / 5"))
    .join("");
  const detail = report.factors
    .map(
      (f) => `<div class="box"><b>${esc(f.factor)} · ${esc(f.label)} · ${f.score.toFixed(2)} 分（${esc(f.band)}）</b>
${para(f.meaning)}
${f.score > 2 ? para(`风险解读：${f.riskText}`) : ""}
<p><b>改善建议</b></p>${bulletList(f.advice)}</div>`,
    )
    .join("\n");
  return [
    `<div class="box"><b>免责声明</b>${para(report.disclaimer)}</div>`,
    h2("心理健康筛查（SCL-90 式 · 选做）"),
    `<div class="cards">
<div class="card"><div class="card-label">整体状态</div><div class="card-value">${esc(report.level)}</div><div class="card-note">近一周总体水平</div></div>
<div class="card"><div class="card-label">总分</div><div class="card-value">${esc(report.total)}</div><div class="card-note">30 题原始分求和</div></div>
<div class="card"><div class="card-label">阳性项目数</div><div class="card-value">${esc(report.positiveCount)}</div><div class="card-note">单项 ≥ 2 计为阳性</div></div>
</div>`,
    para(result.summary),
    h2("十因子均分"),
    rows,
    h2("十因子详细解读"),
    detail,
    para(report.disclaimer),
  ].join("\n");
}

/** V3.7 三档判定 → 打印样式类（绿 ok / 黄 warn / 红 bad）。 */
function lvClass(level?: string): string {
  if (!level) return "";
  return ` lv-${level === "正常" ? "ok" : level === "卡点" ? "bad" : "warn"}`;
}

function combinedSectionHtml(s: CombinedSection): string {
  const parts = [h2(s.title)];
  s.paragraphs?.forEach((p) => parts.push(para(p)));
  if (s.bullets) parts.push(bulletList(s.bullets));
  s.items?.forEach((it) => {
    parts.push(
      `<div class="box${lvClass(it.level)}"><b>${rich(it.heading)}${it.level ? `（${esc(it.level)}）` : ""}</b>${para(it.text)}</div>`,
    );
  });
  return parts.join("\n");
}

/** V3.7 三阶九能 · 数据速览图表 HTML（combinedPrintHtml 的 e3 分支用）。 */
function e3V37ChartsHtml(e3: E3V37Result): string[] {
  const levelTag = (lv: string) => (lv === "卡点" ? "（卡点·红）" : lv === "待提升" ? "（待提升·黄）" : "");
  return [
    h2("数据速览 · 三阶九能体检") +
      `<div class="chart">${e3.systems.core.map((s) => barRow(`${s.key}${levelTag(s.level)}`, s.score, 5, " / 5")).join("")}</div>`,
    h2("数据速览 · 九能逐项") +
      `<div class="chart">${e3.abilities.map((a) => barRow(`${a.system}·${a.label}${levelTag(a.level)}`, a.score, 5, " / 5")).join("")}</div>`,
    h2("数据速览 · 条件系统（单独报告，不进总分）") +
      `<div class="chart">${e3.systems.condition.cells.map((c) => barRow(`${c.label}${levelTag(c.level)}`, c.score, 5, " / 5")).join("")}</div>`,
    h2("数据速览 · 学能三项（单独报告，不进总分）") +
      `<div class="chart">${e3.aptitude.map((a) => barRow(`${a.label}${levelTag(a.level)}`, a.score, 5, " / 5")).join("")}</div>` +
      para("学能三项反映当前加工效率，不是智力、也不代表潜力上限。"),
    ...(e3.redFlags.length > 0
      ? [h2("红线提示：先照顾好状态，再谈成绩") + bulletList(e3.redFlags)]
      : []),
    para("判定阈值：红 <3.0 卡点（≈百分制<50）· 黄 3.0-3.7 待提升（≈50-69）· 绿 ≥3.8 正常（≈≥70）。"),
  ];
}

export function combinedPrintHtml(
  report: CombinedReport,
  ctx: { e3?: unknown; multi?: MultiResult; academics?: AcademicsData },
): string {
  const parts = [
    h2(report.title),
    para(report.subtitle),
    `<div class="cards">${report.overviewCards
      .map((c) => `<div class="card"><div class="card-label">${esc(c.label)}</div><div class="card-value">${esc(c.value)}</div><div class="card-note">${esc(c.note)}</div></div>`)
      .join("")}</div>`,
  ];

  // 图表降级：维度数值条形字符图
  const charts: string[] = [];
  if (isE3V37Result(ctx.e3)) {
    charts.push(...e3V37ChartsHtml(ctx.e3));
  } else if (ctx.e3) {
    // 旧版（V2.7 及更早）e3 结果：不再输出旧口径图表，避免错乱内容。
    charts.push(
      h2("数据速览 · 学业诊断") +
        para("学业诊断已升级为 V3.7 三阶九能版，该学生的旧版结果不再适用——请重新完成一次诊断（约 16-18 分钟）后重新生成本报告。"),
    );
  }
  if (ctx.multi) {
    charts.push(
      h2("数据速览 · 多元智能八维") +
        `<div class="chart">${MULTI_DIM_ORDER.map((k) => barRow(MULTI_DIM_LABEL[k], Number(ctx.multi!.dims[k].toFixed(1)), 5, " / 5")).join("")}</div>`,
    );
  }
  const gapRows = (ctx.academics?.subjects ?? []).filter((s) => s.lastScore != null || s.targetScore != null);
  if (gapRows.length > 0) {
    charts.push(
      h2(`数据速览 · 分数差距${ctx.academics?.examName ? `（以「${esc(ctx.academics.examName)}」为基准）` : ""}`) +
        `<div class="chart">${gapRows
          .map((s) => {
            const max = s.fullScore ?? defaultFullScore(s.name);
            return (
              barRow(`${s.name} 最近`, s.lastScore ?? 0, max, ` / ${max}`) +
              barRow(`${s.name} 目标`, s.targetScore ?? 0, max, ` / ${max}`)
            );
          })
          .join("")}</div>`,
    );
  }
  parts.push(...charts);
  parts.push(...report.sections.map(combinedSectionHtml));
  parts.push(para("报告基于三项测评结果生成，随着学习行为数据积累会持续更准。"));
  return parts.join("\n");
}

/** V3.7 学业诊断 · 简版打印 HTML：九能表 + 条件 + 学能 + 红线 + 阈值说明。 */
export function e3V37PrintHtml(e3: E3V37Result, studentName?: string): string {
  void studentName;
  const rows = (list: { label: string; score: number; level: string }[]) =>
    `<table style="width:100%;border-collapse:collapse;font-size:12.5px">
      <thead><tr>
        <th style="border:1px solid #e4e6cd;padding:5px 8px;text-align:left">项目</th>
        <th style="border:1px solid #e4e6cd;padding:5px 8px;text-align:center">得分</th>
        <th style="border:1px solid #e4e6cd;padding:5px 8px;text-align:center">判定</th>
      </tr></thead>
      <tbody>${list
        .map(
          (r) =>
            `<tr><td style="border:1px solid #e4e6cd;padding:5px 8px">${esc(r.label)}</td><td style="border:1px solid #e4e6cd;padding:5px 8px;text-align:center;font-family:monospace;font-weight:700">${r.score}/5</td><td style="border:1px solid #e4e6cd;padding:5px 8px;text-align:center">${esc(r.level)}</td></tr>`,
        )
        .join("")}</tbody>
    </table>`;
  return [
    h2(`三阶九能体检（${e3.stageLabel}）`),
    `<div class="cards">
<div class="card"><div class="card-label">学习状态</div><div class="card-value">${esc(e3.motivationLabel)}</div><div class="card-note">${e3.motivationScore}/5 · 单独报告</div></div>
<div class="card"><div class="card-label">主卡点</div><div class="card-value">${e3.mainBlock ? esc(e3.mainBlock.label) : "无"}</div><div class="card-note">${e3.mainBlock ? `${e3.mainBlock.score}/5 · 优先干预` : "九能全部正常"}</div></div>
<div class="card"><div class="card-label">生活事件</div><div class="card-value">${e3.lifeEventScore}/24</div><div class="card-note">${esc(e3.lifeEventLevel)}</div></div>
</div>`,
    h2("三阶均分"),
    `<div class="chart">${e3.systems.core.map((s) => barRow(s.key, s.score, 5, " / 5")).join("")}</div>`,
    h2("九能逐项得分"),
    rows(e3.abilities.map((a) => ({ label: `${a.system} · ${a.label}`, score: a.score, level: a.level }))),
    h2("条件系统（状态/关系/资源 · 单独报告不进总分）"),
    rows(e3.systems.condition.cells.map((c) => ({ label: c.label, score: c.score, level: c.level }))),
    h2("学能三项（注意力/工作记忆/加工速度 · 单独报告不进总分）"),
    rows(e3.aptitude.map((a) => ({ label: a.label, score: a.score, level: a.level }))),
    para("学能三项反映当前加工效率，不是智力、也不代表潜力上限。"),
    ...(e3.redFlags.length > 0 ? [h2("红线提示：先照顾好状态，再谈成绩"), bulletList(e3.redFlags)] : []),
    h2("判定阈值说明"),
    para("红 <3.0 卡点（≈百分制<50）· 黄 3.0-3.7 待提升（≈50-69）· 绿 ≥3.8 正常（≈≥70）；任一关注点 ≤2.0 该能强制「卡点」。"),
  ].join("\n");
}

/* ---------------- 打印窗口 ---------------- */

const PRINT_CSS = `
  body { font-family: "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif; color: #333a22; background: #fff; margin: 0; padding: 32px 40px; line-height: 1.75; font-size: 14px; }
  h1 { font-size: 22px; margin: 0 0 4px; color: #35421e; }
  h2 { font-size: 16px; margin: 26px 0 8px; color: #35421e; border-left: 4px solid #8ebb3e; padding-left: 10px; page-break-after: avoid; }
  p { margin: 6px 0; }
  ul, ol { margin: 6px 0; padding-left: 22px; }
  li { margin: 4px 0; }
  strong { color: #35421e; }
  .meta { color: #8b9468; font-size: 12px; margin-bottom: 18px; }
  .box { border: 1px solid #e4e6cd; border-radius: 8px; padding: 10px 14px; margin: 8px 0; page-break-inside: avoid; }
  .lv-ok { border-left: 4px solid #8ebb3e; }
  .lv-warn { border-left: 4px solid #e2c25e; }
  .lv-bad { border-left: 4px solid #c25e3a; }
  .bar-row { display: flex; align-items: center; gap: 10px; font-size: 12.5px; margin: 5px 0; page-break-inside: avoid; }
  .bar-label { width: 200px; flex-shrink: 0; }
  .bar-track { flex: 1; height: 10px; background: #f1eedd; border-radius: 6px; overflow: hidden; }
  .bar-fill { display: block; height: 100%; background: #7cb83c; border-radius: 6px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .bar-val { font-family: monospace; color: #556339; width: 72px; text-align: right; flex-shrink: 0; }
  .cards { display: flex; flex-wrap: wrap; gap: 10px; margin: 10px 0; }
  .card { border: 1px solid #e4e6cd; border-radius: 8px; padding: 10px 14px; min-width: 140px; flex: 1; }
  .card-label { font-size: 11.5px; color: #8b9468; }
  .card-value { font-size: 16px; font-weight: 700; color: #35421e; }
  .card-note { font-size: 11px; color: #556339; }
  @media print { body { padding: 12mm; } .bar-fill { background: #7cb83c !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
`;

/** 打开打印窗口写入报告 HTML 并调起打印（用户可另存 PDF）。 */
export function downloadReport(title: string, bodyHtml: string, studentName?: string): void {
  const win = window.open("", "_blank");
  if (!win) {
    window.alert("浏览器拦截了新窗口，请允许弹出窗口后重试。");
    return;
  }
  const date = new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" });
  win.document.write(`<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<title>${esc(studentName ? `${studentName}的${title}` : title)} · 三好学伴</title>
<style>${PRINT_CSS}</style>
</head>
<body>
<h1>${esc(studentName ? `${studentName}的${title}` : title)}</h1>
<div class="meta">三好学伴 · 测评报告${studentName ? ` · 学生：${esc(studentName)}` : ""} · 生成日期：${esc(date)}</div>
${bodyHtml}
</body>
</html>`);
  win.document.close();
  win.focus();
  // 等待渲染完成后再调起打印
  setTimeout(() => {
    win.print();
  }, 300);
}
