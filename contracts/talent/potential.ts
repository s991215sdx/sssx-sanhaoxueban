/**
 * 管理潜质评估（pot 通道）：不是「人岗匹配」，而是「该不该带人、能带哪一段」。
 *
 * 输出三件东西：
 *  1. 潜质指数（0–100）：五个管理相关的维度加权，只看「现在这一刻」；
 *  2. 四段适配（前 / 中 / 后 / 整体）：同样的人，在前段带销售和在
 *     后段带服务，要的维度组合不一样——指数相同，段不同，结论不同；
 *  3. 风险类型（抢单 / 老好人 / 救火 / 空转 / 稳当）：指数达标也可能
 *     带砸，砸的方式由风险项决定，不由分数决定。
 */

import { DIM_LABEL, type TalentDim, type TalentDims } from "./score";

export type TierKey = "front" | "mid" | "back" | "top";

export const TIER_LABEL: Record<TierKey, string> = {
  front: "前段管理",
  mid: "中段管理",
  back: "后段管理",
  top: "整体管理",
};

export const TIER_ROLE: Record<TierKey, string> = {
  front: "销售主管、市场主管",
  mid: "人事主管、财务教务主管",
  back: "教学服务主管、教研主管",
  top: "校区负责人、校长",
};

/** 四段各自看重的维度组合。weight 0 = 这一段不看这项。 */
export const TIER_WEIGHTS: Record<TierKey, Record<TalentDim, number>> = {
  front: {
    /* 前段管理：带着一群人冲数——自己得敢冲，也得让人愿意跟着冲 */
    lead: 3, drive: 3, influence: 2, stable: 2, duty: 2,
    order: 1, empathy: 1, rule: 1, achieve: 2, detail: 1,
  },
  mid: {
    /* 中段管理：流程、合规、不出事——冲劲在这里反而是干扰项 */
    lead: 3, drive: 1, influence: 1, stable: 2, duty: 3,
    order: 3, empathy: 1, rule: 2, achieve: 0, detail: 2,
  },
  back: {
    /* 后段管理：交付质量与人的情绪都在他手上 */
    lead: 3, drive: 1, influence: 1, stable: 3, duty: 3,
    order: 2, empathy: 3, rule: 1, achieve: 1, detail: 1,
  },
  top: {
    /* 整体管理：三段都要看，所以不能有单项塌陷，但也不能样样都要 */
    lead: 3, drive: 3, influence: 2, stable: 3, duty: 2,
    order: 1, empathy: 2, rule: 2, achieve: 2, detail: 1,
  },
};

export const TIER_ORDER: TierKey[] = ["front", "mid", "back", "top"];

export const INDEX_WEIGHTS: { dim: TalentDim; w: number }[] = [
  { dim: "lead", w: 0.34 },
  { dim: "stable", w: 0.22 },
  { dim: "duty", w: 0.18 },
  { dim: "drive", w: 0.16 },
  { dim: "achieve", w: 0.1 },
];

export type BandKey = "team" | "trial" | "hold" | "no";

export const BAND_LABEL: Record<BandKey, string> = {
  team: "可以给团队",
  trial: "先小步试",
  hold: "暂不建议转管理",
  no: "不建议往管理推",
};

export const BAND_TEXT: Record<BandKey, string> = {
  team: "该有的几项都在，且没有明显塌陷。可以给 5—8 人的团队，配一个可复盘的季度目标。",
  trial: "底子是有的，但有一两项还不稳。先给 3 人左右的小团队试半年，把带人的动作练成习惯再扩。",
  hold: "现在推上去，多半是把一个做得好的位置，换到一个做得难受的位置。先留在专业线，补齐短板再谈。",
  no: "不是「人不行」，是他现在这套做事方式和管理岗位的日常差得太远。硬推，双方都会难受。",
};

export type RiskKey = "grab" | "nice" | "firefight" | "idle" | "steady";

export const RISK_INFO: Record<RiskKey, { key: RiskKey; label: string; text: string }> = {
  grab: {
    key: "grab",
    label: "抢单型",
    text: "目标驱动和领导动机都高，但共情偏低。带人时会不知不觉跟下属抢客户、抢功劳，团队里强的人先走。",
  },
  nice: {
    key: "nice",
    label: "老好人型",
    text: "共情高、领导动机低。不敢讲重话，问题一直拖着，直到有人递辞职信才发现。",
  },
  firefight: {
    key: "firefight",
    label: "救火型",
    text: "目标驱动高、条理偏低。天天在补昨天的窟窿，团队永远建不起流程，越带越累。",
  },
  idle: {
    key: "idle",
    label: "空转型",
    text: "领导动机高、成就动机低。喜欢「带人」这个身份，对结果不上心，会多、进展少。",
  },
  steady: {
    key: "steady",
    label: "稳当型",
    text: "没有明显偏科，也没有靠单项硬撑。这类人带团队不容易出大事，缺点是短期爆发力一般。",
  },
};

