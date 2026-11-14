/**
 * 人才测评计分：五份作答 → 十项维度分 → 岗位的人岗匹配度。
 *
 * 口径统一：所有维度最终都折算到 0–100（50 ≈ 常模中位，本系统为自比量尺，
 * 未做外部常模转换）。岗位匹配度不是「能力总分」，而是「按该岗位的权重加权后，
 * 这个人现在的样子离这个岗位的要求有多近」，权重 0 的维度不计入分母。
 *
 * v270：岗位从四值扩到六值（mkt/sales/admin/fin/service/pot）。
 * 五个是真实岗位（按前段获客→中段组织→后段交付的链路排），
 * pot（潜质通道）不是岗位：评估的是「该不该带人、能带哪一段」，
 * 所以 allFits 只出五个岗位，pot 走单独的潜质评估（见 potential.ts）。
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

export type JobKey = "mkt" | "sales" | "admin" | "fin" | "service" | "pot";

export const JOB_LABEL: Record<JobKey, string> = {
  mkt: "市场推广",
  sales: "咨询销售",
  admin: "人事行政",
  fin: "财务教务",
  service: "教学服务",
  pot: "管理潜质",
};

/** 列表/卡片上的短名 */
export const JOB_SHORT: Record<JobKey, string> = {
  mkt: "推广",
  sales: "销售",
  admin: "人事",
  fin: "财务",
  service: "教学",
  pot: "潜质",
};

/** 岗位在机构链路里的位置：前段对客、中段对组织、后段对交付；通道跨三段。 */
export const JOB_TRACK: Record<JobKey, string> = {
  mkt: "前段",
  sales: "前段",
  admin: "中段",
  fin: "中段",
  service: "后段",
  pot: "通道",
};

/** job = 真实岗位；potential = 潜质通道（不是岗位，是「该不该带人」的评估） */
export const JOB_KIND: Record<JobKey, "job" | "potential"> = {
  mkt: "job",
  sales: "job",
  admin: "job",
  fin: "job",
  service: "job",
  pot: "potential",
};

/** 五个真实岗位（按链路顺序）；pot 不在内 */
export const JOB_ORDER: JobKey[] = ["mkt", "sales", "admin", "fin", "service"];
export const JOB_KEYS: JobKey[] = [...JOB_ORDER, "pot"];

export const JOB_BLURB: Record<JobKey, string> = {
  mkt: "地推、社群、内容、投放：靠把陌生人变成名单拿结果。考核留资量与成本，不背签单。",
  sales: "课程顾问、咨询师：靠面咨和跟单把名单变成合同。考核签单率，每天面对拒绝。",
  admin: "招聘、入离职、员工关系、办公与合规：靠流程和准确把组织撑住，跟人打交道多。",
  fin: "收费退费、课时核销、课酬结算、排课：跟数字和规则打交道，账实相符就是底线。",
  service: "学管、伴学师、班主任：靠长期关系维系家长与学生的信任，交付质量就是口碑。",
  pot: "不是岗位，是在职者的一条通道：看这个人现在该不该带人、能带哪一段、先给多大摊子。",
};

/** 岗位分层（前端配色/分组用） */
export const JOB_LAYER: Record<JobKey, "front" | "mid" | "back" | "channel"> = {
  mkt: "front",
  sales: "front",
  admin: "mid",
  fin: "mid",
  service: "back",
  pot: "channel",
};

export const LAYER_LABEL: Record<"front" | "mid" | "back" | "channel", { name: string; sub: string }> = {
  front: { name: "前段", sub: "对客获客" },
  mid: { name: "中段", sub: "对组织" },
  back: { name: "后段", sub: "对交付" },
  channel: { name: "通道", sub: "跨三段" },
};

