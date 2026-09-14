/**
 * 心理健康筛查测评题库、计分器与报告文案生成。
 *
 * 【V2 · 通用版】国际通用筛查量表：PHQ-9（抑郁筛查，9 题）
 * + GAD-7（焦虑筛查，7 题），共 16 题，四级评分（0=完全不会 / 1=好几天 /
 * 2=超过一半的天数 / 3=几乎天天），引导语「过去两周里，你有多少天受到
 * 以下问题困扰？」。见文件底部 MENTAL_V2_* 与 scoreMental。
 *
 * 【V40 · 学生版 A】SDQ 长处与困难问卷学生自评版（25 题 + 1 条安全预警题），
 * 五维度：情绪/品行/多动注意/同伴交往/亲社会。见 MENTAL_SDQ_* 与 scoreMentalSdq。
 *
 * 【V40/V42 · 学生版 B】PHQ-A（青少年抑郁筛查 9 题）+ GAD-7（V42 起恢复原版标准措辞），
 * 共 16 题，四级评分同 V2。见 MENTAL_PA_* 与 scoreMentalPa。
 *
 * 【V1 · 旧版（保留兼容）】SCL-90 式中学生适配版，30 题 10 因子 5 级评分。
 * 旧版类型与计分（scoreMentalLegacy / buildMentalReport 等）全部保留，
 * 供报告层对历史数据做兼容展示；新作答一律走 V2。
 *
 * 重要声明：本评估为筛查参考，不构成医学诊断。阳性明显时建议前往
 * 专业心理/医疗机构进一步评估。
 *
 * 前后端共享：纯类型、纯数据、纯函数，不依赖服务端或 React。
 */

export type MentalFactor = "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7" | "F8" | "F9" | "F10";

/** 固定因子序。 */
export const MENTAL_FACTOR_ORDER: MentalFactor[] = ["F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8", "F9", "F10"];

/** 因子中文名。 */
export const MENTAL_FACTOR_LABEL: Record<MentalFactor, string> = {
  F1: "躯体化",
  F2: "强迫症状",
  F3: "人际关系敏感",
  F4: "抑郁",
  F5: "焦虑",
  F6: "敌对",
  F7: "恐怖",
  F8: "偏执",
  F9: "急性症状",
  F10: "睡眠及饮食",
};

/** 免责声明（报告与打印件必须展示）。 */
export const MENTAL_DISCLAIMER =
  "免责声明：本评估为筛查参考，不构成医学诊断，也不能替代专业医生或心理咨询师的评估。若阳性项目较多或某个因子程度明显（均分超过 2 分），建议前往专业心理或医疗机构进一步评估，可使用 SDS（抑郁自评量表）、SAS（焦虑自评量表）做进一步筛查。如果低落、焦虑或睡眠问题持续两周以上，请务必告诉家长或老师——主动求助是勇敢，不是软弱。";

export type MentalRating = {
  no: number;
  /** 近一周的状态描述。 */
  text: string;
  factor: MentalFactor;
};

export type MentalBand = "无" | "轻度" | "中度" | "重度";

export type MentalResult = {
  /** 总分（30 题原始分求和，30-150）。 */
  total: number;
  /** 阳性项目数（单项评分 ≥ 2 的题数）。 */
  positiveCount: number;
  /** 各因子均分，保留 2 位小数，范围 1-5。 */
  factors: Record<MentalFactor, number>;
  /** 阳性因子（均分 > 2）。 */
  positiveFactors: MentalFactor[];
  /** 整体状态：良好 / 关注 / 预警。 */
  level: "良好" | "关注" | "预警";
  summary: string;
};

/* 每因子 3 题：SCL-90 风格、中学生语境，均为「近一周」的状态描述。 */
const MENTAL_BANK: Record<MentalFactor, string[]> = {
  F1: ["头痛或头晕", "身体酸痛、乏力、提不起劲", "恶心或胃部不舒服"],
  F2: ["反复检查（作业、书包、门锁），不查就不放心", "脑子里的想法停不下来，明知没必要也忍不住", "做事必须按固定顺序，否则心里难受"],
  F3: ["觉得别人不理解自己、不同情自己", "和同学在一起感到不自在", "特别在意别人对自己的看法"],
  F4: ["心情低落、闷闷不乐", "对以前喜欢的事情提不起兴趣", "觉得未来没有什么希望"],
  F5: ["容易紧张、心里发慌", "为还没发生的事（如考试）过度担心", "莫名其妙地感到不安"],
  F6: ["容易烦躁、发脾气", "有想摔东西或大喊的冲动", "忍不住和人争吵"],
  F7: ["害怕独处、黑暗或某些场所", "害怕在众人面前发言或被注视", "因为害怕而回避某些场合"],
  F8: ["总觉得别人在针对自己", "怀疑别人在背后议论自己", "很难信任别人"],
  F9: ["脑子突然一片空白", "感觉周围的事物不真实", "突然一阵情绪失控的感觉"],
  F10: ["入睡困难、睡不踏实或早醒", "食欲明显变化（吃不下或吃得特别多）", "白天没精神、总是犯困"],
};

/** 心理健康题库：30 道 Likert 题（1-5），每因子 3 题，按因子分组排列。 */
export const MENTAL_RATINGS: MentalRating[] = MENTAL_FACTOR_ORDER.flatMap((factor) =>
  MENTAL_BANK[factor].map((text) => ({ factor, text })),
).map((q, i) => ({ no: i + 1, ...q }));

/** 每因子题数。 */
export const MENTAL_PER_DIM = 3;

/** 因子均分 → 程度分档（<2 无 / <2.5 轻度 / <3 中度 / ≥3 重度）。 */
export function mentalBand(score: number): MentalBand {
  if (score >= 3) return "重度";
  if (score >= 2.5) return "中度";
  if (score >= 2) return "轻度";
  return "无";
}

/* ---------------- 计分 ---------------- */

/**
 * 【旧版 V1】心理健康计分。ratings[i]：第 i+1 题自评分（1-5）；长度须为 30。
 * - 总分 = 30 题原始分求和；
 * - 阳性项目数 = 单项 ≥ 2 的题数；
 * - 因子均分保留 2 位小数，均分 > 2 为阳性线；
 * - level：任一因子均分 ≥ 3 为「预警」；存在阳性因子或总分 ≥ 60 为「关注」；否则「良好」。
 * 仅供历史数据兼容，新作答请用 scoreMental（PHQ-9 + GAD-7 版）。
 */
export function scoreMentalLegacy(ratings: number[]): MentalResult {
  if (ratings.length !== MENTAL_RATINGS.length) {
    throw new Error(`心理健康测评题数应为 ${MENTAL_RATINGS.length}，实际 ${ratings.length}`);
  }
  const sum: Record<MentalFactor, number> = { F1: 0, F2: 0, F3: 0, F4: 0, F5: 0, F6: 0, F7: 0, F8: 0, F9: 0, F10: 0 };
  const cnt: Record<MentalFactor, number> = { F1: 0, F2: 0, F3: 0, F4: 0, F5: 0, F6: 0, F7: 0, F8: 0, F9: 0, F10: 0 };
  let total = 0;
  let positiveCount = 0;
  ratings.forEach((raw, i) => {
    if (!Number.isInteger(raw) || raw < 1 || raw > 5) {
      throw new Error(`第 ${i + 1} 题分值应为 1-5，实际 ${raw}`);
    }
    const f = MENTAL_RATINGS[i].factor;
    sum[f] += raw;
    cnt[f] += 1;
    total += raw;
    if (raw >= 2) positiveCount += 1;
  });
  const factors = Object.fromEntries(
    MENTAL_FACTOR_ORDER.map((k) => [k, Math.round((sum[k] / cnt[k]) * 100) / 100]),
  ) as Record<MentalFactor, number>;
  const positiveFactors = MENTAL_FACTOR_ORDER.filter((k) => factors[k] > 2);
  const level: MentalResult["level"] =
    MENTAL_FACTOR_ORDER.some((k) => factors[k] >= 3) ? "预警" : positiveFactors.length > 0 || total >= 60 ? "关注" : "良好";
  const topPositive = positiveFactors.slice(0, 3).map((k) => MENTAL_FACTOR_LABEL[k]);
  const summary =
    level === "良好"
      ? "近一周你的整体状态不错，各因子均在平稳范围内。状态会有起伏，记得继续保持规律的作息和运动。"
      : level === "关注"
        ? `近一周有些方面需要留意${topPositive.length > 0 ? `（${topPositive.join("、")}均分略高）` : ""}。先别紧张——这更像身体发出的「需要休息和照顾」的信号，按下面的建议照顾自己，一两周后可以再测一次对比。`
        : `近一周有因子得分明显偏高（${topPositive.join("、")}），请认真对待这个信号：先告诉家长或信任的老师，必要时寻求专业帮助。这不丢人，是对自己负责。`;
  return { total, positiveCount, factors, positiveFactors, level, summary };
}

/* ---------------- 报告内容 ---------------- */

type MentalContent = {
  /** 指标含义。 */
  meaning: string;
  /** 风险解读（程度偏高时意味着什么）。 */
  riskText: string;
  /** 改善建议（落到学习与日常生活）。 */
  advice: string[];
};

