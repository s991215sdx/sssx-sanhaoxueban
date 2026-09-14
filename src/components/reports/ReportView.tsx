/**
 * 可复用报告视图：学生端（ReportDetail 页）与伴学师端共用同一份渲染。
 * 本组件不 import trpc——所有数据经 props 传入；viewer="tutor" 时隐藏「我的档案」tab、
 * 「成绩与目标」只读，且不渲染「返回测评中心」按钮。
 */
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { MBTI_REPORTS, DISC_REPORTS, DISC_THEORY, buildCombinedReport, getDiscCombo, buildDiscComboBlend, DISC_ANIMAL } from "@/data/reports";
import { buildE3Report } from "@/data/reports/combined";
import ProfileCard from "@/components/companion/ProfileCard";
import AcademicsForm from "@/components/companion/AcademicsForm";
import type { CombinedSection, CombinedReport } from "@/data/reports";
import type { MbtiResult, DiscResult } from "@contracts/assessments";
import {
  isE3V37Result,
  E3V37_RATING_COUNT,
  scoreE3V37Items,
  e3v37Level,
} from "@contracts/e3v37";
import type { E3V37Result, E3V37Stage, E3V37ItemScore } from "@contracts/e3v37";
import { E3V37P_MIRROR_QUESTIONS, isE3V37ParentResult, type E3V37ParentResult } from "@contracts/e3v37Parent";
import { DISC_DIM_PLAIN } from "./DiscParentCompare";
import { ANCHOR_LABEL, ANCHOR_ORDER } from "@contracts/careerAnchor";
import type { AnchorResult } from "@contracts/careerAnchor";
import type { MultiResult } from "@contracts/multi";
import { MULTI_DIM_LABEL } from "@contracts/multi";
import type { Multi5Result } from "@contracts/multi5";
import { buildMulti5Report, MULTI5_THEORY_NOTE, MULTI5_DIM_ORDER, MULTI5_DIM_LABEL } from "@contracts/multi5";
import type { HollandResult } from "@contracts/holland";
import { HOLLAND_ORDER, HOLLAND_LABEL } from "@contracts/holland";
import type { MentalResult, MentalV2Result, MentalSdqResult, MentalPaResult } from "@contracts/mentalHealth";
import {
  MENTAL_FACTOR_ORDER,
  MENTAL_FACTOR_LABEL,
  mentalBand,
  isMentalV2,
  MENTAL_V2_DISCLAIMER,
  MENTAL_V2_ITEM9_NOTICE,
  MENTAL_SDQ_DISCLAIMER,
  MENTAL_SDQ_SAFETY_NOTICE,
  MENTAL_SDQ_AGE,
  MENTAL_PA_AGE,
  MENTAL_PA_DISCLAIMER,
  SDQ_DIM_LABEL,
  MENTAL_SCORE_GUIDE,
  MENTAL_V2_BAND_GUIDE,
  MENTAL_SDQ_BAND_GUIDE,
  SDQ_DIM_EXPLAIN,
  PHQ9_ITEM_EXPLAIN,
  GAD7_ITEM_EXPLAIN,
} from "@contracts/mentalHealth";
import type { AcademicsData } from "@contracts/academics";
import { SELF_LEVELS } from "@contracts/academics";
import { buildAnswerBlocks, answerKindsForSection } from "@/components/reports/answerBlocks";
import type { AnswerBlock, RawAnswer } from "@/components/reports/answerBlocks";
import { RichText } from "@/components/RichText";
import NineAbilityRadar from "@/components/reports/NineAbilityRadar";
import AbilityScoreTable from "@/components/reports/AbilityScoreTable";
import SystemFramework from "@/components/reports/SystemFramework";
import type { FrameworkStatus, FrameworkUnit, FrameworkFocus, FrameworkLink } from "@/components/reports/SystemFramework";
import DiscParentCompare from "@/components/reports/DiscParentCompare";
import AnchorBarChart from "@/components/reports/AnchorBarChart";
import { E3V37_LEVEL_CLASS, E3V37_LEVEL_CAPTION, E3V37_LEVEL_STYLE, e3v37LevelTextClass } from "@/components/reports/e3v37Theme";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  LabelList,
  Cell,
} from "recharts";
import { ArrowLeft, BookOpen, ChevronDown, Compass, Download, Sparkles, Puzzle, Target } from "lucide-react";
import AnchorDetail from "@/components/reports/AnchorDetail";
import HollandDetail from "@/components/reports/HollandDetail";
import MentalDetail from "@/components/reports/MentalDetail";

/** 报告视图所需的测评数据（学生端来自 trpc.assessment.latest；伴学师端由其自己的数据源组装）。 */
export type ReportAssessmentData = {
  mbti?: MbtiResult; disc?: DiscResult; e3?: unknown;
  e3parent?: unknown;
  discParents?: { label: string; result: DiscResult; createdAt?: Date | string }[];
  multi?: MultiResult | null; multi5?: Multi5Result | null;
  anchor?: AnchorResult | null; holland?: HollandResult | null;
  mental?: MentalResult | MentalV2Result | null;
  mentalSdq?: MentalSdqResult | null;
  mentalPa?: MentalPaResult | null;
  raw?: { kind: string; answers: unknown; createdAt: Date | string }[];
};
export type ReportProfileInfo = { name?: string | null; grade?: string | null; academics?: AcademicsData | null };

type Tab = "combined" | "profile" | "academics" | "e3" | "mbti" | "disc" | "multi5" | "anchor" | "holland" | "mental" | "discparent" | "parent";

/** V36 报告内动作目标：未测 → 去测评；成绩未填 → 去填写。 */
type RevealTarget = { kind: "assess"; start: string } | { kind: "fill-academics" };

const TABS: { key: Tab; label: string }[] = [
  { key: "combined", label: "综合学习力报告" },
  { key: "profile", label: "我的档案" },
  { key: "academics", label: "成绩与目标" },
  { key: "e3", label: "学业诊断报告" },
  { key: "mbti", label: "MBTI 性格详版" },
  { key: "disc", label: "DISC 行为详版" },
  { key: "multi5", label: "多元智能五项" },
  { key: "anchor", label: "职业锚" },
  { key: "holland", label: "职业兴趣" },
  { key: "mental", label: "心理健康" },
  { key: "parent", label: "家长报告" },
];

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

/* V3.7 三档判定卡配色（红 卡点 / 黄 待提升 / 绿 正常），常量集中在 e3v37Theme。 */
const LEVEL_CLASS: Record<string, string> = E3V37_LEVEL_CLASS;

/** 章节条款卡列表（从 SectionCard 抽出，供折叠结构复用）。 */
function SectionItems({ items }: { items: NonNullable<CombinedSection["items"]> }) {
  return (
    <div className="mt-3 space-y-2.5">
      {items.map((it, i) => (
        <div
          key={i}
          className={`rounded-xl border px-3.5 py-3 ${
            it.level ? LEVEL_CLASS[it.level] : "border-cream-deep bg-cream/60"
          }`}
        >
          <div className={it.big ? "text-[16.5px] font-bold" : "text-[13.5px] font-semibold"}>
            <RichText text={it.heading} />
          </div>
          <p className="mt-1 text-[13.5px] leading-relaxed opacity-90">
            <RichText text={it.text} />
          </p>
        </div>
      ))}
    </div>
  );
}

/** 章节要点列表。 */
function SectionBullets({ bullets }: { bullets: string[] }) {
  return (
    <ul className="mt-2.5 space-y-1.5">
      {bullets.map((b, i) => (
        <li key={i} className="text-[14px] leading-relaxed text-olive-soft">
          · <RichText text={b} />
        </li>
      ))}
    </ul>
  );
}

/** 通用折叠块：默认收起（defaultOpen 时默认展开），点击展开/收起；打印/导出 PDF 时会被强制展开（见 onDownload）。 */
function Fold({ title, children, defaultOpen }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen || undefined} className="group mt-3 overflow-hidden rounded-xl border border-border bg-cream/50">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3.5 py-2.5 text-[13px] font-semibold text-olive transition-colors hover:bg-lime-pale/50">
        <span>{title}</span>
        <ChevronDown size={15} className="shrink-0 text-olive-mute transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border/70 px-3.5 py-3">{children}</div>
    </details>
  );
}

/**
 * 详版章节卡（折叠版）：优先显示「结果数据 + 结论段」（标题 + 引导段落），
 * 详细条款与要点收进「详细报告文字」折叠，图形收进「图形与图表」折叠——先简明扼要，想看再展开。
 * 答题明细经 answers 传入，作为独立折叠上移一级（与「详细报告文字」平级）。
 */
function CollapsibleSection({
  section,
  index,
  charts,
  detail,
  answers,
}: {
  section: CombinedSection;
  index: number;
  charts?: ReactNode;
  detail?: ReactNode;
  answers?: ReactNode;
}) {
  const hasParas = (section.paragraphs?.length ?? 0) > 0;
  /* 可见区兜底：没有结论段时条款直接可见；条款也没有时要点直接可见——保证每章先亮出核心内容 */
  const itemsVisible = (!!section.itemsVisible || !hasParas) && !!section.items?.length;
  const bulletsVisible = !hasParas && !section.items?.length && !!section.bullets?.length;
  const detailItems = hasParas && !section.itemsVisible ? section.items : undefined;
  const detailBullets = !bulletsVisible ? section.bullets : undefined;
  const hasDetail = !!(detailItems?.length || detailBullets?.length || detail || section.detailItems?.length);
  return (
    <div id={`sec-${index}`} className="paper-card scroll-mt-20 p-5">
      <div className="flex items-center gap-2.5 border-l-4 border-lime pl-3">
        <span className="mono text-[12px] font-bold text-[#5a9326]">{String(index + 1).padStart(2, "0")}</span>
        <h3 className="text-[15.5px] font-bold text-olive">
          <RichText text={section.title} />
        </h3>
      </div>
      {section.paragraphs?.map((p, i) => (
        <p key={i} className="mt-2.5 text-[14.5px] leading-relaxed text-olive-soft">
          <RichText text={p} />
        </p>
      ))}
      {itemsVisible && section.items && <SectionItems items={section.items} />}
      {bulletsVisible && section.bullets && <SectionBullets bullets={section.bullets} />}
      {charts && (
        <Fold title="图形与图表（默认展开，点击可折叠）" defaultOpen>
          {charts}
        </Fold>
      )}
      {hasDetail && (
        <Fold title="详细报告文字（点击展开）">
          {detailItems && <SectionItems items={detailItems} />}
          {section.detailItems && <SectionItems items={section.detailItems} />}
          {detailBullets && <SectionBullets bullets={detailBullets} />}
          {detail}
        </Fold>
      )}
      {answers && <Fold title="本章相关测评 · 答题明细（点击展开）">{answers}</Fold>}
    </div>
  );
}




