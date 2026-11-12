/**
 * 人才测评计分：五份作答 → 十项维度分 → 四个岗位的人岗匹配度。
 *
 * 口径统一：所有维度最终都折算到 0–100（50 ≈ 常模中位，本系统为自比量尺，
 * 未做外部常模转换）。岗位匹配度不是「能力总分」，而是「按该岗位的权重加权后，
 * 这个人现在的样子离这个岗位的要求有多近」，权重 0 的维度不计入分母。
 */

import {
  BIGFIVE_ITEMS,
  BIGFIVE_DIM_LABEL,
  VALUE_ITEMS,
  VALUE_DIM_LABEL,
  WORK_DISC_GROUPS,
  EQ_ITEMS,
  EQ_DIM_LABEL,
  EQ_FACTOR_DIMS,
  EQ_FACTOR_LABEL,
  DUTY_PACKS,
  type BigFiveDim,
  type ValueDim,
  type EqDim,
  type EqFactor,
  type DutyPackKey,
} from "./bank";

/* ------------------------------ 岗位与权重 ------------------------------ */

export type JobKey = "sales" | "service" | "admin" | "mgmt";

export const JOB_LABEL: Record<JobKey, string> = {
  sales: "销售咨询师",
  service: "教学服务",
  admin: "行政",
  mgmt: "管理",
};

export const JOB_BLURB: Record<JobKey, string> = {
  sales: "课程顾问、咨询师：靠说服和跟进拿结果，被拒绝是日常。",
  service: "学管、伴学师、教务：靠长期关系维系家长与学生的信任。",
  admin: "行政、前台、排课：靠准确和流程把机构运转撑住。",
  mgmt: "主管、校长：靠带人和定事把团队的结果做出来。",
};

/** 十项维度。前四项来自职场 DISC，三、四来自大五，七、八来自价值观，九、十来自岗位加测。 */
export type TalentDim =
  | "influence" | "empathy" | "order" | "drive"
  | "stable" | "duty" | "achieve" | "rule" | "lead" | "detail";

export const DIM_LABEL: Record<TalentDim, string> = {
  influence: "影响说服",
  empathy: "共情耐性",
  order: "条理规范",
  drive: "目标驱动",
  stable: "情绪稳定",
  duty: "尽责性",
  achieve: "成就动机",
  rule: "规则遵从",
  lead: "领导动机",
  detail: "细致准确",
};

/** 维度来源（报告里要标清楚，避免读者把自评当能力测验）。 */
export const DIM_SOURCE: Record<TalentDim, string> = {
  influence: "DISC·I",
  empathy: "DISC·S",
  order: "DISC·C",
  drive: "DISC·D",
  stable: "大五·情绪稳定",
  duty: "大五·尽责性",
  achieve: "价值观·成长",
  rule: "价值观·规则",
  lead: "管理加测",
  detail: "行政加测",
};

/** 3 = 核心（缺了就干不了）、2 = 重要、1 = 加分、0 = 不作为该岗要求。 */
export type Weight = 0 | 1 | 2 | 3;

export const JOB_WEIGHTS: Record<JobKey, Record<TalentDim, Weight>> = {
  sales: {
    influence: 3, empathy: 2, order: 1, drive: 3, stable: 3,
    duty: 2, achieve: 3, rule: 1, lead: 1, detail: 1,
  },
  service: {
    influence: 2, empathy: 3, order: 2, drive: 1, stable: 3,
    duty: 3, achieve: 1, rule: 2, lead: 0, detail: 1,
  },
  admin: {
    influence: 1, empathy: 2, order: 3, drive: 1, stable: 2,
    duty: 3, achieve: 1, rule: 3, lead: 0, detail: 3,
  },
  mgmt: {
    /* 共情从 3 降到 2：DISC 是强迫选择，四项不可能同时高。
       把「影响」「共情」「目标」「稳定」四项都设成核心，等于要求一个人四种风格全占，
       没有任何真实答卷能满足，最后所有管理岗都会被判成「有条件匹配」。
       管理要的是「听得进 + 顶得住」，不是「谁都照顾到」——共情留在重要档。 */
    influence: 3, empathy: 2, order: 2, drive: 3, stable: 3,
    duty: 3, achieve: 3, rule: 2, lead: 3, detail: 1,
  },
};