const MENTAL_CONTENT: Record<MentalFactor, MentalContent> = {
  F1: {
    meaning: "躯体化反映心理压力转化成身体不舒服的程度：头痛、乏力、肠胃不适等，查不出原因时常常与压力有关。",
    riskText: "偏高说明压力可能正在通过身体「说话」——不是装病，是身体在替你报警。",
    advice: ["保证每天 30 分钟户外活动或运动，身体的放松会带动心理的放松", "学习每 40 分钟起身活动 5 分钟，拉伸、远眺", "身体不适持续两周以上，请告诉家长并就医排查"],
  },
  F2: {
    meaning: "强迫症状反映那些「明知没必要却停不下来」的想法和行为，常与紧绷和追求完美有关。",
    riskText: "偏高说明你最近可能把自己绷得太紧，对「确定感」的需求过了头，反而更累。",
    advice: ["给自己设「检查上限」：作业检查一遍就交，书包整理一次就出门", "允许作业有 20% 的不完美，先完成再完美", "反复的念头出现时，写下来放进「烦恼停车场」，睡前统一看一眼"],
  },
  F3: {
    meaning: "人际关系敏感反映在与同学、老师相处时的不自在感和对别人看法的在意程度。",
    riskText: "偏高说明你可能把很多精力耗在了「别人怎么看我」上，留给学习的能量就被挤占了。",
    advice: ["记住「焦点效应」：别人对你的关注远没有你想象的多", "每天主动做一个小的友善举动（打招呼、帮个小忙），关系会在行动中变松", "被一句话困扰时，写下来问自己「三天后这事还重要吗」"],
  },
  F4: {
    meaning: "抑郁因子反映情绪低落、兴趣减退和希望感的程度，是需要被温柔对待的信号。",
    riskText: "偏高说明你的「心理电量」偏低，这不是懒也不是矫情，是需要休息和支持的状态。",
    advice: ["每天记录一件「还不错的小事」，帮大脑重新注意到好消息", "保持最低限度的运动和晒太阳，身体动起来情绪才有出口", "低落持续两周以上，务必告诉家长或老师，并考虑专业帮助（可先用 SDS 自评）"],
  },
  F5: {
    meaning: "焦虑因子反映紧张、担心、心慌的程度，考试季出现轻度焦虑非常常见。",
    riskText: "偏高说明你的「担心系统」最近超负荷运转，适度的紧张助人，过度的担心耗人。",
    advice: ["考前焦虑时做 4-7-8 呼吸：吸气 4 秒、屏息 7 秒、呼气 8 秒，连做三轮", "把担心写下来并加一句「那我能做什么」，把焦虑翻译成行动", "睡前 1 小时不刷题不刷手机，给大脑一个「降速档」（持续明显可用 SAS 自评）"],
  },
  F6: {
    meaning: "敌对因子反映烦躁、易怒和冲动的程度，常常是压力积攒后的「出口」。",
    riskText: "偏高说明你心里积攒了不少没被消化的情绪，发脾气之后往往自己也不好受。",
    advice: ["发火前给自己一个「暂停 10 秒」：先离开现场，喝口水再回来", "用运动给情绪找出口：跑步、打球、跳绳，汗水是最好的灭火器", "事后主动修复一句「刚才我语气重了」，关系和你的心情都会轻松很多"],
  },
  F7: {
    meaning: "恐怖因子反映对特定场合、独处或被关注的害怕与回避程度。",
    riskText: "偏高说明有些害怕正在限制你的活动范围，越回避它往往越强大。",
    advice: ["用「阶梯法」面对害怕：从最不紧张的场景开始，一小步一小步靠近", "发言前把要说的第一句话写在纸上，开头顺了后面就顺了", "每完成一次小小的「面对」，记录并奖励自己一次"],
  },
  F8: {
    meaning: "偏执因子反映猜疑、防备和难以信任的程度，常常与不安全感有关。",
    riskText: "偏高说明你可能习惯了先防备别人，这会让你在集体里感到孤单和消耗。",
    advice: ["当觉得「别人针对我」时，先列出 3 种其他可能的解释再下结论", "主动验证一次：直接、友好地问清楚，多数误会开口就散", "每周和一位信任的人聊一次天，安全感来自真实的连接"],
  },
  F9: {
    meaning: "急性症状反映突发的失控感、空白感或不真实感，是压力过高时的「过载警报」。",
    riskText: "偏高说明你最近的压力可能已经超过了承受上限，需要认真对待而不是硬扛。",
    advice: ["这种感受出现时，用「5-4-3-2-1」落地法：说出你看到的 5 样东西、听到的 4 种声音、摸到的 3 件物品、闻到的 2 种气味、尝到的 1 种味道", "立刻告诉家长或老师你的感受，不要一个人扛", "若反复出现，请家长陪同前往专业机构评估——这和感冒看医生一样正常"],
  },
  F10: {
    meaning: "睡眠及饮食因子反映入睡、睡眠质量和食欲的状况，是所有状态的地基。",
    riskText: "偏高说明你的「地基」最近在晃——睡不好吃不好，白天任何努力都会事倍功半。",
    advice: ["固定起床和入睡时间，周末偏差不超过 1 小时", "睡前 1 小时远离手机，卧室只用来睡觉", "三餐规律，别用零食代替正餐；睡眠问题持续两周请告诉家长"],
  },
};

/** 因子详细报告条目。 */
export type MentalFactorReport = {
  factor: MentalFactor;
  label: string;
  /** 因子均分（2 位小数）。 */
  score: number;
  band: MentalBand;
  meaning: string;
  riskText: string;
  advice: string[];
};

export type MentalReport = {
  total: number;
  positiveCount: number;
  level: MentalResult["level"];
  factors: MentalFactorReport[];
  disclaimer: string;
};

/**
 * 生成心理健康报告：总分与阳性项目数概览 + 每因子的指标含义 /
 * 风险解读 / 改善建议 + 程度分档 + 免责声明。
 */
export function buildMentalReport(result: MentalResult): MentalReport {
  const factors = MENTAL_FACTOR_ORDER.map((f) => {
    const c = MENTAL_CONTENT[f];
    const score = result.factors[f];
    return {
      factor: f,
      label: MENTAL_FACTOR_LABEL[f],
      score,
      band: mentalBand(score),
      meaning: c.meaning,
      riskText: c.riskText,
      advice: c.advice,
    };
  });
  return {
    total: result.total,
    positiveCount: result.positiveCount,
    level: result.level,
    factors,
    disclaimer: MENTAL_DISCLAIMER,
  };
}

/* ============================================================================
 * V2 · PHQ-9 + GAD-7 专业筛查版（国际通用筛查工具）
 * ============================================================================
 * - PHQ-9（Patient Health Questionnaire-9）：抑郁筛查，9 题，总分 0-27；
 * - GAD-7（Generalized Anxiety Disorder-7）：焦虑筛查，7 题，总分 0-21；
 * - 每题四级评分：0=完全不会 / 1=好几天 / 2=超过一半的天数 / 3=几乎天天；
 * - 分级（两表通用）：0-4 良好 / 5-9 关注（轻度）/ 10-14 预警（中度）/ ≥15 高风险（中重度/重度）；
 * - 综合 level 取两表分级中较重者；
 * - 红线：PHQ-9 第 9 题（自伤念头）≥1 直接 selfHarm=true，level 至少「高风险」；
 * - positives = 16 题中得分 ≥2 的题数。
 * 题干为标准量表条目，不得随意改写。
 */

/** V2 总题数（PHQ-9 九题 + GAD-7 七题）。 */
export const MENTAL_V2_QUESTION_COUNT = 16;

/** V2 作答引导语（两段通用）。 */
export const MENTAL_V2_INTRO = "过去两周里，你有多少天受到以下问题困扰？";

/** V2 四级选项（分值 0-3）。 */
export const MENTAL_V2_OPTIONS = [
  { value: 0, label: "完全不会" },
  { value: 1, label: "好几天" },
  { value: 2, label: "超过一半的天数" },
  { value: 3, label: "几乎天天" },
] as const;

/** V2 免责声明（答题末尾与报告必须展示）。 */
export const MENTAL_V2_DISCLAIMER =
  "免责声明：本量表为国际通用筛查工具（PHQ-9 / GAD-7），结果仅供筛查参考，不构成医学诊断，也不能替代专业医生或心理咨询师的评估。若得分偏高，或 PHQ-9 第 9 题不是「完全不会」，请尽快告诉家长或老师，必要时前往专业心理/医疗机构评估，或拨打全国心理援助热线 12356。主动求助是勇敢，不是软弱。";

/** PHQ-9 第 9 题（自伤念头）的红线提示（题干下方小字）。 */
export const MENTAL_V2_ITEM9_NOTICE =
  "如果这题不是「完全不会」，建议尽快告诉家长或老师，必要时拨打心理援助热线 12356。";

export type MentalV2SectionKey = "phq9" | "gad7";

export type MentalV2Question = {
  /** 全局题号 1-16（1-9 为 PHQ-9，10-16 为 GAD-7）。 */
  no: number;
  text: string;
};

export type MentalV2Section = {
  key: MentalV2SectionKey;
  /** 分段标题。 */
  title: string;
  /** 分段说明（含量表来源与用途）。 */
  description: string;
  /** 作答引导语。 */
  intro: string;
  questions: MentalV2Question[];
};

const PHQ9_TEXTS = [
  "做事时提不起劲或没有乐趣",
  "感到心情低落、沮丧或绝望",
  "入睡困难、睡不安稳或睡得过多",
  "感觉疲倦或没有精力",
  "食欲不振或吃得太多",
  "觉得自己很糟、很失败，或让自己或家人失望",
  "难以集中注意力，例如看报纸或看电视时",
  "动作或说话速度缓慢到别人已经察觉；或正好相反，烦躁或坐立不安、动来动去的情况比平时更多",
  "有不如死掉，或用某种方式伤害自己的念头",
];

const GAD7_TEXTS = [
  "感到紧张、焦虑或着急",
  "无法停止或控制担忧",
  "对各种各样的事情过度担忧",
  "很难放松下来",
  "坐立不安，难以安静地坐着",
  "变得容易烦恼或易怒",
  "感到害怕，仿佛有可怕的事情要发生",
];

/** V2 题库：两段结构（PHQ-9 九题 + GAD-7 七题），题号全局 1-16。 */
export const MENTAL_V2_SECTIONS: MentalV2Section[] = [
  {
    key: "phq9",
    title: "第一部分 · PHQ-9 抑郁筛查（9 题）",
    description: "PHQ-9 是国际通用的抑郁筛查量表，看最近两周情绪与状态方面的困扰。",
    intro: MENTAL_V2_INTRO,
    questions: PHQ9_TEXTS.map((text, i) => ({ no: i + 1, text })),
  },
  {
    key: "gad7",
    title: "第二部分 · GAD-7 焦虑筛查（7 题）",
    description: "GAD-7 是国际通用的焦虑筛查量表，看最近两周紧张、担忧方面的困扰。",
    intro: MENTAL_V2_INTRO,
    questions: GAD7_TEXTS.map((text, i) => ({ no: i + 10, text })),
  },
];

