/**
 * 工作能力计分：按维度算正确率，再按岗位权重判断「能力达不达标」。
 *
 * 正确率不是百分位排名：题本自编、暂无常模，核心 55% / 重要 45% 是参考线，
 * 不是常模切点。权重表回答「这个岗位把哪项能力当核心」——
 * 财务的数字是核心，推广的数字是核心，潜质通道三项都是核心。
 */

import {
  COG_DIM_LABEL,
  cogItemsFor,
  type CogDim,
  type CogTrack,
} from "./cognitive-bank";
import type { JobKey } from "./score";

export const COG_WEIGHTS: Record<JobKey, Record<CogDim, 0 | 1 | 2 | 3>> = {
  mkt: { verbal: 2, numeric: 3, abstract: 2 },
  sales: { verbal: 3, numeric: 3, abstract: 2 },
  admin: { verbal: 2, numeric: 3, abstract: 1 },
  /* 财务教务：数字是核心，语言只要求看得懂、说得清，不要求说服 */
  fin: { verbal: 1, numeric: 3, abstract: 1 },
  service: { verbal: 3, numeric: 2, abstract: 2 },
  /* 潜质通道：三段管理都要，三项同为核心——管理者要能把话讲清、把账算清、把事想清 */
  pot: { verbal: 3, numeric: 3, abstract: 3 },
};

export const COG_CORE_LINE = 55;
export const COG_MAJOR_LINE = 45;

export const COG_WEIGHT_LABEL: Record<0 | 1 | 2 | 3, string> = { 0: "—", 1: "加分", 2: "重要", 3: "核心" };

const round = (n: number) => Math.round(n);

export type CogDimScore = { correct: number; total: number; rate: number };
export type CognitiveScores = {
  verbal: CogDimScore;
  numeric: CogDimScore;
  abstract: CogDimScore;
  overall: CogDimScore;
};

const dimScore = (dim: CogDim, ans: Record<string, number>, items: ReturnType<typeof cogItemsFor>): CogDimScore => {
  let correct = 0;
  const pool = items.filter((it) => it.dim === dim);
  for (const it of pool) {
    if (typeof ans[it.id] === "number" && ans[it.id] === it.answer) correct += 1;
  }
  const total = pool.length;
  return { correct, total, rate: total > 0 ? round((correct / total) * 100) : 0 };
};

export function scoreCognitive(ans: Record<string, number>, track: CogTrack = "edu"): CognitiveScores {
  const items = cogItemsFor(track);
  const verbal = dimScore("verbal", ans, items);
  const numeric = dimScore("numeric", ans, items);
  const abstract = dimScore("abstract", ans, items);
  const correct = verbal.correct + numeric.correct + abstract.correct;
  const total = verbal.total + numeric.total + abstract.total;
  return { verbal, numeric, abstract, overall: { correct, total, rate: total > 0 ? round((correct / total) * 100) : 0 } };
}

export type CogDimAssessment = {
  dim: CogDim;
  label: string;
  correct: number;
  total: number;
  rate: number;
  weight: 0 | 1 | 2 | 3;
  status: "met" | "edge" | "gap";
};

function cogStatus(rate: number, weight: 0 | 1 | 2 | 3): "met" | "edge" | "gap" {
  if (weight === 3) return rate >= COG_CORE_LINE ? "met" : rate >= 40 ? "edge" : "gap";
  if (weight === 2) return rate >= COG_MAJOR_LINE ? "met" : rate >= 30 ? "edge" : "gap";
  return rate >= COG_CORE_LINE ? "met" : "edge";
}

export type CognitiveAssessment = {
  dims: CogDimAssessment[];
  overall: CogDimScore;
  /** ok = 核心维全达标；partial = 核心维差一点；low = 核心维明显偏弱 */
  ability: "ok" | "partial" | "low";
  weak: { dim: CogDim; label: string; rate: number; status: "met" | "edge" | "gap" }[];
};