/** 十项维度。前四项来自职场 DISC，五、六来自大五，七、八来自价值观，九、十来自岗位加测。 */
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
  mkt: {
    /* 推广的核心是「自己找量」：没人给名单，得自己判断哪条渠道值得继续投。
       影响说服只要够用（跟保安、群主、合作方谈），不必是销售级；
       反过来条理与细致要比销售高——投放数据、物料、排期错一处，钱就白花了。 */
    influence: 2, empathy: 1, order: 2, drive: 3, stable: 2,
    duty: 2, achieve: 3, rule: 1, lead: 1, detail: 2,
  },
  sales: {
    influence: 3, empathy: 2, order: 1, drive: 3, stable: 3,
    duty: 2, achieve: 3, rule: 1, lead: 1, detail: 1,
  },
  admin: {
    /* 中段岗不只是守流程，还要能跟候选人谈、跟部门争、跟员工讲清规矩。
       影响仍是「重要」不进核心——这一岗的核心始终是「不出错」，
       把影响提到核心会让偏执行的人全部被判不匹配，与岗位实情相反。 */
    influence: 2, empathy: 2, order: 3, drive: 1, stable: 2,
    duty: 3, achieve: 1, rule: 3, lead: 0, detail: 2,
  },
  fin: {
    /* 和人事的核心几乎重合，所以必须在两端拉开，否则两个岗的分数永远一样。
       人事的核心是「答应的事盯到底」（尽责），财务的核心是「数字不出错」（细致）——
       所以人事 detail 降到 2、财务 duty 降到 2，各留一项不同的硬要求。
       影响压到 0：这岗不需要说服谁，需要的是顶住「先退了再说」；成就动机也给 0，
       财务岗不靠闯劲，靠的是把同一件事做一千遍不出错。 */
    influence: 0, empathy: 1, order: 3, drive: 0, stable: 2,
    duty: 2, achieve: 0, rule: 3, lead: 0, detail: 3,
  },
  service: {
    influence: 2, empathy: 3, order: 2, drive: 1, stable: 3,
    duty: 3, achieve: 1, rule: 2, lead: 0, detail: 1,
  },
  pot: {
    /* 潜质通道不按「岗位日常」加权，而按「整体管理」这一层配：
       要带人（领导）、要拿结果（目标、成就）、要顶得住（情绪）、要收得住尾（尽责）。
       共情留给「重要」——DISC 是强迫选择，四项不可能同时高，
       核心设太多，所有真实答卷都会被判不匹配。 */
    influence: 2, empathy: 2, order: 1, drive: 3, stable: 3,
    duty: 2, achieve: 3, rule: 2, lead: 3, detail: 1,
  },
};

export const WEIGHT_LABEL: Record<Weight, string> = { 0: "—", 1: "加分", 2: "重要", 3: "核心" };

/** 岗位需要做哪一套加测（没有则用估算值，报告标注）。 */
export const JOB_DUTY_PACK: Record<JobKey, DutyPackKey> = {
  mkt: "mkt",
  sales: "sales",
  admin: "admin",
  fin: "admin",
  service: "service",
  pot: "mgmt",
};

/* ------------------------------ 作答结构 ------------------------------ */

export type TalentAnswers = {
  bigfive?: Record<string, number>;
  value?: Record<string, number>;
  discwork?: { most: number[]; least: number[] };
  eq?: Record<string, number>;
  duty?: Record<string, number | string>;
  /** 开放题（P08 家庭变化、P09 最想先解决的一件事）的一句话补充：不参与计分，随答卷留存 */
  notes?: Record<string, string>;
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
  /** 岗位在机构链路中的位置（前段/中段/后段/通道） */
  track: string;
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

/** 高于这个分才叫「吃得开」。低于它就不往强项里写——把 55 分说成长处，报告就不可信了。 */
export const STRENGTH_LINE = 60;

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
  /* 强项先看这个岗的核心维，核心维不够强才拿重要维补。
     早前是「全池取最高两项」，结果几个岗列出来是同两个维度——
     「换个岗位会怎样」就白写了：人只有一套特质，高分维在哪儿都高。 */
  const byScore = (a: { score: number; weight: Weight }, b: { score: number; weight: Weight }) =>
    b.score - a.score || b.weight - a.weight;
  const core = pool.filter((p) => p.weight === 3 && p.score >= STRENGTH_LINE).sort(byScore);
  const extra = pool.filter((p) => p.weight < 3 && p.score >= STRENGTH_LINE).sort(byScore);
  const strengths = [...core, ...extra]
    .slice(0, 2)
    .map(({ dim, label, score }) => ({ dim, label, score }));
  const score = weightSum > 0 ? Math.round(sum / weightSum) : 0;
  return {
    job,
    label: JOB_LABEL[job],
    track: JOB_TRACK[job],
    score,
    gaps,
    weak,
    band: fitBand(score, gaps.length, weak.length),
    strengths,
    weightSum,
  };
}

/** 只出五个真实岗位的匹配；pot（潜质通道）由 potential.ts 单独评估。 */
export function allFits(dims: TalentDims): JobFit[] {
  return JOB_ORDER.map((j) => fitForJob(j, dims)).sort((a, b) => b.score - a.score);
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