/** V2 分级：0-4 良好 / 5-9 关注（轻度）/ 10-14 预警（中度）/ ≥15 高风险（中重度/重度）。 */
export type MentalV2Band = "良好" | "关注" | "预警" | "高风险";

export function mentalV2Band(score: number): MentalV2Band {
  if (score >= 15) return "高风险";
  if (score >= 10) return "预警";
  if (score >= 5) return "关注";
  return "良好";
}

const MENTAL_V2_BAND_ORDER: MentalV2Band[] = ["良好", "关注", "预警", "高风险"];

/** V2 计分结果。 */
export type MentalV2Result = {
  version: "v2";
  /** PHQ-9 总分（0-27）。 */
  phq9: number;
  /** GAD-7 总分（0-21）。 */
  gad7: number;
  phq9Level: MentalV2Band;
  gad7Level: MentalV2Band;
  /** 综合等级：取两者较重者；selfHarm 时至少「高风险」。 */
  level: MentalV2Band;
  /** 红线：PHQ-9 第 9 题（自伤念头）≥1。 */
  selfHarm: boolean;
  /** 得分 ≥2 的题数（0-16）。 */
  positives: number;
  summary: string;
};

/**
 * V2 计分。answers[i]：第 i+1 题作答（0-3 整数），长度须为 16（前 9 题 PHQ-9，后 7 题 GAD-7）。
 */
export function scoreMental(answers: number[]): MentalV2Result {
  if (answers.length !== MENTAL_V2_QUESTION_COUNT) {
    throw new Error(`心理健康测评题数应为 ${MENTAL_V2_QUESTION_COUNT}，实际 ${answers.length}`);
  }
  answers.forEach((raw, i) => {
    if (!Number.isInteger(raw) || raw < 0 || raw > 3) {
      throw new Error(`第 ${i + 1} 题分值应为 0-3，实际 ${raw}`);
    }
  });
  const phq9 = answers.slice(0, 9).reduce((s, v) => s + v, 0);
  const gad7 = answers.slice(9).reduce((s, v) => s + v, 0);
  const phq9Level = mentalV2Band(phq9);
  const gad7Level = mentalV2Band(gad7);
  const selfHarm = answers[8] >= 1;
  const positives = answers.filter((v) => v >= 2).length;
  const heavier = MENTAL_V2_BAND_ORDER[Math.max(
    MENTAL_V2_BAND_ORDER.indexOf(phq9Level),
    MENTAL_V2_BAND_ORDER.indexOf(gad7Level),
  )];
  const level: MentalV2Band = selfHarm
    ? MENTAL_V2_BAND_ORDER[Math.max(MENTAL_V2_BAND_ORDER.indexOf(heavier), MENTAL_V2_BAND_ORDER.indexOf("高风险"))]
    : heavier;
  const summary = selfHarm
    ? "这次筛查中，你在「有不如死掉或伤害自己的念头」一题上的选择需要被认真对待——请一定告诉家长或信任的老师，必要时拨打心理援助热线 12356 或前往专业机构。这不是矫情，是对自己负责。"
    : level === "良好"
      ? "过去两周你的情绪状态总体平稳（PHQ-9 / GAD-7 均在良好范围）。状态会有起伏，继续保持规律作息和运动就好。"
      : level === "关注"
        ? `过去两周有一些轻度困扰信号（PHQ-9 ${phq9} 分「${phq9Level}」，GAD-7 ${gad7} 分「${gad7Level}」）。先别紧张——这更像「需要休息和照顾」的信号，一两周后可以再测一次对比。`
        : level === "预警"
          ? `过去两周的困扰达到中度（PHQ-9 ${phq9} 分「${phq9Level}」，GAD-7 ${gad7} 分「${gad7Level}」）。建议把结果告诉家长或老师，考虑找学校心理老师聊一聊，必要时前往专业机构进一步评估。`
          : `过去两周的困扰比较明显（PHQ-9 ${phq9} 分「${phq9Level}」，GAD-7 ${gad7} 分「${gad7Level}」）。请认真对待这个信号：尽快告诉家长或信任的老师，并前往专业心理/医疗机构评估——这和感冒看医生一样正常。`;
  return { version: "v2", phq9, gad7, phq9Level, gad7Level, level, selfHarm, positives, summary };
}

/** 判断是否为 V2（PHQ-9 + GAD-7）结果（类型守卫）；旧版 V1 结果返回 false。 */
export function isMentalV2(x: unknown): x is MentalV2Result {
  return !!x && typeof x === "object" && (x as { version?: string }).version === "v2";
}


/* ============================================================================
 * V40 · 学生版 A：SDQ 长处与困难问卷（学生自评版，25 题 + 1 条安全预警题）
 * ============================================================================
 * - SDQ（Strengths and Difficulties Questionnaire）是国际通用的儿童青少年
 *   行为筛查问卷；学生自评版官方适用 11—17 岁，11 岁以下建议家长陪同读题。
 * - 25 题分五维（每维 5 题）：情绪症状 / 品行问题 / 多动与注意 / 同伴交往 /
 *   亲社会行为（优势维度，分越高越好，其余四维分越低越好）。
 * - 三级评分：0=不符合 / 1=有点符合 / 2=完全符合；引导语「过去六个月」。
 * - 第 7、11、14、21、25 题为反向计分（2 - 原值）。
 * - 另加第 26 题安全预警题（自伤念头），不计入任何维度，≥1 直接红线。
 * - 分档（学生自评官方切点）：困难总分（情绪+品行+多动+同伴，0-40）
 *   0-15 正常 / 16-19 边缘 / 20-40 明显；各维度见 SDQ_BANDS。
 */

export type SdqDim = "emotion" | "conduct" | "hyper" | "peer" | "prosocial";

export const SDQ_DIM_LABEL: Record<SdqDim, string> = {
  emotion: "情绪症状",
  conduct: "品行问题",
  hyper: "多动与注意",
  peer: "同伴交往",
  prosocial: "亲社会行为",
};

/** SDQ 适用年龄说明（答题页与报告展示）。 */
export const MENTAL_SDQ_AGE = "适用 4—17 岁：学生自己填写；11 岁以下请家长引导填写（陪同读题、帮助理解题意，答案仍由孩子自己选）";

/** SDQ 作答引导语。 */
export const MENTAL_SDQ_INTRO = "请根据你过去六个月的实际情况，选择最符合你的一项——没有对错，如实就好。";

/** SDQ 三级选项（分值 0-2）。 */
export const MENTAL_SDQ_OPTIONS = [
  { value: 0, label: "不符合" },
  { value: 1, label: "有点符合" },
  { value: 2, label: "完全符合" },
] as const;

export type MentalSdqQuestion = {
  no: number;
  text: string;
  dim?: SdqDim;
  /** 反向计分（2 - 原值）。 */
  reverse?: boolean;
  /** 安全预警题：不计入维度分，≥1 触发红线。 */
  safety?: boolean;
};

/** SDQ 学生自评版 25 题（标准条目）+ 第 26 题安全预警题。 */
export const MENTAL_SDQ_QUESTIONS: MentalSdqQuestion[] = [
  { no: 1, text: "我尝试对别人友善，我关心别人的感受", dim: "prosocial" },
  { no: 2, text: "我不能安定下来，不能长时间安静地坐着", dim: "hyper" },
  { no: 3, text: "我经常头痛、肚子痛或身体不舒服", dim: "emotion" },
  { no: 4, text: "我常与别人分享东西（食物、玩具、笔等）", dim: "prosocial" },
  { no: 5, text: "我觉得非常愤怒，常发脾气", dim: "conduct" },
  { no: 6, text: "我经常独处，通常一个人玩", dim: "peer" },
  { no: 7, text: "我通常按照吩咐做事", dim: "conduct", reverse: true },
  { no: 8, text: "我经常担忧，心事重重", dim: "emotion" },
  { no: 9, text: "如果有人受伤、难过或不舒服，我都乐意帮忙", dim: "prosocial" },
  { no: 10, text: "我经常坐立不安或感到不耐烦", dim: "hyper" },
  { no: 11, text: "我有一个或几个好朋友", dim: "peer", reverse: true },
  { no: 12, text: "我经常与人争执，我能使别人照我的想法做", dim: "conduct" },
  { no: 13, text: "我经常不快乐、心情沉重或想哭", dim: "emotion" },
  { no: 14, text: "一般来说，其他和我年纪差不多的人都喜欢我", dim: "peer", reverse: true },
  { no: 15, text: "我容易分心，觉得难以集中精神", dim: "hyper" },
  { no: 16, text: "在新的环境中我会紧张，容易失去自信", dim: "emotion" },
  { no: 17, text: "我会友善地对待比我小的孩子", dim: "prosocial" },
  { no: 18, text: "我常被指责撒谎或不老实", dim: "conduct" },
  { no: 19, text: "其他同学或青少年常捉弄或欺负我", dim: "peer" },
  { no: 20, text: "我常自愿帮助别人（家人、老师、同学）", dim: "prosocial" },
  { no: 21, text: "我做事前会先想清楚", dim: "hyper", reverse: true },
  { no: 22, text: "我曾从家里、学校或别处拿过不属于我的东西", dim: "conduct" },
  { no: 23, text: "我和大人相处，比和同辈相处更融洽", dim: "peer" },
  { no: 24, text: "我心中有很多恐惧，容易受惊吓", dim: "emotion" },
  { no: 25, text: "我总能把事情做完，注意力能保持得住", dim: "hyper", reverse: true },
  { no: 26, text: "我有过「不想活了」或者想伤害自己的念头", safety: true },
];