export const WEIGHT_LABEL: Record<Weight, string> = { 0: "—", 1: "加分", 2: "重要", 3: "核心" };

/** 岗位需要做哪一套加测（没有则用估算值，报告标注）。 */
export const JOB_DUTY_PACK: Record<JobKey, DutyPackKey> = {
  sales: "sales",
  service: "service",
  admin: "admin",
  mgmt: "mgmt",
};

/* ------------------------------ 作答结构 ------------------------------ */

export type TalentAnswers = {
  bigfive?: Record<string, number>;
  value?: Record<string, number>;
  discwork?: { most: number[]; least: number[] };
  eq?: Record<string, number>;
  duty?: Record<string, number | string>;
};

export type BigFiveScores = Record<BigFiveDim, number>;
export type ValueScores = Record<ValueDim, number>;
export type DiscWorkScores = { D: number; I: number; S: number; C: number; tendency: Record<"D" | "I" | "S" | "C", number>; primary: string };
export type EqScores = { dims: Record<EqDim, number>; factors: Record<EqFactor, number>; overall: number };

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** 5 点量表 → 0–100（1 分=0，5 分=100）。 */
const pct5 = (v: number) => ((v - 1) / 4) * 100;
/** 7 点量表 → 0–100。 */
const pct7 = (v: number) => ((v - 1) / 6) * 100;

/* ------------------------------ 各分项计分 ------------------------------ */

export function scoreBigFive(ans: Record<string, number>): BigFiveScores {
  const acc: Record<string, { sum: number; n: number }> = {};
  for (const it of BIGFIVE_ITEMS) {
    const raw = ans[it.id];
    if (typeof raw !== "number" || raw < 1 || raw > 5) continue;
    const v = it.reverse ? 6 - raw : raw;
    acc[it.dim] = acc[it.dim] ?? { sum: 0, n: 0 };
    acc[it.dim].sum += v;
    acc[it.dim].n += 1;
  }
  const out = {} as BigFiveScores;
  for (const d of Object.keys(BIGFIVE_DIM_LABEL) as BigFiveDim[]) {
    const a = acc[d];
    /* 缺答按该维已答题目均值外推，不把没答的当 0 分 */
    out[d] = a && a.n > 0 ? clamp(pct5(a.sum / a.n)) : 50;
  }
  return out;
}

export function scoreValue(ans: Record<string, number>): ValueScores {
  const acc: Record<string, { sum: number; n: number }> = {};
  for (const it of VALUE_ITEMS) {
    const raw = ans[it.id];
    if (typeof raw !== "number" || raw < 1 || raw > 5) continue;
    acc[it.dim] = acc[it.dim] ?? { sum: 0, n: 0 };
    acc[it.dim].sum += raw;
    acc[it.dim].n += 1;
  }
  const out = {} as ValueScores;
  for (const d of Object.keys(VALUE_DIM_LABEL) as ValueDim[]) {
    const a = acc[d];
    out[d] = a && a.n > 0 ? clamp(pct5(a.sum / a.n)) : 50;
  }
  return out;
}

/**
 * 职场 DISC：净分 −24..+24 → 0–100（中性 50）。
 *
 * 四项折百必须合计 200——强迫选择每组「最像」加一、「最不像」减一，四维净分和为 0，
 * 所以 4 × 50 + 0 = 200 是代数结果，不是巧合。但逐项四舍五入会让合计变成 199/201：
 * 平台期最常被挑的错就是这个。所以用「最大余数法」分配那 200 分，
 * 倾向度直接取「折百分 − 50」，于是四项倾向度也必然合计 0。
 */
