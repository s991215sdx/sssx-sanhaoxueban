/**
 * 家庭教育 · 家长侧家庭卷（Family Parent Pack）
 *
 * 与 e3v37Parent.ts 的关系：
 * - **不改 e3v37Parent**。那套 32 题（背景 9 + 条件观察 7 + 学习对照 16）继续服务学习力诊断；
 * - 本包只装「家庭关系」相关的 29 题：台阶、管教、情感对照、投入、自身、冲突场景；
 * - 两套可同时派发，报告各自取数，互不覆盖。
 *
 * 编号规则：AP 台阶 / BP 管教 / EP 情感对照 / FP 投入 / GP 自身 / HP 场景。
 */

/* ------------------------------------------------------------------ */
/* 一、选项集                                                          */
/* ------------------------------------------------------------------ */

/** 5 点量表：程度递增。 */
export const FAMILY_P5 = ["很不符合", "不太符合", "一般", "比较符合", "完全符合"];
/** 6 级频率：含「不了解」，0 不参与计分。 */
export const FAMILY_P6 = ["不了解", "从不", "很少", "有时", "经常", "总是"];
/** 4 档单选（投入·经济）。 */
export const FAMILY_P4_MONEY = ["比较紧张", "刚好够用", "比较宽裕", "很宽裕"];
/** 5 档单选（投入·时间）。 */
export const FAMILY_P5_TIME = ["几乎没有", "15 分钟以内", "15—30 分钟", "30—60 分钟", "1 小时以上"];

/* ------------------------------------------------------------------ */
/* 二、题目                                                            */
/* ------------------------------------------------------------------ */

export type FamilyParentBlock = "ladder" | "style" | "mirror" | "invest" | "self" | "scene";

export type FamilyParentItem = {
  id: string;
  block: FamilyParentBlock;
  text: string;
  /** 选项集 key。 */
  scale: "p5" | "p6" | "p4money" | "p5time" | "scene";
  /** 归属：台阶级 / 管教维度 / 对照项 / 投入项 / 自身项。 */
  dim?: string;
  /** 反向题：算分时 6 - 原值（p5/p6 通用）。 */
  reverse?: boolean;
};