export const MENTAL_SDQ_QUESTION_COUNT = MENTAL_SDQ_QUESTIONS.length; // 26

/** SDQ 安全预警题的红线提示（题干下方小字）。 */
export const MENTAL_SDQ_SAFETY_NOTICE =
  "如果这题不是「不符合」，请尽快告诉家长或信任的老师，必要时拨打心理援助热线 12356。你不需要一个人扛。";

/** SDQ 维度分档：正常 / 边缘 / 明显（亲社会为优势维度，方向相反）。 */
export type SdqBand = "正常" | "边缘" | "明显";

const SDQ_BANDS: Record<SdqDim, (v: number) => SdqBand> = {
  emotion: (v) => (v >= 7 ? "明显" : v >= 6 ? "边缘" : "正常"),
  conduct: (v) => (v >= 5 ? "明显" : v >= 4 ? "边缘" : "正常"),
  hyper: (v) => (v >= 7 ? "明显" : v >= 6 ? "边缘" : "正常"),
  peer: (v) => (v >= 6 ? "明显" : v >= 4 ? "边缘" : "正常"),
  // 亲社会为优势维度：分低才需要关注
  prosocial: (v) => (v <= 4 ? "明显" : v === 5 ? "边缘" : "正常"),
};

export function sdqBand(dim: SdqDim, v: number): SdqBand {
  return SDQ_BANDS[dim](v);
}

/** SDQ 计分结果。 */
export type MentalSdqResult = {
  version: "sdq";
  /** 五维度得分（0-10，已做反向计分）。 */
  dims: Record<SdqDim, number>;
  /** 五维度分档。 */
  dimBands: Record<SdqDim, SdqBand>;
  /** 困难总分（情绪+品行+多动+同伴，0-40；不含亲社会）。 */
  totalDiff: number;
  /** 困难总分分档：0-15 正常 / 16-19 边缘 / 20-40 明显。 */
  totalBand: SdqBand;
  /** 综合等级（沿用 V2 词表）：良好 / 关注 / 预警 / 高风险。 */
  level: MentalV2Band;
  /** 红线：第 26 题（自伤念头）≥1。 */
  selfHarm: boolean;
  summary: string;
};

/** SDQ 计分。answers[i]：第 i+1 题作答（0-2 整数），长度须为 26（最后 1 题为安全预警题，不计分）。 */
export function scoreMentalSdq(answers: number[]): MentalSdqResult {
  if (answers.length !== MENTAL_SDQ_QUESTION_COUNT) {
    throw new Error(`SDQ 测评题数应为 ${MENTAL_SDQ_QUESTION_COUNT}，实际 ${answers.length}`);
  }
  answers.forEach((raw, i) => {
    if (!Number.isInteger(raw) || raw < 0 || raw > 2) {
      throw new Error(`第 ${i + 1} 题分值应为 0-2，实际 ${raw}`);
    }
  });
  const dims: Record<SdqDim, number> = { emotion: 0, conduct: 0, hyper: 0, peer: 0, prosocial: 0 };
  MENTAL_SDQ_QUESTIONS.forEach((q, i) => {
    if (!q.dim) return;
    dims[q.dim] += q.reverse ? 2 - answers[i] : answers[i];
  });
  const totalDiff = dims.emotion + dims.conduct + dims.hyper + dims.peer;
  const totalBand: SdqBand = totalDiff >= 20 ? "明显" : totalDiff >= 16 ? "边缘" : "正常";
  const dimBands = Object.fromEntries(
    (Object.keys(dims) as SdqDim[]).map((k) => [k, sdqBand(k, dims[k])]),
  ) as Record<SdqDim, SdqBand>;
  const selfHarm = answers[25] >= 1;
  const dimIssue = (Object.keys(dims) as SdqDim[]).filter((k) => dimBands[k] !== "正常");
  const level: MentalV2Band = selfHarm
    ? "高风险"
    : totalBand === "明显"
      ? "预警"
      : totalBand === "边缘" || dimIssue.length > 0
        ? "关注"
        : "良好";
  const issueText = dimIssue.map((k) => `${SDQ_DIM_LABEL[k]}「${dimBands[k]}」`).join("、");
  const summary = selfHarm
    ? "这次问卷中，你在最后一题（「不想活了或想伤害自己」）上的选择需要被认真对待——请一定告诉家长或信任的老师，必要时拨打心理援助热线 12356 或前往专业机构。这不是矫情，是对自己负责。"
    : level === "良好"
      ? "过去六个月你的状态总体平稳，亲社会行为（乐于助人、关心别人）是你的闪光点。继续保持规律作息就好。"
      : level === "关注"
        ? `过去六个月有些方面需要留意（困难总分 ${totalDiff}/40「${totalBand}」${issueText ? `，${issueText}` : ""}）。先别紧张——这更像「需要休息和照顾」的信号，一两个月后可以再测一次对比。`
        : `过去六个月的困难信号比较明显（困难总分 ${totalDiff}/40「明显」${issueText ? `，${issueText}` : ""}）。建议把结果告诉家长或老师，找学校心理老师聊一聊，必要时前往专业机构进一步评估。`;
  return { version: "sdq", dims, dimBands, totalDiff, totalBand, level, selfHarm, summary };
}

/** 判断是否为 SDQ 学生自评版结果（类型守卫）。 */
export function isMentalSdq(x: unknown): x is MentalSdqResult {
  return !!x && typeof x === "object" && (x as { version?: string }).version === "sdq";
}

/** SDQ 免责声明（答题末尾与报告必须展示）。 */
export const MENTAL_SDQ_DISCLAIMER =
  "免责声明：SDQ（长处与困难问卷）是国际通用的儿童青少年行为筛查工具，结果仅供筛查参考，不构成医学诊断，也不能替代专业医生或心理咨询师的评估。若得分偏高，或最后一题不是「不符合」，请尽快告诉家长或老师，必要时前往专业心理/医疗机构评估，或拨打全国心理援助热线 12356。主动求助是勇敢，不是软弱。";

/* ============================================================================
 * V40/V42 · 学生版 B：PHQ-A（青少年抑郁筛查 9 题）+ GAD-7 焦虑筛查（7 题）
 * ============================================================================
 * - PHQ-A（Patient Health Questionnaire for Adolescents）是 PHQ-9 的青少年
 *   改编版本，国际通用、有青少年群体信效度研究支持，保留原版措辞。
 * - V42 起 GAD-7 恢复原版标准措辞（Spitzer 2006 验证版本，国内通行译本），
 *   不再做学生化改写——改写版偏离已验证文本，信效度证据无法继承。
 * - 结构、评分、分级与 V2 相同：16 题 0-3 四级评分；PHQ-A 0-27 / GAD-7 0-21；
 *   0-4 良好 / 5-9 关注 / 10-14 预警 / ≥15 高风险；第 9 题（自伤念头）≥1 红线。
 * - 适用 11 岁以上自评。
 */

export const MENTAL_PA_QUESTION_COUNT = 16;

/** PHQ-A + GAD-7 学生版适用年龄说明。 */
export const MENTAL_PA_AGE = "适用 11 岁以上学生自评";

const PHQA_TEXTS = [
  "做事时提不起劲，或觉得什么都没意思",
  "感到心情低落、沮丧或绝望",
  "入睡困难、睡不安稳，或睡得太多",
  "感觉疲倦，没有活力",
  "胃口不好，或吃得太多",
  "觉得自己很糟、很失败，或让家人失望",
  "很难集中注意力，比如上课、看书或看电视时",
  "动作或说话慢到别人能察觉；或正好相反——坐不住、动来动去比平时多",
  "有过「不如死了算了」或想伤害自己的念头",
];

/** GAD-7 原版标准措辞（Spitzer 2006 验证版本，国内通行译本，V42 恢复）。 */
const GAD7_STANDARD_TEXTS = [
  "感到紧张、焦虑或急切",
  "不能够停止或控制担忧",
  "对各种各样的事情担忧过多",
  "很难放松下来",
  "感到不安而难以静坐",
  "变得容易烦恼或急躁",
  "感到似乎将有可怕的事情发生而害怕",
];

/** 学生版 B 题库：两段结构（PHQ-A 九题 + GAD-7 标准七题），题号全局 1-16。 */
export const MENTAL_PA_SECTIONS: MentalV2Section[] = [
  {
    key: "phq9",
    title: "第一部分 · PHQ-A 青少年抑郁筛查（9 题）",
    description: "PHQ-A 是国际通用的青少年抑郁筛查量表（PHQ-9 的青少年改编版），看最近两周情绪与状态方面的困扰。",
    intro: MENTAL_V2_INTRO,
    questions: PHQA_TEXTS.map((text, i) => ({ no: i + 1, text })),
  },
  {
    key: "gad7",
    title: "第二部分 · GAD-7 焦虑筛查（7 题 · 标准版）",
    description: "GAD-7 是国际通用的焦虑筛查量表（原版标准措辞，青少年群体同样有信效度研究支持），看最近两周紧张、担忧方面的困扰。",
    intro: MENTAL_V2_INTRO,
    questions: GAD7_STANDARD_TEXTS.map((text, i) => ({ no: i + 10, text })),
  },
];

/** 学生版 B 计分结果（结构与 V2 相同，版本标记不同）。 */
export type MentalPaResult = Omit<MentalV2Result, "version"> & { version: "pa" };

/** 学生版 B 计分：复用 V2 算法，version 标记为 "pa"。 */
export function scoreMentalPa(answers: number[]): MentalPaResult {
  const r = scoreMental(answers);
  return { ...r, version: "pa" };
}

/** 判断是否为 PHQ-A + GAD-7 学生版结果（类型守卫）。 */
export function isMentalPa(x: unknown): x is MentalPaResult {
  return !!x && typeof x === "object" && (x as { version?: string }).version === "pa";
}