export function scoreWorkDisc(ans: { most: number[]; least: number[] }): DiscWorkScores {
  const net = { D: 0, I: 0, S: 0, C: 0 };
  WORK_DISC_GROUPS.forEach((g, i) => {
    const m = ans.most[i];
    const l = ans.least[i];
    if (m == null || l == null || m === l) return;
    const mt = g.types[m];
    const lt = g.types[l];
    if (mt) net[mt] += 1;
    if (lt) net[lt] -= 1;
  });

  const order: ("D" | "I" | "S" | "C")[] = ["D", "I", "S", "C"];
  /* 24 组全投一维才到 ±24，故 100/48 ≈ 2.083 分/票；四项原始值合计恰好 200 */
  const exact = order.map((k) => 50 + (net[k] * 100) / 48);
  const base = exact.map((v) => Math.floor(v));
  let rest = 200 - base.reduce((a, b) => a + b, 0);
  const byFrac = exact
    .map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (let k = 0; rest > 0 && k < byFrac.length; k += 1, rest -= 1) base[byFrac[k].i] += 1;

  const dims = {
    D: clamp(base[0]),
    I: clamp(base[1]),
    S: clamp(base[2]),
    C: clamp(base[3]),
  };
  const tendency = { D: dims.D - 50, I: dims.I - 50, S: dims.S - 50, C: dims.C - 50 };
  const primary = [...order].sort((a, b) => dims[b] - dims[a])[0];
  return { ...dims, tendency, primary };
}

export function scoreEq(ans: Record<string, number>): EqScores {
  const acc: Record<string, { sum: number; n: number }> = {};
  for (const it of EQ_ITEMS) {
    const raw = ans[it.id];
    if (typeof raw !== "number" || raw < 1 || raw > 7) continue;
    const v = it.reverse ? 8 - raw : raw;
    acc[it.dim] = acc[it.dim] ?? { sum: 0, n: 0 };
    acc[it.dim].sum += v;
    acc[it.dim].n += 1;
  }
  const dims = {} as Record<EqDim, number>;
  for (const d of Object.keys(EQ_DIM_LABEL) as EqDim[]) {
    const a = acc[d];
    dims[d] = a && a.n > 0 ? clamp(pct7(a.sum / a.n)) : 50;
  }
  const factors = {} as Record<EqFactor, number>;
  for (const f of Object.keys(EQ_FACTOR_LABEL) as EqFactor[]) {
    const list = EQ_FACTOR_DIMS[f];
    factors[f] = clamp(list.reduce((s, d) => s + dims[d], 0) / list.length);
  }
  const all = Object.keys(EQ_DIM_LABEL) as EqDim[];
  const overall = clamp(all.reduce((s, d) => s + dims[d], 0) / all.length);
  return { dims, factors, overall };
}

/** 岗位加测：likert 与情境选择混合，一律折算成得分率。 */
export function scoreDuty(pack: DutyPackKey, ans: Record<string, number | string>): { pack: DutyPackKey; score: number; answered: number } {
  const items = DUTY_PACKS[pack].items;
  let sum = 0;
  let n = 0;
  for (const it of items) {
    const raw = ans[it.id];
    if (raw == null) continue;
    if (it.kind === "likert") {
      const v = Number(raw);
      if (!Number.isFinite(v) || v < 1 || v > 5) continue;
      sum += it.reverse ? pct5(6 - v) : pct5(v);
      n += 1;
    } else {
      const idx = Number(raw);
      const opt = it.options[idx];
      if (!opt) continue;
      const max = Math.max(...it.options.map((o) => o.score));
      sum += max > 0 ? (opt.score / max) * 100 : 0;
      n += 1;
    }
  }
  return { pack, score: n > 0 ? clamp(sum / n) : 50, answered: n };
}

/* ------------------------------ 十维汇总 ------------------------------ */

export type TalentDims = Record<TalentDim, number>;

export type TalentScoreInput = {
  bigfive?: BigFiveScores;
  value?: ValueScores;
  discwork?: DiscWorkScores;
  dutyScores?: { pack: DutyPackKey; score: number; answered: number } | null;
  /** 逐题明细，用于判断某项是否真的做了（而不是估算补位） */
  answered?: { bigfive?: number; value?: number; discwork?: number; eq?: number; duty?: number };
};