export const FAMILY_PARENT_ITEMS: FamilyParentItem[] = [
  /* ---- A 五级台阶（与孩子 FS01—FS05 一一对应） ---- */
  { id: "AP01", block: "ladder", dim: "L1", scale: "p5", text: "孩子遇到麻烦，第一个会来找我们" },
  { id: "AP02", block: "ladder", dim: "L2", scale: "p5", text: "孩子心里的事，愿意跟我们说" },
  { id: "AP03", block: "ladder", dim: "L3", scale: "p5", text: "吵完之后，孩子还能主动跟我们说话" },
  { id: "AP04", block: "ladder", dim: "L4", scale: "p5", text: "家里的规矩，孩子可以跟我们商量" },
  { id: "AP05", block: "ladder", dim: "L5", scale: "p5", text: "孩子自己的事，大部分由他自己决定" },

  /* ---- B 管教方式：要求 4 题 ---- */
  { id: "BP01", block: "style", dim: "要求", scale: "p5", text: "我对孩子的要求很明确，说到的必须做到" },
  { id: "BP02", block: "style", dim: "要求", scale: "p5", text: "孩子的时间怎么安排，基本由我定" },
  { id: "BP03", block: "style", dim: "要求", scale: "p5", text: "成绩一不好，我会立刻给他加任务" },
  { id: "BP04", block: "style", dim: "要求", scale: "p5", text: "孩子喊累的时候，我很少因此降低要求" },

  /* ---- B 管教方式：回应 4 题（BP08 反向） ---- */
  { id: "BP05", block: "style", dim: "回应", scale: "p5", text: "孩子说他的想法时，我会先听完再表态" },
  { id: "BP06", block: "style", dim: "回应", scale: "p5", text: "只要理由说得通，孩子可以改我定的规矩" },
  { id: "BP07", block: "style", dim: "回应", scale: "p5", text: "孩子情绪不好时，我会先把学习的事放一放" },
  { id: "BP08", block: "style", dim: "回应", scale: "p5", reverse: true, text: "我很少主动问孩子今天过得怎么样" },

  /* ---- E 情感对照（与孩子对应题配对，算盲区用） ---- */
  { id: "EP01", block: "mirror", dim: "总体", scale: "p6", text: "孩子觉得我们是合格的父母" },
  { id: "EP02", block: "mirror", dim: "理解", scale: "p6", text: "孩子觉得我们理解他" },
  { id: "EP03", block: "mirror", dim: "信任", scale: "p6", text: "孩子相信我们站在他这边" },
  { id: "EP04", block: "mirror", dim: "求助", scale: "p6", text: "孩子遇到麻烦，第一个会找我们" },
  { id: "EP05", block: "mirror", dim: "开口", scale: "p6", text: "孩子心里的事，愿意跟我们说" },
  { id: "EP06", block: "mirror", dim: "难受", scale: "p6", text: "孩子心里难受时，愿意让我们知道" },

  /* ---- F 家庭投入 ---- */
  { id: "FP01", block: "invest", dim: "时间", scale: "p5time", text: "我每天能陪孩子说上话的时间（不谈学习）" },
  { id: "FP02", block: "invest", dim: "经济", scale: "p4money", text: "家里在孩子学习上的花销" },
  { id: "FP03", block: "invest", dim: "了解", scale: "p5", text: "我了解孩子的朋友和日常在做什么" },
  { id: "FP04", block: "invest", dim: "话题", scale: "p5", text: "我会跟孩子聊他感兴趣的事，不只是学习" },
  { id: "FP05", block: "invest", dim: "条件", scale: "p5", text: "孩子需要的资料和工具，我能及时给他备齐" },

  /* ---- G 家长自身（GP04 反向：高分=负担重） ---- */
  { id: "GP01", block: "self", dim: "睡眠", scale: "p5", text: "我最近的睡眠质量" },
  { id: "GP02", block: "self", dim: "情绪", scale: "p5", text: "我最近的情绪状态，比半年前" },
  { id: "GP03", block: "self", dim: "一致", scale: "p5", text: "我和另一半在教育孩子上的一致程度" },
  { id: "GP04", block: "self", dim: "负担", scale: "p5", reverse: true, text: "家里的事，主要是我一个人在扛" },

  /* ---- H 冲突场景（与学生 FS14 同一题，比对是否一致） ---- */
  { id: "HP01", block: "scene", dim: "高频冲突", scale: "scene", text: "你和孩子最容易吵起来的是哪件事（只能选一件）" },
];

export const FAMILY_PARENT_SCENE_OPTIONS = [
  { value: "phone", label: "手机" },
  { value: "homework", label: "作业拖延" },
  { value: "score", label: "成绩" },
  { value: "sleep", label: "作息" },
  { value: "friend", label: "交友" },
  { value: "privacy", label: "隐私（关门、翻手机）" },
] as const;

/* ------------------------------------------------------------------ */
/* 三、组卷                                                            */
/* ------------------------------------------------------------------ */

/** 快版：台阶两级 + 管教四项 + 投入一项 + 自身两项 + 场景 —— 11 题。 */
const LITE_IDS = ["AP01", "AP02", "BP01", "BP02", "BP05", "BP08", "FP01", "GP03", "GP04", "HP01"];

export type FamilyParentPackId = "standard" | "lite";

export const FAMILY_PARENT_PACKS: Record<FamilyParentPackId, string[]> = {
  standard: FAMILY_PARENT_ITEMS.map((q) => q.id),
  lite: LITE_IDS,
};

export function parentItemsOf(pack: FamilyParentPackId): FamilyParentItem[] {
  const ids = new Set(FAMILY_PARENT_PACKS[pack]);
  return FAMILY_PARENT_ITEMS.filter((q) => ids.has(q.id));
}

/* ------------------------------------------------------------------ */
/* 四、计分                                                            */
/* ------------------------------------------------------------------ */

export type FamilyStyleQuadrant = "权威型" | "专制型" | "放任型" | "忽视型";
export type FamilyBand3 = "低" | "中" | "高";

export type FamilyParentAnswers = {
  /** AP/BP/EP/FP/GP 作答：id → 选项下标 +1（p6 的「不了解」记 0）。 */
  items: Record<string, number>;
  scene?: string | null;
  /** 填卷人：dad / mom / other —— 报告称谓要用。 */
  respondent?: "dad" | "mom" | "other";
};