/** 学生版 B 免责声明（答题末尾与报告必须展示）。 */
export const MENTAL_PA_DISCLAIMER =
  "免责声明：本量表为国际通用筛查工具（PHQ-A / GAD-7），结果仅供筛查参考，不构成医学诊断，也不能替代专业医生或心理咨询师的评估。若得分偏高，或第 9 题不是「完全不会」，请尽快告诉家长或老师，必要时前往专业心理/医疗机构评估，或拨打全国心理援助热线 12356。主动求助是勇敢，不是软弱。";

/* ============================================================================
 * V41 · 心理健康详细解读素材（报告页「数字怎么看 / 维度说明」卡用）
 * ============================================================================
 * 原则：告诉读者①这个分数是怎么算出来的、②数字代表什么、③每个观测点
 * 在观察什么、④分级意味着什么、⑤接下来可以做什么。措辞面向学生与家长。
 */

/** 量表分数的通用解释（报告页统一展示「分数怎么看」）。 */
export const MENTAL_SCORE_GUIDE =
  "这些分数怎么看：量表没有「考多少分算好」，它统计的是「过去一段时间里，某种状态出现的频繁程度」。分越低，说明这种困扰越少出现；分越高，说明它出现的频率越高、值得认真对待。分数是「信号」不是「判决」——一次测量反映的是这段时间的状态快照，情绪会波动，复测对比变化比单次分数更有价值。所有结果都只是筛查参考，不构成医学诊断；只有持续偏高或影响吃睡学时，才需要进一步专业评估。";

export type MentalDimExplain = {
  /** 这个观测点在观察什么。 */
  observe: string;
  /** 分数代表什么。 */
  meaning: string;
  /** 偏高/偏低时可以做什么。 */
  advice: string[];
};

/* ---------------- SDQ 五维度 ---------------- */

export const SDQ_DIM_EXPLAIN: Record<SdqDim, MentalDimExplain> = {
  emotion: {
    observe: "观察孩子是不是经常忧心忡忡、不快乐、容易害怕或有躯体不适（头痛、肚子痛查不出原因）。",
    meaning: "0-5 为正常范围；6 分边缘；7 分以上说明情绪上的不舒服出现得相当频繁，已经值得认真关注。",
    advice: [
      "每天留 10 分钟不谈学习的闲聊时间，让情绪有出口",
      "情绪低落持续两周以上，告诉孩子「这不是你的错」，并考虑找学校心理老师聊聊",
    ],
  },
  conduct: {
    observe: "观察冲动控制：是否经常发脾气、说谎、拿别人东西、与人争执。",
    meaning: "0-3 为正常；4 分边缘；5 分以上说明行为上的冲动出现频繁，常与「心里憋着劲」有关。",
    advice: [
      "先找行为背后的原因（累？被误解？压力大？），再谈规则",
      "发火前约定「暂停 10 秒」，事后主动修复一句「刚才我语气重了」",
    ],
  },
  hyper: {
    observe: "观察注意与安定：是否坐不住、容易分心、做事前不想清楚。",
    meaning: "0-5 为正常；6 分边缘；7 分以上说明多动/注意方面的困扰频繁出现，会直接影响听课和作业效率。",
    advice: [
      "把任务切成小块（15-20 分钟一段），每段之间起来活动 3 分钟",
      "写作业只留当前这一科的书，桌面清空减少干扰",
    ],
  },
  peer: {
    observe: "观察同伴关系：是否孤独、被捉弄、觉得别人不喜欢自己、只能和大人相处。",
    meaning: "0-3 为正常；4-5 分边缘；6 分以上说明在同伴中感到孤立或不舒服，孤独感是学习动力的大敌。",
    advice: [
      "帮孩子创造低压力的社交场景：小组作业、运动队、兴趣社团",
      "如果涉及被欺负，认真对待，先倾听不评判，再和学校沟通",
    ],
  },
  prosocial: {
    observe: "这是优势维度，观察孩子的善意：是否关心别人、愿意分享、乐于助人。分越高越好。",
    meaning: "6 分以上为正常优势；5 分边缘；4 分以下说明孩子的善意和助人行为近期较少出现，可能与情绪状态有关。",
    advice: [
      "优势要用起来：让孩子负责一件能帮助别人的事（教同学一道题、照顾弟妹）",
      "被看见的亲社会行为会被强化，多具体地肯定（「你注意到同学难过主动去陪，这很棒」）",
    ],
  },
};

/* ---------------- PHQ-9 / PHQ-A 九题含义 ---------------- */

export type MentalItemExplain = { text: string; observe: string };

/** PHQ-9 / PHQ-A 九个观测点逐项说明（通用版与学生版 B 共用，题干措辞不同但观察点相同）。 */
export const PHQ9_ITEM_EXPLAIN: MentalItemExplain[] = [
  { text: "做事提不起劲 / 没有乐趣", observe: "观察「愉悦感」——对以前喜欢的事情还有没有兴趣，这是情绪低落最核心的信号之一。" },
  { text: "心情低落、沮丧或绝望", observe: "观察「情绪底色」——最近两周心情的平均水平，而不是某一两天的心情。" },
  { text: "睡眠问题（入睡难/睡不稳/睡太多）", observe: "观察「睡眠节律」——睡眠是心理状态的地基，持续失眠或嗜睡都值得重视。" },
  { text: "疲倦、没有精力", observe: "观察「能量水平」——睡够了还是累，可能提示心理在持续耗能。" },
  { text: "食欲问题（吃不下/吃太多）", observe: "观察「身体反应」——情绪会通过胃口表现出来。" },
  { text: "觉得自己很糟、很失败", observe: "观察「自我评价」——对自己的看法是否变得苛刻、只剩负面，这是需要温柔对待的信号。" },
  { text: "难以集中注意力", observe: "观察「注意资源」——上课走神、看不进书是否比平时多，直接影响学习效率。" },
  { text: "动作说话变慢 / 烦躁不安", observe: "观察「激活水平」——要么明显变慢、要么明显坐不住，两种极端都提示状态异常。" },
  { text: "有伤害自己的念头", observe: "红线观测点——只要这一项不是「完全不会」，无论总分多少，都需要认真对待并告诉可信任的大人。" },
];

/** GAD-7 七个观测点逐项说明。 */
export const GAD7_ITEM_EXPLAIN: MentalItemExplain[] = [
  { text: "紧张、焦虑或急切", observe: "观察「紧绷程度」——身体和心理是不是经常处在备战状态。" },
  { text: "不能够停止或控制担忧", observe: "观察「担忧的可控性」——担心的开关能不能自己关上，关不上最耗人。" },
  { text: "对各种各样的事情担忧过多", observe: "观察「担忧的泛化」——是否从小事担心到大事、从学习担心到生活，无处不在。" },
  { text: "很难放松下来", observe: "观察「放松能力」——休息时是不是脑子还在转，「不会放松」本身就是一种负担。" },
  { text: "不安而难以静坐", observe: "观察「躯体化表现」——焦虑常常以坐不住、来回走动的方式跑出来。" },
  { text: "容易烦恼或急躁", observe: "观察「情绪阈值」——是不是一点小事就烦，易怒往往是焦虑或压力的副产品。" },
  { text: "似乎将有可怕的事情发生而害怕", observe: "观察「不祥预感」——没来由的心慌和不安，是焦虑程度偏高的典型感受。" },
];

/* ---------------- 分级总表 ---------------- */

export const MENTAL_V2_BAND_GUIDE: { band: MentalV2Band; meaning: string; action: string }[] = [
  { band: "良好", meaning: "0-4 分：过去两周基本没有这类困扰，状态在正常波动范围内。", action: "继续保持规律作息和运动，状态会有自然起伏，不用为偶尔的小低落紧张。" },
  { band: "关注", meaning: "5-9 分：有一些轻度困扰，像是身体在发「需要休息和照顾」的信号。", action: "先照顾自己：睡够、运动、把担心写下来；一两周后复测，看分数有没有回落。" },
  { band: "预警", meaning: "10-14 分：中度困扰，这类感受已经比较频繁，大概率在影响吃睡和注意力。", action: "建议把结果告诉家长或老师，找学校心理老师聊一聊；必要时到专业机构做进一步评估。" },
  { band: "高风险", meaning: "15 分及以上：困扰明显且频繁，或触发了自伤念头红线，这件事的优先级高于一切学习目标。", action: "请一定告诉家长或信任的老师，尽快寻求专业帮助，可拨打全国心理援助热线 12356。" },
];

export const MENTAL_SDQ_BAND_GUIDE: { band: SdqBand; meaning: string }[] = [
  { band: "正常", meaning: "得分在常见范围内，这个方面与大多数同龄人相当。" },
  { band: "边缘", meaning: "得分接近需要关注的边界，不算异常，但值得留个心眼——留意它是否在复测中继续走高。" },
  { band: "明显", meaning: "得分明显偏离常见范围，这个方面的困扰出现得相当频繁，建议认真对待并考虑专业评估。" },
];


/* ============================================================================
 * V42 · 深度评估：SCL-90 症状自评量表（90 题 · 10 因子 · 5 级评分）
 * ============================================================================
 * - SCL-90（Symptom Checklist-90，Derogatis 编制）是国际应用最广泛的心理
 *   症状自评量表之一，20 世纪 80 年代引入中国，建立了中国常模；筛选阳性
 *   的通行标准：总分 >160 分、或阳性项目数 >43 项、或任一因子均分 >2 分。
 * - 题目为原版标准中文译本（一字未改），计分与因子归属按通行手册
 *   （F1—F9 各因子 + F10 附加项「睡眠及饮食」），信效度依据充分。
 * - 第 15 题（想结束自己的生命）为安全风险题：选「很轻」及以上（≥2）即
 *   触发红线，优先级高于一切分数解读。
 * - 适用 16 岁以上学生自评（常模为成人常模，结果按筛查口径解释），
 *   约 15—20 分钟完成。作为前三套量表之外的「深度评估」选做项。
 */

export const MENTAL_SCL90_QUESTION_COUNT = 90;