const clamp3 = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

function weighted(tier: TierKey, dims: TalentDims) {
  const w = TIER_WEIGHTS[tier];
  let sum = 0;
  let ws = 0;
  const gaps: { dim: TalentDim; label: string; score: number }[] = [];
  for (const dim of Object.keys(w) as TalentDim[]) {
    const weight = w[dim];
    if (weight === 0) continue;
    sum += dims[dim] * weight;
    ws += weight;
    if (weight === 3 && dims[dim] < 40) gaps.push({ dim, label: DIM_LABEL[dim], score: dims[dim] });
  }
  return { score: ws > 0 ? Math.round(sum / ws) : 0, gaps };
}

function bandOf2(index: number, gapCount: number, risk: RiskKey): BandKey {
  let base: BandKey = index >= 75 ? "team" : index >= 60 ? "trial" : index >= 45 ? "hold" : "no";
  if (gapCount >= 2) return "no";
  if (gapCount === 1 && base === "team") base = "trial";
  if (risk === "grab" && base === "team") base = "trial";
  return base;
}

function riskOf(dims: TalentDims): RiskKey {
  const { drive, lead, empathy, order: order2, achieve } = dims;
  if (drive >= 65 && lead >= 65 && empathy < 45) return "grab";
  if (empathy >= 65 && lead < 50) return "nice";
  if (drive >= 65 && order2 < 45) return "firefight";
  if (lead >= 65 && achieve < 45) return "idle";
  return "steady";
}

export type PotentialAssessment = {
  index: number;
  band: BandKey;
  bandLabel: string;
  bandText: string;
  teamSize: string;
  leadMeasured: boolean;
  layers: { tier: TierKey; label: string; role: string; score: number; gaps: { dim: TalentDim; label: string; score: number }[] }[];
  best: { tier: TierKey; label: string; role: string; score: number; gaps: { dim: TalentDim; label: string; score: number }[] };
  risk: { key: RiskKey; label: string; text: string };
  drags: { dim: TalentDim; label: string; score: number }[];
  notes: string[];
};

export function buildPotential(dims: TalentDims, opts: { leadMeasured?: boolean } = {}): PotentialAssessment {
  const leadMeasured = opts.leadMeasured ?? true;
  let sum = 0;
  let ws = 0;
  for (const it of INDEX_WEIGHTS) {
    sum += dims[it.dim] * it.w;
    ws += it.w;
  }
  const index = clamp3(ws > 0 ? sum / ws : 0);
  const layers = TIER_ORDER.map((tier) => {
    const r = weighted(tier, dims);
    return { tier, label: TIER_LABEL[tier], role: TIER_ROLE[tier], score: r.score, gaps: r.gaps };
  });
  const best = [...layers].sort((a, b) => b.score - a.score)[0] ?? layers[0];
  const risk = riskOf(dims);
  const gapCount = best.gaps.length;
  const band = bandOf2(index, gapCount, risk);
  const teamSize = band === "team" ? "5—8 人" : band === "trial" ? "3 人左右" : band === "hold" ? "不带人，先做专业线" : "暂不带人";
  const drags = INDEX_WEIGHTS.map((it) => ({ dim: it.dim, label: DIM_LABEL[it.dim], score: dims[it.dim] }))
    .filter((d) => d.score < 55)
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const notes = [
    "潜质指数看的是「现在这一刻」，不是终身判定。人在带人的位置上会变，半年后可以重测。",
    "带人这件事，测评的预测力低于「他真的带过一小队人」。指数只用来决定「要不要给机会」，不用来定「给多大机会」——后者看试用期的实际结果。",
  ];
  if (!leadMeasured) {
    notes.unshift("本次未完成管理加测，领导动机是按其他维度估算的。这一项恰好是潜质里权重最高的，结论只能当参考，建议补测后再定。");
  }
  if (risk === "grab") {
    notes.push("这一类的风险不在能力，在带法：他越能干，越容易把下属的活接过来自己干。带教时要把「不许抢下属的单」写成明确规则。");
  }
  return {
    index,
    band,
    bandLabel: BAND_LABEL[band],
    bandText: BAND_TEXT[band],
    teamSize,
    leadMeasured,
    layers,
    best,
    risk: RISK_INFO[risk],
    drags,
    notes,
  };
}
