/**
 * 综合学习力报告 · 三阶九能版（V3.9 冰山模型版式）。
 * 与详版/简版并存：封面 + 冰山图（一屏看全）+ 01 综合结论与行动方案（一级管二级归类）
 * + 02-10 章复用详版既有章节渲染（ReportView 传入）。
 * 数据来源完全复用既有 E3V37 结果：元认知 = 计划 + 监控(kp 自我监控) + 复盘(kp 反思归因/策略调节)，
 * 学能 = 注意力/工作记忆/加工速度均分，AI 智学 = 智学能——呈现层重归组，题库与计分器零改动。
 */
import { useLayoutEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { MBTI_REPORTS, DISC_REPORTS } from "@/data/reports";
import { e3v37Level } from "@contracts/e3v37";
import type { E3V37Result, E3V37Level } from "@contracts/e3v37";
import type { MbtiResult, DiscResult, MbtiPole } from "@contracts/assessments";
import type { HollandResult } from "@contracts/holland";
import type { AnchorResult } from "@contracts/careerAnchor";
import { ANCHOR_LABEL } from "@contracts/careerAnchor";
import type { Multi5Result } from "@contracts/multi5";
import { MULTI5_DIM_ORDER, MULTI5_DIM_LABEL } from "@contracts/multi5";
import type { MentalResult, MentalV2Result, MentalSdqResult, MentalPaResult, Scl90Result } from "@contracts/mentalHealth";
import { isMentalV2 } from "@contracts/mentalHealth";
import type { AcademicsData } from "@contracts/academics";
import type { SubjectAssessmentResult } from "@contracts/subjectAssessment";
import { E3V37_LEVEL_STYLE } from "@/components/reports/e3v37Theme";
import { buildAnswerBlocks } from "@/components/reports/answerBlocks";
import type { RawAnswer } from "@/components/reports/answerBlocks";

export type CombinedV39Props = {
  name: string;
  grade?: string | null;
  e3: E3V37Result;
  /** E3 原始作答：学科快扫（学习成绩卡）+ 答题明细折叠。 */
  raw?: RawAnswer[];
  academics?: AcademicsData;
  mbti?: MbtiResult;
  disc?: DiscResult;
  holland?: HollandResult | null;
  anchor?: AnchorResult | null;
  multi5?: Multi5Result | null;
  mental?: MentalResult | MentalV2Result | null;
  mentalSdq?: MentalSdqResult | null;
  mentalPa?: MentalPaResult | null;
  mentalScl90?: Scl90Result | null;
  subject?: SubjectAssessmentResult | null;
  onReveal?: (t: { kind: "assess"; start: string } | { kind: "fill-academics" }) => void;
};

const r1 = (x: number) => Math.round(x * 10) / 10;
const mean = (xs: number[]) => (xs.length ? r1(xs.reduce((s, x) => s + x, 0) / xs.length) : 0);

/* 层 → 干预方案文字（与详版 RoadmapSection 同源文案）。 */
const LAYER_PLAN_TEXT: Record<string, string> = {
  乐学: "点燃与唤醒：稳动力、攒信心、练韧劲 → 每日小胜记录、兴趣嫁接学习、10 年愿景对话、受挫后 24 小时重启仪式",
  会学: "跑顺「听懂-记住-会用」闭环 → 预习带问题听课、结构化整理与复述输出、错题三天重做、同类题举一反三",
  善学: "提升计划、监控复盘与 AI 智学 → 目标拆解与限时清单、试卷分析三件事+逐题归因、AI 私人教练出周计划并核对答案",
  条件: "稳地基：睡眠、情绪、关系、资源先归位 → 睡眠前奏曲、手机使用约定、每周 3 次运动、亲子善意沟通",
  学能: "补加工效率：注意力/工作记忆/加工速度专项 → 舒尔特方格、听记复述、限时口算，每周 3 次、坚持 3 个月",
};

/* 条件格显示名（冰山卡用全称，明细表保留原标签）。 */
const COND_DISPLAY: Record<string, string> = { state: "身心状态", relation: "家庭关系", resource: "学习资源" };

/* ---------- 计分芯片：红 <3.0 卡点 · 黄 3.0–3.7 待提升 · 绿 ≥3.8 正常 ---------- */
function SolidChip({ label, score }: { label: string; score: number }) {
  const lv = e3v37Level(score);
  return (
    <span
      className="mr-1.5 mb-1 inline-block shrink-0 rounded-full px-2.5 py-0.5 text-[11.5px] font-bold leading-tight text-white"
      style={{ background: E3V37_LEVEL_STYLE[lv].bar }}
    >
      {label} {score}
    </span>
  );
}
function SubChip({ label, score }: { label: string; score: number }) {
  const lv = e3v37Level(score);
  return (
    <span
      className="mr-1.5 mb-1 inline-block rounded-full border px-2 py-0.5 text-[11px] leading-tight"
      style={{
        borderColor: `${E3V37_LEVEL_STYLE[lv].bar}80`,
        color: E3V37_LEVEL_STYLE[lv].text,
        background: E3V37_LEVEL_STYLE[lv].bg,
      }}
    >
      {label} {score}
    </span>
  );
}
function TraitChip({ label }: { label: string }) {
  return <span className="mr-1.5 mb-1 inline-block rounded-full border border-border bg-cream px-2.5 py-0.5 text-[11px] leading-tight text-olive-soft">{label}</span>;
}
/** 成绩差距等「需关注」灰底红字 chip（非量表分，不走红黄绿档）。 */
function BadChip({ label }: { label: string }) {
  return <span className="mr-1.5 mb-1 inline-block rounded-full border border-[#DD3534]/60 bg-[#F9E4E1] px-2.5 py-0.5 text-[11px] font-bold leading-tight text-[#A82524]">{label}</span>;
}

/** 一级（能/格）+ 二级（关注点）同行，换一级另起一行。 */
function AbilityLine({ label, score, focuses, subScores }: {
  label: string;
  score: number;
  focuses?: { kp: string; score: number }[];
  /** 无 kp 明细时的固定二级（如学能三项/元认知三成分）。 */
  subScores?: { label: string; score: number }[];
}) {
  return (
    <div className="mb-1 flex flex-wrap items-center last:mb-0">
      <SolidChip label={label} score={score} />
      {focuses && focuses.length > 0
        ? focuses.map((f) => <SubChip key={f.kp} label={f.kp} score={f.score} />)
        : subScores?.map((s) => <SubChip key={s.label} label={s.label} score={s.score} />)}
    </div>
  );
}

/** 答题明细折叠（默认折叠；blocks 渲染与详版 AnswerBlocksView 同款样式）。 */
function AnswersFold({ raw, kinds, title, onlyNos }: { raw?: RawAnswer[]; kinds: string[]; title?: string; onlyNos?: number[] }) {
  if (!raw || raw.length === 0) return null;
  let blocks = buildAnswerBlocks(raw, kinds);
  if (onlyNos && onlyNos.length > 0) {
    const allow = new Set(onlyNos);
    blocks = blocks
      .map((b) => (b.key.startsWith("e3-") ? { ...b, rows: b.rows.filter((r) => typeof r.no === "number" && allow.has(r.no as number)) } : b))
      .filter((b) => b.rows.length > 0);
  }
  if (blocks.length === 0) return null;
  return (
    <details className="group mt-1.5 overflow-hidden rounded-lg bg-white/60 print:hidden">
      <summary className="flex cursor-pointer select-none items-center gap-2.5 px-2.5 py-1.5 text-[11.5px] font-semibold text-olive transition-colors hover:bg-butter-pale/60">
        <span className="inline-block h-3.5 w-1 shrink-0 rounded-full bg-[#0C7064]" aria-hidden />
        <span className="flex-1">{title ?? "答题明细（仅对应问题，点击展开）"}</span>
        <span className="text-olive-mute transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div className="space-y-2 border-t border-border/60 px-1 py-2">
        {blocks.map((b) => (
          <details key={b.key} open className="rounded-xl border border-border bg-cream/60 px-3.5 py-2">
            <summary className="cursor-pointer text-[12.5px] font-semibold text-olive">{b.title}</summary>
            {b.note && <p className="mt-1 text-[11px] text-olive-mute">{b.note}</p>}
            <ol className="mt-1.5 space-y-1">
              {b.rows.map((row, ri) => (
                <li key={`${row.no}-${ri}`} className="flex gap-2 text-[12px] leading-relaxed text-olive-soft">
                  <span className="mono shrink-0 text-olive-mute">{row.no}.</span>
                  <span className="min-w-0 flex-1">{row.text}</span>
                  <span
                    className={`max-w-[60%] shrink-0 text-right font-semibold ${
                      row.band === "bad" ? "text-[#A82524]" : row.band === "mid" ? "text-[#8A6500]" : row.band === "ok" ? "text-[#2F7A41]" : row.bad ? "text-terra" : "text-olive"
                    }`}
                  >
                    {row.ans}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        ))}
      </div>
    </details>
  );
}

/* ================= 冰山图 ================= */
const STAGE_W = 788;
/** 冰山宽 340（viewBox 430 → 渲染 340，等比 0.7907），自然高 506；拉长留白用「垂直居中」消除，不改变冰山比例。 */
const BERG_W = 340;
const GAP = 24;
const CARD_W = STAGE_W - BERG_W - GAP; // 424（记分卡收窄，把空间留给冰山）
const BERG_SCALE = BERG_W / 430;
const BERG_H = Math.round(640 * BERG_SCALE); // 506
const CARD_LEFT = BERG_W + GAP; // 364
/** 冰山锚点（viewBox 坐标；y<150 为水上不拉伸）。 */
const ANCHORS_VB: Record<string, [number, number]> = {
  score: [287, 77],
  shan: [358, 176],
  hui: [336, 291],
  le: [300, 375],
};
/** 冰山尖 / 右下缘锚点（viewBox 坐标）。 */
const TIP_VB: [number, number] = [215, 483];
const ENV_VB: [number, number] = [331, 462];
const ENV_CORNER_X = 288;
/** 水下拉伸上限：1.6 倍，避免过于细长。 */
const MAX_STRETCH = 1.6;

function BergSvg({ stretch = 1 }: { stretch?: number }) {
  const k = stretch;
  /* 水下纵向拉伸（以水线 y=150 为轴），水上部分保持不动；比例随内容高度自适应。 */
  const vy = (y: number) => (y < 150 ? y : 150 + (y - 150) * k);
  const H = 150 + 490 * k;
  const belowD = `M 60,150 C 38,${vy(212)} 56,${vy(296)} 88,${vy(392)} C 112,${vy(472)} 152,${vy(556)} 215,${vy(616)} C 270,${vy(552)} 310,${vy(470)} 332,${vy(392)} C 358,${vy(296)} 376,${vy(212)} 368,150 L 60,150 Z`;
  return (
    <svg viewBox={`0 0 430 ${H}`} className="block h-auto w-full">
      <defs>
        <linearGradient id="v39IceAbove" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" /><stop offset="1" stopColor="#EDF7F1" />
        </linearGradient>
        <linearGradient id="v39IceBelow" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#E6F2E9" /><stop offset="1" stopColor="#C9E0CE" />
        </linearGradient>
        <linearGradient id="v39Water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#D8ECDB" /><stop offset="1" stopColor="#AECFB4" />
        </linearGradient>
        <linearGradient id="v39Sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F7FBF8" /><stop offset="1" stopColor="#E2EFE4" />
        </linearGradient>
        <filter id="v39Soft" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="5" floodColor="#5E8271" floodOpacity=".18" />
        </filter>
      </defs>
      <rect x="0" y="0" width="430" height="150" fill="url(#v39Sky)" />
      <rect x="0" y="150" width="430" height={490 * k} fill="url(#v39Water)" />
      <path d="M14,144 Q107,137 215,144 T416,144" fill="none" stroke="#C2D8C6" strokeWidth="1.2" opacity=".8" />
      <path d="M14,150 Q107,143 215,150 T416,150" fill="none" stroke="#AECDB4" strokeWidth="1.6" />
      <ellipse cx="215" cy={vy(200)} rx="150" ry="42" fill="#A9CBAF" opacity=".4" />
      <path fill="url(#v39IceAbove)" stroke="#A9C8AE" strokeWidth="1.6" filter="url(#v39Soft)" d="M 60,150 C 70,118 108,100 138,86 C 158,74 172,54 200,40 C 214,48 226,62 250,74 C 284,90 340,110 368,150 L 60,150 Z" />
      <path fill="url(#v39IceBelow)" stroke="#A9C8AE" strokeWidth="1.6" filter="url(#v39Soft)" d={belowD} />
      <g stroke="#ffffff" strokeWidth="1.2" opacity=".7" fill="none">
        <path d={`M 138,86 C 160,${vy(170)} 178,${vy(290)} 184,${vy(420)}`} />
        <path d={`M 250,74 C 258,${vy(170)} 262,${vy(290)} 254,${vy(410)}`} />
        <path d="M 200,40 C 205,78 210,114 214,150" />
      </g>
      <path d="M 60,150 Q 140,144 215,150 T 370,150" fill="none" stroke="#A3C6A9" strokeWidth="2" opacity=".9" />
      <text x="205" y="98" textAnchor="middle" fontSize="14" fontWeight="700" fill="#22453A">学习成绩</text>
      <text x="215" y={vy(222)} textAnchor="middle" fontSize="14" fontWeight="700" fill="#22453A">善学 · 能力系统</text>
      <text x="215" y={vy(250)} textAnchor="middle" fontSize="24" fontWeight="800" fill="#0B8A63" opacity=".9">脑</text>
      <text x="215" y={vy(368)} textAnchor="middle" fontSize="14" fontWeight="700" fill="#22453A">会学 · 行为系统</text>
      <text x="215" y={vy(396)} textAnchor="middle" fontSize="24" fontWeight="800" fill="#0B8A63" opacity=".9">术</text>
      <text x="212" y={vy(474)} textAnchor="middle" fontSize="14" fontWeight="700" fill="#22453A">乐学 · 动力系统</text>
      <text x="212" y={vy(502)} textAnchor="middle" fontSize="24" fontWeight="800" fill="#0B8A63" opacity=".9">心</text>
      <text x="150" y={vy(586)} textAnchor="end" fontSize="13" fontWeight="700" fill="#22453A">自我认知 · 心理状态</text>
      <text x="262" y={vy(572)} fontSize="13" fontWeight="700" fill="#22453A">支持系统</text>
    </svg>
  );
}

/** 计分条行（右列卡片通用）。 */
function KRow({ label, value, note, color }: { label: string; value: number; note?: string; color: string }) {
  return (
    <div className="flex items-center gap-2 py-[3px]">
      <span className="w-[76px] shrink-0 truncate text-[12.5px] text-olive-soft" title={label}>{label}</span>
      <span className="w-[40px] shrink-0 text-right text-[13px] font-extrabold" style={{ color }}>{value}</span>
      <div className="h-2 w-[38%] shrink-0 overflow-hidden rounded-full bg-[#EDF3EF]">
        <div className="h-full rounded-full" style={{ width: `${Math.min(100, value * 20)}%`, background: color }} />
      </div>
      {note && <span className="shrink-0 text-[11px] text-olive-mute">{note}</span>}
    </div>
  );
}
function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between rounded-lg bg-[#F0FAF5] px-3.5 py-1.5 my-[7px]">
      <span className="text-[12.5px] font-bold text-olive-soft">{label}</span>
      <span className="text-[19px] font-extrabold text-[#0B8A63]">{value}<small className="text-[11px] font-semibold text-olive-mute">/ 5</small></span>
    </div>
  );
}
const levelColor = (s: number) => E3V37_LEVEL_STYLE[e3v37Level(s)].bar;

export default function CombinedV39Report({
  name, grade, e3, raw, academics, mbti, disc, holland, anchor, multi5,
  mental, mentalSdq, mentalPa, mentalScl90, subject, onReveal,
}: CombinedV39Props) {
  /* ---------- 数据加工（呈现层重归组，题库计分零改动） ---------- */
  const ability = (label: string) => e3.abilities.find((a) => a.label === label);
  const core = (key: string) => e3.systems.core.find((c) => c.key === key);
  const kpMean = (abilityLabel: string, kps: string[]): number | null => {
    const a = ability(abilityLabel);
    const fs = (a?.focuses ?? []).filter((f) => kps.includes(f.kp));
    return fs.length ? mean(fs.map((f) => f.score)) : null;
  };
  /* 善学三能：元认知 = 计划 + 监控(自我监控) + 复盘(反思归因/策略调节)；学能 = 三项均分；AI 智学 = 智学 */
  const planScore = ability("计划")?.score ?? null;
  const monitorScore = kpMean("复盘", ["自我监控"]);
  const reviewScore = kpMean("复盘", ["反思归因", "策略调节"]);
  const metaParts = [planScore, monitorScore, reviewScore].filter((x): x is number => x != null);
  const metaScore = metaParts.length ? mean(metaParts) : (core("善学")?.score ?? 0);
  const aptitudeMean = mean(e3.aptitude.map((a) => a.score));
  const aiScore = ability("智学")?.score ?? 0;

  /* 学习成绩卡：E3 学科快扫（喜欢/掌握/发挥 三项均分）→ 档案学科自评兜底 */
  const SUBJ_SHORT: Record<string, string> = {
    "首选科目（物理/历史，圈一个）": "首选科目",
    "再选科目（填两科）": "再选科目",
  };
  const e3raw = raw?.find((r) => r.kind === "e3")?.answers as { subjects?: { name: string; liking: number; mastery: number; exam: number }[] } | null | undefined;
  const scanRows = ((e3raw?.subjects ?? []) as { name: string; liking: number; mastery: number; exam: number }[])
    .map((s) => {
      const vals = [s.liking, s.mastery, s.exam].filter((v) => v > 0);
      return { name: SUBJ_SHORT[s.name] ?? s.name, score: vals.length ? mean(vals) : 0, n: vals.length };
    })
    .filter((s) => s.n > 0);
  const acadRows = (academics?.subjects ?? [])
    .filter((x) => x.selfLevel != null)
    .map((x) => ({ name: x.name, score: x.selfLevel as number, n: 1 }));
  const scoreRows = scanRows.length > 0 ? scanRows : acadRows;
  const scoreMean = mean(scoreRows.map((s) => s.score));

  /* 学科快扫 n=0 的科目显示提示用 */
  const condCells = e3.systems.condition.cells;
  const condMean = mean(condCells.map((c) => c.score));
  const subjectsAcad = (academics?.subjects ?? []).filter((x) => x.lastScore != null || x.targetScore != null);
  const lastTotal = subjectsAcad.reduce((a, b) => a + (b.lastScore ?? 0), 0);
  const targetTotal = subjectsAcad.reduce((a, b) => a + (b.targetScore ?? 0), 0);

  /* 三档分布：九能 + 条件三格 + 学能三项 = 15 个计分点（result JSON 内含，旧数据兼容）。 */
  const itemLevels: E3V37Level[] = (() => {
    const pts = [
      ...e3.abilities.map((x) => e3v37Level(x.score)),
      ...condCells.map((c) => e3v37Level(c.score)),
      ...e3.aptitude.map((x) => e3v37Level(x.score)),
    ];
    return pts;
  })();
  const bandCount = (lv: E3V37Level) => itemLevels.filter((x) => x === lv).length;

  /* 深层特质 */
  const mbtiName = mbti ? MBTI_REPORTS[mbti.type]?.name : undefined;
  const discName = disc ? DISC_REPORTS[disc.primary]?.name : undefined;

  /* 已完成测评清单（封面） */
  const doneList = [
    "E3 学业诊断", "MBTI", "DISC",
    multi5 ? "多元智能五项" : null,
    holland ? "霍兰德" : null,
    anchor ? "职业锚" : null,
    mentalSdq || mentalPa || mental ? "心理健康" : null,
  ].filter(Boolean).join(" · ");

  /* ---------- 冰山几何：测量 + 连线 + 宽度适配（<768px 手机端堆叠，无连线） ---------- */
  const wrapRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLElement | null>>({});
  const [geom, setGeom] = useState<{ H: number; lines: { pts: string; head: string }[] } | null>(null);
  const [scale, setScale] = useState(1);
  const [panelH, setPanelH] = useState(BERG_H);
  const [stacked, setStacked] = useState(false);
  const [stretch, setStretch] = useState(1);

  useLayoutEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const measure = () => {
      const stage = stageRef.current;
      const wrap = wrapRef.current;
      const stackedNow = mq.matches;
      setStacked((p) => (p === stackedNow ? p : stackedNow));
      if (!stage || !wrap) return;
      if (stackedNow) {
        /* 手机端：静态堆叠，无绝对定位/连线/缩放；清掉桌面端遗留的内联定位 */
        setGeom((p) => (p === null ? p : null));
        setScale((p) => (p === 1 ? p : 1));
        setStretch((p) => (p === 1 ? p : 1));
        if (wrap.style.height) wrap.style.height = "";
        if (stage.style.height) stage.style.height = "";
        stage.querySelectorAll<HTMLElement>("[data-row]").forEach((el) => {
          if (el.style.top) el.style.top = "";
        });
        return;
      }
      const cardsEl = stage.querySelector<HTMLElement>('[data-col="cards"]');
      const bottomEl = stage.querySelector<HTMLElement>('[data-row="bottom"]');
      const legendEl = stage.querySelector<HTMLElement>('[data-row="legend"]');
      /* 水下拉伸系数：冰山渲染高度随记分卡列内容高度自适应（1–1.6），消除留白 */
      const cardsH = cardsEl?.offsetHeight ?? BERG_H;
      const k = Math.max(1, Math.min(MAX_STRETCH, cardsH / BERG_H));
      setStretch((p) => (p === k ? p : k));
      const bergH = Math.round((150 + 490 * k) * BERG_SCALE);
      const ph = Math.max(bergH, cardsH);
      setPanelH((p) => (p === ph ? p : ph));
      const bergTop = Math.round((ph - bergH) / 2);
      const vy = (y: number) => (y < 150 ? y : 150 + (y - 150) * k);
      const ax = (x: number) => Math.round(x * BERG_SCALE);
      const ay = (y: number) => Math.round(bergTop + vy(y) * BERG_SCALE);
      const bottomTop = ph + GAP;
      if (bottomEl) bottomEl.style.top = `${bottomTop}px`;
      const bottomH = bottomEl?.offsetHeight ?? 128;
      if (legendEl) legendEl.style.top = `${bottomTop + bottomH + 24}px`;
      const H = bottomTop + bottomH + 70;
      if (stage.style.height !== `${H}px`) stage.style.height = `${H}px`;
      /* 连线（冰山锚点 + 顶部偏移，水平通道至记分卡左缘 364） */
      const lines: { pts: string; head: string }[] = [];
      Object.entries(ANCHORS_VB).forEach(([key, [x, y]]) => {
        const card = cardRefs.current[key];
        if (!card) return;
        const sx = ax(x);
        const sy = ay(y);
        const cy = card.offsetTop + card.offsetHeight / 2;
        const ex = Math.min(sx + 44, CARD_LEFT - 16);
        lines.push({ pts: `${sx},${sy} ${ex},${sy} ${ex},${cy} ${CARD_LEFT},${cy}`, head: `${sx},${sy}` });
      });
      const selfCard = cardRefs.current.self;
      if (selfCard) {
        const selfTop = bottomTop + selfCard.offsetTop;
        const tipX = ax(TIP_VB[0]);
        const tipY = ay(TIP_VB[1]);
        lines.push({ pts: `${tipX},${tipY} ${tipX},${selfTop - 1} ${tipX + 8},${selfTop - 1}`, head: `${tipX},${tipY}` });
      }
      const envCard = cardRefs.current.env;
      if (envCard) {
        const envCy = bottomTop + envCard.offsetTop + envCard.offsetHeight / 2;
        const envX = ax(ENV_VB[0]);
        const envY = ay(ENV_VB[1]);
        lines.push({ pts: `${envX},${envY} ${ENV_CORNER_X},${envY} ${ENV_CORNER_X},${envCy} ${CARD_LEFT},${envCy}`, head: `${envX},${envY}` });
      }
      setGeom((prev) => {
        const same = prev && prev.H === H && JSON.stringify(prev.lines) === JSON.stringify(lines);
        return same ? prev : { H, lines };
      });
      /* 一屏看全：宽度和高度双向约束（与定稿样例 v9 一致），并回填缩放后的高度避免留白 */
      const s = Math.min(1, wrap.clientWidth / STAGE_W, (window.innerHeight - 80) / H);
      setScale((prev) => (prev === s ? prev : s));
      const scaledH = Math.round(H * s + 10);
      if (wrap.style.height !== `${scaledH}px`) wrap.style.height = `${scaledH}px`;
    };
    measure();
    window.addEventListener("resize", measure);
    mq.addEventListener("change", measure);
    return () => {
      window.removeEventListener("resize", measure);
      mq.removeEventListener("change", measure);
    };
  });

  const setCardRef = (key: string) => (el: HTMLElement | null) => {
    cardRefs.current[key] = el;
  };

  /* ---------- 01 章 · 诊断行数据 ---------- */
  const e3NosOfAbility = (label: string) => (ability(label)?.focuses ?? []).flatMap((f) => f.items);
  const nosOfKps = (abilityLabel: string, kps: string[]) =>
    (ability(abilityLabel)?.focuses ?? []).filter((f) => kps.includes(f.kp)).flatMap((f) => f.items);

  /* ---------- 记分卡内容（桌面舞台与打印静态版共用，避免两处文案分叉） ---------- */
  const CardHead = ({ title, note }: { title: string; note?: string }) => (
    <h4 className="text-[14.5px] font-extrabold text-olive">
      {title}
      {note && <span className="ml-2 text-[11px] font-semibold text-olive-mute">{note}</span>}
    </h4>
  );
  const scoreCardBody = (
    <>
      <TotalRow label="学科综合均分" value={scoreMean} />
      {scoreRows.length === 0 ? (
        <p className="py-1 text-[12px] text-olive-mute">学科测评数据未填写</p>
      ) : (
        scoreRows.slice(0, 8).map((s) => <KRow key={s.name} label={s.name} value={s.score} color={levelColor(s.score)} />)
      )}
    </>
  );
  const shanCardBody = (
    <>
      <TotalRow label="善学 · 系统总分" value={core("善学")?.score ?? 0} />
      <KRow label="元认知" value={metaScore} note="计划 · 监控 · 复盘" color={levelColor(metaScore)} />
      <KRow label="学能" value={aptitudeMean} note="学习效率" color={levelColor(aptitudeMean)} />
      <KRow label="AI 智学" value={aiScore} note="运用 AI 自学" color={levelColor(aiScore)} />
      {multi5 && (
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5 border-t border-dashed border-[#E3EEE8] pt-2">
          <span className="w-full text-[11px] font-bold text-[#0B8A63]">多元智能五项（百分制 · 参考，不计入总分）</span>
          {MULTI5_DIM_ORDER.map((k) => (
            <span key={k} className="flex items-center gap-1.5">
              <span className="text-[11px] text-olive-soft">{MULTI5_DIM_LABEL[k]}</span>
              <span className="h-[7px] w-14 overflow-hidden rounded-full bg-[#EDF3EF]">
                <span className="block h-full rounded-full bg-[#7FB89A]" style={{ width: `${multi5.dims[k]}%` }} />
              </span>
              <span className="w-6 text-[12px] font-extrabold text-[#0B8A63]">{multi5.dims[k]}</span>
            </span>
          ))}
        </div>
      )}
    </>
  );
  const huiCardBody = (
    <>
      <TotalRow label="会学 · 系统总分" value={core("会学")?.score ?? 0} />
      <KRow label="听懂" value={ability("学懂")?.score ?? 0} color={levelColor(ability("学懂")?.score ?? 0)} />
      <KRow label="记住" value={ability("记住")?.score ?? 0} color={levelColor(ability("记住")?.score ?? 0)} />
      <KRow label="会用" value={ability("会用")?.score ?? 0} color={levelColor(ability("会用")?.score ?? 0)} />
    </>
  );
  const leCardBody = (
    <>
      <TotalRow label="乐学 · 系统总分" value={core("乐学")?.score ?? 0} />
      <KRow label="学习动力" value={ability("动力")?.score ?? 0} color={levelColor(ability("动力")?.score ?? 0)} />
      <KRow label="学习信心" value={ability("信心")?.score ?? 0} color={levelColor(ability("信心")?.score ?? 0)} />
      <KRow label="学习韧劲" value={ability("韧劲")?.score ?? 0} color={levelColor(ability("韧劲")?.score ?? 0)} />
    </>
  );
  const selfCardBody = (
    <>
      {mentalSdq ? (
        <KRow label="SDQ 困难总分" value={mentalSdq.totalDiff} note={`/40 · ${mentalSdq.totalBand}`} color={mentalSdq.level !== "良好" ? "#E4572E" : "#2F7A41"} />
      ) : mentalPa ? (
        <>
          <KRow label="PHQ-A" value={mentalPa.phq9} note={`/27 · ${mentalPa.phq9Level}`} color={mentalPa.phq9Level !== "良好" ? "#E4572E" : "#2F7A41"} />
          <KRow label="GAD-7" value={mentalPa.gad7} note={`/21 · ${mentalPa.gad7Level}`} color={mentalPa.gad7Level !== "良好" ? "#E4572E" : "#2F7A41"} />
        </>
      ) : mental && isMentalV2(mental) ? (
        <>
          <KRow label="PHQ-9" value={mental.phq9} note={`/27 · ${mental.phq9Level}`} color={mental.phq9Level !== "良好" ? "#E4572E" : "#2F7A41"} />
          <KRow label="GAD-7" value={mental.gad7} note={`/21 · ${mental.gad7Level}`} color={mental.gad7Level !== "良好" ? "#E4572E" : "#2F7A41"} />
        </>
      ) : (
        <p className="py-1 text-[12px] text-olive-mute">心理状态测评未做（选做）</p>
      )}
    </>
  );
  const envCardBody = (
    <>
      <TotalRow label="支持系统 · 系统总分" value={condMean} />
      {condCells.map((c) => (
        <KRow key={c.key} label={COND_DISPLAY[c.key] ?? c.label} value={c.score} color={levelColor(c.score)} />
      ))}
    </>
  );
  const traitCardBody = (
    <>
      {disc && <div className="flex items-baseline gap-2 py-1"><span className="w-[52px] shrink-0 text-[11.5px] font-bold text-olive-soft">DISC</span><span className="text-[15px] font-extrabold tracking-wide text-[#0B8A63]">{disc.primary}</span><span className="text-[11px] text-olive-mute">{discName ?? ""}</span></div>}
      {mbti && <div className="flex items-baseline gap-2 py-1"><span className="w-[52px] shrink-0 text-[11.5px] font-bold text-olive-soft">MBTI</span><span className="text-[15px] font-extrabold tracking-wide text-[#0B8A63]">{mbti.type}</span><span className="text-[11px] text-olive-mute">{mbtiName ?? ""}</span></div>}
      {holland && <div className="flex items-baseline gap-2 py-1"><span className="w-[52px] shrink-0 text-[11.5px] font-bold text-olive-soft">职业兴趣</span><span className="text-[15px] font-extrabold tracking-wide text-[#0B8A63]">{holland.code}</span><span className="text-[11px] text-olive-mute">{holland.keywords}</span></div>}
      {anchor && anchor.top2.length > 0 && (
        <div className="flex flex-wrap items-baseline gap-2 py-1">
          <span className="w-[52px] shrink-0 text-[11.5px] font-bold text-olive-soft">职业锚</span>
          <span className="text-[15px] font-extrabold tracking-wide text-[#0B8A63]">{anchor.top2.join("·")}</span>
          <span className="text-[11px] text-olive-mute">{anchor.top2.map((k) => ANCHOR_LABEL[k]).join(" · ")}</span>
        </div>
      )}
      {!disc && !mbti && !holland && !anchor && <p className="py-1 text-[12px] text-olive-mute">性格/兴趣测评未完成</p>}
    </>
  );

  return (
    <div className="space-y-4">
      {/* ============ 封面 ============ */}
      <div className="paper-card relative flex min-h-[520px] flex-col overflow-hidden px-7 py-8 sm:px-10">
        <div className="flex gap-2">
          <span className="h-[7px] w-[7px] rounded-full bg-[#0EA875]" />
          <span className="h-[7px] w-[7px] rounded-full bg-[#0EA875]" />
          <span className="h-[7px] w-[7px] rounded-full bg-[#0EA875]" />
        </div>
        <div className="flex flex-1 flex-col items-start justify-center">
          <div className="mb-4 text-[12px] uppercase tracking-[3px] text-olive-mute">Evaluation Report · 综合学习力测评</div>
          <h2 className="text-[30px] font-extrabold leading-snug tracking-wide text-[#0B3D2E]">综合学习力<br />测评报告</h2>
          <div className="mt-5 h-1 w-16 rounded-full bg-[#0EA875]" />
          <p className="mt-5 text-[14px] leading-[2] text-olive-soft">
            愿不愿学（心）→ 会不会学（术）→ 学习效率高不高（脑）<br />乐学 · 会学 · 善学 —— 三阶九能，看见看不见的学习力
          </p>
        </div>
        <div className="card w-full max-w-[420px] rounded-xl border border-[#E3EEE8] bg-[#F0FAF5] px-6 py-5">
          <div className="grid grid-cols-[auto_1fr] gap-y-2.5 gap-x-5 text-[13.5px]">
            <span className="text-olive-mute">姓　　名</span><span className="font-semibold text-olive">{name || "—"}</span>
            <span className="text-olive-mute">年　　级</span><span className="font-semibold text-olive">{grade || "—"}</span>
            <span className="text-olive-mute">体系版本</span><span className="font-semibold text-olive">三阶九能（V3.9）</span>
            <span className="text-olive-mute">报告日期</span><span className="font-semibold text-olive">{new Date().toLocaleDateString("zh-CN", { year: "numeric", month: "long", day: "numeric" })}</span>
            <span className="text-olive-mute">已完成测评</span><span className="font-semibold leading-snug text-olive">{doneList || "—"}</span>
          </div>
        </div>
      </div>

      {/* ============ PART 1 冰山模型 ============ */}
      <div className="paper-card px-5 py-6 sm:px-7">
        <div className="mb-1 inline-flex items-center gap-2.5 text-[13px] font-semibold tracking-[4px] text-[#0B8A63]">
          <span className="h-0.5 w-[26px] bg-[#0EA875]" />PART 1
        </div>
        <h3 className="text-[20px] font-extrabold text-[#0B3D2E]">学习能力冰山模型 · 三阶九能</h3>
        <p className="mt-2 text-[12.5px] leading-relaxed text-olive-soft">
          水面之上是看得见的学习成绩；水面之下是乐学（心）、会学（术）、善学（脑）三大系统，共九能，全部计入总分。冰山越往下越隐蔽：能力最好训练、行为靠习惯、动力最难撬动。
        </p>

        <div ref={wrapRef} className="mt-3 overflow-hidden print:hidden">
          <div
            ref={stageRef}
            className="relative"
            style={stacked ? undefined : { width: STAGE_W, transform: `scale(${scale})`, transformOrigin: "top left" }}
          >
            <div className={stacked ? "flex flex-col gap-4" : "flex gap-6"}>
              {/* 左：冰山（桌面端面板高度 = 内容高，冰山垂直居中不留白） */}
              <div
                className={
                  stacked
                    ? "mx-auto w-[340px] max-w-full overflow-hidden rounded-2xl border border-[#E3EEE8] bg-gradient-to-b from-[#F0FAF5] to-[#E4F2E9]"
                    : "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#E3EEE8] bg-gradient-to-b from-[#F0FAF5] to-[#E4F2E9]"
                }
                style={stacked ? undefined : { width: BERG_W, height: panelH }}
              >
                <BergSvg stretch={stacked ? 1 : stretch} />
              </div>
              {/* 右：指标卡（桌面端收窄至 424，把空间留给冰山） */}
              <div data-col="cards" className="flex flex-col gap-3" style={stacked ? undefined : { width: CARD_W }}>
                <div ref={setCardRef("score")} data-berg="score" className="rounded-xl border border-[#E3EEE8] bg-white px-4 py-3 shadow-sm">
                  <CardHead title="学习成绩" note="看得见的结果 · 各科三项均分" />
                  {scoreCardBody}
                </div>

                <div ref={setCardRef("shan")} data-berg="shan" className="rounded-xl border border-[#E3EEE8] bg-white px-4 py-3 shadow-sm">
                  <CardHead title="能力系统" note="学习效率高不高（脑）" />
                  {shanCardBody}
                </div>

                <div ref={setCardRef("hui")} data-berg="hui" className="rounded-xl border border-[#E3EEE8] bg-white px-4 py-3 shadow-sm">
                  <CardHead title="行为系统" note="会不会学（术）" />
                  {huiCardBody}
                </div>

                <div ref={setCardRef("le")} data-berg="le" className="rounded-xl border border-[#E3EEE8] bg-white px-4 py-3 shadow-sm">
                  <CardHead title="动力系统" note="愿不愿学（心）" />
                  {leCardBody}
                </div>
              </div>
            </div>

            {/* 底排：自我认知 + 支持系统 + 深层特质 */}
            <div
              data-row="bottom"
              className={stacked ? "mt-4 grid grid-cols-1 gap-3" : "absolute left-0 flex gap-3"}
              style={stacked ? undefined : { width: STAGE_W }}
            >
              <div ref={setCardRef("self")} className={`${stacked ? "w-full" : "min-h-[128px] w-[244px]"} rounded-xl border border-[#E3EEE8] bg-white px-4 py-3 shadow-sm`}>
                <CardHead title="自我认知 · 心理状态" />
                {selfCardBody}
              </div>
              <div ref={setCardRef("env")} className={`${stacked ? "w-full" : "min-h-[128px] w-[288px]"} rounded-xl border border-[#E3EEE8] bg-white px-4 py-3 shadow-sm`}>
                <CardHead title="支持系统" note="身心 · 家庭 · 资源" />
                {envCardBody}
              </div>
              <div className={`${stacked ? "w-full" : "min-h-[128px] w-[232px]"} rounded-xl border border-[#E3EEE8] bg-white px-4 py-3 shadow-sm`}>
                <CardHead title="深层特质" note="性格 · 兴趣 · 锚" />
                {traitCardBody}
              </div>
            </div>

            {/* 连线（仅桌面端） */}
            {!stacked && geom && (
              <svg width={STAGE_W} height={geom.H} viewBox={`0 0 ${STAGE_W} ${geom.H}`} className="pointer-events-none absolute left-0 top-0" style={{ zIndex: 5 }}>
                {geom.lines.map((l, i) => {
                  const [hx, hy] = l.head.split(",");
                  return (
                    <g key={i}>
                      <polyline points={l.pts} fill="none" stroke="#9CC4A4" strokeWidth="1.4" strokeDasharray="4 4" />
                      <circle cx={hx} cy={hy} r="3.5" fill="#5AA573" />
                    </g>
                  );
                })}
              </svg>
            )}
            {/* 图例 */}
            <div
              data-row="legend"
              className={
                stacked
                  ? "mt-3 border-t border-[#E3EEE8] pt-2.5 text-[12px] leading-[1.8] text-olive-mute"
                  : "absolute left-0 border-t border-[#E3EEE8] pt-2.5 text-[12px] leading-[1.8] text-olive-mute"
              }
              style={stacked ? undefined : { width: STAGE_W }}
            >
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: "#E4572E" }} />红 &lt; 3.0 卡点（优先干预）　
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: "#F0A92E" }} />黄 3.0–3.7 待提升　
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: "#3CC078" }} />绿 ≥ 3.8 正常　|　
              评分为 1–5 分制；三阶九能计入总分；支持系统与多元智能五项单独解读。
            </div>
          </div>
        </div>

        {/* ---------- 打印静态版：无 transform/绝对定位/连线，冰山+记分卡+底排纵向流式，保证 PDF 不变型 ---------- */}
        <div className="mt-3 hidden print:block">
          <div className="flex items-start gap-4">
            <div className="w-[300px] shrink-0 overflow-hidden rounded-2xl border border-[#E3EEE8] bg-gradient-to-b from-[#F0FAF5] to-[#E4F2E9]">
              <BergSvg stretch={1} />
            </div>
            <div className="min-w-0 flex-1 space-y-3">
              <div className="rounded-xl border border-[#E3EEE8] bg-white px-4 py-3">
                <CardHead title="学习成绩" note="看得见的结果 · 各科三项均分" />
                {scoreCardBody}
              </div>
              <div className="rounded-xl border border-[#E3EEE8] bg-white px-4 py-3">
                <CardHead title="能力系统" note="学习效率高不高（脑）" />
                {shanCardBody}
              </div>
              <div className="rounded-xl border border-[#E3EEE8] bg-white px-4 py-3">
                <CardHead title="行为系统" note="会不会学（术）" />
                {huiCardBody}
              </div>
              <div className="rounded-xl border border-[#E3EEE8] bg-white px-4 py-3">
                <CardHead title="动力系统" note="愿不愿学（心）" />
                {leCardBody}
              </div>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <div className="rounded-xl border border-[#E3EEE8] bg-white px-4 py-3">
              <CardHead title="自我认知 · 心理状态" />
              {selfCardBody}
            </div>
            <div className="rounded-xl border border-[#E3EEE8] bg-white px-4 py-3">
              <CardHead title="支持系统" note="身心 · 家庭 · 资源" />
              {envCardBody}
            </div>
            <div className="rounded-xl border border-[#E3EEE8] bg-white px-4 py-3">
              <CardHead title="深层特质" note="性格 · 兴趣 · 锚" />
              {traitCardBody}
            </div>
          </div>
          <p className="mt-3 border-t border-[#E3EEE8] pt-2.5 text-[12px] leading-[1.8] text-olive-mute">
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: "#E4572E" }} />红 &lt; 3.0 卡点（优先干预）　
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: "#F0A92E" }} />黄 3.0–3.7 待提升　
            <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: "#3CC078" }} />绿 ≥ 3.8 正常　|　
            评分为 1–5 分制；三阶九能计入总分；支持系统与多元智能五项单独解读。
          </p>
        </div>
      </div>

      {/* ============ PART 2 · 01 综合结论与行动方案 ============ */}
      <div className="paper-card px-5 py-6 sm:px-7">
        <div className="mb-1 inline-flex items-center gap-2.5 text-[13px] font-semibold tracking-[4px] text-[#0B8A63]">
          <span className="h-0.5 w-[26px] bg-[#0EA875]" />PART 2
        </div>
        <h3 className="text-[20px] font-extrabold text-[#0B3D2E]">
          01 综合结论与行动方案<span className="ml-2 text-[13px] font-medium text-olive-mute">现状 → 诊断 → 方案</span>
        </h3>

        <div className="mt-4 text-center">
          <span className="inline-block rounded-r-full rounded-l-none bg-[#0EA875] py-2 pl-4 pr-6 text-[15px] font-bold text-white">
            {e3.mainBlock ? `主卡点：${e3.mainBlock.label} ${e3.mainBlock.score}/5` : "三阶九能全部正常"}
          </span>
          <p className="mt-2 text-[12.5px] text-olive-soft">
            状态「{e3.motivationLabel}」{e3.motivationScore}/5 · 生活事件 {e3.lifeEventScore}/24（{e3.lifeEventLevel}）
            {lastTotal > 0 && targetTotal > 0 && ` · 成绩总差距 ${Math.max(0, targetTotal - lastTotal)} 分`}
          </p>
          {e3.redFlags.length > 0 && (
            <p className="mt-1 text-[12px] font-semibold text-terra">本次测评触发 {e3.redFlags.length} 条红线提示，建议先减压、多陪伴，必要时寻求专业心理帮助。</p>
          )}
        </div>
        <div className="mt-3 rounded-xl border border-[#E3EEE8] bg-[#F0FAF5] px-5 py-3">
          <b className="text-[13px] text-olive">总策略：</b>
          <span className="text-[13px] leading-relaxed text-olive-soft">
            {e3.redFlags.length > 0 ? "先照顾好状态，再谈成绩；" : ""}
            {e3.mainBlock
              ? `优先攻 ${e3.priorities.slice(0, 3).map((p) => `${p.label} ${p.score}`).join("、")}，按「条件 → 乐学 → 会学 → 善学 → 学能」的顺序逐层补。`
              : "保持当前节奏，每周对照自查一次即可。"}
          </span>
        </div>

        {/* 第一步 · 理清现状与目标 */}
        <SectionHead n="1" title="理清现状与目标" />
        {subjectsAcad.length === 0 ? (
          <p className="text-[12.5px] text-olive-mute">
            成绩目标未填写
            {onReveal && (
              <button type="button" onClick={() => onReveal({ kind: "fill-academics" })} className="ml-1.5 rounded-full border border-lime/60 bg-lime-pale/70 px-2 py-px text-[11px] font-semibold text-[#1E3530] hover:bg-butter-pale">
                去填写 →
              </button>
            )}
            ；三阶现状：{e3.systems.core.map((c) => `${c.key} ${c.score}/5（${c.level}）`).join(" · ")}
          </p>
        ) : (
          <div className="flex flex-wrap items-center gap-1 text-[12.5px] text-olive-soft">
            {subjectsAcad.filter((x) => (x.targetScore ?? 0) - (x.lastScore ?? 0) > 0).map((x) => (
              <BadChip key={x.name} label={`${x.name} 差 ${(x.targetScore ?? 0) - (x.lastScore ?? 0)} 分`} />
            ))}
            {subjectsAcad.every((x) => (x.targetScore ?? 0) - (x.lastScore ?? 0) <= 0) && <span className="text-[#2F7A41]">各科均已达标</span>}
            <span className="ml-1 text-olive-mute">三阶现状：{e3.systems.core.map((c) => `${c.key} ${c.score}/5（${c.level}）`).join(" · ")}</span>
          </div>
        )}

        {/* 第二步 · 分析问题 · 痛点 · 特点（一级管二级） */}
        <SectionHead n="2" title="分析问题 · 痛点 · 特点" sub="冰山模型 · 与 PART 1 图一致" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className="w-[132px] border border-[#CDEBDD] bg-[#D4F2E8] px-2.5 py-2 text-left text-[13px] text-[#0B8A63]">冰山位置</th>
                <th className="border border-[#CDEBDD] bg-[#D4F2E8] px-2.5 py-2 text-left text-[13px] text-[#0B8A63]">系统 · 一级管二级得分明细（红 &lt;3.0 卡点 · 黄 3.0–3.7 待提升 · 绿 ≥3.8 正常）</th>
              </tr>
            </thead>
            <tbody>
              {/* 冰山上 */}
              <tr>
                <td className="border border-[#E8F1EC] bg-[#F0FAF5] px-2.5 py-2 font-bold text-olive">冰山上<small className="block text-[11px] font-medium text-olive-mute">看得见的结果</small></td>
                <td className="border border-[#E8F1EC] px-2.5 py-2">
                  {subjectsAcad.length === 0 ? (
                    <>
                      <TraitChip label="知识点 · 成绩 未填写" />
                      {onReveal && (
                        <button type="button" onClick={() => onReveal({ kind: "fill-academics" })} className="mb-1 inline-block rounded-full border border-lime/60 bg-lime-pale/70 px-2 py-px text-[11px] font-semibold text-[#1E3530] hover:bg-butter-pale">
                          去填写成绩与目标 →
                        </button>
                      )}
                    </>
                  ) : (
                    subjectsAcad.filter((x) => (x.targetScore ?? 0) - (x.lastScore ?? 0) > 0).map((x) => (
                      <BadChip key={x.name} label={`${x.name} 差 ${(x.targetScore ?? 0) - (x.lastScore ?? 0)} 分`} />
                    ))
                  )}
                  {subject && subject.subjects.map((s) => (
                    <span key={s.name} className={`mr-1.5 mb-1 inline-block rounded-full border px-2 py-0.5 text-[11px] leading-tight ${s.overall < 3.0 ? "border-[#DD3534]/60 bg-[#F9E4E1] font-bold text-[#A82524]" : "border-border bg-cream text-olive-soft"}`}>
                      {s.name} 自评 {s.overall} · {s.grade}
                    </span>
                  ))}
                </td>
              </tr>
              {/* 善学 */}
              <DiagRow
                title="善学 · 能力系统"
                sub={`脑 · 系统总分 ${core("善学")?.score ?? 0}`}
                lines={[
                  <AbilityLine key="meta" label="元认知" score={metaScore} subScores={[
                    { label: "计划", score: planScore ?? metaScore },
                    { label: "监控", score: monitorScore ?? metaScore },
                    { label: "复盘", score: reviewScore ?? metaScore },
                  ]} />,
                  <AbilityLine key="apt" label="学能" score={aptitudeMean} subScores={e3.aptitude.map((a) => ({ label: a.label, score: a.score }))} />,
                  <AbilityLine key="ai" label="AI 智学" score={aiScore} focuses={(ability("智学")?.focuses ?? []).map((f) => ({ kp: f.kp, score: f.score }))} />,
                ]}
                fold={<AnswersFold raw={raw} kinds={["e3:善学"]} onlyNos={e3NosOfAbility("计划").concat(e3NosOfAbility("复盘"), e3NosOfAbility("智学"))} />}
              />
              {/* 会学 */}
              <DiagRow
                title="会学 · 行为系统"
                sub={`术 · 系统总分 ${core("会学")?.score ?? 0}`}
                lines={(["学懂", "记住", "会用"] as const).map((lab) => (
                  <AbilityLine key={lab} label={lab === "学懂" ? "听懂" : lab} score={ability(lab)?.score ?? 0} focuses={(ability(lab)?.focuses ?? []).map((f) => ({ kp: f.kp, score: f.score }))} />
                ))}
                fold={<AnswersFold raw={raw} kinds={["e3:会学"]} onlyNos={e3NosOfAbility("学懂").concat(e3NosOfAbility("记住"), e3NosOfAbility("会用"))} />}
              />
              {/* 乐学 */}
              <DiagRow
                title="乐学 · 动力系统"
                sub={`心 · 系统总分 ${core("乐学")?.score ?? 0}`}
                lines={(["动力", "信心", "韧劲"] as const).map((lab) => (
                  <AbilityLine key={lab} label={lab} score={ability(lab)?.score ?? 0} focuses={(ability(lab)?.focuses ?? []).map((f) => ({ kp: f.kp, score: f.score }))} />
                ))}
                fold={<AnswersFold raw={raw} kinds={["e3:乐学"]} onlyNos={e3NosOfAbility("动力").concat(e3NosOfAbility("信心"), e3NosOfAbility("韧劲"))} />}
              />
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11.5px] text-olive-mute">
          红底 = &lt;3.0 卡点（优先干预）；黄底 = 3.0–3.7 待提升；绿底 = ≥3.8 正常。灰底 = 性格 / 兴趣 / 职业锚代码（没有好坏，不是缺点）。
        </p>

        {/* 冰山下 · 看不见的根 */}
        <SectionHead n="2" title="冰山下 · 看不见的根" sub="支持系统 × 深层特质" />
        <p className="mb-3 text-[12.5px] leading-relaxed text-olive-soft">
          它们不进学习力总分，但决定干预能不能落地：支持系统不稳，上面的动力与方法都立不住；深层特质没有好坏，是用来「按自己的方式高效学、按内心的方向做选择」的底色。
        </p>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-xl border border-[#E3EEE8] bg-[#F0FAF5] px-5 py-4">
            <h5 className="mb-2 text-[13px] font-extrabold text-olive">支持系统 · 学习条件（系统总分 {condMean} · 不进总分）</h5>
            <AbilityLine label="状态" score={condCells.find((c) => c.key === "state")?.score ?? 0} focuses={(ability("状态")?.focuses ?? []).map((f) => ({ kp: f.kp, score: f.score }))} />
            <AbilityLine label="关系" score={condCells.find((c) => c.key === "relation")?.score ?? 0} focuses={(ability("关系")?.focuses ?? []).map((f) => ({ kp: f.kp, score: f.score }))} />
            <AbilityLine label="资源" score={condCells.find((c) => c.key === "resource")?.score ?? 0} focuses={(ability("资源")?.focuses ?? []).map((f) => ({ kp: f.kp, score: f.score }))} />
            <AnswersFold raw={raw} kinds={["e3:条件"]} title="条件三格 · 答题明细（点击展开）" />
          </div>
          <div className="rounded-xl border border-[#E3EEE8] bg-[#F0FAF5] px-5 py-4">
            <h5 className="mb-2 text-[13px] font-extrabold text-olive">深层特质 · 性格与方向的长期底色</h5>
            {mbti && (
              <div className="mb-1 flex flex-wrap items-center">
                <TraitChip label={`MBTI · ${mbti.type} ${mbtiName ?? ""}`} />
                {(["EI", "SN", "TF", "JP"] as const).map((pair) => {
                  const a = pair[0] as MbtiPole;
                  const b = pair[1] as MbtiPole;
                  return <TraitChip key={pair} label={`${a}${mbti.dims[a]}·${b}${mbti.dims[b]}`} />;
                })}
              </div>
            )}
            {disc && (
              <div className="mb-1 flex flex-wrap items-center">
                <TraitChip label={`DISC · ${disc.primary} 型 ${discName ?? ""}`} />
                <TraitChip label={`D${disc.dims.D}·I${disc.dims.I}·S${disc.dims.S}·C${disc.dims.C}`} />
              </div>
            )}
            {holland && (
              <div className="mb-1 flex flex-wrap items-center">
                <TraitChip label={`职业兴趣 · ${holland.code}`} />
                {holland.top3.map((k) => <TraitChip key={k} label={k} />)}
              </div>
            )}
            {anchor && anchor.top2.length > 0 && (
              <div className="mb-1 flex flex-wrap items-center">
                <TraitChip label={`职业锚 · ${anchor.top2.join("·")} ${anchor.top2.map((k) => ANCHOR_LABEL[k]).join(" / ")}`} />
              </div>
            )}
            {!mbti && !disc && !holland && !anchor && <p className="text-[12px] text-olive-mute">性格 / 兴趣 / 职业锚测评未完成（选做）。</p>}
            {mbti && <AnswersFold raw={raw} kinds={["mbti"]} title="MBTI 答题明细（点击展开）" />}
            {disc && <AnswersFold raw={raw} kinds={["disc"]} title="DISC 答题明细（点击展开）" />}
          </div>
        </div>
        {(mentalSdq || mentalPa || mentalScl90 || mental) && (
          <div className="mt-4 rounded-xl border border-[#E3EEE8] bg-[#F0FAF5] px-5 py-4">
            <h5 className="mb-2 text-[13px] font-extrabold text-olive">心理状态 · 需要温柔关注的信号</h5>
            {mentalSdq && (
              <div className="mb-1 flex flex-wrap items-center">
                <span className={`mr-1.5 mb-1 inline-block rounded-full border px-2.5 py-0.5 text-[11px] font-bold leading-tight ${mentalSdq.level !== "良好" ? "border-[#DD3534]/60 bg-[#F9E4E1] text-[#A82524]" : "border-border bg-cream text-olive-soft"}`}>
                  学生版A · SDQ 困难总分 {mentalSdq.totalDiff}/40（{mentalSdq.totalBand}）
                </span>
                {mentalSdq.selfHarm && <span className="mr-1.5 mb-1 inline-block rounded-full border border-[#DD3534]/60 bg-[#F9E4E1] px-2.5 py-0.5 text-[11px] font-bold text-[#A82524]">!!有自伤念头信号 · 立即求助!!</span>}
              </div>
            )}
            {mentalPa && (
              <div className="mb-1 flex flex-wrap items-center">
                <TraitChip label={`学生版B · PHQ-A ${mentalPa.phq9}/27（${mentalPa.phq9Level}）`} />
                <TraitChip label={`GAD-7 ${mentalPa.gad7}/21（${mentalPa.gad7Level}）`} />
                {mentalPa.selfHarm && <span className="mr-1.5 mb-1 inline-block rounded-full border border-[#DD3534]/60 bg-[#F9E4E1] px-2.5 py-0.5 text-[11px] font-bold text-[#A82524]">!!有自伤念头信号 · 立即求助!!</span>}
              </div>
            )}
            {mentalScl90 && <TraitChip label={`深度评估 · SCL-90 总分 ${mentalScl90.total}/450（${mentalScl90.screeningPositive ? "筛选阳性" : "筛选阴性"}）`} />}
            {mental && isMentalV2(mental) && (
              <div className="mb-1 flex flex-wrap items-center">
                <TraitChip label={`通用版 · PHQ-9 ${mental.phq9}/27（${mental.phq9Level}）`} />
                <TraitChip label={`GAD-7 ${mental.gad7}/21（${mental.gad7Level}）`} />
                {mental.selfHarm && <span className="mr-1.5 mb-1 inline-block rounded-full border border-[#DD3534]/60 bg-[#F9E4E1] px-2.5 py-0.5 text-[11px] font-bold text-[#A82524]">!!有自伤念头信号 · 立即求助!!</span>}
              </div>
            )}
            <AnswersFold raw={raw} kinds={["mental", "mentalsdq", "mentalpa", "scl90"]} title="心理状态 · 答题明细（点击展开）" />
          </div>
        )}

        {/* 第三步 · 建议进步方案 */}
        <SectionHead n="3" title="建议进步方案" />
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-[12.5px]">
            <thead>
              <tr>
                <th className="w-[150px] border border-[#CDEBDD] bg-[#D4F2E8] px-2.5 py-2 text-left text-[13px] text-[#0B8A63]">层</th>
                <th className="w-[230px] border border-[#CDEBDD] bg-[#D4F2E8] px-2.5 py-2 text-left text-[13px] text-[#0B8A63]">层内重点项</th>
                <th className="border border-[#CDEBDD] bg-[#D4F2E8] px-2.5 py-2 text-left text-[13px] text-[#0B8A63]">干预方向 → 训练方案</th>
              </tr>
            </thead>
            <tbody>
              {planLayers(e3).map((l) => (
                <tr key={l.layer}>
                  <td className="border border-[#E8F1EC] bg-[#F0FAF5] px-2.5 py-2 font-bold whitespace-nowrap text-olive">
                    {l.title}
                    <small className="block text-[11px] font-medium text-olive-mute">{l.sub}</small>
                  </td>
                  <td className="border border-[#E8F1EC] px-2.5 py-2">
                    <div className="flex flex-wrap">
                      {l.chips.map((c) => <SolidChip key={c.label} label={c.label} score={c.score} />)}
                    </div>
                  </td>
                  <td className="border border-[#E8F1EC] px-2.5 py-2 text-olive-soft">
                    {l.plan}
                    <AnswersFold raw={raw} kinds={l.kinds} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-[11.5px] text-olive-mute">
          评分原则：红 &lt;3.0（≈百分制 &lt;50）卡点 · 优先干预；黄 3.0—3.7（≈50—69）待提升；绿 ≥3.8（≈≥70）正常。每层的「答题明细」折叠可展开查看生成该结果的所有题目。
        </p>

        {/* 简要总结 · 三档分布 */}
        <SectionHead n="总" title="简要总结" sub="15 个计分点三档分布（九能 + 条件三格 + 学能三项）" />
        <div className="grid gap-3.5 sm:grid-cols-3">
          <div className="rounded-xl border border-[#E3EEE8] bg-[#E4F7EC] px-4 py-3.5 text-[12.5px] leading-[1.9] text-olive-soft">
            <h6 className="mb-1 text-[13px] font-extrabold text-[#0B8A63]">优势点 · {bandCount("正常")} 项</h6>
            {bandCount("正常") === 0 ? "本档没有项目。（≥3.8 · 正常 · 标绿）" : "处于正常区间的计分点，保持即可。"}
          </div>
          <div className="rounded-xl border border-[#E3EEE8] bg-[#FDF6E3] px-4 py-3.5 text-[12.5px] leading-[1.9] text-olive-soft">
            <h6 className="mb-1 text-[13px] font-extrabold text-[#8A6500]">待提升 · {bandCount("待提升")} 项</h6>
            {bandCount("待提升") === 0
              ? "本档没有项目。（3.0–3.7 · 待提升 · 标黄）"
              : `主要是：${e3.priorities.slice(0, 3).map((p) => p.label).join("、")}——按训练方案做，最容易提上来。`}
          </div>
          <div className="rounded-xl border border-[#E3EEE8] bg-[#FDEAE3] px-4 py-3.5 text-[12.5px] leading-[1.9] text-olive-soft">
            <h6 className="mb-1 text-[13px] font-extrabold text-[#C2451F]">卡点 · {bandCount("卡点")} 项</h6>
            {bandCount("卡点") === 0 ? "本档没有项目。（&lt;3.0 · 卡点 · 标红 · 优先干预）" : "红档计分点需优先干预，详见上方诊断表。"}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 小组件 ---------- */
function SectionHead({ n, title, sub }: { n: string; title: string; sub?: string }) {
  return (
    <div className="mt-6 mb-3 flex items-center gap-3">
      <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#0EA875] text-[13px] font-bold text-white">{n}</span>
      <h4 className="text-[16px] font-bold text-olive">{title}</h4>
      {sub && <span className="ml-auto text-[12px] text-olive-mute">{sub}</span>}
    </div>
  );
}
function DiagRow({ title, sub, lines, fold }: { title: string; sub: string; lines: ReactNode[]; fold?: ReactNode }) {
  return (
    <tr>
      <td className="border border-[#E8F1EC] bg-[#F0FAF5] px-2.5 py-2 font-bold whitespace-nowrap text-olive">
        {title}
        <small className="block text-[11px] font-medium text-olive-mute">{sub}</small>
      </td>
      <td className="border border-[#E8F1EC] px-2.5 py-2">
        {lines}
        {fold}
      </td>
    </tr>
  );
}
/** 建议进步方案五层（学能 → 善学 → 会学 → 乐学 → 条件）。 */
function planLayers(e3: E3V37Result) {
  const r1f = (x: number) => Math.round(x * 10) / 10;
  const core = (k: string) => e3.systems.core.find((c) => c.key === k);
  const aptitudeMean = r1f(e3.aptitude.reduce((s, a) => s + a.score, 0) / Math.max(1, e3.aptitude.length));
  const condCells = e3.systems.condition.cells;
  const condMean = r1f(condCells.reduce((s, c) => s + c.score, 0) / Math.max(1, condCells.length));
  const ability = (l: string) => e3.abilities.find((a) => a.label === l);
  const defs = [
    {
      layer: "学能", title: `学能层 ${aptitudeMean}/5`, sub: "能力系统 · 计入总分",
      chips: e3.aptitude.map((a) => ({ label: a.label, score: a.score })),
      plan: LAYER_PLAN_TEXT["学能"], kinds: ["e3:学能"],
    },
    {
      layer: "善学", title: `善学层 ${core("善学")?.score ?? 0}/5`, sub: "能力系统 · 元认知 + 学能 + AI 智学",
      chips: [
        ...(ability("计划") ? [{ label: "计划", score: ability("计划")!.score }] : []),
        ...(ability("复盘") ? [{ label: "监控复盘", score: ability("复盘")!.score }] : []),
        ...(ability("智学") ? [{ label: "智学", score: ability("智学")!.score }] : []),
      ],
      plan: LAYER_PLAN_TEXT["善学"], kinds: ["e3:善学"],
    },
    {
      layer: "会学", title: `会学层 ${core("会学")?.score ?? 0}/5`, sub: "行为系统",
      chips: (["学懂", "记住", "会用"] as const).map((lab) => ({ label: lab === "学懂" ? "听懂" : lab, score: ability(lab)?.score ?? 0 })),
      plan: LAYER_PLAN_TEXT["会学"], kinds: ["e3:会学"],
    },
    {
      layer: "乐学", title: `乐学层 ${core("乐学")?.score ?? 0}/5`, sub: "动力系统",
      chips: (["动力", "信心", "韧劲"] as const).map((lab) => ({ label: lab, score: ability(lab)?.score ?? 0 })),
      plan: LAYER_PLAN_TEXT["乐学"], kinds: ["e3:乐学"],
    },
    {
      layer: "条件", title: `条件层 ${condMean}/5`, sub: "支持系统 · 不进总分",
      chips: condCells.map((c) => ({ label: c.label, score: c.score })),
      plan: LAYER_PLAN_TEXT["条件"], kinds: ["e3:条件"],
    },
  ];
  return defs;
}