export function assessCognitive(scores: CognitiveScores, job: JobKey): CognitiveAssessment {
  const w = COG_WEIGHTS[job];
  const dims = (Object.keys(COG_DIM_LABEL) as CogDim[]).map((dim) => {
    const s = scores[dim];
    const weight = w[dim];
    return { dim, label: COG_DIM_LABEL[dim], correct: s.correct, total: s.total, rate: s.rate, weight, status: cogStatus(s.rate, weight) };
  });
  const core = dims.filter((d) => d.weight === 3);
  const weak = dims
    .filter((d) => d.weight >= 2 && d.status !== "met")
    .map((d) => ({ dim: d.dim, label: d.label, rate: d.rate, status: d.status }));
  const ability = core.some((d) => d.status === "gap") ? "low" : core.every((d) => d.status === "met") ? "ok" : "partial";
  return { dims, overall: scores.overall, ability, weak };
}

/* ------------------------------ 效度检查 ------------------------------ */

export const COG_TIME_LIMIT_SEC = 15 * 60;
export const COG_FAST_SEC = 180;
export const COG_MIN_RATE = 0.6;

export type CogValidity = {
  key: "fast" | "guessy" | "thin" | "ok";
  label: string;
  text: string;
  time: { usedSec: number; limitSec: number; state: "unknown" | "fast" | "over" | "normal"; text: string };
  doneRate: number;
};

/**
 * 正确率只有「作答方式正常」时才作数。三种异常：
 *  - 过快（< 3 分钟做完 21 题）：不是读题是蒙；
 *  - 倒置（难题对、易题错 ≥2）：疑似随机或对照答案键乱填；
 *  - 完成不足（< 60%）：正确率只反映答过的部分。
 */
export function cogValidity(
  scores: CognitiveScores,
  ans: Record<string, number>,
  usedSec: number,
  answeredCount: number | undefined,
  track: CogTrack = "edu",
): CogValidity {
  const total = scores.overall.total;
  const answered = answeredCount ?? Object.keys(ans).filter((k) => ans[k] != null && Number.isFinite(ans[k])).length;
  const doneRate = total > 0 ? answered / total : 0;
  const limitSec = COG_TIME_LIMIT_SEC;
  const state: CogValidity["time"]["state"] = !Number.isFinite(usedSec) || usedSec <= 0 ? "unknown" : usedSec < COG_FAST_SEC ? "fast" : usedSec > limitSec ? "over" : "normal";
  const timeText =
    state === "unknown"
      ? "未记录用时"
      : state === "fast"
        ? `用时 ${Math.round(usedSec / 60)} 分钟，明显快于读题节奏`
        : state === "over"
          ? `用时 ${Math.round(usedSec / 60)} 分钟，超出 ${limitSec / 60} 分钟限时`
          : `用时 ${Math.round(usedSec / 60)} 分钟（限时 ${limitSec / 60} 分钟）`;

  let hardRight = 0;
  let easyWrong = 0;
  for (const it of cogItemsFor(track)) {
    const v = ans[it.id];
    const right = typeof v === "number" && v === it.answer;
    if (it.difficulty === 3 && right) hardRight += 1;
    if (it.difficulty === 1 && typeof v === "number" && !right) easyWrong += 1;
  }
  const inverted = hardRight >= 2 && easyWrong >= 2;

  if (state === "fast") {
    return { key: "fast", label: "作答过快", text: "完成速度明显快于读题所需，正确率不宜作为能力判断依据，建议重测。", time: { usedSec, limitSec, state, text: timeText }, doneRate };
  }
  if (inverted) {
    return { key: "guessy", label: "作答模式异常", text: "难题答对、易题答错的情况出现两次以上，疑似随机作答，建议结合工作样本核实。", time: { usedSec, limitSec, state, text: timeText }, doneRate };
  }
  if (doneRate < COG_MIN_RATE) {
    return { key: "thin", label: "完成不足", text: `只答完 ${Math.round(doneRate * 100)}% 的题，正确率只反映答过的部分，不能当作能力上限。`, time: { usedSec, limitSec, state, text: timeText }, doneRate };
  }
  return { key: "ok", label: "正常", text: "用时、完成率、答题模式均未见异常，正确率可作为「能不能做」的参考。", time: { usedSec, limitSec, state, text: timeText }, doneRate };
}