export type TalentDimDetail = {
  key: TalentDim;
  label: string;
  score: number;
  /** measured = 有原始作答；estimated = 无作答，按相邻维度估算（报告需标注） */
  basis: "measured" | "estimated";
  source: string;
};

export function computeDims(input: TalentScoreInput): { dims: TalentDims; details: TalentDimDetail[] } {
  const bf = input.bigfive;
  const vv = input.value;
  const dw = input.discwork;
  const duty = input.dutyScores ?? null;
  const an = input.answered ?? {};

  const measured = {
    bigfive: (an.bigfive ?? 0) >= 8,
    value: (an.value ?? 0) >= 6,
    discwork: (an.discwork ?? 0) >= 12,
    duty: !!duty && duty.answered >= 6,
  };

  const order = dw && measured.discwork ? dw.C : 50;
  const dutyC = bf && measured.bigfive ? bf.C : 50;

  const detail = (key: TalentDim): TalentDimDetail => {
    switch (key) {
      case "influence":
        return { key, label: DIM_LABEL[key], score: dw ? dw.I : 50, basis: measured.discwork ? "measured" : "estimated", source: DIM_SOURCE[key] };
      case "empathy":
        return { key, label: DIM_LABEL[key], score: dw ? dw.S : 50, basis: measured.discwork ? "measured" : "estimated", source: DIM_SOURCE[key] };
      case "order":
        return { key, label: DIM_LABEL[key], score: order, basis: measured.discwork ? "measured" : "estimated", source: DIM_SOURCE[key] };
      case "drive":
        return { key, label: DIM_LABEL[key], score: dw ? dw.D : 50, basis: measured.discwork ? "measured" : "estimated", source: DIM_SOURCE[key] };
      case "stable":
        return { key, label: DIM_LABEL[key], score: bf ? bf.N : 50, basis: measured.bigfive ? "measured" : "estimated", source: DIM_SOURCE[key] };
      case "duty":
        return { key, label: DIM_LABEL[key], score: dutyC, basis: measured.bigfive ? "measured" : "estimated", source: DIM_SOURCE[key] };
      case "achieve":
        return { key, label: DIM_LABEL[key], score: vv ? vv.G : 50, basis: measured.value ? "measured" : "estimated", source: DIM_SOURCE[key] };
      case "rule":
        return { key, label: DIM_LABEL[key], score: vv ? vv.P : 50, basis: measured.value ? "measured" : "estimated", source: DIM_SOURCE[key] };
      case "lead":
        return { key, label: DIM_LABEL[key], score: duty?.pack === "mgmt" && measured.duty ? duty.score : 50, basis: duty?.pack === "mgmt" && measured.duty ? "measured" : "estimated", source: DIM_SOURCE[key] };
      case "detail":
        return {
          key,
          label: DIM_LABEL[key],
          /* 没做行政加测时，用「条理 + 尽责」估一个：细致这件事，一半靠习惯、一半靠性子 */
          score: duty?.pack === "admin" && measured.duty ? duty.score : clamp(order * 0.6 + dutyC * 0.4),
          basis: duty?.pack === "admin" && measured.duty ? "measured" : "estimated",
          source: DIM_SOURCE[key],
        };
    }
  };

  const keys = Object.keys(DIM_LABEL) as TalentDim[];
  const details = keys.map(detail);
  const dims = Object.fromEntries(details.map((d) => [d.key, d.score])) as TalentDims;
  return { dims, details };
}

/* ------------------------------ 岗位匹配 ------------------------------ */

