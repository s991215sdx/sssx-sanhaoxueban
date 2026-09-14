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
 * 【V40 · 学生版 B】PHQ-A（青少年抑郁筛查 9 题）+ GAD-7 学生化措辞（7 题），
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
export const MENTAL_SDQ_AGE = "适用 4—17 岁：学生自己填写（11 岁以下建议家长陪同读题）";

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
 * V40 · 学生版 B：PHQ-A（青少年抑郁筛查 9 题）+ GAD-7 学生化措辞（7 题）
 * ============================================================================
 * - PHQ-A（Patient Health Questionnaire for Adolescents）是 PHQ-9 的青少年
 *   版本，国际通用；GAD-7 题干按学生日常语境改写（学习、考试、同伴）。
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

const GAD7_STUDENT_TEXTS = [
  "感到紧张、焦虑或着急",
  "停不下来地担心，或控制不住自己的担心",
  "对各种各样的事情担心太多（学习、考试、和同学相处等）",
  "很难放松下来",
  "坐不住，很难安静地待着",
  "容易心烦，或爱发脾气",
  "感到害怕，好像会有什么可怕的事情发生",
];

/** 学生版 B 题库：两段结构（PHQ-A 九题 + GAD-7 学生化七题），题号全局 1-16。 */
export const MENTAL_PA_SECTIONS: MentalV2Section[] = [
  {
    key: "phq9",
    title: "第一部分 · PHQ-A 青少年抑郁筛查（9 题）",
    description: "PHQ-A 是国际通用的青少年抑郁筛查量表（PHQ-9 的青少年版），看最近两周情绪与状态方面的困扰。",
    intro: MENTAL_V2_INTRO,
    questions: PHQA_TEXTS.map((text, i) => ({ no: i + 1, text })),
  },
  {
    key: "gad7",
    title: "第二部分 · GAD-7 焦虑筛查 · 学生版（7 题）",
    description: "GAD-7 是国际通用的焦虑筛查量表，这里按学生日常语境表述，看最近两周紧张、担忧方面的困扰。",
    intro: MENTAL_V2_INTRO,
    questions: GAD7_STUDENT_TEXTS.map((text, i) => ({ no: i + 10, text })),
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