/** SCL-90 适用年龄说明。 */
export const MENTAL_SCL90_AGE = "适用 16 岁以上学生自评（约 15—20 分钟）";

/** SCL-90 十因子键。 */
export type Scl90FactorKey =
  | "somatization"
  | "compulsive"
  | "interpersonal"
  | "depression"
  | "anxiety"
  | "hostility"
  | "phobic"
  | "paranoid"
  | "psychotic"
  | "additional";

export const SCL90_FACTOR_ORDER: Scl90FactorKey[] = [
  "somatization",
  "compulsive",
  "interpersonal",
  "depression",
  "anxiety",
  "hostility",
  "phobic",
  "paranoid",
  "psychotic",
  "additional",
];

export const SCL90_FACTOR_LABEL: Record<Scl90FactorKey, string> = {
  somatization: "躯体化",
  compulsive: "强迫症状",
  interpersonal: "人际关系敏感",
  depression: "抑郁",
  anxiety: "焦虑",
  hostility: "敌对",
  phobic: "恐怖",
  paranoid: "偏执",
  psychotic: "急性症状",
  additional: "睡眠及饮食",
};

/** 因子 → 题号（1 起始，与标准手册一致；F10 为未归入前九因子的附加 7 项）。 */
export const SCL90_FACTOR_ITEMS: Record<Scl90FactorKey, number[]> = {
  somatization: [1, 4, 12, 27, 40, 42, 48, 49, 52, 53, 56, 58],
  compulsive: [3, 9, 10, 28, 38, 45, 46, 51, 55, 65],
  interpersonal: [6, 21, 34, 36, 37, 41, 61, 69, 73],
  depression: [5, 14, 15, 20, 22, 26, 29, 30, 31, 32, 54, 71, 79],
  anxiety: [2, 17, 23, 33, 39, 57, 72, 78, 80, 86],
  hostility: [11, 24, 63, 67, 74, 81],
  phobic: [13, 25, 47, 50, 70, 75, 82],
  paranoid: [8, 18, 43, 68, 76, 83],
  psychotic: [7, 16, 35, 62, 77, 84, 85, 87, 88, 90],
  additional: [19, 44, 59, 60, 64, 66, 89],
};

/** 中国成人常模均分（各因子参考值，报告展示用；来源为国内通行手册常引数据）。 */
export const SCL90_NORM: Record<Scl90FactorKey, number> = {
  somatization: 1.37,
  compulsive: 1.62,
  interpersonal: 1.65,
  depression: 1.5,
  anxiety: 1.39,
  hostility: 1.46,
  phobic: 1.23,
  paranoid: 1.43,
  psychotic: 1.29,
  additional: 1.5,
};

/** 5 级评分选项（1—5）。 */
export const SCL90_OPTIONS = [
  { value: 1, label: "没有" },
  { value: 2, label: "很轻" },
  { value: 3, label: "中等" },
  { value: 4, label: "偏重" },
  { value: 5, label: "严重" },
] as const;

export type Scl90Question = { no: number; text: string; factor: Scl90FactorKey; safety?: boolean };

/** SCL-90 题库（90 题，原版标准译本，逐题标注因子；第 15 题为安全风险题）。 */
export const SCL90_QUESTIONS: Scl90Question[] = [
  { no: 1, text: "头痛", factor: "somatization" },
  { no: 2, text: "神经过敏，心中不踏实", factor: "anxiety" },
  { no: 3, text: "头脑中有不必要的想法或字句盘旋", factor: "compulsive" },
  { no: 4, text: "头昏或昏倒", factor: "somatization" },
  { no: 5, text: "对异性的兴趣减退", factor: "depression" },
  { no: 6, text: "对旁人责备求全", factor: "interpersonal" },
  { no: 7, text: "感到别人能控制你的思想", factor: "psychotic" },
  { no: 8, text: "责怪别人制造麻烦", factor: "paranoid" },
  { no: 9, text: "忘性大", factor: "compulsive" },
  { no: 10, text: "担心自己的衣饰整齐及仪态的端正", factor: "compulsive" },
  { no: 11, text: "容易烦恼和激动", factor: "hostility" },
  { no: 12, text: "胸痛", factor: "somatization" },
  { no: 13, text: "害怕空旷的场所或街道", factor: "phobic" },
  { no: 14, text: "感到自己的精力下降，活动减慢", factor: "depression" },
  { no: 15, text: "想结束自己的生命", factor: "depression", safety: true },
  { no: 16, text: "听到旁人听不到的声音", factor: "psychotic" },
  { no: 17, text: "发抖", factor: "anxiety" },
  { no: 18, text: "感到大多数人都不可信任", factor: "paranoid" },
  { no: 19, text: "胃口不好", factor: "additional" },
  { no: 20, text: "容易哭泣", factor: "depression" },
  { no: 21, text: "同异性相处时感到害羞不自在", factor: "interpersonal" },
  { no: 22, text: "感到受骗，中了圈套或有人想抓住你", factor: "depression" },
  { no: 23, text: "无缘无故地突然感到害怕", factor: "anxiety" },
  { no: 24, text: "自己不能控制地大发脾气", factor: "hostility" },
  { no: 25, text: "怕单独出门", factor: "phobic" },
  { no: 26, text: "经常责怪自己", factor: "depression" },
  { no: 27, text: "腰痛", factor: "somatization" },
  { no: 28, text: "感到难以完成任务", factor: "compulsive" },
  { no: 29, text: "感到孤独", factor: "depression" },
  { no: 30, text: "感到苦闷", factor: "depression" },
  { no: 31, text: "过分担忧", factor: "depression" },
  { no: 32, text: "对事物不感兴趣", factor: "depression" },
  { no: 33, text: "感到害怕", factor: "anxiety" },
  { no: 34, text: "我的感情容易受到伤害", factor: "interpersonal" },
  { no: 35, text: "旁人能知道你的私下想法", factor: "psychotic" },
  { no: 36, text: "感到别人不理解你不同情你", factor: "interpersonal" },
  { no: 37, text: "感到人们对你不友好，不喜欢你", factor: "interpersonal" },
  { no: 38, text: "做事必须做得很慢以保证做得正确", factor: "compulsive" },
  { no: 39, text: "心跳得很厉害", factor: "anxiety" },
  { no: 40, text: "恶心或胃部不舒服", factor: "somatization" },
  { no: 41, text: "感到比不上他人", factor: "interpersonal" },
  { no: 42, text: "肌肉酸痛", factor: "somatization" },
  { no: 43, text: "感到有人在监视你、谈论你", factor: "paranoid" },
  { no: 44, text: "难以入睡", factor: "additional" },
  { no: 45, text: "做事必须反复检查", factor: "compulsive" },
  { no: 46, text: "难以做出决定", factor: "compulsive" },
  { no: 47, text: "怕乘电车、公共汽车、地铁或火车", factor: "phobic" },
  { no: 48, text: "呼吸有困难", factor: "somatization" },
  { no: 49, text: "一阵阵发冷或发热", factor: "somatization" },
  { no: 50, text: "因为感到害怕而避开某些东西、场合或活动", factor: "phobic" },
  { no: 51, text: "脑子变空了", factor: "compulsive" },
  { no: 52, text: "身体发麻或刺痛", factor: "somatization" },
  { no: 53, text: "喉咙有梗塞感", factor: "somatization" },
  { no: 54, text: "感到前途没有希望", factor: "depression" },
  { no: 55, text: "不能集中注意力", factor: "compulsive" },
  { no: 56, text: "感到身体的某一部分软弱无力", factor: "somatization" },
  { no: 57, text: "感到紧张或容易紧张", factor: "anxiety" },
  { no: 58, text: "感到手或脚发重", factor: "somatization" },
  { no: 59, text: "想到死亡的事", factor: "additional" },
  { no: 60, text: "吃得太多", factor: "additional" },
  { no: 61, text: "当别人看着你或谈论你时感到不自在", factor: "interpersonal" },
  { no: 62, text: "有一些不属于你自己的想法", factor: "psychotic" },
  { no: 63, text: "有想打人或伤害他人的冲动", factor: "hostility" },
  { no: 64, text: "醒得太早", factor: "additional" },
  { no: 65, text: "必须反复洗手、点数", factor: "compulsive" },
  { no: 66, text: "睡得不稳不深", factor: "additional" },
  { no: 67, text: "有想摔坏或破坏东西的冲动", factor: "hostility" },
  { no: 68, text: "有一些别人没有的想法或念头", factor: "psychotic" },
  { no: 69, text: "感到对别人神经过敏", factor: "interpersonal" },
  { no: 70, text: "在商店或电影院等人多的地方感到不自在", factor: "phobic" },
  { no: 71, text: "感到任何事情都很困难", factor: "depression" },
  { no: 72, text: "一阵阵恐惧或惊恐", factor: "anxiety" },
  { no: 73, text: "感到在公共场合吃东西很不舒服", factor: "interpersonal" },
  { no: 74, text: "经常与人争论", factor: "hostility" },
  { no: 75, text: "单独一人时神经很紧张", factor: "phobic" },
  { no: 76, text: "别人对你的成绩没有做出恰当的评价", factor: "paranoid" },
  { no: 77, text: "即使和别人在一起也感到孤单", factor: "psychotic" },
  { no: 78, text: "感到坐立不安心神不定", factor: "anxiety" },
  { no: 79, text: "感到自己没有什么价值", factor: "depression" },
  { no: 80, text: "感到熟悉的东西变成陌生或不像是真的", factor: "anxiety" },
  { no: 81, text: "大叫或摔东西", factor: "hostility" },
  { no: 82, text: "害怕会在公共场合昏倒", factor: "phobic" },
  { no: 83, text: "感到别人想占你的便宜", factor: "paranoid" },
  { no: 84, text: "为一些有关性的想法而很苦恼", factor: "psychotic" },
  { no: 85, text: "你认为应该因为自己的过错而受到惩罚", factor: "psychotic" },
  { no: 86, text: "感到要很快把事情做完", factor: "anxiety" },
  { no: 87, text: "感到自己的身体有严重问题", factor: "psychotic" },
  { no: 88, text: "从未感到和其他人很亲近", factor: "psychotic" },
  { no: 89, text: "感到自己有罪", factor: "additional" },
  { no: 90, text: "感到自己的脑子有毛病", factor: "psychotic" },
];