export type JobFit = {
  job: JobKey;
  label: string;
  score: number;
  /** 核心维（权重 3）里低于门槛的项——这些是「不补就上不去」的地方 */
  gaps: { dim: TalentDim; label: string; score: number }[];
  /**
   * 重要维（权重 ≥2）里明显偏低的项。
   * 和 gaps 分开：gaps 是「这个岗离不开你却不行」，weak 是「不至于干不了，但会拖后腿」。
   * 分档时要看 weak——否则一份条理规范 0 分的卷子也会被判成「高度匹配」，读的人不会信。
   */
  weak: { dim: TalentDim; label: string; score: number }[];
  /** 该岗的匹配分档（由 score + gaps + weak 一起定，前端不要自己再算一遍） */
  band: FitBand;
  /** 该岗的强项（核心/重要维里最高的两项） */
  strengths: { dim: TalentDim; label: string; score: number }[];
  /** 真正参与计算的分母权重，0 = 该岗权重全为 0（不应出现） */
  weightSum: number;
};

/** 核心维低于这个分数就算「硬缺口」。40 是「明显偏弱」的经验线，不是常模切点。 */
export const CORE_GAP_LINE = 40;

/** 重要维（权重 ≥2）低于这个分数算「会拖后腿」。比核心线低一档，避免把中等偏弱也当成问题。 */
export const WEAK_LINE = 30;

export function fitForJob(job: JobKey, dims: TalentDims): JobFit {
  const w = JOB_WEIGHTS[job];
  let sum = 0;
  let weightSum = 0;
  const gaps: JobFit["gaps"] = [];
  const pool: { dim: TalentDim; label: string; score: number; weight: Weight }[] = [];
  const weak: JobFit["weak"] = [];
  for (const dim of Object.keys(w) as TalentDim[]) {
    const weight = w[dim];
    if (weight === 0) continue;
    sum += dims[dim] * weight;
    weightSum += weight;
    if (weight === 3 && dims[dim] < CORE_GAP_LINE) gaps.push({ dim, label: DIM_LABEL[dim], score: dims[dim] });
    if (weight >= 2 && dims[dim] < WEAK_LINE) weak.push({ dim, label: DIM_LABEL[dim], score: dims[dim] });
    if (weight >= 2) pool.push({ dim, label: DIM_LABEL[dim], score: dims[dim], weight });
  }
  const strengths = pool
    .sort((a, b) => b.score - a.score || b.weight - a.weight)
    .slice(0, 2)
    .map(({ dim, label, score }) => ({ dim, label, score }));
  const score = weightSum > 0 ? Math.round(sum / weightSum) : 0;
  return {
    job,
    label: JOB_LABEL[job],
    score,
    gaps,
    weak,
    band: fitBand(score, gaps.length, weak.length),
    strengths,
    weightSum,
  };
}

export function allFits(dims: TalentDims): JobFit[] {
  return (Object.keys(JOB_LABEL) as JobKey[])
    .map((j) => fitForJob(j, dims))
    .sort((a, b) => b.score - a.score);
}

/* ------------------------------ 匹配度分档 ------------------------------ */

export type FitBand = "strong" | "fit" | "watch" | "off";

/**
 * 分档。三个输入缺一不可：
 *  - gaps：核心维塌了两项，分数再高也不能叫「匹配」；
 *  - weak：重要维塌了，最多算「基本匹配」——不然报告会自相矛盾；
 *  - score：加权分的整体位置。
 */
export function fitBand(score: number, gaps: number, weak = 0): FitBand {
  if (gaps >= 2) return "off";
  if (weak >= 2) return score >= 50 ? "watch" : "off";
  if (score >= 78 && weak === 0) return "strong";
  if (score >= 64) return "fit";
  if (score >= 50) return "watch";
  return "off";
}

export const FIT_BAND_LABEL: Record<FitBand, string> = {
  strong: "高度匹配",
  fit: "基本匹配",
  watch: "有条件匹配",
  off: "暂不匹配",
};

export const FIT_BAND_TEXT: Record<FitBand, string> = {
  strong: "主要维度都对得上，进来之后主要补方法，不用改性子。",
  fit: "大方向合适，个别维度需要在试用期重点带。",
  watch: "能用，但有一两项明显不是他的长处，得靠流程和搭档兜住。",
  off: "不是「人不好」，是这个岗位每天要做的事，恰好是他最费劲的部分。",
};