/** 章节速览导航：点击直达对应章节，长报告先抓要点。 */
function SectionToc({ sections }: { sections: CombinedSection[] }) {
  return (
    <div className="paper-card p-4">
      <div className="mono text-[11px] tracking-wider text-olive-mute">本报告共 {sections.length} 章 · 点击直达</div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {sections.map((s, i) => (
          <button
            key={i}
            onClick={() => document.getElementById(`sec-${i}`)?.scrollIntoView({ behavior: "smooth", block: "start" })}
            className="rounded-lg border border-border bg-cream px-2.5 py-1 text-[12px] text-olive transition-colors hover:border-lime hover:bg-lime-pale"
          >
            <span className="mono mr-1 text-[#5a9326]">{i + 1}</span>
            {s.title.replace(/[*（(].*$/, "")}
          </button>
        ))}
      </div>
    </div>
  );
}

/** 进步路线图 · 三步走（表格版：现状成绩表 → 冰山诊断表 → 训练方案表，问题项标红，一眼看全貌）。 */
/* V3.7 冰山下五大系统：三阶九能 + 条件三格 + 学能三项。 */
const LAYER_PLAN_TEXT: Record<string, string> = {
  乐学: "点燃与唤醒：稳动力、攒信心、练韧劲 → 每日小胜记录、兴趣嫁接学习、10 年愿景对话、受挫后 24 小时重启仪式",
  会学: "跑顺「学懂-记住-会用」闭环 → 预习带问题听课、结构化整理与复述输出、错题三天重做、同类题举一反三",
  善学: "提升计划、复盘与 AI 智学 → 目标拆解与限时清单、试卷分析三件事+逐题归因、AI 私人教练出周计划并核对答案",
  条件: "稳地基：睡眠、情绪、关系、资源先归位 → 睡眠前奏曲、手机使用约定、每周 3 次运动、亲子善意沟通",
  学能: "补加工效率：注意力/工作记忆/加工速度专项 → 舒尔特方格、听记复述、限时口算，每周 3 次、坚持 3 个月",
};
type RoadmapLayerSub = { label: string; score: number; level: "正常" | "待提升" | "卡点" };
type RoadmapFocus = { kp: string; score: number; level: "正常" | "待提升" | "卡点" };
function RoadmapSection({
  section,
  index,
  e3,
  e3Ratings,
  academics,
  mbti,
  disc,
  multi5,
  anchor,
  holland,
  mental,
  mentalSdq,
  mentalPa,
  charts,
  raw,
  onReveal,
}: {
  section: CombinedSection;
  index: number;
  e3?: E3V37Result;
  /** E3 本次 70 题原始评分：用于冰山模型条件/学能层的二级关注点展开（无则只显示一级）。 */
  e3Ratings?: number[] | null;
  academics?: AcademicsData;
  mbti?: MbtiResult;
  disc?: DiscResult;
  multi5?: Multi5Result;
  anchor?: AnchorResult;
  holland?: HollandResult;
  mental?: MentalResult | MentalV2Result;
  mentalSdq?: MentalSdqResult;
  mentalPa?: MentalPaResult;
  charts?: ReactNode;
  /** 各测评原始作答：冰山各行/层内重点项的答题明细折叠由此构建（V36 折叠式直出）。 */
  raw?: RawAnswer[];
  /** V35 深链：成绩未填 → 去填写。 */
  onReveal?: (t: RevealTarget) => void;
}) {
  /** 小数值芯片：bad=深红（需关注）；trait=琥珀显眼（性格/行为/兴趣特点，非缺点）。 */
  const Chip = ({ label, bad, trait }: { label: string; bad?: boolean; trait?: boolean }) => (
    <span
      className={`mr-1.5 mb-1 inline-block rounded-md border px-1.5 py-0.5 text-[11.5px] leading-tight ${
        bad
          ? "border-[#b91c1c]/50 bg-[#fbe3df] font-bold text-[#8f1313]"
          : trait
            ? "border-[#c7a23a]/70 bg-[#f5e7c1] font-bold text-[#8a6d1a]"
            : "border-border bg-cream text-olive-soft"
      }`}
    >
      {label}
    </span>
  );
  const round1 = (x: number) => Math.round(x * 10) / 10;
  const layers = (["乐学", "会学", "善学", "条件", "学能"] as const).map((l) => {
    let score = 0;
    let subs: RoadmapLayerSub[] = [];
    if (e3) {
      if (l === "条件") {
        const cells = e3.systems.condition.cells;
        score = round1(cells.reduce((s, c) => s + c.score, 0) / Math.max(1, cells.length));
        subs = cells.map((c) => ({ label: c.label, score: c.score, level: c.level }));
      } else if (l === "学能") {
        score = round1(e3.aptitude.reduce((s, a) => s + a.score, 0) / Math.max(1, e3.aptitude.length));
        subs = e3.aptitude.map((a) => ({ label: a.label, score: a.score, level: a.level }));
      } else {
        const sys = e3.systems.core.find((c) => c.key === l);
        score = sys?.score ?? 0;
        subs = e3.abilities
          .filter((a) => a.system === l)
          .map((a) => ({ label: a.label, score: a.score, level: a.level }));
      }
    }
    return { layer: l, score, level: e3v37Level(score), dims: subs };
  });
  /* 冰山模型两级展开：一级=能/格（均分实心 chip），二级=关注点（描边小字 chip）。
     乐学/会学/善学的关注点直接取 abilities[].focuses；条件三格与学能三项从逐题得分换算（无原始评分则只显示一级）。
     各系统内部行序倒转（韧劲/信心/动力、会用/记住/学懂、智学/复盘/计划、资源/关系/状态、加工速度/工作记忆/注意力），行内关注点顺序不变。 */
  const itemScores = e3 && e3Ratings ? scoreE3V37Items(e3.stage, e3Ratings) : [];
  const focusOfAbility = (abilityLabel: string): RoadmapFocus[] =>
    itemScores.filter((it) => it.ability === abilityLabel).map((it) => ({ kp: it.kp, score: it.score, level: it.level }));
  const layerUnits: Record<string, (RoadmapLayerSub & { focuses: RoadmapFocus[] })[]> = {
    乐学: (e3?.abilities ?? []).filter((a) => a.system === "乐学").map((a) => ({ ...a, focuses: a.focuses })).reverse(),
    会学: (e3?.abilities ?? []).filter((a) => a.system === "会学").map((a) => ({ ...a, focuses: a.focuses })).reverse(),
    善学: (e3?.abilities ?? []).filter((a) => a.system === "善学").map((a) => ({ ...a, focuses: a.focuses })).reverse(),
    条件: (e3?.systems.condition.cells ?? []).map((c) => ({ ...c, focuses: focusOfAbility(c.label) })).reverse(),
    学能: (e3?.aptitude ?? []).map((a) => ({
      ...a,
      focuses: itemScores
        .filter((it) => it.system === "学能" && it.ability === a.label)
        .map((it) => ({ kp: `第${it.no}题`, score: it.score, level: it.level })),
    })).reverse(),
  };
  /** 一级元素：实心色块 chip（白字，按阈值着色）。 */
  const SolidChip = ({ label, level }: { label: string; level: "正常" | "待提升" | "卡点" }) => (
    <span
      className="mr-1 inline-block shrink-0 rounded-md px-1.5 py-0.5 text-[11.5px] font-bold leading-tight text-white"
      style={{ background: E3V37_LEVEL_STYLE[level].bar }}
    >
      {label}
    </span>
  );
  /** 二级元素：描边小字 chip（阈值色文字 + 浅底），与一级实心块明显区分。 */
  const FocusChip = ({ label, level }: { label: string; level: "正常" | "待提升" | "卡点" }) => (
    <span
      className="mr-1 mb-0.5 inline-block rounded-md border px-1.5 py-px text-[11px] leading-tight"
      style={{ borderColor: `${E3V37_LEVEL_STYLE[level].bar}80`, color: E3V37_LEVEL_STYLE[level].text, background: E3V37_LEVEL_STYLE[level].bg }}
    >
      {label}
    </span>
  );
  const subjects = (academics?.subjects ?? []).filter((x) => x.lastScore != null || x.targetScore != null);
  const lastTotal = subjects.reduce((a, b) => a + (b.lastScore ?? 0), 0);
  const targetTotal = subjects.reduce((a, b) => a + (b.targetScore ?? 0), 0);
  const discCombo = disc ? getDiscCombo(disc.dims) : [];
  const StepHead = ({ n, title, color }: { n: string; title: string; color: string }) => (
    <div className="flex items-center gap-2">
      <span className={`flex h-6.5 w-6.5 shrink-0 items-center justify-center rounded-full px-1.5 py-1 text-[13px] font-bold text-white ${color}`}>
        {n}
      </span>
      <span className="text-[14px] font-bold text-olive">{title}</span>
    </div>
  );
  /** 层 → E3 答题明细段过滤（answerBlocks 的 kinds 口径）。 */
  const LAYER_KINDS: Record<string, string[]> = {
    学能: ["e3:学能"],
    善学: ["e3:善学"],
    会学: ["e3:会学"],
    乐学: ["e3:乐学"],
    条件: ["e3:条件"],
  };
  /** 行内答题明细折叠（V36：折叠式直出在当前行，不再跳转到其他 tab）。 */
  const AnswersFold = ({ kinds, title = "答题明细（点击展开）" }: { kinds: string[]; title?: string }) => {
    if (!raw || raw.length === 0) return null;
    const blocks = buildAnswerBlocks(raw, kinds);
    if (blocks.length === 0) return null;
    return (
      <details className="group mt-1.5 overflow-hidden rounded-lg border border-border/70 bg-white/60 print:hidden">
        <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-2.5 py-1.5 text-[11.5px] font-semibold text-olive transition-colors hover:bg-lime-pale/50">
          <span>{title}</span>
          <ChevronDown size={13} className="shrink-0 text-olive-mute transition-transform group-open:rotate-180" />
        </summary>
        <div className="border-t border-border/60 px-1 py-1">
          <AnswerBlocksView blocks={blocks} />
        </div>
      </details>
    );
  };
  /* 冰山下各行（从上→下）：学能 → 善学 → 会学 → 乐学 → 条件 → 心理健康 → DISC 行为 → MBTI 性格 → 职业锚 → 霍兰德兴趣；
     心理健康/DISC/MBTI/职业锚/霍兰德按数据有无条件渲染，全部行共享一个「冰山下」rowSpan 单元格。 */
  const underRows: { key: string; label: string; content: ReactNode }[] = (
    [
      ["学能 · 能力系统", "学能"],
      ["善学 · 加速系统", "善学"],
      ["会学 · 行为系统", "会学"],
      ["乐学 · 动力系统", "乐学"],
      ["条件 · 支持系统", "条件"],
    ] as const
  ).map(([rowLabel, layer]) => ({
    key: layer,
    label: rowLabel,
    content: (
      <>
        {/* 两级结构：一行一个「能」——实心 chip（能名+均分）后跟随该能的关注点描边 chips */}
        {(layerUnits[layer] ?? []).map((u) => (
          <div key={u.label} className="mb-1 flex flex-wrap items-center last:mb-0">
            <SolidChip label={`${u.label} ${u.score}`} level={u.level} />
            {u.focuses.map((f) => (
              <FocusChip key={f.kp} label={`${f.kp} ${f.score}`} level={f.level} />
            ))}
          </div>
        ))}
        {layer === "学能" && (
          <p className="mt-0.5 text-[10.5px] leading-tight text-olive-mute">学能三项单独报告，不进总分</p>
        )}
        {layer === "学能" && multi5 && (
          <div className="mt-1 border-t border-border/60 pt-1">
            {MULTI5_DIM_ORDER.map((k) => (
              <Chip key={k} label={`${MULTI5_DIM_LABEL[k]} ${multi5.dims[k]}`} bad={multi5.dims[k] < 60} />
            ))}
            <Chip label={`细心指数 ${multi5.carefulIndex}%`} bad={multi5.carefulIndex < 70} />
          </div>
        )}
        <AnswersFold kinds={LAYER_KINDS[layer]} />
        {layer === "学能" && multi5 && <AnswersFold kinds={["multi5"]} title="多元五项 · 答题明细（点击展开）" />}
      </>
    ),
  }));
  if (mental || mentalSdq || mentalPa) {
    underRows.push({
      key: "mental",
      label: "心理健康",
      content: (
        <>
          {mentalSdq && (
            <>
              <Chip label={`学生版A · SDQ 困难总分 ${mentalSdq.totalDiff}/40（${mentalSdq.totalBand}）`} bad={mentalSdq.level !== "良好"} />
              {mentalSdq.selfHarm && <Chip label="!!有自伤念头信号 · 立即求助!!" bad />}
            </>
          )}
          {mentalPa && (
            <>
              <Chip label={`学生版B · PHQ-A ${mentalPa.phq9}/27（${mentalPa.phq9Level}）`} bad={mentalPa.phq9Level !== "良好"} />
              <Chip label={`GAD-7 ${mentalPa.gad7}/21（${mentalPa.gad7Level}）`} bad={mentalPa.gad7Level !== "良好"} />
              {mentalPa.selfHarm && <Chip label="!!有自伤念头信号 · 立即求助!!" bad />}
            </>
          )}
          {mental && (isMentalV2(mental) ? (
            <>
              <Chip label={`通用版 · PHQ-9 ${mental.phq9}/27（${mental.phq9Level}）`} bad={mental.phq9Level !== "良好"} />
              <Chip label={`GAD-7 ${mental.gad7}/21（${mental.gad7Level}）`} bad={mental.gad7Level !== "良好"} />
              {mental.selfHarm && <Chip label="!!有自伤念头信号 · 立即求助!!" bad />}
            </>
          ) : (
            <>
              {MENTAL_FACTOR_ORDER.map((f) => {
                const v = mental.factors[f];
                if (v == null) return null;
                const band = mentalBand(v);
                return (
                  <Chip
                    key={f}
                    label={`${MENTAL_FACTOR_LABEL[f]} ${v.toFixed(1)}${band === "无" ? "" : `（${band}）`}`}
                    bad={band !== "无"}
                  />
                );
              })}
            </>
          ))}
          <AnswersFold kinds={["mental", "mentalsdq", "mentalpa"]} />
        </>
      ),
    });
  }
  if (disc) {
    underRows.push({
      key: "disc",
      label: "DISC 行为",
      content: (
        <>
          <Chip label={`${discCombo.join("")} 型 · ${DISC_REPORTS[disc.primary as "D"|"I"|"S"|"C"]?.name ?? ""}`} trait />
          {(["D", "I", "S", "C"] as const).map((k) => (
            <Chip key={k} label={`${k} ${disc.dims[k]}`} trait={discCombo.includes(k)} />
          ))}
          <AnswersFold kinds={["disc"]} />
        </>
      ),
    });
  }
  if (mbti) {
    underRows.push({
      key: "mbti",
      label: "MBTI 性格",
      content: (
        <>
          <Chip label={`${mbti.type} · ${MBTI_REPORTS[mbti.type]?.name ?? ""}`} trait />
          {(["E", "I", "S", "N", "T", "F", "J", "P"] as const).map((k) => (
            <Chip key={k} label={`${k} ${mbti.dims[k as keyof typeof mbti.dims]}`} trait={mbti.type.includes(k)} />
          ))}
          <AnswersFold kinds={["mbti"]} />
        </>
      ),
    });
  }
  if (anchor) {
    underRows.push({
      key: "anchor",
      label: "职业锚",
      content: (
        <>
          <Chip label={`第一锚 · ${ANCHOR_LABEL[anchor.top2[0]]} ${anchor.dims[anchor.top2[0]].toFixed(1)}`} trait />
          <Chip label={`第二锚 · ${ANCHOR_LABEL[anchor.top2[1]]} ${anchor.dims[anchor.top2[1]].toFixed(1)}`} trait />
          <AnswersFold kinds={["anchor"]} />
        </>
      ),
    });
  }
  if (holland) {
    underRows.push({
      key: "holland",
      label: "霍兰德兴趣",
      content: (
        <>
          <Chip label={`代码 ${holland.code}`} trait />
          {HOLLAND_ORDER.map((k) => (
            <Chip key={k} label={`${HOLLAND_LABEL[k]} ${holland.dims[k].toFixed(1)}`} trait={holland.top3.includes(k)} />
          ))}
          <AnswersFold kinds={["holland"]} />
        </>
      ),
    });
  }
  /* 第三步「建议进步方案」按冰山同序倒序渲染：学能、善学、会学、乐学、条件（LAYER_PLAN_TEXT 按层名取值）。 */
  const planLayers = [layers[4], layers[2], layers[1], layers[0], layers[3]];

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2.5">
        <span className="mono text-[12px] font-bold text-[#5a9326]">{String(index + 1).padStart(2, "0")}</span>
        <h3 className="text-[15.5px] font-bold text-olive">{section.title}</h3>
      </div>
      {section.paragraphs?.map((p, i) => (
        <p key={i} className="text-[13px] leading-relaxed text-olive-soft">
          <RichText text={p} />
        </p>
      ))}

      {/* 第一步 · 现状与目标（成绩表 + 三阶表） */}
      <div className="paper-card border-lime/50 p-4">
        <StepHead n="1" title="理清现状与目标" color="bg-lime" />
        {subjects.length > 0 ? (
          <div className="mt-2.5 overflow-x-auto">
            <table className="w-full min-w-[430px] border-collapse text-[11.5px] sm:text-[12.5px]">
              <thead>
                <tr className="bg-cream-deep/60 text-olive">
                  <th className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 text-left">科目</th>
                  {subjects.map((x) => (
                    <th key={x.name} className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5">{x.name}</th>
                  ))}
                  <th className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 font-bold">总分</th>
                </tr>
              </thead>
              <tbody className="text-center text-olive-soft">
                <tr>
                  <td className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 text-left font-semibold text-olive">现状</td>
                  {subjects.map((x) => (
                    <td key={x.name} className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5">{x.lastScore ?? "-"}</td>
                  ))}
                  <td className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 font-bold text-olive">{lastTotal}</td>
                </tr>
                <tr>
                  <td className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 text-left font-semibold text-olive">目标</td>
                  {subjects.map((x) => (
                    <td key={x.name} className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5">{x.targetScore ?? "-"}</td>
                  ))}
                  <td className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 font-bold text-olive">{targetTotal}</td>
                </tr>
                <tr>
                  <td className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 text-left font-semibold text-olive">差距</td>
                  {subjects.map((x) => {
                    const gap = (x.targetScore ?? 0) - (x.lastScore ?? 0);
                    return (
                      <td
                        key={x.name}
                        className={`border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 ${gap > 0 ? "bg-[#fbe3df] font-bold text-[#b91c1c]" : "text-[#5a9326]"}`}
                      >
                        {gap > 0 ? `+${gap}` : "已达标"}
                      </td>
                    );
                  })}
                  <td className={`border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 font-bold ${targetTotal - lastTotal > 0 ? "bg-[#fbe3df] text-[#b91c1c]" : "text-[#5a9326]"}`}>
                    {targetTotal - lastTotal > 0 ? `+${targetTotal - lastTotal}` : "已达标"}
                  </td>
                </tr>
                <tr>
                  <td className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 text-left font-semibold text-olive">三阶</td>
                  {layers.slice(0, 3).map((l) => {
                    const st =
                      l.level === "卡点"
                        ? { cls: "bg-[#f5c8c0] font-bold text-[#8f1313]", tag: " · 卡点，优先补" }
                        : l.level === "待提升"
                          ? { cls: "bg-[#f5e7c1] font-semibold text-[#8a6d1a]", tag: " · 待提升" }
                          : { cls: "font-semibold text-[#5a9326]", tag: " · 正常" };
                    return (
                      <td
                        key={l.layer}
                        colSpan={Math.max(1, Math.floor(subjects.length / 3))}
                        className={`border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 ${st.cls}`}
                      >
                        {l.layer} {l.score}/5{st.tag}
                      </td>
                    );
                  })}
                  <td className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 text-olive-mute">3.8 分为线</td>
                </tr>
                <tr>
                  <td className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 text-left font-semibold text-olive">条件/学能</td>
                  {[
                    ...layers[3].dims,
                    { label: "学能筛查", score: layers[4].score, level: layers[4].level },
                  ].map((s) => {
                    const st =
                      s.level === "卡点"
                        ? "bg-[#f5c8c0] font-bold text-[#8f1313]"
                        : s.level === "待提升"
                          ? "bg-[#f5e7c1] font-semibold text-[#8a6d1a]"
                          : "font-semibold text-[#5a9326]";
                    return (
                      <td
                        key={s.label}
                        colSpan={Math.max(1, Math.floor(subjects.length / 4))}
                        className={`border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 ${st}`}
                      >
                        {s.label} {s.score}/5
                      </td>
                    );
                  })}
                  <td className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 text-olive-mute">单独报告</td>
                </tr>
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-2 text-[12.5px] text-olive-mute">
            成绩目标未填写
            {onReveal && (
              <button
                type="button"
                onClick={() => onReveal({ kind: "fill-academics" })}
                className="ml-1.5 rounded-full border border-lime/60 bg-lime-pale/70 px-2 py-px text-[11px] font-semibold text-[#4e7d20] transition hover:bg-lime-pale"
              >
                去填写 →
              </button>
            )}
            ；三阶现状：{layers.slice(0, 3).map((l) => `${l.layer} ${l.score}/5（${l.level}）`).join(" · ")}
          </p>
        )}
      </div>

      {/* 第二步 · 冰山诊断表 */}
      <div className="paper-card border-[#c9a227]/50 p-4">
        <StepHead n="2" title="分析问题 · 痛点 · 特点（冰山模型）" color="bg-[#c9a227]" />
        <div className="mt-2.5 overflow-x-auto">
          <table className="w-full min-w-[460px] border-collapse text-[11.5px] sm:text-[12.5px]">
            <tbody>
              <tr>
                <td rowSpan={1} className="w-20 border border-border bg-[#dce9f5] px-2 py-1.5 text-center font-bold text-olive">冰山上</td>
                <td className="w-32 border border-border bg-cream-deep/50 px-2 py-1.5 font-semibold text-olive">知识点 · 成绩</td>
                <td className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5">
                  {subjects.length === 0 ? (
                    <>
                      <Chip label="未填写" bad />
                      {onReveal && (
                        <button
                          type="button"
                          onClick={() => onReveal({ kind: "fill-academics" })}
                          className="mb-1 inline-block rounded-full border border-lime/60 bg-lime-pale/70 px-2 py-px text-[10.5px] font-semibold text-[#4e7d20] transition hover:bg-lime-pale hover:shadow-sm"
                        >
                          去填写成绩与目标 →
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      {subjects.filter((x) => (x.targetScore ?? 0) - (x.lastScore ?? 0) > 0).map((x) => (
                        <Chip key={x.name} label={`${x.name} 差 ${(x.targetScore ?? 0) - (x.lastScore ?? 0)} 分`} bad />
                      ))}
                      {subjects.every((x) => (x.targetScore ?? 0) - (x.lastScore ?? 0) <= 0) && <Chip label="各科均已达标" />}
                    </>
                  )}
                </td>
              </tr>
              {underRows.map((row, ri) => (
                <tr key={row.key}>
                  {ri === 0 && (
                    <td rowSpan={underRows.length} className="w-20 border border-border bg-[#f6e3d8] px-2 py-1.5 text-center font-bold text-olive">冰山下</td>
                  )}
                  <td className="w-32 border border-border bg-cream-deep/50 px-2 py-1.5 font-semibold text-olive">{row.label}</td>
                  <td className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5">{row.content}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-[11.5px] text-olive-mute">红底芯片 = 需要关注的点（观察点未达正常 / 五项&lt;60 / 心理阳性）；琥珀底芯片 = 你的主导类型与特点（性格/行为/兴趣没有好坏，不是缺点）。</p>
      </div>

      {/* 第三步 · 训练方案表 */}
      <div className="paper-card border-terra/50 p-4">
        <StepHead n="3" title="建议进步方案（哪层不行补哪层）" color="bg-terra" />
        <div className="mt-2.5 overflow-x-auto">
          <table className="w-full min-w-[460px] border-collapse text-[11.5px] sm:text-[12.5px]">
            <thead>
              <tr className="bg-cream-deep/60 text-olive">
                <th className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 text-left">层</th>
                <th className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 text-left">层内重点项</th>
                <th className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 text-left">干预方向 → 训练方案</th>
              </tr>
            </thead>
            <tbody>
              {planLayers.map((l) => {
                const bad = l.level !== "正常";
                const weakDims = l.dims.filter((n) => n.level !== "正常");
                return (
                  <tr key={l.layer} className={bad ? "" : "opacity-70"}>
                    <td className={`border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 font-bold ${l.level === "卡点" ? "bg-[#fbe3df] text-[#8f1313]" : l.level === "待提升" ? "bg-[#f5e7c1] text-[#8a6d1a]" : "text-[#5a9326]"}`}>
                      {l.layer}层 {l.score}/5 · {l.level}
                    </td>
                    <td className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5">
                      {(weakDims.length > 0 ? weakDims : l.dims.slice(0, 1)).map((n) => (
                        <span
                          key={n.label}
                          className="mr-1.5 mb-1 inline-block rounded-md border px-1.5 py-0.5 text-[11.5px] font-bold leading-tight"
                          style={{
                            borderColor: `${E3V37_LEVEL_STYLE[n.level].bar}66`,
                            color: E3V37_LEVEL_STYLE[n.level].text,
                            background: E3V37_LEVEL_STYLE[n.level].bg,
                          }}
                        >
                          {n.label} {n.score}
                        </span>
                      ))}
                      <AnswersFold kinds={LAYER_KINDS[l.layer]} />
                    </td>
                    <td className="border border-border px-1.5 py-1 sm:px-2 sm:py-1.5 leading-relaxed text-olive-soft">
                      {bad ? LAYER_PLAN_TEXT[l.layer] : "已到 3.8 正常线：保持节奏，每周对照自查一次即可。"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1.5 text-[11.5px] leading-relaxed text-olive-mute">
          评分原则：红 &lt;3.0（≈百分制 &lt;50）卡点 · 优先干预；黄 3.0—3.7（≈50—69）待提升；绿 ≥3.8（≈≥70）正常。每层的「答题明细」折叠可展开查看生成该结果的所有题目。
        </p>
      </div>

      {/* 图形与图表（如九能整体雷达，诊断总览）：默认展开，可手动折叠 */}
      {charts && (
        <Fold title="图形与图表（默认展开，点击可折叠）" defaultOpen>
          {charts}
        </Fold>
      )}

      {/* 简要总结收尾：优势 ≥3.8（绿）/ 待提升 3.0—3.7（黄）/ 卡点 <3.0（红）三档折叠对应题目；
          无逐题原始评分时回退为概要总论文案。 */}
      {itemScores.length > 0 ? (
        <BriefSummary items={itemScores} />
      ) : (
        section.closing &&
        section.closing.length > 0 && (
          <div className="paper-card border-lime/50 p-4">
            <div className="text-[14px] font-bold text-olive">简要总结</div>
            {section.closing.map((p, i) => (
              <p key={i} className="mt-1.5 text-[13px] leading-relaxed text-olive-soft">
                <RichText text={p} />
              </p>
            ))}
          </div>
        )
      )}
    </section>
  );
}

/**
 * V35 简要总结：把 E3 70 道评分题按三档分组折叠——
 * 优势点（≥3.8，绿）/ 待提升（3.0—3.7，黄）/ 卡点（<3.0，红，优先干预）。
 * 每档先给一句话总结（含 kp 聚合前三），展开可见该档所有题目与得分。
 */
function BriefSummary({ items }: { items: E3V37ItemScore[] }) {
  const BANDS: {
    key: string;
    title: string;
    rule: string;
    match: (s: number) => boolean;
    tone: { text: string; bar: string; bg: string };
    order: "asc" | "desc";
    summary: (kps: string[], n: number) => string;
  }[] = [
    {
      key: "good",
      title: "优势点总结",
      rule: "≥3.8（≈百分制 ≥70）· 正常 · 标绿",
      match: (s) => s >= 3.8,
      tone: E3V37_LEVEL_STYLE.正常,
      order: "desc",
      summary: (kps, n) =>
        `共 ${n} 题落在正常线以上${kps.length ? `，优势集中在：${kps.join("、")}` : ""}——这些是孩子的底气，继续保持。`,
    },
    {
      key: "mid",
      title: "待提升总结",
      rule: "3.0—3.7（≈50—69）· 待提升 · 标黄",
      match: (s) => s >= 3.0 && s < 3.8,
      tone: E3V37_LEVEL_STYLE.待提升,
      order: "asc",
      summary: (kps, n) =>
        `共 ${n} 题处于待提升区${kps.length ? `，主要是：${kps.join("、")}` : ""}——按训练方案做，最容易提上来。`,
    },
    {
      key: "bad",
      title: "卡点总结",
      rule: "<3.0（≈百分制 <50）· 卡点 · 标红 · 优先干预",
      match: (s) => s < 3.0,
      tone: E3V37_LEVEL_STYLE.卡点,
      order: "asc",
      summary: (kps, n) =>
        `共 ${n} 题低于 3.0${kps.length ? `，卡点集中在：${kps.join("、")}` : ""}——优先干预，从分数最低的一项做起。`,
    },
  ];
  return (
    <div className="paper-card border-lime/50 p-4">
      <div className="text-[14px] font-bold text-olive">简要总结</div>
      <p className="mt-1 text-[12px] leading-relaxed text-olive-mute">
        按评分原则把 70 道诊断题分成三档：红 &lt;3.0（≈&lt;50）卡点 · 黄 3.0—3.7（≈50—69）待提升 · 绿 ≥3.8（≈≥70）正常；点击每档可展开对应的所有题目。
      </p>
      <div className="mt-2.5 space-y-2">
        {BANDS.map((b) => {
          const list = items
            .filter((it) => b.match(it.score))
            .sort((x, y) => (b.order === "asc" ? x.score - y.score : y.score - x.score));
          /* 档内按 kp 聚合取前三，写进一句话总结 */
          const kpAvg = new Map<string, { sum: number; n: number }>();
          for (const it of list) {
            const g = kpAvg.get(it.kp);
            if (g) {
              g.sum += it.score;
              g.n += 1;
            } else kpAvg.set(it.kp, { sum: it.score, n: 1 });
          }
          const topKps = [...kpAvg.entries()]
            .map(([kp, g]) => ({ kp, avg: g.sum / g.n }))
            .sort((x, y) => (b.order === "asc" ? x.avg - y.avg : y.avg - x.avg))
            .slice(0, 3)
            .map((x) => x.kp);
          return (
            <details
              key={b.key}
              className="group overflow-hidden rounded-xl border"
              style={{ borderColor: `${b.tone.bar}55`, background: b.tone.bg }}
            >
              <summary className="cursor-pointer select-none px-3.5 py-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[13px] font-bold" style={{ color: b.tone.text }}>
                    {b.title} · {list.length} 题
                  </span>
                  <ChevronDown size={15} className="shrink-0 transition-transform group-open:rotate-180" style={{ color: b.tone.text }} />
                </div>
                <p className="mt-0.5 text-[11.5px] leading-relaxed" style={{ color: b.tone.text }}>
                  {list.length ? b.summary(topKps, list.length) : "本档没有题目。"}
                  <span className="ml-1 opacity-75">（{b.rule}）</span>
                </p>
              </summary>
              {list.length > 0 && (
                <ol className="space-y-1 border-t px-3.5 py-2.5" style={{ borderColor: `${b.tone.bar}33` }}>
                  {list.map((it) => (
                    <li key={it.no} className="flex gap-2 text-[12px] leading-relaxed" style={{ color: b.tone.text }}>
                      <span className="mono shrink-0 opacity-70">{it.no}.</span>
                      <span className="flex-1">
                        [{it.kp}] {it.text}
                      </span>
                      <span className="mono shrink-0 font-bold">{it.score} 分</span>
                    </li>
                  ))}
                </ol>
              )}
            </details>
          );
        })}
      </div>
    </div>
  );
}

function ListCard({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) {
  return (
    <div className="paper-card p-5">
      <h3 className="font-bold text-olive">{title}</h3>
      <ul className="mt-3 space-y-2">
        {items.map((t, i) => (
          <li key={i} className="flex gap-2 text-[14px] leading-relaxed text-olive-soft">
            <span className="mono shrink-0 text-[12.5px] font-bold text-[#5a9326]">
              {ordered ? `${i + 1}.` : "·"}
            </span>
            <span>
              <RichText text={t} />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MbtiDetail({ result, onGoCombined }: { result: MbtiResult; onGoCombined: () => void }) {
  const report = MBTI_REPORTS[result.type];
  if (!report) {
    return (
      <div className="paper-card p-5">
        <h3 className="font-bold text-olive">暂时读不到 {result.type} 的详细报告</h3>
        <p className="mt-2 text-[13.5px] text-olive-mute">简单版结果不受影响，稍后再来试试。</p>
      </div>
    );
  }
  return (
    <div className="space-y-4">
      {/* 画像头卡 */}
      <div className="paper-card p-5">
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold tracking-widest text-olive">{report.type}</span>
          <span className="text-lg font-bold text-olive">{report.name}</span>
        </div>
        <p className="mt-1.5 text-[14px] text-olive-soft">
          <RichText text={report.headline} />
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {report.tags.map((t) => (
            <span key={t} className="chip">
              {t}
            </span>
          ))}
        </div>
        {/* 四维度对比条 */}
        <div className="mt-4 space-y-2.5">
          {(["EI", "SN", "TF", "JP"] as const).map((pair) => {
            const [a, b] = pair.split("") as [keyof typeof result.dims, keyof typeof result.dims];
            const total = Math.max(1, result.dims[a] + result.dims[b]);
            const pctA = (result.dims[a] / total) * 100;
            const winA = result.dims[a] >= result.dims[b];
            return (
              <div key={pair}>
                <div className="flex justify-between text-[12.5px]">
                  <span className={winA ? "font-bold text-olive" : "text-olive-mute"}>
                    {POLE_LABEL[a]} {a} · {result.dims[a]}
                  </span>
                  <span className={!winA ? "font-bold text-olive" : "text-olive-mute"}>
                    {POLE_LABEL[b]} {b} · {result.dims[b]}
                  </span>
                </div>
                <div className="mt-1 flex h-2.5 overflow-hidden rounded-full bg-cream-deep">
                  <div className="h-full rounded-l-full bg-lime" style={{ width: `${pctA}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <ListCard title="你的性格特征" items={report.traits} ordered />
      <ListCard title="你的性格优势" items={report.strengths} ordered />
      <ListCard title="可以留意的小角落" items={report.weaknesses} ordered />
      <ListCard title="学习中的你 · 优势" items={report.studyStrengths} ordered />
      <ListCard title="学习中的你 · 可能的盲点" items={report.studyBlindspots} ordered />

      {/* 校园五幕 */}
      <div className="paper-card p-5">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-olive" />
          <h3 className="font-bold text-olive">校园里的你 · 五个场景</h3>
        </div>
        <div className="mt-3 space-y-2.5">
          {report.scenes.map((s) => (
            <div key={s.scene} className="rounded-xl border border-cream-deep bg-cream/60 px-3.5 py-3">
              <div className="text-[13.5px] font-semibold text-olive">{s.scene}</div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-olive-soft">
                <RichText text={s.text} />
              </p>
            </div>
          ))}
        </div>
      </div>

      <ListCard title="给你的发展建议" items={report.suggestions} ordered />

      <button
        onClick={onGoCombined}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream hover:bg-lime-deep"
      >
        <Sparkles size={16} />
        看看 MBTI × DISC × 学习力 三合一综合报告 →
      </button>
    </div>
  );
}

function DiscDetail({ primary, dims, version, onGoCombined }: { primary: "D" | "I" | "S" | "C"; dims: Record<"D" | "I" | "S" | "C", number>; version?: 2; onGoCombined: () => void }) {
  const report = DISC_REPORTS[primary];
  const combo = getDiscCombo(dims);
  const blend = buildDiscComboBlend(combo);
  return (
    <div className="space-y-4">
      {/* 主型头卡 */}
      <div className="paper-card p-5">
        <div className="flex flex-wrap items-baseline gap-3">
          <span className="text-3xl font-bold text-olive">{combo.join("")} 型</span>
          <span className="text-lg font-bold text-olive">{report.name}</span>
          {combo.length > 1 && (
            <span className="text-[12.5px] text-olive-mute">
              {combo.map((k) => DISC_ANIMAL[k]).join(" + ")}
            </span>
          )}
          {version !== 2 && (
            <a
              href="/assessments?start=disc"
              className="rounded-full border border-butter bg-butter/25 px-2.5 py-0.5 text-[11.5px] font-semibold text-olive-soft hover:border-lime/60"
            >
              旧版题目 · 已升级为更准的「最像/最不像」版，点这里重测 →
            </a>
          )}
        </div>
        <p className="mt-1.5 text-[14px] text-olive-soft">
          <RichText text={report.headline} />
        </p>
        {blend && (
          <div className="mt-3 rounded-xl border border-butter bg-butter/20 px-3.5 py-3">
            <div className="text-[13px] font-bold text-olive">你是 {combo.join("")} 混合型</div>
            <p className="mt-1 text-[13px] leading-relaxed text-olive-soft">
              <RichText text={blend} />
            </p>
          </div>
        )}
        <div className="mt-4 space-y-2.5">
          {(["D", "I", "S", "C"] as const).map((k) => {
            const isMain = k === primary;
            return (
              <div key={k} className="flex items-center gap-3">
                <span className={`w-16 shrink-0 text-[13px] ${isMain ? "font-bold text-olive" : "text-olive-mute"}`}>
                  {k} · {DISC_THEORY.find((t) => t.type === k)?.name}
                </span>
                <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
                  <div
                    className={`h-full rounded-full ${isMain ? "bg-lime" : "bg-lime/40"}`}
                    style={{ width: `${Math.min(100, (dims[k] / 24) * 100)}%` }}
                  />
                </div>
                <span className="mono w-6 text-right text-[12.5px] text-olive-soft">{dims[k]} 分</span>
              </div>
            );
          })}
        </div>
        {/* 四因子倾向度曲线（与综合报告共用组件） */}
        <div className="mt-4 -mx-5">
          <DiscTendencyChart dims={dims} max={version === 2 ? 24 : 12} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {report.keywords.map((k) => (
            <span key={k} className="chip">
              {k}
            </span>
          ))}
        </div>
      </div>

      <div className="paper-card p-5">
        <h3 className="font-bold text-olive">基本情况解读</h3>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-olive-soft">
          <RichText text={report.overview} />
        </p>
      </div>

      {/* 校园五幕 */}
      <div className="paper-card p-5">
        <div className="flex items-center gap-2">
          <BookOpen size={16} className="text-olive" />
          <h3 className="font-bold text-olive">校园里的你 · 五个场景</h3>
        </div>
        <div className="mt-3 space-y-2.5">
          {report.scenes.map((s) => (
            <div key={s.scene} className="rounded-xl border border-cream-deep bg-cream/60 px-3.5 py-3">
              <div className="text-[13.5px] font-semibold text-olive">{s.scene}</div>
              <p className="mt-1 text-[13.5px] leading-relaxed text-olive-soft">
                <RichText text={s.text} />
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="paper-card accent-l border-butter bg-butter/20 p-5">
        <h3 className="font-bold text-olive">压力下的你</h3>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-olive-soft">
          <RichText text={report.underPressure} />
        </p>
      </div>

      <ListCard title="这些行为可能会绊住你" items={report.obstacles} ordered />
      <ListCard title="你需要的支持" items={report.supports} ordered />

      <div className="paper-card p-5">
        <h3 className="font-bold text-olive">你最喜欢的老师风格</h3>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-olive-soft">
          <RichText text={report.teacherFit} />
        </p>
      </div>

      <button
        onClick={onGoCombined}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream hover:bg-lime-deep"
      >
        <Sparkles size={16} />
        看看 MBTI × DISC × 学习力 三合一综合报告 →
      </button>
    </div>
  );
}

/** 家长管教风格 → 与不同主型孩子的常见摩擦点与建议（简版现场生成）。 */
const PARENT_DISC_STYLE: Record<"D" | "I" | "S" | "C", { style: string; risk: Record<"D" | "I" | "S" | "C", string>; tip: string }> = {
  D: {
    style: "指令多、节奏快、重结果",
    risk: {
      D: "两强相遇，容易硬碰硬起冲突",
      I: "孩子爱表达，被压节奏会觉得不被听见",
      S: "孩子偏稳偏慢，被催促容易默默抵触、关上耳朵",
      C: "孩子重细节，被快进催促容易焦虑和反复检查",
    },
    tip: "把命令换成有限选择（「先写数学还是英语？」），批评只对事不对人，每周留一次不谈学习的闲聊。",
  },
  I: {
    style: "热情、重氛围，表扬和批评都带情绪",
    risk: {
      D: "孩子目标感强，情绪化评价容易被他当耳旁风",
      I: "都热情外向，容易聊得热闹、学习计划落不了地",
      S: "孩子安静配合，情绪化的忽冷忽热会让他没安全感",
      C: "孩子敏感细致，随口的批评可能让他内耗好几天",
    },
    tip: "表扬要具体（指出哪件事做得好），批评私下说、先肯定再提问题，说完给一个明确台阶。",
  },
  S: {
    style: "温和包容、不喜欢冲突，规则执行偏松",
    risk: {
      D: "孩子好胜自主，可能觉得规则约束不住自己",
      I: "孩子活泼好动，太宽松容易让计划流于形式",
      S: "都偏稳，家里气氛好但容易缺少推进力",
      C: "孩子自律细致，总体合拍，注意别替他做太多",
    },
    tip: "规则要少而坚定，定了就执行到底；多让孩子自己定目标，家长做「安静的同路人」。",
  },
  C: {
    style: "高标准、重细节、讲规矩",
    risk: {
      D: "孩子求快求赢，反复挑细节容易激起「你别管我」",
      I: "孩子随性爱热闹，细节上反复纠错会让他泄气",
      S: "孩子听话配合，但标准太高容易让他怕犯错、不敢试",
      C: "两个细节控叠加，注意别把小问题放大成否定",
    },
    tip: "先肯定再提一个（只提一个）改进点；允许孩子用自己的节奏完成，把「完美」调成「完成优先」。",
  },
};

/** 亲子冲突/建议聚合（家长报告 tab 与一页简版摘要卡共用）。hot=true 的冲突条目在报告里红色强化。 */
function buildParentChildAnalysis(
  student: DiscResult | null,
  parents: { label: string; result: DiscResult }[],
  e3parent: E3V37ParentResult | null,
): { conflicts: { text: string; hot: boolean }[]; tips: string[] } {
  const conflicts: { text: string; hot: boolean }[] = [];
  const tips: string[] = [];
  if (e3parent?.severeConflict) {
    conflicts.push({ text: "家里最近亲子冲突比较严重（家长卷信号）——先修复关系、让孩子感到安全，再谈学习要求。", hot: true });
    tips.push("红线期原则：暂停加压与说教，先恢复日常陪伴（一起吃饭、散步、不谈学习的闲聊），必要时寻求学校心理老师或专业机构支持。");
  }
  for (const p of parents) {
    const style = PARENT_DISC_STYLE[p.result.primary];
    if (student) {
      const deltas = (["D", "I", "S", "C"] as const).map((k) => ({
        k,
        abs: Math.abs(discNv(student, k) - discNv(p.result, k)),
      }));
      const strong = deltas.filter((x) => x.abs >= 6).sort((a, b) => b.abs - a.abs);
      if (strong.length > 0) {
        conflicts.push({
          text: `${p.label} × 孩子在「${strong.map((x) => `${x.k}（${DISC_DIM_PLAIN[x.k]}）`).join("、")}」上明显顶牛（差 ${strong.map((x) => x.abs).join("、")} 分，差 6 分以上就算明显）——${style.risk[student.primary]}。`,
          hot: true,
        });
      } else {
        conflicts.push({ text: `${p.label} × 孩子：行为频道总体接近，没有明显顶牛的维度；日常留意——${style.risk[student.primary]}。`, hot: false });
      }
    } else {
      conflicts.push({ text: `${p.label} 偏 ${p.result.primary} 型（${style.style}）；孩子完成 DISC 后这里会给出亲子冲突对照。`, hot: false });
    }
    tips.push(`对${p.label}（${p.result.primary} 型家长）：${style.tip}`);
  }
  if (e3parent) {
    if (e3parent.overestimates.length > 0) {
      conflicts.push({
        text: `家长比孩子更乐观的方面：${e3parent.overestimates.map((x) => `「${x.kp}」家长打 ${x.parentScore} 分、孩子只给自己 ${x.studentScore} 分`).join("；")}——家长的期待高过孩子的实际感受，容易变成压力。`,
        hot: e3parent.overestimates.some((x) => x.gap >= 3),
      });
      tips.push("家长更乐观的项：把「我以为你没问题」换成「我们一起看看难在哪」，先问清楚困难，再定目标。");
    }
    if (e3parent.underestimates.length > 0) {
      conflicts.push({
        text: `家长没看到的闪光点：${e3parent.underestimates.map((x) => `「${x.kp}」孩子给自己 ${x.studentScore} 分、家长只打 ${x.parentScore} 分`).join("；")}——孩子的努力值得被看见。`,
        hot: false,
      });
      tips.push("没看到闪光点的项：让孩子主动展示一次（讲一道题、翻一次错题本），比辩解十次更有效。");
    }
    const badCond = e3parent.condView.filter((cv) => cv.note.includes("状况较差"));
    if (badCond.length > 0) conflicts.push({ text: `家长认为状况较差的方向：${badCond.map((cv) => cv.label).join("、")}——需要家校一起核实真因，优先处理。`, hot: true });
    if (e3parent.unknownCount >= 3) conflicts.push({ text: `家长对孩子学习「不了解」有 ${e3parent.unknownCount} 项（了解程度「${e3parent.unknownLevel}」）——先把情况了解清楚，再谈怎么管。`, hot: false });
    tips.push("家长和孩子一起玩「对照游戏」：各说各的理由，先对齐事实，再讨论方法。");
  }
  tips.push("每周留一次「不谈学习」的亲子时间；批评对事不对人，先肯定再提一个（只提一个）改进点。");
  return { conflicts, tips };
}

/** DISC 量尺归一（0–24）：V2 原值，V1 ×2。 */
function discNv(r: DiscResult, k: "D" | "I" | "S" | "C"): number {
  return (r.dims[k] ?? 0) * (r.version === 2 ? 1 : 2);
}

/**
 * 家长报告 tab：家长版专属报告——家庭支持与环境观察（家长卷）+ 家长认知对照 +
 * 亲子 DISC 冲突对照 + 冲突点清单与改进方案 + 答题明细。
 */
function ParentReportTab({
  student,
  parents,
  e3parent,
  raw,
}: {
  student: DiscResult | null;
  parents: { label: string; result: DiscResult }[];
  e3parent: E3V37ParentResult | null;
  raw?: RawAnswer[];
}) {
  if (parents.length === 0 && !e3parent) {
    return (
      <div className="space-y-4">
        <MissingCard
          text="家长报告还没有数据。它由两部分组成：① 家长卷（约 8 分钟，家庭支持与认知对照）；② 家长 DISC（24 组「最像我 / 最不像我」，约 4 分钟，可多位家长各测一次）。完成后这里会生成家庭支持对照、亲子冲突点清单与改进方案。"
          actionText="去测家长卷 →"
          to="/assessments?start=e3parent"
        />
        <MissingCard
          text="家长 DISC：对照孩子的行为风格，看沟通卡点出在哪里。"
          actionText="去测家长 DISC →"
          to="/assessments?start=discparent"
        />
      </div>
    );
  }
  const { conflicts, tips } = buildParentChildAnalysis(student, parents, e3parent);
  return (
    <div className="space-y-4">
      {/* ① 冲突点清单与改进方案（核心卡） */}
      <div className="paper-card accent-l border-terra/50 p-5">
        <h3 className="font-bold text-olive">亲子冲突点清单与改进方案</h3>
        <p className="mt-1 text-[12.5px] text-olive-mute">
          左边是家长和孩子「想不到一块」的地方（红色为最需要注意的），右边是照着就能做的改进办法。
        </p>
        <div className="mt-3 grid gap-3 lg:grid-cols-2">
          <div className="rounded-xl border border-terra/30 bg-terra/5 p-3.5">
            <div className="text-[13px] font-bold text-terra">冲突点清单 · {conflicts.length} 条</div>
            <ol className="mt-2 space-y-1.5">
              {conflicts.map((c, i) => (
                <li
                  key={i}
                  className={
                    c.hot
                      ? "rounded-lg bg-[#fbe3df] px-2.5 py-1.5 text-[12.5px] font-semibold leading-relaxed text-[#8f1313] ring-1 ring-[#b91c1c]/50"
                      : "text-[12.5px] leading-relaxed text-olive-soft"
                  }
                >
                  <b className={c.hot ? "text-[#8f1313]" : "text-olive"}>{i + 1}.</b> {c.text}
                </li>
              ))}
            </ol>
          </div>
          <div className="rounded-xl border border-lime/40 bg-lime-pale/50 p-3.5">
            <div className="text-[13px] font-bold text-olive">改进方案 · {tips.length} 条</div>
            <ol className="mt-2 space-y-1.5">
              {tips.map((t, i) => (
                <li key={i} className="text-[12.5px] leading-relaxed text-olive-soft">
                  <b className="text-olive">{i + 1}.</b> {t}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>

      {/* ② 家庭支持与环境观察（家长卷） */}
      {e3parent ? (
        <div className="paper-card p-5">
          <h3 className="font-bold text-olive">家庭支持与环境观察（家长卷）</h3>
          <p className="mt-1 text-[13px] leading-relaxed text-olive-soft">{e3parent.summary}</p>
          {e3parent.severeConflict && (
            <div className="mt-2.5 rounded-xl border border-[#8f1313]/40 bg-[#fbe3df] p-3 text-[12.5px] font-semibold text-[#8f1313]">
              !! 红线提醒：家庭近期出现严重亲子冲突信号——建议先修复关系，必要时寻求学校心理老师或专业机构支持。
            </div>
          )}
          <div className="mt-3 space-y-2">
            {e3parent.condView.map((cv) => (
              <div key={cv.key} className="rounded-xl border border-border/70 bg-cream/60 px-3.5 py-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-bold text-olive">{cv.label}</span>
                  <span className="chip !text-[11px]">家长观察：{cv.parentView}</span>
                  {cv.studentScore != null && (
                    <span
                      className="chip !text-[11px]"
                      style={
                        cv.studentLevel === "卡点"
                          ? { borderColor: "#b91c1c66", color: "#8f1313", background: "#fbe3df" }
                          : cv.studentLevel === "待提升"
                            ? { borderColor: "#c7a23a66", color: "#8a6d1a", background: "#f5e7c1" }
                            : { borderColor: "#7cb83c66", color: "#5a9326", background: "#f0f7dd" }
                      }
                    >
                      孩子自评 {cv.studentScore}/5 · {cv.studentLevel}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-[12.5px] leading-relaxed text-olive-soft">{cv.note}</p>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <MissingCard
          text="家长卷还没有填写（约 8 分钟）。填好后这里会给出家庭支持观察与家长—孩子认知对照。"
          actionText="去测家长卷 →"
          to="/assessments?start=e3parent"
        />
      )}

      {/* ③ 家长认知对照（观察 vs 孩子自评） */}
      {e3parent && (
        <div className="paper-card p-5">
          <h3 className="font-bold text-olive">家长认知对照</h3>
          <p className="mt-1 text-[12.5px] text-olive-mute">
            同一件事，家长怎么看、孩子自己怎么感觉，摆在一起对照（两边差 2 分以上列在这里，差得越多越红）；另有「不了解」{e3parent.unknownCount} 项（了解程度「{e3parent.unknownLevel}」）。
          </p>
          {e3parent.blindSpots.length === 0 ? (
            <p className="mt-3 rounded-xl bg-lime-pale/60 px-3.5 py-2.5 text-[13px] text-olive">
              无明显差异项——家长的观察与孩子的自评总体一致，认知同频。
            </p>
          ) : (
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {e3parent.blindSpots.map((b) => {
                const mirror = E3V37P_MIRROR_QUESTIONS.find((m) => m.key === b.key);
                const over = b.gap >= 2; // 家长打分高于孩子自评 = 家长更乐观
                const strong = Math.abs(b.gap) >= 3;
                return (
                  <div
                    key={b.key}
                    className={`rounded-xl border p-3.5 ${
                      strong ? "border-[#b91c1c]/50 bg-[#fbe3df]/60" : over ? "border-[#c7a23a]/50 bg-[#f5e7c1]/40" : "border-lime/40 bg-lime-pale/40"
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[13px] font-bold text-olive">{b.kp}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                          strong ? "bg-[#b91c1c] text-white" : over ? "bg-[#f5e7c1] text-[#8a6d1a]" : "bg-[#f0f7dd] text-[#5a9326]"
                        }`}
                      >
                        差 {Math.abs(b.gap)} 分 · {over ? "家长更乐观" : "家长没看到"}
                      </span>
                    </div>
                    {mirror && <p className="mt-1.5 text-[12px] leading-relaxed text-olive-mute">对照的事：{mirror.text}</p>}
                    <div className="mt-2 grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-white/70 px-2.5 py-1.5 text-center">
                        <div className="text-[11px] text-olive-mute">家长的估计</div>
                        <div className={`mono text-[16px] font-bold ${strong ? "text-[#8f1313]" : "text-olive"}`}>{b.parentScore}<span className="text-[11px] font-normal text-olive-mute"> /5</span></div>
                      </div>
                      <div className="rounded-lg bg-white/70 px-2.5 py-1.5 text-center">
                        <div className="text-[11px] text-olive-mute">孩子的实际感受</div>
                        <div className={`mono text-[16px] font-bold ${strong ? "text-[#8f1313]" : "text-olive"}`}>{b.studentScore}<span className="text-[11px] font-normal text-olive-mute"> /5</span></div>
                      </div>
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-olive-soft">
                      {over
                        ? "家长以为没问题，其实孩子觉得难——别只夸「你可以的」，先问问难在哪。"
                        : "孩子觉得自己做得不错，家长没看到——值得当面肯定一次。"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ④ 亲子 DISC 对照 */}
      {parents.length === 0 ? (
        <MissingCard
          text="家长 DISC 还没有测评（24 组「最像我 / 最不像我」，约 4 分钟），可多位家长各测一次——对照孩子的行为风格，看沟通卡点出在哪里。"
          actionText="去测家长 DISC →"
          to="/assessments?start=discparent"
        />
      ) : (
        <>
          {student && <DiscParentCompare student={student} parents={parents} />}
          {parents.map((p, i) => {
        const combo = getDiscCombo(p.result.dims);
        const report = DISC_REPORTS[p.result.primary];
        const style = PARENT_DISC_STYLE[p.result.primary];
        return (
          <div key={`${p.label}-${i}`} className="paper-card p-5">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="text-lg font-bold text-olive">{p.label}</span>
              <span className="text-[14px] font-bold text-olive">
                {combo.join("")} 型{report ? ` · ${report.name}` : ""}
              </span>
              <span className="text-[12px] text-olive-mute">{combo.map((k) => DISC_ANIMAL[k]).join(" + ")}</span>
              {p.result.version !== 2 && (
                <a
                  href="/assessments?start=discparent"
                  className="rounded-full border border-butter bg-butter/25 px-2.5 py-0.5 text-[11.5px] font-semibold text-olive-soft hover:border-lime/60"
                >
                  旧版题目 · 建议重测 →
                </a>
              )}
            </div>
            <div className="mt-3 space-y-1.5">
              {(["D", "I", "S", "C"] as const).map((k) => (
                <div key={k} className="flex items-center gap-2">
                  <span className={`w-10 shrink-0 text-[12px] ${combo.includes(k) ? "font-bold text-olive" : "text-olive-mute"}`}>{k}</span>
                  <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, (p.result.dims[k] / (p.result.version === 2 ? 24 : 12)) * 100)}%`,
                        background: combo.includes(k) ? "#c7a23a" : "#7cb83c",
                        opacity: combo.includes(k) ? 1 : 0.5,
                      }}
                    />
                  </div>
                  <span className="mono w-5 shrink-0 text-right text-[12px] text-olive-soft">{p.result.dims[k]}</span>
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-olive-soft">
              <p>
                <b className="text-olive">管教风格：</b>{p.label}偏 {p.result.primary} 型（{style.style}）。
              </p>
              {student && (
                <p>
                  <b className="text-olive">可能的冲突点：</b>孩子是 {getDiscCombo(student.dims).join("")} 型
                  {DISC_REPORTS[student.primary] ? `「${DISC_REPORTS[student.primary].name}」` : ""}——{style.risk[student.primary]}。
                </p>
              )}
              <p>
                <b className="text-olive">管教建议：</b>{style.tip}
              </p>
            </div>
          </div>
        );
          })}
          <p className="text-center text-[12px] text-olive-mute">可多位家长各测一次：让家长打开「测评中心 → 家长 DISC」分别填写。</p>
        </>
      )}

      {/* ⑤ 答题明细（家长卷 + 家长 DISC） */}
      {raw && raw.length > 0 && (
        <>
          <Fold title="答题明细 · 家长卷（点击展开）">
            <AnswerDetailsByKind raw={raw} kinds={["e3parent"]} />
          </Fold>
          <Fold title="答题明细 · 家长 DISC（点击展开）">
            <AnswerDetailsByKind raw={raw} kinds={["discparent"]} />
          </Fold>
        </>
      )}
    </div>
  );
}

const MULTI5_BAND_CLASS: Record<string, string> = {
  优秀: "border-lime/50 bg-lime-pale text-olive",
  良好: "border-lime/40 bg-lime-pale/60 text-olive",
  中等: "border-butter bg-butter/60 text-olive",
  待提升: "border-terra/40 bg-terra/10 text-terra",
};

function Multi5SubCard({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="mt-3">
      <h4 className="text-[13px] font-semibold text-olive">{title}</h4>
      <ul className="mt-1.5 space-y-1">
        {items.map((t, i) => (
          <li key={i} className="text-[13px] leading-relaxed text-olive-soft">
            · <RichText text={t} />
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 多元智能五项客观题测评详版。 */
function Multi5Detail({ result }: { result: Multi5Result }) {
  const report = useMemo(() => buildMulti5Report(result), [result]);
  const topDim = report.dims.find((d) => d.key === report.topKey)!;
  const radarData = report.dims.map((d) => ({ dim: d.label, 得分: d.score }));
  return (
    <div className="space-y-4">
      {/* 总览卡 */}
      <div className="paper-card accent-l border-lime p-5">
        <div className="flex items-center gap-2">
          <Puzzle size={16} className="text-olive" />
          <h3 className="font-bold text-olive">多元智能五项 · 客观题测评</h3>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-cream px-2.5 py-2.5 text-center">
            <div className="text-[11.5px] text-olive-mute">综合水平</div>
            <div className="mt-0.5 text-[17px] font-bold text-olive">{report.overall}</div>
            <div className="mt-0.5 text-[11px] text-olive-soft">五维均值</div>
          </div>
          <div className="rounded-xl bg-cream px-2.5 py-2.5 text-center">
            <div className="text-[11.5px] text-olive-mute">细心指数</div>
            <div className="mt-0.5 text-[17px] font-bold text-olive">{report.carefulIndex}%</div>
            <div className="mt-0.5 text-[11px] text-olive-soft">全卷正确率</div>
          </div>
          <div className="rounded-xl bg-cream px-2.5 py-2.5 text-center">
            <div className="text-[11.5px] text-olive-mute">最强维度</div>
            <div className="mt-0.5 text-[15px] font-bold text-olive">{topDim.label}</div>
            <div className="mt-0.5 text-[11px] text-olive-soft">{topDim.score} 分</div>
          </div>
        </div>
        <p className="mt-3 text-[12.5px] leading-relaxed text-olive-mute">{MULTI5_THEORY_NOTE}</p>
      </div>

      {/* 雷达图 */}
      <div className="paper-card p-5">
        <h3 className="font-bold text-olive">五维雷达（百分制）</h3>
        <p className="mt-1 text-[12.5px] text-olive-mute">每维 8 道客观题的正确率换算得分，越靠外越好。</p>
        <div className="mt-2 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radarData} outerRadius="72%">
              <PolarGrid stroke="#d9dcb8" />
              <PolarAngleAxis dataKey="dim" tick={{ fill: "#556339", fontSize: 12 }} />
              <Radar dataKey="得分" stroke="#7cb83c" fill="#7cb83c" fillOpacity={0.35} strokeWidth={2.5} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 五维卡片 */}
      {report.dims.map((d) => (
        <div key={d.key} className="paper-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-olive">{d.label}</h3>
            <span className={`chip !py-0.5 text-[11.5px] ${MULTI5_BAND_CLASS[d.band]}`}>{d.band}</span>
          </div>
          <div className="mt-2.5 flex items-center gap-3">
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
              <div className="h-full rounded-full bg-lime" style={{ width: `${d.score}%` }} />
            </div>
            <span className="mono shrink-0 text-[12.5px] text-olive-soft">{d.score} / 100</span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-olive-mute">{d.feature}</p>
          <Multi5SubCard title="评估结果" items={d.evalPoints} />
          <Multi5SubCard title="学习建议" items={d.studyAdvice} />
          <Multi5SubCard title="职业建议" items={d.careerAdvice} />
          <Multi5SubCard title="成长建议" items={d.growthAdvice} />
        </div>
      ))}
    </div>
  );
}

/** DISC 四因子纵向标尺图（参考专业 DISC 图示：四色纵列 + 分值落点 + 特征词）。 */
const DISC_TRAIT_WORDS: Record<"D" | "I" | "S" | "C", string[]> = {
  D: ["勇敢果断", "敢于冒险", "直截了当", "严格要求", "独立自主", "敏捷迅速", "自信满满", "勇于挑战"],
  I: ["热情奔放", "乐观开朗", "善于社交", "深具影响", "自我激励", "情感流露", "和蔼可亲", "自信自然"],
  S: ["忠诚可靠", "有始有终", "稳健安定", "合作无间", "含蓄稳重", "平静安详", "友善可亲", "积极主动"],
  C: ["追求完美", "细致完备", "系统逻辑", "有条不紊", "善于分析", "关注细节", "较高标准", "坚持己见"],
};
/** DISC 全量特征词表（对标专业词选式报告的 4×24 词阵）。 */
const DISC_WORD_GRID: Record<"D" | "I" | "S" | "C", string[]> = {
  D: ["自我中心", "强硬独断", "直截了当", "勇敢果断", "敢于冒险", "严格要求", "争先恐后", "身先士卒", "自信满满", "勇于挑战", "敏捷迅速", "独立自主", "精于计算", "深思熟虑", "理性客观", "谦恭有礼", "内向保守", "安静平和", "自制被动", "缺乏信心", "拘谨内敛", "易受控制", "谨小慎微", "自我怀疑"],
  I: ["感情用事", "冲动盲目", "情感流露", "热情奔放", "深具影响", "自我激励", "乐观开朗", "善于社交", "轻易信赖", "自信自然", "优雅大方", "和蔼可亲", "泰然自若", "若即若离", "不善言辞", "独处一隅", "不苟言笑", "实事求是", "亦步亦趋", "胆小腼腆", "手足无措", "自我防卫", "怀疑悲观", "抑郁孤僻"],
  S: ["被动消极", "一成不变", "忠诚可靠", "有始有终", "安于现状", "前后一致", "乐于跟随", "合作无间", "含蓄稳重", "稳健安定", "平静安详", "自得其乐", "友善可亲", "自然惬意", "外向活跃", "心思活络", "乐观其成", "创新求变", "警觉警惕", "坐立不安", "行为易变", "积极主动", "急躁不安", "鲁莽冲动"],
  C: ["吹毛求疵", "逃避推诿", "追求完美", "固守成规", "细致完备", "系统逻辑", "内敛敏感", "有条不紊", "善于分析", "较高标准", "关注细节", "流程导向", "独立自主", "不拘细节", "自有主张", "随心所欲", "坚持己见", "粗枝大叶", "敢于挑战", "不讲策略", "自以为是", "毫无章法", "公然违抗", "顽固不化"],
};
const DISC_COLOR: Record<"D" | "I" | "S" | "C", string> = {
  D: "#d44f3a",
  I: "#e8a33d",
  S: "#4e9e5f",
  C: "#3d8ec4",
};
function DiscTendencyChart({ dims, max = 12 }: { dims: Record<"D" | "I" | "S" | "C", number>; max?: number }) {
  const keys: ("D" | "I" | "S" | "C")[] = ["D", "I", "S", "C"];
  const combo = getDiscCombo(dims);
  const MAX = max; // 单因子满分：V1 旧版 12（24 题 ÷ 4 因子 × 2）；V2 新版 24
  return (
    <div className="paper-card p-5">
      <h3 className="font-bold text-olive">行为之镜 · DISC 四因子倾向</h3>
      <p className="mt-1 text-[12.5px] text-olive-mute">
        落点越高，该行为因子越明显；彩色徽章为你的主因子组合（{combo.join("")} 型）。每列下方是该因子的典型特征词。
      </p>
      <div className="mt-4 grid grid-cols-4 gap-2 sm:gap-3">
        {keys.map((k) => {
          const v = dims[k] ?? 0;
          const inCombo = combo.includes(k);
          const color = DISC_COLOR[k];
          const name = DISC_THEORY.find((t) => t.type === k)?.name ?? "";
          return (
            <div key={k} className="flex flex-col items-center">
              <span
                className={`mb-2 rounded-full px-2 py-0.5 text-[11.5px] font-bold text-white ${inCombo ? "" : "opacity-45"}`}
                style={{ background: color }}
              >
                {k} · {name} {v}
              </span>
              <div className="relative h-36 w-full max-w-[72px] overflow-hidden rounded-lg border border-border bg-cream-deep/50">
                {[25, 50, 75].map((g) => (
                  <div key={g} className="absolute left-0 right-0 border-t border-dashed border-olive-mute/25" style={{ bottom: `${g}%` }} />
                ))}
                <div className="absolute bottom-0 left-1/2 h-full w-[3px] -translate-x-1/2 rounded" style={{ background: `${color}33` }} />
                <div
                  className="absolute left-1/2 h-4 w-4 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-white shadow"
                  style={{ bottom: `${(v / MAX) * 100}%`, background: color }}
                  title={`${k} ${v} 分`}
                />
              </div>
              <div
                className={`mt-2 w-full rounded-lg border p-1.5 text-center text-[10.5px] leading-[1.7] ${
                  inCombo ? "border-border bg-cream text-olive-soft" : "border-border/60 bg-cream/60 text-olive-mute"
                }`}
              >
                {DISC_TRAIT_WORDS[k].map((w, i) => (
                  <span key={w}>
                    {w}
                    {i < DISC_TRAIT_WORDS[k].length - 1 && <span className="text-olive-mute/50"> · </span>}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      {/* 全量特征词阵：四个因子列各按本色高亮最典型的 5 个特征词（主因子组合列颜色更深） */}
      <div className="mt-4 overflow-hidden rounded-xl border border-border">
        <div className="grid grid-cols-4">
          {keys.map((k) => (
            <div key={k} className="py-1.5 text-center text-[13px] font-bold text-white" style={{ background: DISC_COLOR[k] }}>
              {k}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-4">
          {keys.map((k) => {
            const inCombo = combo.includes(k);
            // 按该因子的实际得分定位：词阵从上到下 = 该因子最强→最弱，
            // 得分越高，高亮区越靠上；以得分对应位置为中心取 5 个词，主因子列底色更深
            const v = dims[k] ?? 0;
            const center = Math.round((1 - v / MAX) * (DISC_WORD_GRID[k].length - 1));
            const hiStart = Math.max(0, Math.min(DISC_WORD_GRID[k].length - 5, center - 2));
            const hiCount = 5;
            return (
              <div key={k} className="border-r border-border last:border-r-0">
                {DISC_WORD_GRID[k].map((w, wi) => {
                  const hit = wi >= hiStart && wi < hiStart + hiCount;
                  return (
                    <div
                      key={w}
                      className="border-b border-border/60 px-1 py-[3px] text-center text-[11px] leading-tight"
                      style={
                        hit
                          ? { background: `${DISC_COLOR[k]}${inCombo ? "40" : "22"}`, color: "#35421e", fontWeight: inCombo ? 800 : 600 }
                          : { color: "#8b9468" }
                      }
                    >
                      {w}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
      <p className="mt-1.5 text-[11px] text-olive-mute">
        每列词从上到下按该因子最强到最弱排列；高亮的 5 个词按你的实际得分定位（得分越高越靠上），主因子组合（{combo.join("")} 型）对应列底色更深。仅供对照理解，不代表逐词实测。
      </p>
      <p className="mt-3 text-[12px] text-olive-mute">
        四因子得分：D {dims.D} ｜ I {dims.I} ｜ S {dims.S} ｜ C {dims.C}（各 0-12 分，总分 24）。类型没有好坏，只代表当前状态下的行为倾向。
      </p>
    </div>
  );
}

/** 多元智能五项（客观题）五维雷达。 */
function Multi5Radar({ multi5 }: { multi5: Multi5Result }) {
  return (
    <div className="paper-card p-5">
      <h3 className="font-bold text-olive">多元智能五项 · 五维雷达（客观题）</h3>
      <p className="mt-1 text-[12.5px] text-olive-mute">
        五维正确率得分（百分制，客观作答）；细心指数 {multi5.carefulIndex}%（全卷正确率）。单项低于 60 分标红，需要专项练。
      </p>
      <div className="mt-2 h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={MULTI5_DIM_ORDER.map((k) => ({ dim: `${MULTI5_DIM_LABEL[k]} ${multi5.dims[k]}`, 得分: multi5.dims[k] }))} outerRadius="72%">
            <PolarGrid stroke="#d9dcb8" />
            <PolarAngleAxis
              dataKey="dim"
              tick={({ x, y, payload }: any) => {
                const v = Number(String(payload.value).split(" ").pop());
                return (
                  <text x={x} y={y} textAnchor="middle" fontSize={12} fill={v < 60 ? "#b91c1c" : "#556339"} fontWeight={v < 60 ? 700 : 400}>
                    {payload.value}
                  </text>
                );
              }}
            />
            <Radar dataKey="得分" stroke="#7cb83c" fill="#7cb83c" fillOpacity={0.35} strokeWidth={2.5} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** 霍兰德六型雷达。 */
function HollandRadar({ holland }: { holland: HollandResult }) {
  return (
    <div className="paper-card p-5">
      <h3 className="font-bold text-olive">霍兰德职业兴趣 · 六型雷达</h3>
      <p className="mt-1 text-[12.5px] text-olive-mute">
        兴趣代码 <b className="text-olive">{holland.code}</b>：六型均分（1-5），外凸最明显的就是你的主导兴趣方向。
      </p>
      <div className="mt-2 h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={HOLLAND_ORDER.map((k) => ({ dim: `${k}·${HOLLAND_LABEL[k]} ${holland.dims[k]}`, 得分: holland.dims[k] }))} outerRadius="72%">
            <PolarGrid stroke="#d9dcb8" />
            <PolarAngleAxis dataKey="dim" tick={{ fill: "#556339", fontSize: 11.5 }} />
            <Radar dataKey="得分" stroke="#cf6a3c" fill="#cf6a3c" fillOpacity={0.3} strokeWidth={2.5} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** 心理健康 V2（PHQ-9 + GAD-7）双量表条形卡：分级口径 0-4 良好 / 5-9 关注 / 10-14 预警 / ≥15 高风险。 */
function MentalV2Bars({
  mental,
  variant = "v2",
}: {
  mental: MentalV2Result | MentalPaResult;
  /** v2=通用版（PHQ-9）；pa=学生版 B（PHQ-A + GAD-7 学生化）。 */
  variant?: "v2" | "pa";
}) {
  const BAND_COLOR: Record<string, string> = { 良好: "#7cb83c", 关注: "#c7a23a", 预警: "#cf6a3c", 高风险: "#b91c1c" };
  const isPa = variant === "pa";
  const rows = [
    { label: isPa ? "PHQ-A 青少年抑郁筛查" : "PHQ-9 抑郁筛查", value: mental.phq9, max: 27, band: mental.phq9Level },
    { label: isPa ? "GAD-7 焦虑筛查 · 学生版" : "GAD-7 焦虑筛查", value: mental.gad7, max: 21, band: mental.gad7Level },
  ];
  return (
    <div className="paper-card p-5">
      <h3 className="font-bold text-olive">{isPa ? "心理健康 · 学生版 B（PHQ-A + GAD-7 学生版）" : "心理健康 · 通用版（PHQ-9 + GAD-7）"}</h3>
      <p className="mt-1 text-[12.5px] text-olive-mute">
        国际通用筛查量表{isPa ? `（${MENTAL_PA_AGE}）` : ""}（0-4 良好 / 5-9 关注 / 10-14 预警 / ≥15 高风险）；综合分级：
        <b className="text-olive">{mental.level}</b>（筛查参考，非诊断）。
      </p>
      <div className="mt-3 space-y-2.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-2">
            <span className="w-32 shrink-0 text-[12.5px] font-medium text-olive">{r.label}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(3, Math.min(100, (r.value / r.max) * 100))}%`, background: BAND_COLOR[r.band] }}
              />
            </div>
            <span className="mono w-24 shrink-0 text-right text-[12px] font-bold" style={{ color: BAND_COLOR[r.band] }}>
              {r.value}/{r.max} · {r.band}
            </span>
          </div>
        ))}
      </div>
      {mental.selfHarm && (
        <div className="mt-3 rounded-xl border border-[#b91c1c]/50 bg-[#fbe3df] p-3">
          <div className="text-[12.5px] font-bold text-[#8f1313]">⚠ 需要立即关注的信号</div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#8f1313]">{MENTAL_V2_ITEM9_NOTICE}主动求助是勇敢，不是软弱。</p>
        </div>
      )}
      <p className="mt-3 text-[11.5px] leading-relaxed text-olive-mute">{isPa ? MENTAL_PA_DISCLAIMER : MENTAL_V2_DISCLAIMER}</p>
    </div>
  );
}

/** 学生版 A（SDQ）五维度条形图。 */
function MentalSdqBars({ mental }: { mental: MentalSdqResult }) {
  const BAND_COLOR: Record<string, string> = { 正常: "#7cb83c", 边缘: "#c7a23a", 明显: "#b91c1c" };
  const dims = ["emotion", "conduct", "hyper", "peer", "prosocial"] as const;
  return (
    <div className="paper-card p-5">
      <h3 className="font-bold text-olive">心理健康 · 学生版 A（SDQ 长处与困难问卷）</h3>
      <p className="mt-1 text-[12.5px] text-olive-mute">
        国际通用的儿童青少年行为筛查（{MENTAL_SDQ_AGE}）；困难总分：
        <b className="text-olive">{mental.totalDiff}/40「{mental.totalBand}」</b>（0-15 正常 / 16-19 边缘 / 20-40 明显），综合分级：
        <b className="text-olive">{mental.level}</b>（筛查参考，非诊断）。
      </p>
      <div className="mt-3 space-y-2.5">
        {dims.map((k) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-32 shrink-0 text-[12.5px] font-medium text-olive">
              {SDQ_DIM_LABEL[k]}
              {k === "prosocial" && <span className="ml-1 text-[10.5px] text-olive-mute">（优势）</span>}
            </span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
              <div
                className="h-full rounded-full"
                style={{ width: `${Math.max(3, (mental.dims[k] / 10) * 100)}%`, background: BAND_COLOR[mental.dimBands[k]] }}
              />
            </div>
            <span className="mono w-24 shrink-0 text-right text-[12px] font-bold" style={{ color: BAND_COLOR[mental.dimBands[k]] }}>
              {mental.dims[k]}/10 · {mental.dimBands[k]}
            </span>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11.5px] text-olive-mute">亲社会行为是优势维度（分越高越好）；其余四维与困难总分越低越好。</p>
      {mental.selfHarm && (
        <div className="mt-3 rounded-xl border border-[#b91c1c]/50 bg-[#fbe3df] p-3">
          <div className="text-[12.5px] font-bold text-[#8f1313]">⚠ 需要立即关注的信号</div>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#8f1313]">{MENTAL_SDQ_SAFETY_NOTICE}主动求助是勇敢，不是软弱。</p>
        </div>
      )}
      <p className="mt-3 text-[11.5px] leading-relaxed text-olive-mute">{MENTAL_SDQ_DISCLAIMER}</p>
    </div>
  );
}

/** 分数总指南卡：量表分数怎么看（三种量表共用，mental tab 顶部展示一次）。 */
function MentalScoreGuideCard() {
  return (
    <div className="paper-card border-lime/50 bg-lime-pale/40 p-5">
      <h3 className="font-bold text-olive">这些分数怎么看？</h3>
      <p className="mt-2 text-[13px] leading-relaxed text-olive-soft">{MENTAL_SCORE_GUIDE}</p>
    </div>
  );
}

/** 分级总表卡：PHQ-9/PHQ-A/GAD-7 四级各自意味着什么。 */
function MentalBandGuideCard({ title }: { title: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-cream/60 p-3.5">
      <div className="text-[12.5px] font-bold text-olive">{title}</div>
      <ul className="mt-1.5 space-y-1.5">
        {MENTAL_V2_BAND_GUIDE.map((g) => (
          <li key={g.band} className="text-[12.5px] leading-relaxed text-olive-soft">
            <b className="text-olive">{g.band}：</b>
            {g.meaning}
            <span className="text-olive-mute">——{g.action}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** SDQ 维度说明卡：每个观测点观察什么 + 分数含义 + 建议。 */
function SdqDimExplainCard({ mental }: { mental: MentalSdqResult }) {
  const dims = ["emotion", "conduct", "hyper", "peer", "prosocial"] as const;
  return (
    <div className="paper-card p-5">
      <h3 className="font-bold text-olive">学生版 A · 每个观测点在观察什么</h3>
      <p className="mt-1 text-[12.5px] text-olive-mute">SDQ 把孩子的状态拆成五个观察面；下面逐面说明它观察什么、分数代表什么。</p>
      <div className="mt-3 space-y-2.5">
        {dims.map((k) => {
          const ex = SDQ_DIM_EXPLAIN[k];
          return (
            <div key={k} className="rounded-xl border border-border/70 bg-cream/60 p-3.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[13px] font-bold text-olive">{SDQ_DIM_LABEL[k]}</span>
                <span
                  className={`rounded-full border px-2 py-px text-[11px] font-semibold ${
                    mental.dimBands[k] === "正常"
                      ? "border-lime/50 bg-lime-pale text-[#5a9326]"
                      : mental.dimBands[k] === "边缘"
                        ? "border-[#c7a23a]/70 bg-[#f5e7c1] text-[#8a6d1a]"
                        : "border-[#b91c1c]/50 bg-[#fbe3df] text-[#8f1313]"
                  }`}
                >
                  本次 {mental.dims[k]}/10「{mental.dimBands[k]}」
                </span>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-olive-soft">
                <b className="text-olive">观察什么：</b>{ex.observe}
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-olive-soft">
                <b className="text-olive">分数代表什么：</b>{ex.meaning}
              </p>
              <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-[12.5px] leading-relaxed text-olive-soft">
                {ex.advice.map((a, i) => (
                  <li key={i}>{a}</li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      <div className="mt-3 rounded-xl border border-border/70 bg-cream/60 p-3.5">
        <div className="text-[12.5px] font-bold text-olive">「正常 / 边缘 / 明显」分别意味着什么</div>
        <ul className="mt-1.5 space-y-1">
          {MENTAL_SDQ_BAND_GUIDE.map((g) => (
            <li key={g.band} className="text-[12.5px] leading-relaxed text-olive-soft">
              <b className="text-olive">{g.band}：</b>
              {g.meaning}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

/** PHQ-9 / PHQ-A + GAD-7 逐观测点说明卡（通用版与学生版 B 共用）。 */
function PhqGadExplainCard({ variant, selfHarm }: { variant: "v2" | "pa"; selfHarm: boolean }) {
  const phqTitle = variant === "pa" ? "PHQ-A 九个观测点" : "PHQ-9 九个观测点";
  return (
    <div className="paper-card p-5">
      <h3 className="font-bold text-olive">{variant === "pa" ? "学生版 B" : "通用版"} · 每道题在观察什么</h3>
      <p className="mt-1 text-[12.5px] text-olive-mute">
        {variant === "pa"
          ? `PHQ-A 是青少年抑郁筛查（PHQ-9 的青少年版），GAD-7 看焦虑；每道题对应一个观测点，0=完全不会 / 1=好几天 / 2=超过一半的天数 / 3=几乎天天，分数就是「过去两周这个状态出现的频率」。`
          : `PHQ-9 看抑郁、GAD-7 看焦虑；每道题对应一个观测点，0=完全不会 / 1=好几天 / 2=超过一半的天数 / 3=几乎天天，分数就是「过去两周这个状态出现的频率」。`}
      </p>
      <div className="mt-3 grid gap-2.5 lg:grid-cols-2">
        <div className="rounded-xl border border-border/70 bg-cream/60 p-3.5">
          <div className="text-[12.5px] font-bold text-olive">{phqTitle}</div>
          <ul className="mt-1.5 space-y-1.5">
            {PHQ9_ITEM_EXPLAIN.map((it, i) => (
              <li key={i} className="text-[12.5px] leading-relaxed text-olive-soft">
                <b className={i === 8 && selfHarm ? "text-[#8f1313]" : "text-olive"}>
                  第 {i + 1} 题{i === 8 ? "（红线）" : ""}：
                </b>
                {it.text}——{it.observe}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-xl border border-border/70 bg-cream/60 p-3.5">
          <div className="text-[12.5px] font-bold text-olive">GAD-7 七个观测点</div>
          <ul className="mt-1.5 space-y-1.5">
            {GAD7_ITEM_EXPLAIN.map((it, i) => (
              <li key={i} className="text-[12.5px] leading-relaxed text-olive-soft">
                <b className="text-olive">第 {i + 10} 题：</b>
                {it.text}——{it.observe}
              </li>
            ))}
          </ul>
          <div className="mt-2.5">
            <MentalBandGuideCard title="综合分级意味着什么" />
          </div>
        </div>
      </div>
    </div>
  );
}

/** 旧版 V1 心理健康十因子条形图（历史数据兼容展示）。 */
function MentalBar({ mental }: { mental: MentalResult }) {
  return (
    <div className="paper-card p-5">
      <h3 className="font-bold text-olive">心理健康 · 十因子均分</h3>
      <p className="mt-1 text-[12.5px] text-olive-mute">
        各因子均分（1-5），绿色为正常，红色为超过阳性线（2 分）需温柔关注；当前整体状态：<b className="text-olive">{mental.level}</b>。
      </p>
      <div className="mt-2" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={MENTAL_FACTOR_ORDER.map((f) => ({
              name: MENTAL_FACTOR_LABEL[f],
              得分: mental.factors[f],
            }))}
            layout="vertical"
            barSize={12}
            margin={{ left: 8, right: 40 }}
          >
            <XAxis type="number" domain={[0, 5]} tick={{ fill: "#8b9468", fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis type="category" dataKey="name" width={88} tick={{ fill: "#556339", fontSize: 12 }} axisLine={false} tickLine={false} />
            <ReferenceLine x={2} stroke="#cf6a3c" strokeDasharray="6 4" label={{ value: "阳性线 2", position: "top", fontSize: 10.5, fill: "#cf6a3c" }} />
            <Bar dataKey="得分" radius={[0, 6, 6, 0]}>
              {MENTAL_FACTOR_ORDER.map((f) => (
                <Cell key={f} fill={mental.factors[f] > 2 ? "#cf6a3c" : "#7cb83c"} />
              ))}
              <LabelList
                dataKey="得分"
                position="right"
                style={{ fontSize: 11, fill: "#556339" }}
                formatter={(v: number) => {
                  const s = v > 2 ? (v >= 3 ? "重度" : v >= 2.5 ? "中度" : "轻度") : "";
                  return s ? `${v}（${s}）` : `${v}`;
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** 报告视图：学生端（/report-detail）与伴学师端共用。数据全部经 props 传入，本组件不发起任何 trpc 请求。 */
export default function ReportView({
  data,
  profile,
  viewer,
  onEditAcademics,
}: {
  data: ReportAssessmentData | undefined;
  profile?: ReportProfileInfo;
  viewer: "student" | "tutor";
  /** tutor 模式且提供时，成绩 tab 显示「帮TA填写/修改」按钮 */
  onEditAcademics?: () => void;
}) {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const tab: Tab = (params.get("tab") as Tab) || "combined";
  /* tutor 模式没有「我的档案」tab */
  const tabs = viewer === "tutor" ? TABS.filter((t) => t.key !== "profile") : TABS;

  /** V3.7 判定：有 e3 但不是 V3.7 结果 → 旧版数据，提示重测。 */
  const e3v37 = isE3V37Result(data?.e3) ? data.e3 : null;
  const e3Legacy = !!data?.e3 && !isE3V37Result(data.e3);
  // 支持 ?view=lite 直达简版（冒烟/深链）
  const [combinedView, setCombinedView] = useState<"full" | "lite">(params.get("view") === "lite" ? "lite" : "full");
  /* 兜底：用户直接 Ctrl+P / 系统菜单打印时，也自动展开所有折叠块，保证 PDF 完整 */
  useEffect(() => {
    let closed: Element[] = [];
    const openAll = () => {
      closed = Array.from(document.querySelectorAll("#report-print-root details:not([open])"));
      closed.forEach((d) => d.setAttribute("open", ""));
    };
    const restore = () => closed.forEach((d) => d.removeAttribute("open"));
    window.addEventListener("beforeprint", openAll);
    window.addEventListener("afterprint", restore);
    return () => {
      window.removeEventListener("beforeprint", openAll);
      window.removeEventListener("afterprint", restore);
    };
  }, []);
  const parentResult = isE3V37ParentResult(data?.e3parent) ? data.e3parent : null;
  /** 家长 DISC（latest 字段，类型 any 兜底读取）。 */
  const discParents = useMemo<{ label: string; result: DiscResult; createdAt?: Date | string }[]>(() => {
    const v = (data as any)?.discParents;
    return Array.isArray(v) ? v.filter((p) => p && p.result && p.result.dims) : [];
  }, [data]);
  const mentalSdq = data?.mentalSdq ?? undefined;
  const mentalPa = data?.mentalPa ?? undefined;
  const combined = useMemo<CombinedReport | null>(() => {
    if (!data?.mbti || !data?.disc || !e3v37) return null;
    const mr = MBTI_REPORTS[data.mbti.type];
    const dr = DISC_REPORTS[data.disc.primary];
    if (!mr || !dr) return null;
    return buildCombinedReport(data.mbti, mr, data.disc, dr, e3v37, {
      academics: profile?.academics ?? undefined,
      multi5: data.multi5 ?? undefined,
      anchor: data.anchor ?? undefined,
      holland: data.holland ?? undefined,
      mental: data.mental ?? undefined,
      mentalSdq: mentalSdq ?? undefined,
      mentalPa: mentalPa ?? undefined,
      e3parent: parentResult ?? undefined,
      discParents,
    });
  }, [data, profile, e3v37, parentResult, discParents]);

  /** E3 V3.7 最新一次作答的 70 题原始评分（附录逐题表用；长度 70 才有效）。 */
  const e3Ratings = useMemo<number[] | null>(() => {
    const raw = data?.raw?.find((r) => r.kind === "e3")?.answers as
      | { stage?: E3V37Stage; ratings?: number[] }
      | null
      | undefined;
    if (!raw || !Array.isArray(raw.ratings) || raw.ratings.length !== E3V37_RATING_COUNT) return null;
    return raw.ratings;
  }, [data]);

  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true });
  const goCombined = () => setTab("combined");

  /**
   * V36 报告内动作：
   * - assess：未测评 → 测评中心直达对应答题；
   * - fill-academics：学生→「我的档案」填成绩，伴学师→打开成绩编辑。
   */
  const reveal = (t: RevealTarget) => {
    if (t.kind === "assess") {
      navigate(`/assessments?start=${t.start}`);
      return;
    }
    if (viewer === "tutor") onEditAcademics?.();
    else setTab("profile");
  };

  /** 框架图节点点击：未测 → 直达测评；成绩未填 → 去填写（已测节点为纯展示，不可点）。 */
  const openFramework = (l: FrameworkLink) => {
    if (l.kind === "assess") reveal({ kind: "assess", start: l.start });
    else reveal({ kind: "fill-academics" });
  };

  /** 当前 tab 是否已有可下载的数据。 */
  const canDownload = useMemo(() => {
    if (tab === "e3") return !!e3v37;
    if (tab === "mbti") return !!(data?.mbti && MBTI_REPORTS[data.mbti.type]);
    if (tab === "disc") return !!(data?.disc && DISC_REPORTS[data.disc.primary]);
    if (tab === "multi5") return !!data?.multi5;
    if (tab === "parent" || tab === "discparent") return discParents.length > 0 || !!parentResult; // window.print 直接可用
    if (tab === "academics" || tab === "profile") return false; // 档案/成绩 tab 不提供下载
    if (tab === "anchor" || tab === "holland") return !!(data as any)?.[tab];
    if (tab === "mental") return !!(data?.mental || data?.mentalSdq || data?.mentalPa);
    return !!combined;
  }, [tab, data, combined, e3v37, discParents]);

  /** 下载当前 tab 的报告：直接调浏览器打印当前页面（所见即所得，PDF 与网页完全一致，图表不变形）。
   *  用户在打印对话框里选「另存为 PDF」即可。打印时通过 document.title 带入报告名作为默认文件名。 */
  const onDownload = () => {
    const TAB_TITLE: Record<Tab, string> = {
      e3: "学业诊断报告（三阶九能 V3.7）",
      profile: "我的档案", // 该 tab 不提供下载，仅兜底
      mbti: "MBTI 性格详版报告",
      disc: "DISC 行为详版报告",
      multi5: "多元智能五项测评报告",
      academics: "成绩现状及目标分数", // 该 tab 不提供下载，仅兜底
      anchor: "职业锚测评报告",
      holland: "霍兰德职业兴趣测评报告",
      mental: "心理健康评估报告",
      discparent: "家长报告（亲子对照与沟通建议）",
      parent: "家长报告（亲子对照与沟通建议）",
      combined: "综合学习力报告",
    };
    const prevTitle = document.title;
    document.title = `${profile?.name ? `${profile.name} - ` : ""}${TAB_TITLE[tab]}`;
    /* 打印前强制展开所有折叠块（否则 PDF 里折叠内容是空的），打印后恢复原状 */
    const root = document.getElementById("report-print-root");
    const closedFolds = Array.from(root?.querySelectorAll("details:not([open])") ?? []);
    closedFolds.forEach((d) => d.setAttribute("open", ""));
    const restore = () => {
      document.title = prevTitle;
      closedFolds.forEach((d) => d.removeAttribute("open"));
      window.removeEventListener("afterprint", restore);
    };
    window.addEventListener("afterprint", restore);
    window.print();
  };

  const { mbti, disc, multi5 } = data ?? {};
  const multi = data?.multi ?? undefined;
  const anchor = data?.anchor ?? undefined;
  const holland = data?.holland ?? undefined;
  const mental = data?.mental ?? undefined;
  const academics = profile?.academics ?? undefined;

  /** 学习力系统框架图的测评完成状态 + 二级考察点（全部由 props 数据计算，学生端/伴学师端口径一致）。 */
  const frameworkStatus = useMemo<FrameworkStatus>(() => {
    const r1 = (x: number) => Math.round(x * 10) / 10;
    /** 逐题分按关注点（kp）聚合成二级考察点：均分 + 三档。 */
    const groupKp = (items: { kp: string; score: number }[]): FrameworkFocus[] => {
      const map = new Map<string, { sum: number; n: number }>();
      for (const it of items) {
        const g = map.get(it.kp);
        if (g) {
          g.sum += it.score;
          g.n += 1;
        } else map.set(it.kp, { sum: it.score, n: 1 });
      }
      return [...map.entries()].map(([kp, g]) => {
        const score = r1(g.sum / g.n);
        return { kp, score, level: e3v37Level(score) };
      });
    };
    const itemScores = e3v37 && e3Ratings ? scoreE3V37Items(e3v37.stage, e3Ratings) : [];
    const units: Record<string, FrameworkUnit> = {};
    if (e3v37) {
      for (const a of e3v37.abilities)
        units[a.label] = {
          score: a.score,
          level: a.level,
          focuses: a.focuses.map((f) => ({ kp: f.kp, score: f.score, level: f.level })),
        };
      for (const c of e3v37.systems.condition.cells)
        units[c.label] = {
          score: c.score,
          level: c.level,
          focuses: groupKp(itemScores.filter((it) => it.ability === c.label)),
        };
      for (const a of e3v37.aptitude)
        units[a.label] = {
          score: a.score,
          level: a.level,
          focuses: itemScores
            .filter((it) => it.system === "学能" && it.ability === a.label)
            .map((it) => ({ kp: `第${it.no}题`, score: it.score, level: it.level })),
        };
    }
    return {
      academics: {
        filled: !!academics && academics.subjects.length > 0,
        note: academics?.examName || undefined,
        subjects: academics?.subjects.map((s) => ({ name: s.name, last: s.lastScore, target: s.targetScore })),
      },
      e3: e3v37
        ? {
            done: true,
            scores: Object.fromEntries(e3v37.systems.core.map((c) => [c.key, c.score])) as Record<"乐学" | "会学" | "善学", number>,
            conditionAvg: r1(
              e3v37.systems.condition.cells.reduce((s, c) => s + c.score, 0) / Math.max(1, e3v37.systems.condition.cells.length),
            ),
            aptitudeAvg: r1(e3v37.aptitude.reduce((s, a) => s + a.score, 0) / Math.max(1, e3v37.aptitude.length)),
            units,
          }
        : { done: false },
      mental:
        mental || mentalSdq || mentalPa
          ? {
              done: true,
              note: [
                mentalSdq ? `SDQ「${mentalSdq.level}」` : "",
                mentalPa ? `学生版B「${mentalPa.level}」` : "",
                mental ? `通用版「${mental.level}」` : "",
              ]
                .filter(Boolean)
                .join(" · "),
            }
          : { done: false },
      multi5: multi5
        ? {
            done: true,
            note: `综合 ${multi5.overall} · 细心 ${multi5.carefulIndex}%`,
            subs: MULTI5_DIM_ORDER.map((k) => `${MULTI5_DIM_LABEL[k]} ${multi5.dims[k]}`),
          }
        : { done: false },
      multi: multi ? { done: true, note: multi.top3.map((k) => MULTI_DIM_LABEL[k]).join("、") } : { done: false },
      mbti: mbti
        ? {
            done: true,
            note: mbti.type,
            subs: (["EI", "SN", "TF", "JP"] as const).map((p) => {
              const [a, b] = p.split("") as [keyof typeof mbti.dims, keyof typeof mbti.dims];
              return `${a}${mbti.dims[a]}·${b}${mbti.dims[b]}`;
            }),
          }
        : { done: false },
      disc: disc
        ? {
            done: true,
            note: `${getDiscCombo(disc.dims).join("")} 型`,
            subs: (["D", "I", "S", "C"] as const).map((k) => `${k} ${disc.dims[k]}`),
          }
        : { done: false },
      holland: holland
        ? {
            done: true,
            note: holland.code,
            subs: HOLLAND_ORDER.map((k) => `${HOLLAND_LABEL[k]} ${holland.dims[k].toFixed(1)}`),
          }
        : { done: false },
      anchor: anchor
        ? {
            done: true,
            note: anchor.top2.map((k) => ANCHOR_LABEL[k]).join("、"),
            subs: anchor.top2.map((k) => `${ANCHOR_LABEL[k]} ${anchor.dims[k].toFixed(1)}`),
          }
        : { done: false },
    };
  }, [academics, e3v37, e3Ratings, mental, multi5, multi, mbti, disc, holland, anchor]);

  return (
    <div className="space-y-4">
      {viewer === "student" && (
        <button
          onClick={() => navigate("/assessments")}
          className="flex items-center gap-1.5 text-[13px] text-olive-mute hover:text-olive"
        >
          <ArrowLeft size={14} /> 返回测评中心
        </button>
      )}

      {/* 报告署名条：所有报告都写明是谁的报告 */}
      {profile?.name && (
        <div className="paper-card flex items-center gap-2 border-lime/50 bg-lime-pale/50 px-4 py-2.5">
          <span className="text-[13px] font-bold text-olive">{profile.name} 的测评报告</span>
          <span className="text-[12px] text-olive-mute">
            · 当前栏目：{tabs.find((t) => t.key === tab)?.label ?? ""}（下载的报告中同样署名）
          </span>
        </div>
      )}

      {/* Tab 切换 */}
      <div className="flex flex-wrap gap-1 rounded-xl bg-cream-deep p-1">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`grow basis-[30%] rounded-lg px-2 py-2 text-[12.5px] font-semibold transition ${
              tab === t.key ? "bg-cream text-olive shadow-sm" : "text-olive-mute"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* 下载当前 tab 的报告 */}
      {canDownload && (
        <button
          onClick={onDownload}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-lime/60 bg-lime-pale py-2.5 text-[13.5px] font-semibold text-olive transition-colors hover:bg-lime/20"
        >
          <Download size={15} />
          下载报告（可另存为 PDF）
        </button>
      )}

      {/* 打印根：window.print() 时仅显示此区域，保证 PDF 与页面所见完全一致 */}
      <div id="report-print-root" className="space-y-4">
      {tab === "profile" && viewer === "student" && (
        <div className="space-y-4">
          <ProfileCard />
          <AcademicsForm />
        </div>
      )}

      {tab === "academics" &&
        (!academics || academics.subjects.length === 0 ? (
          viewer === "tutor" ? (
            <div className="paper-card p-5">
              <h3 className="font-bold text-olive">内容还差一点点</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-olive-mute">学员还没有填写成绩与目标。</p>
              {onEditAcademics && (
                <button
                  onClick={onEditAcademics}
                  className="mt-3 rounded-xl bg-olive px-4 py-2 text-[13px] font-semibold text-cream hover:bg-lime-deep"
                >
                  帮TA填写 →
                </button>
              )}
            </div>
          ) : (
            <MissingCard
              text="还没有填写各科成绩与目标。先在「我的档案」里补全学业信息，这里就能看到每科的差距。"
              actionText="去我的档案填写 →"
              to="/report-detail?tab=profile"
            />
          )
        ) : (
          <div className="space-y-4">
            <div className="paper-card accent-l border-lime p-5">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-olive" />
                <h3 className="font-bold text-olive">成绩现状及目标分数</h3>
              </div>
              <p className="mt-1.5 text-[13px] text-olive-mute">
                {academics.examName ? `最近大考：${academics.examName} · ` : ""}
                目标分数是你和自己定的约定，按节奏靠近就好。
              </p>
            </div>
            <div className="paper-card overflow-hidden p-0">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-border bg-cream/70 text-left text-[12px] text-olive-mute">
                    <th className="px-3.5 py-2.5 font-medium">科目</th>
                    <th className="px-3.5 py-2.5 font-medium">自评水平</th>
                    <th className="px-3.5 py-2.5 font-medium">最近分</th>
                    <th className="px-3.5 py-2.5 font-medium">目标分</th>
                    <th className="px-3.5 py-2.5 font-medium">差距</th>
                  </tr>
                </thead>
                <tbody>
                  {academics.subjects.map((s) => {
                    const gap =
                      s.lastScore != null && s.targetScore != null ? s.targetScore - s.lastScore : null;
                    const levelLabel = SELF_LEVELS.find((l) => l.value === s.selfLevel)?.label;
                    return (
                      <tr key={s.name} className="border-b border-cream-deep last:border-0">
                        <td className="px-3.5 py-2.5 font-semibold text-olive">{s.name}</td>
                        <td className="px-3.5 py-2.5 text-olive-soft">{levelLabel ?? "—"}</td>
                        <td className="px-3.5 py-2.5 mono text-olive-soft">
                          {s.lastScore != null ? s.lastScore : "—"}
                          {s.fullScore ? <span className="text-[11px] text-olive-mute"> /{s.fullScore}</span> : null}
                        </td>
                        <td className="px-3.5 py-2.5 mono text-olive-soft">{s.targetScore != null ? s.targetScore : "—"}</td>
                        <td className="px-3.5 py-2.5 mono">
                          {gap == null ? (
                            <span className="text-olive-mute">—</span>
                          ) : gap > 0 ? (
                            <span className="font-semibold text-terra">+{gap}</span>
                          ) : (
                            <span className="font-semibold text-[#5a9326]">已达标</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {viewer === "tutor" && onEditAcademics && (
              <button
                onClick={onEditAcademics}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-olive py-3 text-[14px] font-semibold text-cream hover:bg-lime-deep"
              >
                修改成绩与目标
              </button>
            )}
          </div>
        ))}

      {tab === "e3" &&
        (e3Legacy ? (
          <MissingCard
            text="学业诊断已升级为 V3.7 三阶九能版，请重新完成一次诊断（约 16-18 分钟）。"
            to="/assessments?start=e3"
          />
        ) : !e3v37 ? (
          <MissingCard text="还没有学习力诊断结果。E3 学业诊断（三阶九能 V3.7）约 16-18 分钟，一次一道题，做完一个部分会有鼓励。" actionText="还未测评，开始测评 →" to="/assessments?start=e3" />
        ) : (
          <div className="space-y-4">
            {/* 结果概要卡：三阶 + 主卡点 + 状态 */}
            <div className="paper-card accent-l border-lime p-5">
              <div className="flex items-center gap-2">
                <Compass size={17} className="text-olive" />
                <h3 className="font-bold text-olive">三阶九能体检 · {e3v37.stageLabel}</h3>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2">
                {e3v37.systems.core.map((c) => (
                  <div key={c.key} className="rounded-xl bg-cream px-2.5 py-2.5 text-center">
                    <div className="text-[11.5px] text-olive-mute">{c.key}</div>
                    <div className={`mt-0.5 text-[17px] font-bold ${e3v37LevelTextClass(c.level)}`}>{c.score}/5</div>
                    <div className={`mt-0.5 text-[11px] ${e3v37LevelTextClass(c.level)}`}>{c.level}</div>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-[12.5px] text-olive-mute">{E3V37_LEVEL_CAPTION}</p>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <span className="chip !text-[11px]">学习状态「{e3v37.motivationLabel}」{e3v37.motivationScore}/5</span>
                <span className="chip !text-[11px]">外驱依赖 {e3v37.extDrive}/5 · 内驱 {e3v37.intDrive}/5</span>
                <span className="chip !text-[11px]">生活事件 {e3v37.lifeEventScore}/24（{e3v37.lifeEventLevel}）</span>
                {e3v37.mainBlock && (
                  <span className="chip !border-[#8f1313]/50 !bg-[#fbe3df] !text-[11px] !text-[#8f1313]">
                    主卡点：{e3v37.mainBlock.label} {e3v37.mainBlock.score}/5
                  </span>
                )}
              </div>
              {e3v37.redFlags.length > 0 && (
                <div className="mt-3 rounded-xl border border-terra/40 bg-terra/10 p-3">
                  <div className="text-[12.5px] font-bold text-terra">红线提示：先照顾好状态，再谈成绩</div>
                  {e3v37.redFlags.map((f, i) => (
                    <p key={i} className="mt-1 text-[12.5px] leading-relaxed text-terra">{f}</p>
                  ))}
                </div>
              )}
            </div>
            <NineAbilityRadar e3={e3v37} />
            {(() => {
              const report = buildE3Report(e3v37);
              return (
                <>
                  <SectionToc sections={report.sections} />
                  {/* 折叠版：优先看结果与结论，详细文字可展开 */}
                  {report.sections.map((s, i) => (
                    <CollapsibleSection key={i} section={s} index={i} />
                  ))}
                </>
              );
            })()}
            {/* 附录：逐题得分表 + 本次答题明细 */}
            <Fold title="附录 · 三阶九能观察点得分表（逐题得分，点击展开）">
              <AbilityScoreTable e3={e3v37} ratings={e3Ratings} />
            </Fold>
            {data?.raw && data.raw.length > 0 && (
              <Fold title="附录 · 本次诊断答题明细（点击展开）">
                <AnswerDetailsByKind raw={data.raw} kinds={["e3"]} />
              </Fold>
            )}
            {/* 家长卷 · 简单概要（选做，进入系统后随时可补） */}
            {parentResult ? (
              <div className="paper-card accent-l border-lime p-5">
                <h3 className="font-bold text-olive">家长观察对照（家长卷 V3.7）</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-olive-soft">{parentResult.summary}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  <span className="chip !text-[11px]">家长了解程度：{parentResult.unknownLevel}（不了解 {parentResult.unknownCount} 项）</span>
                  {parentResult.blindSpots.length > 0 && (
                    <span className="chip !text-[11px]">观察与孩子自评明显差异：{parentResult.blindSpots.length} 项</span>
                  )}
                  {parentResult.overestimates.length > 0 && (
                    <span className="chip !text-[11px]">家长更看好的方面：{parentResult.overestimates.map((d) => d.kp).join("、")}</span>
                  )}
                  {parentResult.underestimates.length > 0 && (
                    <span className="chip !text-[11px]">家长没看到的闪光点：{parentResult.underestimates.map((d) => d.kp).join("、")}</span>
                  )}
                  {parentResult.severeConflict && (
                    <span className="chip !border-[#8f1313]/50 !bg-[#fbe3df] !text-[11px] !text-[#8f1313]">家庭近期有严重亲子冲突信号</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="paper-card border-dashed p-5">
                <h3 className="font-bold text-olive">家长观察对照（家长卷）</h3>
                <p className="mt-1.5 text-[13.5px] leading-relaxed text-olive-mute">
                  家长卷还没有填写。它由家长独立填写（约 8 分钟），用于对比家长观察和你的自评——不着急，进入系统后随时可在「测评中心」补填。
                </p>
              </div>
            )}
          </div>
        ))}

      {tab === "mbti" &&
        (!mbti ? (
          <MissingCard text="还没有 MBTI 测评结果，28 道二选一，约 5 分钟。" actionText="还未测评，开始测评 →" to="/assessments?start=mbti" />
        ) : (
          <MbtiDetail result={mbti} onGoCombined={goCombined} />
        ))}

      {tab === "disc" &&
        (!disc ? (
          <MissingCard text="还没有 DISC 测评结果，24 道二选一，约 4 分钟。" actionText="还未测评，开始测评 →" to="/assessments?start=disc" />
        ) : (
          <DiscDetail primary={disc.primary} dims={disc.dims} version={disc.version} onGoCombined={goCombined} />
        ))}

      {tab === "multi5" &&
        (!multi5 ? (
          <MissingCard text="多元智能五项为客观题测评（选做），40 题约 8 分钟，比自评更能反映真实能力底子。" actionText="还未测评，开始测评 →" to="/assessments?start=multi5" />
        ) : (
          <Multi5Detail result={multi5} />
        ))}

      {(tab === "parent" || tab === "discparent") && (
        <ParentReportTab student={disc ?? null} parents={discParents} e3parent={parentResult} raw={data?.raw} />
      )}

      {tab === "anchor" &&
        (!anchor ? (
          <MissingCard
            text="职业锚测评为选做，看看你内心最看重什么。"
            actionText="还未测评，开始测评 →"
            to="/assessments?start=anchor"
          />
        ) : (
          <AnchorDetail result={anchor} />
        ))}

      {tab === "holland" &&
        (!holland ? (
          <MissingCard
            text="霍兰德职业兴趣测评为选做，生成你的 RIASEC 兴趣代码。"
            actionText="还未测评，开始测评 →"
            to="/assessments?start=holland"
          />
        ) : (
          <HollandDetail result={holland} />
        ))}

      {tab === "mental" &&
        (!mental && !mentalSdq && !mentalPa ? (
          <div className="space-y-4">
            <MissingCard
              text="心理健康筛查全部为选做，有三套可挑着做：学生版 A（SDQ 长处与困难问卷，25 题，4—17 岁，11 岁以下可家长陪读）、学生版 B（PHQ-A + GAD-7 学生版，16 题，11 岁以上）、通用版（PHQ-9 + GAD-7，16 题）。做了哪套，结果都会出现在这里和综合报告里。"
              actionText="去测学生版 A（SDQ）→"
              to="/assessments?start=mental"
            />
            <div className="flex flex-wrap gap-2">
              <a href="/assessments?start=mental" className="rounded-full border border-lime/50 bg-lime-pale/60 px-3 py-1.5 text-[12.5px] font-semibold text-olive hover:border-lime">
                去测学生版 B（PHQ-A，11 岁以上）→
              </a>
              <a href="/assessments?start=mental" className="rounded-full border border-lime/50 bg-lime-pale/60 px-3 py-1.5 text-[12.5px] font-semibold text-olive hover:border-lime">
                去测通用版（PHQ-9 + GAD-7）→
              </a>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <MentalScoreGuideCard />
            {/* 学生版 A（SDQ） */}
            {mentalSdq ? (
              <>
                <MentalSdqBars mental={mentalSdq} />
                <div className="paper-card p-5">
                  <h3 className="font-bold text-olive">学生版 A · 分级解释与建议</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-olive-soft">
                    <RichText text={mentalSdq.summary} />
                  </p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-olive-mute">一两个月后可复测对比变化。</p>
                </div>
                <SdqDimExplainCard mental={mentalSdq} />
                {data?.raw && data.raw.length > 0 && (
                  <Fold title="答题明细 · 学生版 A（SDQ，点击展开）">
                    <AnswerDetailsByKind raw={data.raw} kinds={["mentalsdq"]} />
                  </Fold>
                )}
              </>
            ) : (
              <MissingCard
                text="学生版 A（SDQ 长处与困难问卷）还没测：25 题约 4 分钟，适用 4—17 岁（11 岁以下可家长陪读）。"
                actionText="去测学生版 A →"
                to="/assessments?start=mental"
              />
            )}
            {/* 学生版 B（PHQ-A + GAD-7 学生化） */}
            {mentalPa ? (
              <>
                <MentalV2Bars mental={mentalPa} variant="pa" />
                <div className="paper-card p-5">
                  <h3 className="font-bold text-olive">学生版 B · 分级解释与建议</h3>
                  <p className="mt-2 text-[13.5px] leading-relaxed text-olive-soft">
                    <RichText text={mentalPa.summary} />
                  </p>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-olive-mute">
                    综合分级取 PHQ-A 与 GAD-7 中较重者；得分 ≥2 的题共 {mentalPa.positives}/16 项。两周后可复测对比变化。
                  </p>
                </div>
                <PhqGadExplainCard variant="pa" selfHarm={mentalPa.selfHarm} />
                {data?.raw && data.raw.length > 0 && (
                  <Fold title="答题明细 · 学生版 B（PHQ-A，点击展开）">
                    <AnswerDetailsByKind raw={data.raw} kinds={["mentalpa"]} />
                  </Fold>
                )}
              </>
            ) : (
              <MissingCard
                text="学生版 B（PHQ-A + GAD-7 学生版）还没测：16 题约 3 分钟，适用 11 岁以上。"
                actionText="去测学生版 B →"
                to="/assessments?start=mental"
              />
            )}
            {/* 通用版（PHQ-9 + GAD-7，含旧版十因子兼容） */}
            {mental ? (
              isMentalV2(mental) ? (
                <>
                  <MentalV2Bars mental={mental} />
                  <div className="paper-card p-5">
                    <h3 className="font-bold text-olive">通用版 · 分级解释与建议</h3>
                    <p className="mt-2 text-[13.5px] leading-relaxed text-olive-soft">
                      <RichText text={mental.summary} />
                    </p>
                    <p className="mt-2 text-[12.5px] leading-relaxed text-olive-mute">
                      综合分级取 PHQ-9 与 GAD-7 中较重者；得分 ≥2 的题共 {mental.positives}/16 项。两周后可复测对比变化。
                    </p>
                  </div>
                  <PhqGadExplainCard variant="v2" selfHarm={mental.selfHarm} />
                  {data?.raw && data.raw.length > 0 && (
                    <Fold title="答题明细 · 通用版（PHQ-9 + GAD-7，点击展开）">
                      <AnswerDetailsByKind raw={data.raw} kinds={["mental"]} />
                    </Fold>
                  )}
                </>
              ) : (
                <>
                  <div className="paper-card border-butter bg-butter/20 p-4">
                    <p className="text-[12.5px] leading-relaxed text-olive">
                      你上次完成的是旧版十因子筛查（通用版前身）。现在有新版可用：<b>学生版 A（SDQ）</b>、<b>学生版 B（PHQ-A + GAD-7 学生版）</b>或<b>通用版（PHQ-9 + GAD-7）</b>——旧结果保留可查，
                      <button className="font-bold underline" onClick={() => navigate("/assessments?start=mental")}>点这里测通用版 →</button>
                    </p>
                  </div>
                  <MentalDetail result={mental} />
                </>
              )
            ) : (
              <MissingCard
                text="通用版（PHQ-9 + GAD-7）还没测：16 题约 3 分钟。"
                actionText="去测通用版 →"
                to="/assessments?start=mental"
              />
            )}
          </div>
        ))}

      {tab === "combined" &&
        (e3Legacy ? (
          <MissingCard
            text="学业诊断已升级为 V3.7 三阶九能版，综合报告需要基于新版结果生成——请重新完成一次诊断（约 16-18 分钟）。"
            to="/assessments?start=e3"
          />
        ) : !combined ? (
          <MissingCard text="综合报告需要 MBTI、DISC、学习力诊断三项测评都完成。先去「测评中心」补齐吧。" />
        ) : (
          <div className="space-y-4">
            {/* 详版 / 简版切换 */}
            <div className="flex gap-1 rounded-xl bg-cream-deep p-1">
              {(
                [
                  { key: "full", label: "详版报告" },
                  { key: "lite", label: "简版 · 一页看懂" },
                ] as const
              ).map((v) => (
                <button
                  key={v.key}
                  onClick={() => setCombinedView(v.key)}
                  className={`flex-1 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    combinedView === v.key ? "bg-cream text-olive shadow-sm" : "text-olive-mute"
                  }`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            {combinedView === "lite" ? (
              <>
              <CombinedLite
                name={profile?.name ?? ""}
                mbti={data!.mbti!}
                disc={data!.disc!}
                e3={e3v37!}
                academics={academics}
                multi5={data?.multi5 ?? undefined}
                anchor={anchor}
                holland={holland}
                mental={mental}
                status={frameworkStatus}
                onOpen={openFramework}
                e3parent={parentResult}
                discParents={discParents}
              />
              {/* 综合结论三张图表：现状与目标 / 冰山模型 / 进步方案（与详版一致） */}
              {combined.sections[0] && (
                <RoadmapSection
                  section={combined.sections[0]}
                  index={0}
                  e3={e3v37 ?? undefined}
                  e3Ratings={e3Ratings}
                  academics={academics}
                  mbti={data?.mbti}
                  disc={data?.disc}
                  multi5={data?.multi5 ?? undefined}
                  anchor={anchor}
                  holland={holland}
                  mental={mental}
                  mentalSdq={mentalSdq}
                  mentalPa={mentalPa}
                  raw={data?.raw}
                  onReveal={reveal}
                />
              )}
              {/* 一页纸附录：三阶九能逐题得分表 + 全部测评答题明细，默认折叠放最后（打印时隐藏） */}
              {e3v37 && (
                <div className="print:hidden">
                  <Fold title="附录 · 三阶九能观察点得分表（逐题得分，点击展开）">
                    <AbilityScoreTable e3={e3v37} ratings={e3Ratings} />
                  </Fold>
                </div>
              )}
              {data?.raw && data.raw.length > 0 && (
                <div className="print:hidden">
                  <Fold title="附录 · 全部测评答题明细（点击展开）">
                    <AnswerDetails raw={data.raw} />
                  </Fold>
                </div>
              )}
              </>
            ) : (
              <>
            {/* 头部 */}
            <div className="paper-card accent-l border-lime p-5">
              <div className="flex items-center gap-2">
                <Compass size={17} className="text-olive" />
                <h2 className="text-[17px] font-bold text-olive">{profile?.name ? `${profile.name} 的` : ""}{combined.title}</h2>
              </div>
              <p className="mt-1 text-[13px] text-olive-mute">{combined.subtitle}</p>
              {/* 学习力系统框架图：置顶第一个元素，徽标融合各测评完成状态；点击徽章直达模块图表/测评 */}
              <div className="mt-3">
                <SystemFramework status={frameworkStatus} onOpen={openFramework} />
              </div>
            </div>

            <SectionToc sections={combined.sections} />
            {(() => {
              const hasAcadSec = combined.sections.some((x) => x.title.includes("成绩现状"));
              return combined.sections.map((s, i) => {
              if (s.title.includes("综合结论与行动方案")) {
                return (
                  <RoadmapSection
                    key={i}
                    section={s}
                    index={i}
                    e3={e3v37 ?? undefined}
                    e3Ratings={e3Ratings}
                    academics={academics}
                    mbti={data?.mbti}
                    disc={data?.disc}
                    multi5={data?.multi5 ?? undefined}
                    anchor={anchor}
                    holland={holland}
                    mental={mental}
                    mentalSdq={mentalSdq}
                    mentalPa={mentalPa}
                    charts={e3v37 ? <NineAbilityRadar e3={e3v37} /> : undefined}
                    raw={data?.raw}
                    onReveal={reveal}
                  />
                );
              }
              /* 详版折叠：先显示结果数据与结论段，图形与详细文字各自折叠（章节 → 图表映射见 V3.7 判读页规则） */
              const raw = data?.raw;
              let chartNode: ReactNode;
              /* 乐学/会学/善学模块章：该阶三能小雷达 */
              const modSys = (["乐学", "会学", "善学"] as const).find((k) => s.title.includes(`${k}模块`));
              if (modSys) {
                chartNode = e3v37 ? (
                  <NineAbilityRadar
                    e3={e3v37}
                    abilities={e3v37.abilities.filter((a) => a.system === modSys)}
                    title={`${modSys} · 三能小雷达`}
                  />
                ) : undefined;
              } else if (s.title.includes("条件模块")) {
                /* 亲子 DISC 对照图只放在「亲子对照」章（V38 起），条件章不再重复 */
                chartNode = mentalSdq ? (
                  <MentalSdqBars mental={mentalSdq} />
                ) : mentalPa ? (
                  <MentalV2Bars mental={mentalPa} variant="pa" />
                ) : mental ? (
                  isMentalV2(mental) ? (
                    <MentalV2Bars mental={mental} />
                  ) : (
                    <MentalBar mental={mental} />
                  )
                ) : undefined;
              } else if (s.title.includes("亲子对照")) {
                chartNode =
                  disc && discParents.length > 0 ? <DiscParentCompare student={disc} parents={discParents} /> : undefined;
              } else if (s.title.includes("学能模块")) {
                chartNode =
                  data?.multi5 || e3v37 ? (
                    <div className="space-y-4">
                      {data?.multi5 && <Multi5Radar multi5={data.multi5} />}
                      {e3v37 && (
                        <div className="paper-card p-5">
                          <h3 className="font-bold text-olive">学能三项（注意力 / 工作记忆 / 加工速度）</h3>
                          <p className="mt-1 text-[12.5px] text-olive-mute">
                            反映当前加工效率，单独报告不进总分；{E3V37_LEVEL_CAPTION}。
                          </p>
                          <MiniBars
                            max={5}
                            rows={e3v37.aptitude.map((a) => ({
                              label: a.label,
                              value: a.score,
                              display: `${a.score} · ${a.level}`,
                              state: (a.level === "卡点" ? "bad" : a.level === "待提升" ? "trait" : "ok") as "bad" | "trait" | "ok",
                            }))}
                          />
                        </div>
                      )}
                    </div>
                  ) : undefined;
              } else if (s.title.includes("兴趣与方向")) {
                chartNode =
                  data?.holland || data?.anchor ? (
                    <div className="space-y-4">
                      {data?.holland && <HollandRadar holland={data.holland} />}
                      {data?.anchor && <AnchorBarChart anchor={data.anchor} />}
                    </div>
                  ) : undefined;
              }
              /* 附录章只留观察点得分表（detail）；答题明细按模块下沉到各章，经 answers 作为独立折叠上移一级。
                 章节 → kinds 单一事实源在 answerBlocks.answerKindsForSection；
                 学科快扫明细在「成绩现状」章缺省时并入条件章（answerBlocks 内置 hasAcadSec 逻辑）。 */
              const isAppendix = s.title.includes("附录");
              const detailNode = isAppendix
                ? e3v37
                  ? <div className="print:hidden"><AbilityScoreTable e3={e3v37} ratings={e3Ratings} /></div>
                  : undefined
                : undefined;
              const answersNode =
                !isAppendix && raw && answerKindsForSection(s.title, hasAcadSec)
                  ? <div className="print:hidden"><AnswerDetailsByKind raw={raw} kinds={answerKindsForSection(s.title, hasAcadSec)!} /></div>
                  : undefined;
              const secNode = <CollapsibleSection key={i} section={s} index={i} charts={chartNode} detail={detailNode} answers={answersNode} />;
              /* 附录章整章不打印（详版） */
              return isAppendix ? <div key={i} className="print:hidden">{secNode}</div> : secNode;
            });
            })()}
            <p className="text-center text-[12.5px] text-olive-mute">
              报告内容聚焦学习相关因子，随学习数据积累持续更新。
            </p>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** 附录 · 三阶九能观察点得分表已迁移至 src/components/reports/AbilityScoreTable.tsx（V3.7）。 */

/** 综合报告 · 简版：一页看懂核心——定位徽章 + 双圈雷达 + 画像速记 + 先抓三件事 + 第一个动作。 */
/** 简版通用迷你条形图：一行一个维度，值过低标红、主导特点标琥珀。 */
function MiniBars({
  rows,
  max,
}: {
  rows: { label: string; value: number; display?: string; state?: "bad" | "trait" | "ok" }[];
  max: number;
}) {
  return (
    <div className="mt-3 space-y-1.5">
      {rows.map((r) => (
        <div key={r.label} className="flex items-center gap-2">
          <span className="w-[72px] shrink-0 truncate text-[12px] font-medium text-olive">{r.label}</span>
          <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(3, Math.min(100, (r.value / max) * 100))}%`,
                background: r.state === "bad" ? "#b91c1c" : r.state === "trait" ? "#c7a23a" : "#7cb83c",
              }}
            />
          </div>
          <span
            className={`mono w-12 shrink-0 text-right text-[11.5px] ${
              r.state === "bad" ? "font-bold text-[#8f1313]" : r.state === "trait" ? "font-bold text-[#8a6d1a]" : "text-olive-soft"
            }`}
          >
            {r.display ?? r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** 简版 · 各已做测评的结果图解：每个测评一张卡 = 数据图形 + 一句解读 + 一句对学习力的影响。 */
function AssessmentChartsLite({
  mbti,
  disc,
  multi5,
  anchor,
  holland,
  mental,
}: {
  mbti: MbtiResult;
  disc: DiscResult;
  multi5?: Multi5Result;
  anchor?: AnchorResult;
  holland?: HollandResult;
  mental?: MentalResult | MentalV2Result;
}) {
  const mr = MBTI_REPORTS[mbti.type];
  const dr = DISC_REPORTS[disc.primary];
  const combo = getDiscCombo(disc.dims);

  /** MBTI 最明显的一组倾向（差值最大）。 */
  const mbtiPairs: [keyof MbtiResult["dims"], keyof MbtiResult["dims"], string][] = [
    ["E", "I", "外向 E / 内向 I"],
    ["S", "N", "实感 S / 直觉 N"],
    ["T", "F", "思考 T / 情感 F"],
    ["J", "P", "计划 J / 灵活 P"],
  ];
  const strongestPair = mbtiPairs.reduce((a, b) =>
    Math.abs(mbti.dims[b[0]] - mbti.dims[b[1]]) > Math.abs(mbti.dims[a[0]] - mbti.dims[a[1]]) ? b : a,
  );
  const strongestPole = mbti.dims[strongestPair[0]] >= mbti.dims[strongestPair[1]] ? strongestPair[0] : strongestPair[1];

  const m5r = multi5 ? buildMulti5Report(multi5) : null;
  const m5sorted = m5r ? [...m5r.dims].sort((a, b) => b.score - a.score) : [];
  const anchorSorted = anchor ? [...ANCHOR_ORDER].sort((a, b) => anchor.dims[b] - anchor.dims[a]) : [];
  const anchorTop = anchor ? anchor.top2.map((k) => ANCHOR_LABEL[k]).join("、") : "";
  const hollandSorted = holland ? HOLLAND_ORDER.map((k) => ({ k, label: HOLLAND_LABEL[k], v: holland.dims[k] })).sort((a, b) => b.v - a.v) : [];
  const mentalLegacy = mental && !isMentalV2(mental) ? mental : null;
  const mentalPos = mentalLegacy ? MENTAL_FACTOR_ORDER.filter((f) => (mentalLegacy.factors[f] ?? 0) >= 2) : [];
  const mentalTop = mentalLegacy
    ? MENTAL_FACTOR_ORDER.map((f) => ({ f, v: mentalLegacy.factors[f] ?? 0 })).sort((a, b) => b.v - a.v)[0]
    : null;

  return (
    <div className="space-y-4">
      {/* MBTI 性格图解 */}
      <div className="paper-card p-5">
        <h3 className="font-bold text-olive">MBTI 性格 · {mbti.type}{mr ? `「${mr.name}」` : ""}</h3>
        <MiniBars
          max={7}
          rows={mbtiPairs.map(([a, b, pairLabel]) => {
            const win = mbti.dims[a] >= mbti.dims[b] ? a : b;
            return {
              label: pairLabel,
              value: Math.max(mbti.dims[a], mbti.dims[b]),
              display: `${win} ${Math.max(mbti.dims[a], mbti.dims[b])}`,
              state: "ok" as const,
            };
          })}
        />
        <p className="mt-3 text-[12.5px] leading-relaxed text-olive-soft">
          每组数字是你赢出的那一极及其强度，你的主导倾向是 <b>{strongestPole}</b> 极——性格是特点不是缺点。
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-olive">
          <b>对学习力：</b>{mr?.studyStrengths?.[0] ?? "按你的性格节奏安排学习，配合度最高。"}
        </p>
      </div>

      {/* DISC 行为图解 */}
      <div className="paper-card p-5">
        <h3 className="font-bold text-olive">DISC 行为风格 · {combo.join("")} 型{dr ? `（${dr.name}）` : ""}</h3>
        <MiniBars
          max={12}
          rows={(["D", "I", "S", "C"] as const).map((k) => ({
            label: `${k} · ${{ D: "掌控", I: "影响", S: "稳健", C: "谨慎" }[k]}`,
            value: disc.dims[k],
            state: (combo.includes(k) ? "trait" : "ok") as "trait" | "ok",
          }))}
        />
        <p className="mt-3 text-[12.5px] leading-relaxed text-olive-soft">
          琥珀条是你的主导因子（{combo.join("、")}），代表你最自然的行为模式——是特点不是缺点。
        </p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-olive">
          <b>对学习力：</b>用 {combo.join("")} 型最吃的方式带你（{dr ? dr.keywords.slice(0, 3).join("、") : ""}），督促才不费力、配合才长久。
        </p>
      </div>

      {/* 多元智能五项（客观）· 五维雷达（与详版 Multi5Radar 同形同配色，标签带分数） */}
      {multi5 && m5r && (
        <div className="paper-card p-5">
          <h3 className="font-bold text-olive">多元智能五项（客观题）· 综合 {multi5.overall} 分 · 细心指数 {multi5.carefulIndex}%</h3>
          <div className="mt-2 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                data={MULTI5_DIM_ORDER.map((k) => ({ dim: `${MULTI5_DIM_LABEL[k]} ${multi5.dims[k]}`, 得分: multi5.dims[k] }))}
                outerRadius="70%"
              >
                <PolarGrid stroke="#d9dcb8" />
                <PolarAngleAxis
                  dataKey="dim"
                  tick={({ x, y, payload }: any) => {
                    const v = Number(String(payload.value).split(" ").pop());
                    return (
                      <text x={x} y={y} textAnchor="middle" fontSize={11} fill={v < 60 ? "#b91c1c" : "#556339"} fontWeight={v < 60 ? 700 : 400}>
                        {payload.value}
                      </text>
                    );
                  }}
                />
                <Radar dataKey="得分" stroke="#7cb83c" fill="#7cb83c" fillOpacity={0.35} strokeWidth={2.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-olive-soft">
            百分制客观作答：「{m5sorted[0]?.label}」{m5sorted[0]?.score} 分最强，「{m5sorted[m5sorted.length - 1]?.label}」{m5sorted[m5sorted.length - 1]?.score} 分相对最弱（&lt;60 标红）。
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-olive">
            <b>对学习力：</b>{m5sorted[m5sorted.length - 1]?.studyAdvice?.[0] ?? "用最弱项的针对性练习把底子补齐，成绩天花板才会抬高。"}
            {multi5.carefulIndex < 70 ? "另外细心指数偏低，粗心丢分值得先抓。" : ""}
          </p>
        </div>
      )}

      {/* 职业锚（从高到低降序，Top2 标琥珀） */}
      {anchor && (
        <div className="paper-card p-5">
          <h3 className="font-bold text-olive">职业锚 · 主导锚：{anchorTop}</h3>
          <MiniBars
            max={5}
            rows={anchorSorted.map((k) => ({
              label: ANCHOR_LABEL[k],
              value: anchor.dims[k],
              display: anchor.dims[k].toFixed(1),
              state: (anchor.top2.includes(k) ? "trait" : "ok") as "trait" | "ok",
            }))}
          />
          <p className="mt-3 text-[12.5px] leading-relaxed text-olive-soft">
            琥珀条是你最看重的两样东西（{anchorTop}）——它们决定你长期坚持一件事时需要什么回报。
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-olive">
            <b>对学习力：</b>把学习目标和「{ANCHOR_LABEL[anchor.top2[0]]}」挂上钩（让努力看得见这方面的回报），动力会比单纯催分更持久。
          </p>
        </div>
      )}

      {/* 霍兰德兴趣（雷达图） */}
      {holland && (
        <div className="paper-card p-5">
          <h3 className="font-bold text-olive">霍兰德职业兴趣 · 代码 {holland.code}</h3>
          <div className="mt-2 h-[240px]">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart
                data={HOLLAND_ORDER.map((k) => ({ dim: `${k}·${HOLLAND_LABEL[k]} ${holland.dims[k].toFixed(1)}`, 得分: holland.dims[k] }))}
                outerRadius="70%"
              >
                <PolarGrid stroke="#d9dcb8" />
                <PolarAngleAxis dataKey="dim" tick={{ fill: "#556339", fontSize: 11 }} />
                <Radar dataKey="得分" stroke="#cf6a3c" fill="#cf6a3c" fillOpacity={0.3} strokeWidth={2.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-olive-soft">
            雷达上外凸最明显的三个方向组成你的兴趣代码 {holland.code}，「{hollandSorted[0]?.label}」得分最高——兴趣类型没有好坏。
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-olive">
            <b>对学习力：</b>课外拓展、选科与竞赛方向优先往「{holland.top3.map((k) => HOLLAND_LABEL[k]).join("、")}」靠，兴趣在线时更扛得住枯燥的基本功。
          </p>
        </div>
      )}

      {/* 心理健康（V2 PHQ-9+GAD-7 / 旧版十因子兼容） */}
      {mental && isMentalV2(mental) && (
        <div className="paper-card p-5">
          <h3 className="font-bold text-olive">
            心理健康 · PHQ-9 {mental.phq9}/27 · GAD-7 {mental.gad7}/21（{mental.level}，筛查参考，非诊断）
          </h3>
          <MiniBars
            max={27}
            rows={[
              { label: "PHQ-9 抑郁", value: mental.phq9, display: `${mental.phq9}/27 · ${mental.phq9Level}`, state: (mental.phq9Level !== "良好" ? "bad" : "ok") as "bad" | "ok" },
              { label: "GAD-7 焦虑", value: mental.gad7, display: `${mental.gad7}/21 · ${mental.gad7Level}`, state: (mental.gad7Level !== "良好" ? "bad" : "ok") as "bad" | "ok" },
            ]}
          />
          {mental.selfHarm && (
            <p className="mt-3 rounded-xl border border-[#b91c1c]/50 bg-[#fbe3df] p-3 text-[12.5px] font-bold leading-relaxed text-[#8f1313]">
              ⚠ 有自伤念头信号——请今天就告诉家长或信任的老师，必要时拨打心理援助热线 12356。
            </p>
          )}
          <p className="mt-3 text-[12.5px] leading-relaxed text-olive-soft">{mental.summary}</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-olive">
            <b>对学习力：</b>状态是所有学习方法生效的前提——先把睡眠和情绪稳住，再谈效率和成绩目标。
          </p>
        </div>
      )}
      {mental && !isMentalV2(mental) && (
        <div className="paper-card p-5">
          <h3 className="font-bold text-olive">心理健康十因子（旧版） · 阳性项目 {mental.positiveCount} 项（筛查参考，非诊断）</h3>
          <MiniBars
            max={5}
            rows={MENTAL_FACTOR_ORDER.filter((f) => mental.factors[f] != null).map((f) => ({
              label: MENTAL_FACTOR_LABEL[f],
              value: mental.factors[f] ?? 0,
              display: (mental.factors[f] ?? 0).toFixed(1),
              state: (mentalBand(mental.factors[f] ?? 0) !== "无" ? "bad" : "ok") as "bad" | "ok",
            }))}
          />
          <p className="mt-3 text-[12.5px] leading-relaxed text-olive-soft">
            因子均分 ≥2 标红（阳性，{mentalPos.length} 项）{mentalTop ? `，相对最高的是「${MENTAL_FACTOR_LABEL[mentalTop.f]}」${mentalTop.v.toFixed(1)} 分` : ""}——这是状态信号，不是给人贴标签。量表已升级为 PHQ-9 + GAD-7 专业版（16 题），建议重新测评。
          </p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-olive">
            <b>对学习力：</b>状态是所有学习方法生效的前提——先把睡眠和情绪稳住，再谈效率和成绩目标。
          </p>
        </div>
      )}
    </div>
  );
}

function CombinedLite({
  name,
  mbti,
  disc,
  e3,
  academics,
  multi5,
  anchor,
  holland,
  mental,
  status,
  onOpen,
  e3parent,
  discParents,
}: {
  name: string;
  mbti: MbtiResult;
  disc: DiscResult;
  e3: E3V37Result;
  academics?: AcademicsData;
  multi5?: Multi5Result;
  anchor?: AnchorResult;
  holland?: HollandResult;
  mental?: MentalResult | MentalV2Result;
  status?: FrameworkStatus;
  /** 框架图节点点击（已测→图表 / 未测→测评 / 成绩未填→填写）。 */
  onOpen?: (l: FrameworkLink) => void;
  /** 家长卷结果（选做）与家长 DISC（可多位），用于亲子对照摘要卡。 */
  e3parent?: E3V37ParentResult | null;
  discParents?: { label: string; result: DiscResult }[];
}) {
  const mr = MBTI_REPORTS[mbti.type];
  const dr = DISC_REPORTS[disc.primary];
  const combo = getDiscCombo(disc.dims);
  const gap = academics ? summarizeLite(academics) : null;
  return (
    <div className="space-y-4">
      {/* 学习力系统框架图：置顶（徽标融合测评完成状态；点击徽章直达模块图表/测评，含二级考察点） */}
      <div className="paper-card p-5">
        <h3 className="font-bold text-olive">学习力系统框架</h3>
        <div className="mt-3">
          <SystemFramework status={status} onOpen={onOpen} />
        </div>
      </div>

      {/* 九能雷达：先看图 */}
      <NineAbilityRadar e3={e3} />
      <div className="paper-card p-5">
        <h3 className="font-bold text-olive">三阶九能体检一张图</h3>
        <p className="mt-1 text-[12.5px] text-olive-mute">{E3V37_LEVEL_CAPTION}，凹陷处就是发力点。</p>
        <div className="mt-3 space-y-1.5">
          {e3.systems.core.map((d) => (
            <div key={d.key} className="flex items-center gap-2">
              <span className="w-12 shrink-0 text-[12.5px] font-semibold text-olive">{d.key}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${(d.score / 5) * 100}%`, background: d.level === "正常" ? "#7cb83c" : d.level === "待提升" ? "#c7a23a" : "#b91c1c" }}
                />
              </div>
              <span className={`mono w-16 shrink-0 text-right text-[12px] ${e3v37LevelTextClass(d.level)}`}>
                {d.score}/5 · {d.level}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {e3.abilities.map((a) => (
            <div key={a.key} className="rounded-lg bg-cream px-2 py-1.5 text-center">
              <div className="text-[11px] text-olive-mute">{a.label}</div>
              <div className={`mono text-[13px] font-bold ${e3v37LevelTextClass(a.level)}`}>{a.score}</div>
              <div className={`text-[10.5px] ${e3v37LevelTextClass(a.level)}`}>{a.level}</div>
            </div>
          ))}
        </div>
      </div>

      {/* 画像速记 */}
      <div className="paper-card p-5">
        <h3 className="font-bold text-olive">你是怎样的学习者（一句话版）</h3>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="chip !border-lime/50 !bg-lime-pale !text-[12.5px]">性格 {mbti.type} 型{mr ? ` · ${mr.tags.slice(0, 2).join("、")}` : ""}</span>
          <span className="chip !border-lime/50 !bg-lime-pale !text-[12.5px]">行为 {combo.join("")} 组合{dr ? ` · ${dr.keywords.slice(0, 2).join("、")}` : ""}</span>
          {e3.mainBlock && (
            <span className="chip !border-[#8f1313]/50 !bg-[#fbe3df] !text-[12.5px] !text-[#8f1313]">主卡点 · {e3.mainBlock.label} {e3.mainBlock.score}/5</span>
          )}
        </div>
      </div>

      {/* 亲子对照摘要卡：前 3 条冲突 + 一句核心建议（有家长数据时显示） */}
      {(e3parent || (discParents && discParents.length > 0)) &&
        (() => {
          const { conflicts, tips } = buildParentChildAnalysis(disc, discParents ?? [], e3parent ?? null);
          return (
            <div className="paper-card accent-l border-terra/40 p-5">
              <h3 className="font-bold text-olive">亲子对照 · 摘要</h3>
              <ol className="mt-2 space-y-1.5">
                {conflicts.slice(0, 3).map((c, i) => (
                  <li key={i} className={`text-[12.5px] leading-relaxed ${c.hot ? "font-semibold text-[#8f1313]" : "text-olive-soft"}`}>
                    <b className={c.hot ? "text-[#8f1313]" : "text-terra"}>{i + 1}.</b> {c.text}
                  </li>
                ))}
              </ol>
              {conflicts.length > 3 && (
                <p className="mt-1 text-[12px] text-olive-mute">……共 {conflicts.length} 条冲突点，详见「家长报告」栏目或详版「亲子对照与沟通建议」章。</p>
              )}
              {tips.length > 0 && (
                <p className="mt-2.5 rounded-xl bg-lime-pale/60 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-olive">
                  <b>核心建议：</b>{tips[0]}
                </p>
              )}
            </div>
          );
        })()}

      {/* 各已做测评的结果图解（图形 + 一句解读 + 一句对学习力的影响） */}
      <AssessmentChartsLite
        mbti={mbti}
        disc={disc}
        multi5={multi5}
        anchor={anchor}
        holland={holland}
        mental={mental}
      />

      {/* 现状定位（放在图之后） */}
      <div className="paper-card accent-l border-lime p-5 text-center">
        <div className="mono text-[11px] tracking-wider text-olive-mute">{name ? `${name} 的` : ""}学习力 · 一页看懂（{e3.stageLabel}）</div>
        <div className="mt-2 inline-flex items-center gap-2 rounded-2xl bg-olive px-5 py-2.5 text-[18px] font-bold text-cream">
          {e3.mainBlock ? `主卡点：${e3.mainBlock.label} ${e3.mainBlock.score}/5` : "三阶九能全部正常"}
        </div>
        <p className="mt-2 text-[13px] text-olive-soft">
          状态「{e3.motivationLabel}」{e3.motivationScore}/5 · 生活事件 {e3.lifeEventScore}/24（{e3.lifeEventLevel}）
          {gap ? ` · 成绩总差距 ${gap} 分` : ""}
        </p>
        {e3.redFlags.length > 0 && (
          <div className="mt-3 rounded-xl border border-terra/40 bg-terra/10 p-3 text-left">
            <div className="text-[12.5px] font-bold text-terra">先照顾好状态，再谈成绩</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-terra">本次测评触发了 {e3.redFlags.length} 条红线提示，详细内容见详版报告；红线期间建议先减压、多陪伴。</p>
          </div>
        )}
      </div>

      <p className="text-center text-[12.5px] text-olive-mute">想看完整分析与训练细节，切到「详版报告」。</p>
    </div>
  );
}

/** 简版用的成绩差距汇总（总差距）。 */
function summarizeLite(a: AcademicsData): number | null {
  const gaps = a.subjects
    .map((s) => (s.lastScore != null && s.targetScore != null ? s.targetScore - s.lastScore : null))
    .filter((g): g is number => g != null && g > 0);
  return gaps.length ? gaps.reduce((x, y) => x + y, 0) : null;
}


/** 答题明细数据层已迁移至 src/components/reports/answerBlocks.ts（V33.2：段过滤修复 + 家长版题干 + 心理 V2）。 */

function AnswerBlocksView({ blocks }: { blocks: AnswerBlock[] }) {
  return (
    <div className="mt-3 space-y-2">
      {blocks.map((b) => (
        <details
          key={b.key}
          id={`ansblk-${b.key}`}
          className="scroll-mt-24 rounded-xl border border-border bg-cream/60 px-4 py-2.5"
        >
          <summary className="cursor-pointer text-[13.5px] font-semibold text-olive">{b.title}</summary>
          {b.note && <p className="mt-1.5 text-[11.5px] text-olive-mute">{b.note}</p>}
          <ol className="mt-2 space-y-1.5">
            {b.rows.map((row, ri) => (
              <li key={`${row.no}-${ri}`} className="flex gap-2 text-[12.5px] leading-relaxed text-olive-soft">
                <span className="mono shrink-0 text-olive-mute">{row.no}.</span>
                <span className="flex-1">{row.text}</span>
                <span className={`shrink-0 font-semibold ${row.bad ? "text-terra" : "text-olive"}`}>{row.ans}</span>
              </li>
            ))}
          </ol>
        </details>
      ))}
    </div>
  );
}

/** 按 kind 过滤的答题明细（经 CollapsibleSection 的 answers 折叠「本章相关测评 · 答题明细」渲染，故内部不再重复小标题）。 */
function AnswerDetailsByKind({
  raw,
  kinds,
}: {
  raw: { kind: string; answers: unknown; createdAt: Date | string }[];
  kinds: string[];
}) {
  const blocks = buildAnswerBlocks(raw, kinds);
  if (blocks.length === 0) return null;
  return <AnswerBlocksView blocks={blocks} />;
}

function AnswerDetails({ raw }: { raw: { kind: string; answers: unknown; createdAt: Date | string }[] }) {
  const blocks = buildAnswerBlocks(raw);
  if (blocks.length === 0) return null;
  return (
    <div className="paper-card p-5">
      <h3 className="font-bold text-olive">答题明细</h3>
      <p className="mt-1 text-[12px] text-olive-mute">
        你完成的每一次测评、每一道题的作答记录都在这里，默认折叠，点开可看；供家长和伴学师对照查阅。
      </p>
      <AnswerBlocksView blocks={blocks} />
    </div>
  );
}

function MissingCard({ text, actionText, to }: { text: string; actionText?: string; to?: string }) {
  const navigate = useNavigate();
  return (
    <div className="paper-card p-5">
      <h3 className="font-bold text-olive">内容还差一点点</h3>
      <p className="mt-2 text-[13.5px] leading-relaxed text-olive-mute">{text}</p>
      <button
        onClick={() => navigate(to ?? "/assessments")}
        className="mt-3 rounded-xl bg-olive px-4 py-2 text-[13px] font-semibold text-cream hover:bg-lime-deep"
      >
        {actionText ?? "去测评 →"}
      </button>
    </div>
  );
}