/** SCL-90 指导语。 */
export const MENTAL_SCL90_INTRO =
  "以下列出了有些人可能会有的问题。请仔细阅读每一条，根据最近一星期内这些情况影响你或让你感到苦恼的程度，选择最符合的答案。答案没有对错，凭第一感觉作答即可，请不要漏题。";

export type Scl90FactorLevel = "正常" | "轻度" | "中度" | "偏重" | "严重";

/** 因子均分 → 程度分级（与附件报告口径一致：<2 正常，2—2.9 轻度，3—3.9 中度，4—4.9 偏重，5 严重）。 */
export function scl90FactorLevel(avg: number): Scl90FactorLevel {
  if (avg >= 4.95) return "严重";
  if (avg >= 3.95) return "偏重";
  if (avg >= 2.95) return "中度";
  if (avg >= 2) return "轻度";
  return "正常";
}

/** SCL-90 计分结果。 */
export type Scl90Result = {
  version: "scl90";
  /** 总分（90—450）。 */
  total: number;
  /** 总均分（总分/90，1—5）。 */
  gsi: number;
  /** 阳性项目数（单项分 ≥2 的项目数）。 */
  positiveCount: number;
  /** 阴性项目数（单项分 =1 的项目数）。 */
  negativeCount: number;
  /** 阳性症状均分 =（总分 − 阴性项目数）/ 阳性项目数。 */
  psdi: number;
  /** 十因子均分（保留 2 位小数）。 */
  factors: Record<Scl90FactorKey, number>;
  factorLevels: Record<Scl90FactorKey, Scl90FactorLevel>;
  /** 筛选阳性（总分>160 或 阳性项目>43 或 任一因子均分>2）。 */
  screeningPositive: boolean;
  /** 第 15 题（想结束自己的生命）≥2，安全红线。 */
  selfHarm: boolean;
  level: MentalV2Band;
  summary: string;
};

/** SCL-90 计分（题目、因子归属、常模口径均为标准手册版本）。 */
export function scoreScl90(answers: number[]): Scl90Result {
  if (answers.length !== MENTAL_SCL90_QUESTION_COUNT) {
    throw new Error(`SCL-90 题数应为 ${MENTAL_SCL90_QUESTION_COUNT}，实际 ${answers.length}`);
  }
  answers.forEach((raw, i) => {
    if (!Number.isInteger(raw) || raw < 1 || raw > 5) {
      throw new Error(`SCL-90 第 ${i + 1} 题分值应为 1-5，实际 ${raw}`);
    }
  });
  const total = answers.reduce((s, v) => s + v, 0);
  const gsi = total / 90;
  const positiveCount = answers.filter((v) => v >= 2).length;
  const negativeCount = 90 - positiveCount;
  const psdi = positiveCount > 0 ? (total - negativeCount) / positiveCount : 0;
  const factors = {} as Record<Scl90FactorKey, number>;
  const factorLevels = {} as Record<Scl90FactorKey, Scl90FactorLevel>;
  for (const key of SCL90_FACTOR_ORDER) {
    const items = SCL90_FACTOR_ITEMS[key];
    const avg = items.reduce((s, no) => s + answers[no - 1], 0) / items.length;
    factors[key] = Math.round(avg * 100) / 100;
    factorLevels[key] = scl90FactorLevel(avg);
  }
  const anyFactorOver2 = SCL90_FACTOR_ORDER.some((k) => factors[k] > 2);
  const anyFactorOver3 = SCL90_FACTOR_ORDER.some((k) => factors[k] >= 3);
  const screeningPositive = total > 160 || positiveCount > 43 || anyFactorOver2;
  const selfHarm = answers[14] >= 2;
  const level: MentalV2Band = selfHarm || anyFactorOver3 ? "高风险" : screeningPositive ? "预警" : "良好";
  const over2 = SCL90_FACTOR_ORDER.filter((k) => factors[k] > 2).map((k) => SCL90_FACTOR_LABEL[k]);
  const over2WithScore = SCL90_FACTOR_ORDER.filter((k) => factors[k] > 2).map((k) => `${SCL90_FACTOR_LABEL[k]} ${factors[k]}`);
  const summary = selfHarm
    ? "你在第 15 题「想结束自己的生命」上的选择需要被认真对待——请一定告诉家长或信任的老师，必要时拨打心理援助热线 12356 或前往专业机构。这不是矫情，是对自己负责。"
    : level === "良好"
      ? `本次评估总分 ${total} 分，未达筛选阳性线（>160 分），10 个因子均在中国常模常见范围内。近一周的心理状态总体平稳，继续保持规律作息和运动就好。`
      : level === "预警"
        ? `本次评估达到筛选阳性标准（总分 ${total} 分${total > 160 ? " >160" : ""}，阳性项目 ${positiveCount} 项${positiveCount > 43 ? " >43" : ""}${over2.length > 0 ? `；超出常模的因子：${over2.join("、")}` : ""}）。这提示近期有一些症状值得认真对待，建议把结果告诉家长，找学校心理老师聊一聊，必要时到专业机构做进一步评估。`
        : `本次评估中 ${over2WithScore.join("、")} 的得分明显偏高，提示近期困扰程度较重。请把结果告诉家长或信任的老师，尽快寻求专业心理/医疗机构的评估——主动求助是勇敢，不是软弱。`;
  return {
    version: "scl90",
    total,
    gsi: Math.round(gsi * 100) / 100,
    positiveCount,
    negativeCount,
    psdi: Math.round(psdi * 100) / 100,
    factors,
    factorLevels,
    screeningPositive,
    selfHarm,
    level,
    summary,
  };
}

/** 判断是否为 SCL-90 结果（类型守卫）。 */
export function isMentalScl90(x: unknown): x is Scl90Result {
  return !!x && typeof x === "object" && (x as { version?: string }).version === "scl90";
}

/** SCL-90 免责声明（答题末尾与报告必须展示）。 */
export const MENTAL_SCL90_DISCLAIMER =
  "免责声明：SCL-90（症状自评量表）是国际通用的心理症状筛查工具，结果仅供筛查参考，不构成医学诊断，也不能替代专业医生或心理咨询师的评估。本量表适用 16 岁以上人群，按中国常模口径解释。若筛选阳性、或第 15 题选了「很轻」及以上，请尽快告诉家长或老师，必要时前往专业心理/医疗机构评估，或拨打全国心理援助热线 12356。主动求助是勇敢，不是软弱。";


/* ---------------- SCL-90 逐因子解读（附件式「风险指标解读」素材） ---------------- */

export type Scl90FactorExplain = {
  /** 本指标主要反映什么（指标含义）。 */
  meaning: string;
  /** 低风险（均分 <2）解读。 */
  low: string;
  /** 一般风险（均分 ≥2）解读。 */
  mid: string;
  /** 较高风险（均分 ≥3）解读。 */
  high: string;
  /** 改善建议。 */
  advice: string[];
};