export type FamilyParentProfile = {
  ladder: { level: string; score: number }[];
  style: {
    demand: number;
    warmth: number;
    quadrant: FamilyStyleQuadrant;
    /** 需求高但回应低时，报告写「管得紧，门没关」。 */
    note: string;
  };
  mirror: { id: string; dim: string; score: number }[];
  invest: { time: number; money: number; know: number; topic: number; supply: number };
  self: { sleep: number; mood: number; align: number; burden: number };
  scene: string | null;
  respondent: "dad" | "mom" | "other";
  answered: number;
};

function avg(xs: number[]): number {
  const v = xs.filter((x) => x > 0);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

/** 四象限：要求 × 回应。阈值 3.5 / 3.0 与方案文档一致。 */
export function styleQuadrant(demand: number, warmth: number): FamilyStyleQuadrant {
  if (demand >= 3.5) return warmth >= 3.0 ? "权威型" : "专制型";
  return warmth >= 3.0 ? "放任型" : "忽视型";
}

const QUADRANT_NOTE: Record<FamilyStyleQuadrant, string> = {
  权威型: "同样严格，但多留一个回合。规矩有理由、允许申辩一次",
  专制型: "规矩没问题，问题是规矩只有一个来源。孩子学会的是服从，不是判断",
  放任型: "关系好，但没有边界。孩子不缺爱，缺的是有人替他兜住",
  忽视型: "不是不爱，是自己也没余量了",
};

export function buildFamilyParentProfile(a: FamilyParentAnswers): FamilyParentProfile {
  const pick = (id: string) => a.items[id] ?? 0;
  const pickRev = (id: string, base: number) => {
    const v = pick(id);
    return v > 0 ? base + 1 - v : 0;
  };

  const ladder = ["AP01", "AP02", "AP03", "AP04", "AP05"].map((id, i) => ({
    level: `L${i + 1}`,
    score: pick(id),
  }));

  const demand = avg(["BP01", "BP02", "BP03", "BP04"].map(pick));
  const warmth = avg([pick("BP05"), pick("BP06"), pick("BP07"), pickRev("BP08", 5)]);
  const quadrant = styleQuadrant(demand, warmth);

  const mirror = FAMILY_PARENT_ITEMS.filter((q) => q.block === "mirror").map((q) => ({
    id: q.id,
    dim: q.dim ?? "",
    score: pick(q.id),
  }));

  return {
    ladder,
    style: { demand, warmth, quadrant, note: QUADRANT_NOTE[quadrant] },
    mirror,
    invest: {
      time: pick("FP01"),
      money: pick("FP02"),
      know: pick("FP03"),
      topic: pick("FP04"),
      supply: pick("FP05"),
    },
    self: {
      sleep: pick("GP01"),
      mood: pick("GP02"),
      align: pick("GP03"),
      burden: pickRev("GP04", 5),
    },
    scene: a.scene ?? null,
    respondent: a.respondent ?? "other",
    answered: Object.keys(a.items).filter((k) => /^(AP|BP|EP|FP|GP)/.test(k)).length,
  };
}

/* ------------------------------------------------------------------ */
/* 五、情感对照配对表（家长猜 ↔ 孩子答）                                 */
/* ------------------------------------------------------------------ */

/**
 * reverse=true 表示学生那道题的方向与家长相反，比对前先翻转（6 - 原值）。
 * FS12「难受时更愿意自己待着」是回避信号，家长问的是「愿意让我们知道」，故翻转。
 */
export const FAMILY_MIRROR_PAIRS: {
  parent: string;
  student: string;
  reverse: boolean;
  label: string;
}[] = [
  { parent: "EP01", student: "FS06", reverse: false, label: "他怎么看你们" },
  { parent: "EP02", student: "FS07", reverse: false, label: "他觉不觉得被理解" },
  { parent: "EP03", student: "FS08", reverse: false, label: "他信不信你们站他这边" },
  { parent: "EP04", student: "FS01", reverse: false, label: "遇事找不找你们" },
  { parent: "EP05", student: "FS02", reverse: false, label: "心里的事说不说" },
  { parent: "EP06", student: "FS12", reverse: true, label: "难受时让不让你们知道" },
];