export const SCL90_FACTOR_EXPLAIN: Record<Scl90FactorKey, Scl90FactorExplain> = {
  somatization: {
    meaning:
      "本指标主要反映身体上的不适感，包括肠胃、呼吸系统的不适，头痛、肌肉酸痛，以及焦虑紧张的其他躯体表现（心跳、发抖、发冷发热等）。它是心理健康的外在体现——身体常常以躯体症状的方式替心理压力「喊痛」。",
    low: "你的躯体化指标为低风险：几乎不存在困扰自己的躯体不适，日常生活几乎没有受到影响；即使情绪波动较大时，也基本不会出现明显的身体反应。",
    mid: "你的躯体化指标值得关注：近期身体较常出现不适感（如头痛、肠胃不适、心慌等）。先排查生理原因（如睡眠不足、用眼过度）；若查不出原因且反复出现，要意识到这可能是心理压力在身体上的表达。",
    high: "你的躯体化指标偏高：身体不适感出现得相当频繁。建议先做体检排除生理疾病，同时认真对待心理压力——身体已经在用症状「报警」，请把结果告诉家长并考虑专业评估。",
    advice: [
      "先排查生理因素：保证睡眠时长、规律三餐、适量运动，观察症状是否缓解",
      "记录「症状日记」：什么时候不舒服、当时在想什么，帮自己发现身体与情绪的关联",
    ],
  },
  compulsive: {
    meaning:
      "本指标主要反映明知没有必要、却难以摆脱的思想、冲动和行为，比如反复检查、反复回想、脑子停不下来的杂念，以及「必须做到完美才安心」的紧绷感。适度的认真是优点，过度则会消耗大量精力。",
    low: "你的强迫症状指标为低风险：处理事情时较为灵活，基本没有停不下来的杂念或重复行为；偶尔出现的小纠结，对日常生活几乎没有影响。",
    mid: "你的强迫症状指标值得关注：近期可能有一些「明知没必要却控制不住」的想法或行为（反复检查、反复琢磨、难以开始做事）。这不等于强迫症，但提示大脑处在紧绷状态，需要松绑。",
    high: "你的强迫症状指标偏高：重复思维或行为已经比较频繁，可能明显占用时间和精力。建议把结果告诉家长，寻求学校心理老师或专业机构的支持——早期干预效果最好。",
    advice: [
      "给「完美主义」松绑：允许自己「先完成、再完善」，把检查次数设定上限",
      "杂念来袭时先接纳再转移：不跟念头较劲，起身活动、换一件具体的事做",
    ],
  },
  interpersonal: {
    meaning:
      "本指标主要反映人际交往中的不自在感和自卑感，尤其是在与他人比较时更突出，也包括交流时的不安、戒备和对他人态度的敏感。它反映的是社交中的消极自我期待。",
    low: "你的人际关系敏感指标为低风险：在人际交往中能较好地应对他人、清楚传达自己的意图，群体相处较为融洽，基本没有明显的人际困扰。",
    mid: "你的人际关系敏感指标值得关注：近期在与人相处时可能不太自在，容易觉得别人对自己不友好、或拿自己和别人比较。多数时候这是压力下的正常波动，值得留意但不必焦虑。",
    high: "你的人际关系敏感指标偏高：社交中的不安和自我否定感比较频繁，可能已经影响正常交往。建议告诉家长或信任的老师，找学校心理老师聊一聊，学习调整社交中的自我评价。",
    advice: [
      "练习「事实—想法」分家：「他没理我」是事实，「他讨厌我」是想法，先验证再下结论",
      "减少向上比较：和「上周的自己」比，而不是和别人的高光时刻比",
    ],
  },
  depression: {
    meaning:
      "本指标主要反映苦闷的情感与心境：愉悦感下降、对事情提不起兴趣、动力缺乏、容易哭泣，也包括悲观失望等认知感受。注意：这个因子包含第 15 题（想结束自己的生命），该题有任何阳性选择都单独触发红线。",
    low: "你的抑郁指标为低风险：几乎不存在持续的情绪低落或兴趣减退，对日常生活抱有相对积极的态度，有足够的精力应对学习和生活。",
    mid: "你的抑郁指标值得关注：近期情绪有些低沉、动力不足或容易落泪。先别急着给自己贴标签——这更像「需要休息和照顾」的信号。把感受告诉信任的人，规律作息、晒晒太阳、动起来，通常都会有改善。",
    high: "你的抑郁指标偏高：低落的情绪已经比较频繁，可能正在影响睡眠、食欲和专注力。请务必把结果告诉家长或信任的老师，尽快寻求专业评估——心理状态和感冒发烧一样，需要专业帮助，这不是软弱。",
    advice: [
      "情绪低落时先照顾好身体：睡够、吃饱、出门晒 15 分钟太阳，情绪会跟着生理状态走",
      "把「我不行」换成「我现在状态不好」——状态是会变的，你不是情绪的奴隶",
    ],
  },
  anxiety: {
    meaning:
      "本指标主要反映紧张、担忧、害怕的情感体验：心中不踏实、容易紧张发抖、无缘由地突然害怕、坐立不安，以及由此产生的躯体表现。它既包括对未发生之事的担心，也包括突然的惊恐感。",
    low: "你的焦虑指标为低风险：能够较好地专注于当前的事务，偶尔出现的紧张情绪没有对日常生活产生太大影响。",
    mid: "你的焦虑指标值得关注：近期较常感到紧张、心里不踏实或坐不住。先找压力源（考试？人际？睡眠不足？），把担心具体化写下来，往往就会发现「可解决的部分」比想象中多。",
    high: "你的焦虑指标偏高：紧张和担忧出现得相当频繁，可能已经影响睡眠和专注力。建议告诉家长或老师，学习放松训练（深呼吸、渐进式肌肉放松），必要时寻求专业评估。",
    advice: [
      "4-7-8 呼吸法：吸气 4 秒、屏息 7 秒、呼气 8 秒，重复几轮，能快速平复生理紧张",
      "把担心写成清单，分成「能做的」和「控制不了的」——只管能做的那部分",
    ],
  },
  hostility: {
    meaning:
      "本指标主要反映对他人的敌视与易怒：容易烦恼激动、控制不住地发脾气、想摔东西、想与人争论。敌对常常是压力、委屈或疲惫的外溢，不一定真的针对别人。",
    low: "你的敌对指标为低风险：情绪总体平稳，能较好地处理人际矛盾，基本没有冲动发火或与人争执的困扰。",
    mid: "你的敌对指标值得关注：近期比较容易烦、容易激动或想发火。这通常是压力大、休息不够或心里有委屈的信号——先照顾自己的状态，而不是责怪自己「脾气差」。若其他指标正常，这一项可暂时忽略。",
    high: "你的敌对指标偏高：易怒和冲突感比较频繁，可能已经影响人际关系。建议告诉家长或信任的老师，一起找找背后的压力源，学习更健康的情绪出口。",
    advice: [
      "发火前先「暂停 6 秒」：深呼吸，离开现场一下，再回来处理——多数冲突不值得用最大音量解决",
      "事后复盘而不是自责：记录「刚才为什么炸」，下次同类场景就能提前预警",
    ],
  },
  phobic: {
    meaning:
      "本指标主要反映对特定场合或事物的恐惧与回避：害怕空旷场所、害怕单独出门、怕乘车、在人多的地方不自在、害怕在公共场合吃东西等。回避会让恐惧范围越扩越大，是这一指标的核心关注点。",
    low: "你的恐怖指标为低风险：即使有一些害怕的事物，也不会产生强烈而不必要的恐惧，基本没有因为恐惧而回避正常活动的困扰。",
    mid: "你的恐怖指标值得关注：近期对某些场合（人多、单独出门、乘车等）有明显的紧张或回避。先判断回避是否已经影响正常生活；轻度时可以从「小剂量接触」开始练习适应。",
    high: "你的恐怖指标偏高：恐惧和回避已经比较频繁，可能限制了正常的学习和生活范围。建议告诉家长，寻求学校心理老师或专业机构的支持——这类困扰通过专业方法改善效果很好。",
    advice: [
      "从小剂量开始：害怕的场合拆成几个小步骤，逐级适应，每完成一级给自己一个小奖励",
      "回避前问自己「最坏的结果是什么」——多数时候，想象中的危险远大于实际",
    ],
  },
  paranoid: {
    meaning:
      "本指标主要反映猜疑与偏执性思维：觉得别人不可信、别人在监视或议论自己、别人想占自己便宜、别人对自己成绩的评判不公正等。适度的警觉是自我保护，过度则会加重人际戒备。",
    low: "你的偏执指标为低风险：能相对客观地看待事物和他人，不会固守明显不正确的认知；偶尔的多疑也很快能自行调整。",
    mid: "你的偏执指标值得关注：近期较常猜疑他人的动机，或觉得别人对自己不公正。先暂停「下结论」，主动验证：直接问一句、多收集信息，常常会发现事实没有想象中糟。",
    high: "你的偏执指标偏高：猜疑和戒备感比较频繁，可能正在影响你对他人的信任和正常交往。建议把感受告诉家长或信任的老师，寻求专业心理支持来调整认知模式。",
    advice: [
      "给善意一个机会：列出三个「别人可能只是好心」的解释，再决定怎么回应",
      "感到被针对时先核实事实，再表达感受——「我觉得不公平」比「你们是故意的」更容易被听见",
    ],
  },
  psychotic: {
    meaning:
      "本指标主要反映一些少见的感知与思维体验（如听到别人听不到的声音、觉得别人能知道自己的私下想法等），以及无法归入其他指标的急性心理困扰。青少年在过度疲劳、极度压力下偶发的类似体验并不少见，频繁出现才需要重视。",
    low: "你的急性症状指标为低风险：基本不存在这类罕见的感知与思维体验，偶尔的一些过度反应对日常生活没有负面影响。",
    mid: "你的急性症状指标值得关注：近期出现过一些少见的感知或思维体验。请先检查睡眠——长期缺觉会产生大量类似体验；保证睡眠、减少熬夜后仍频繁出现，请一定告诉家长并寻求专业评估。",
    high: "你的急性症状指标偏高：这类体验出现得较频繁。请务必把结果告诉家长，尽快到专业机构做进一步评估——及早评估、明确原因，是对自己最好的保护。",
    advice: [
      "优先排查睡眠：连续两周睡够 8 小时后再观察这类体验是否减少",
      "不独处硬扛：把体验如实告诉家长或信任的老师，有人分担时症状往往会减轻",
    ],
  },
  additional: {
    meaning:
      "本指标反映睡眠与饮食状况：入睡困难、睡不稳、醒太早、胃口不好、吃得太多、反复想到死亡等。它是身心状态的晴雨表——睡和吃的变化，往往比情绪更早发出信号。",
    low: "你的睡眠及饮食指标为低风险：睡眠和饮食基本正常，偶尔的小波动没有对日常生活产生较大影响。",
    mid: "你的睡眠及饮食指标值得关注：近期入睡困难、睡不稳或食欲异常。睡眠是心理状态的地基——先固定起床时间、睡前 1 小时远离屏幕，多数睡眠问题会随之改善。",
    high: "你的睡眠及饮食指标偏高：睡眠/饮食问题已经比较频繁，正在透支白天的精力和情绪。建议告诉家长，先从作息规律做起；持续两周无改善请寻求专业评估。",
    advice: [
      "固定起床时间比固定入睡时间更管用——生物钟先稳「起」，「睡」会跟着稳",
      "晚餐七分饱、睡前不刷短视频；躺 20 分钟睡不着就起来做点无聊的事，有困意再回床",
    ],
  },
};

/** SCL-90 阳性筛选规则说明（报告「总体与标准说明」卡）。 */
export const MENTAL_SCL90_RULES = {
  scoring:
    "本量表采用 10 个因子分别反映 10 个方面的心理症状。每个项目均采用 5 级评分：1 没有（自觉无该项问题）；2 很轻（有该症状，但影响轻微）；3 中等（有一定影响）；4 偏重（有相当程度的影响）；5 严重（频度和强度都十分严重）。",
  positive:
    "按中国常模口径，符合以下任一条件可考虑筛选阳性，建议进一步检查：① 总分超过 160 分；② 阳性项目数（单项分 ≥2）超过 43 项；③ 任一因子均分超过 2 分。因子均分程度参考：<2 正常，2—2.9 轻度，3—3.9 中度，4—4.9 偏重。",
  note: "指标之间常存在并发关系：例如情绪困扰（抑郁、焦虑）常伴随躯体化不适与睡眠饮食问题。解读时先看整体画像，再看单项高低，避免孤立地看某一个因子。",
};
