/**
 * 家庭教育 · 学生侧补充题包（Family Student Pack）
 *
 * 设计原则（与 E3 学习力诊断彻底解耦）：
 *
 * 1. **不改 e3v37.ts**。新增的 14 道题自成一套编号（FS01—FS14），
 *    不插进 70 题里、不重排原题号、不影响既有计分与报告。
 *
 * 2. **条件域用「引用」不用「复制」**。家庭包需要状态/关系/资源六项，
 *    但题干只在 e3v37 维护一份：这里存 srcNo，运行时按题号取分或取题。
 *    做过 E3 的孩子不必重答；没做过的，把 srcNo 对应的题原样派发一次。
 *
 * 3. **可以单独跑**。没有 E3 数据时，家庭包自己就能出一份报告骨架
 *    （台阶两级 + 看父母 + 安全感 + 冲突场景 + 六项条件）。
 *
 * 4. **一份答案两个报告**。家庭包回写的分数按 srcNo 映射回 E3，
 *    以后做学习力诊断时这六题不重复问。
 */

/* ------------------------------------------------------------------ */
/* 一、题目                                                            */
/* ------------------------------------------------------------------ */

export type FamilyBlock = "ladder" | "parentView" | "security" | "scene";

export type FamilyItem = {
  /** 包内编号，固定不变，报告与答案明细都靠它索引。 */
  id: string;
  block: FamilyBlock;
  text: string;
  /** 5 = 五点量表（默认）；10 = 0—10 打分题。 */
  scale?: 5 | 10;
  /** 归属维度：台阶级 / 看父母的哪一项 / 安全感的哪一维。 */
  dim?: string;
  /** 仅场景题使用。 */
  options?: { value: FamilyScene; label: string }[];
};

export type FamilyScene =
  | "phone"      // 手机
  | "homework"   // 作业拖延
  | "score"      // 成绩
  | "sleep"      // 作息
  | "friend"     // 交友
  | "privacy";   // 隐私（关门、翻手机）

export const FAMILY_SCENE_OPTIONS: { value: FamilyScene; label: string }[] = [
  { value: "phone", label: "手机" },
  { value: "homework", label: "作业拖延" },
  { value: "score", label: "成绩" },
  { value: "sleep", label: "作息" },
  { value: "friend", label: "交友" },
  { value: "privacy", label: "隐私（关门、翻手机）" },
];

export const FAMILY_STUDENT_ITEMS: FamilyItem[] = [
  /* ---- A 五级台阶（每级一问，与家长卷 A1—A5 一一对应） ---- */
  { id: "FS01", block: "ladder", dim: "L1", text: "遇到麻烦，我第一个想到的是找爸妈" },
  { id: "FS02", block: "ladder", dim: "L2", text: "我心里的事，愿意跟爸妈说" },
  { id: "FS03", block: "ladder", dim: "L3", text: "跟爸妈吵完，我还能主动跟他们说话" },
  { id: "FS04", block: "ladder", dim: "L4", text: "家里的规矩，我可以跟他们商量" },
  { id: "FS05", block: "ladder", dim: "L5", text: "我自己的事，大部分由我自己决定" },

  /* ---- C 孩子看父母（决定报告走加固版还是修复版） ---- */
  { id: "FS06", block: "parentView", dim: "总体", text: "总体来说，我觉得爸妈是合格的父母" },
  { id: "FS07", block: "parentView", dim: "理解", text: "我觉得爸妈是理解我的" },
  { id: "FS08", block: "parentView", dim: "信任", text: "遇到事情，我相信爸妈会站在我这边" },
  {
    id: "FS09",
    block: "parentView",
    dim: "打分",
    scale: 10,
    // 题面引导语必须原样保留：不写这句，数据会全在 8 分以上，没有区分度。
    text: "如果让你给爸妈当父母打分，0—10 分，你会打几分（这个分数只有咨询师看得到，不会给爸妈看）",
  },

  /* ---- D 安全感（两维各 2 题，只判倾向，不折算分数） ---- */
  { id: "FS10", block: "security", dim: "需确认", text: "爸妈没回我消息，我会想是不是我做错了什么" },
  { id: "FS11", block: "security", dim: "需确认", text: "爸妈语气一变，我就会想很多" },
  { id: "FS12", block: "security", dim: "怕追问", text: "心里难受的时候，我更愿意自己待着" },
  { id: "FS13", block: "security", dim: "怕追问", text: "爸妈追着问我怎么了，我会想躲" },

  /* ---- H 冲突场景（与家长卷同一题，看两边选的是不是同一件） ---- */
  {
    id: "FS14",
    block: "scene",
    dim: "高频冲突",
    text: "家里最容易吵起来的是哪件事（只能选一件）",
    options: FAMILY_SCENE_OPTIONS,
  },
];

/* ------------------------------------------------------------------ */
/* 二、条件域引用（题干不复制，只存源题号）                              */
/* ------------------------------------------------------------------ */

export type FamilyConditionRef = {
  /** 家庭包内的编号。 */
  id: string;
  /** e3v37 源题号。 */
  srcNo: number;
  /** 引用时的题干（仅用于「没做过 E3」时派发，与 e3v37 保持一致）。 */
  text: string;
  /** 反向题：分数需翻转后再用。 */
  reverse: boolean;
  /** 归到条件的哪一格。 */
  cell: "状态" | "关系" | "资源";
};

/** 学生侧五点量表选项（1—5），与家长卷 p5 同措辞，报告里两侧口径才可比。 */
export const FAMILY_STUDENT_P5 = ["很不符合", "不太符合", "一般", "比较符合", "完全符合"];

/** 0—10 打分题只给两端锚点，中间不写解读。 */
export const FAMILY_STUDENT_RATING10_HINT = { low: "0 分 · 一点也不合格", high: "10 分 · 满分父母" };

export const FAMILY_STUDENT_CONDITION_REFS: FamilyConditionRef[] = [
  { id: "FC01", srcNo: 50, cell: "状态", reverse: false, text: "我最近睡眠规律、能睡够" },
  { id: "FC02", srcNo: 54, cell: "状态", reverse: true, text: "我最近经常疲惫没精神，学习时提不起劲" },
  { id: "FC03", srcNo: 57, cell: "关系", reverse: false, text: "父母和我谈学习时情绪稳定，更多是理解和支持" },
  { id: "FC04", srcNo: 58, cell: "关系", reverse: true, text: "家里对我学习的管教方式让我压力很大" },
  { id: "FC05", srcNo: 64, cell: "资源", reverse: false, text: "我有可自由支配的学习时间，不会被各种安排占满" },
  { id: "FC06", srcNo: 65, cell: "资源", reverse: true, text: "一玩起游戏、刷起手机或追起星来，我就停不下来，超时了也忍不住" },
];

/* ------------------------------------------------------------------ */
/* 三、组卷                                                            */
/* ------------------------------------------------------------------ */

/**
 * 从 E3 的 70 题原始作答里取出家庭包要复用的 6 个分值。
 *
 * ratings 是「按题号顺序」的数组（下标 0 = 第 1 题），srcNo 从 1 起，
 * 所以取下标 srcNo - 1。分数越界或非数字一律丢弃——宁可让报告标「缺数据」，
 * 也不能把脏值当一个有效分数用。
 */
export function e3ScoresOf(ratings: readonly number[] | null | undefined): Partial<Record<number, number>> {
  const out: Partial<Record<number, number>> = {};
  if (!Array.isArray(ratings)) return out;
  for (const ref of FAMILY_STUDENT_CONDITION_REFS) {
    const v = ratings[ref.srcNo - 1];
    if (typeof v === "number" && Number.isFinite(v) && v >= 1 && v <= 5) out[ref.srcNo] = v;
  }
  return out;
}

/** 快版：只保台阶前两级、看父母两项、安全感四题、场景一题 —— 9 题。 */
const LITE_IDS = ["FS01", "FS02", "FS06", "FS09", "FS10", "FS11", "FS12", "FS13", "FS14"];

export type FamilyPackId = "standard" | "lite";

export const FAMILY_STUDENT_PACKS: Record<FamilyPackId, string[]> = {
  standard: FAMILY_STUDENT_ITEMS.map((q) => q.id),
  lite: LITE_IDS,
};

export function itemsOf(pack: FamilyPackId): FamilyItem[] {
  const ids = new Set(FAMILY_STUDENT_PACKS[pack]);
  return FAMILY_STUDENT_ITEMS.filter((q) => ids.has(q.id));
}

/* ------------------------------------------------------------------ */
/* 四、计分                                                            */
/* ------------------------------------------------------------------ */

export type LadderBand = "断" | "勉强" | "通" | "稳" | "未测";
export type ThreeBand = "低" | "中" | "高";

/**
 * 台阶单级判定（1—5 分）。阈值与家长卷共用，取低在合并层做。
 *
 * 阈值取 1.5 而不是 2.0，是因为报告案例里 L1「不太符合」= 2 分，
 * 判定必须是「勉强」——门虚掩着，不是锁死。若阈值放在 2.0，
 * 2 分会掉进「断」，PART00 优势页那句「门没关」就写不出来。
 */
export function ladderBand(score: number): LadderBand {
  if (score <= 1.5) return "断";
  if (score <= 3.4) return "勉强";
  if (score <= 4.4) return "通";
  return "稳";
}

/** 三档（安全感用）。低于 3 题不折算分数，只走这个。 */
export function threeBand(score: number): ThreeBand {
  if (score < 2.6) return "低";
  if (score <= 3.6) return "中";
  return "高";
}

export type FamilyStudentAnswers = {
  /** FS01—FS14 的作答（1—5，或 0—10）。 */
  items: Record<string, number>;
  /** 含 FS14 的场景选择。 */
  scene?: FamilyScene | null;
  /** 家庭包内自带的六道条件题（1—5）。 */
  condition?: Record<string, number>;
  /** 若已有 E3 数据，按 srcNo 传原始分（1—5），优先于 condition。 */
  e3Scores?: Partial<Record<number, number>>;
};

export type ConditionView = {
  /** 三格均分（已处理反向）。 */
  state: number;
  relation: number;
  resource: number;
  /** 数据来源：own = 本次作答，e3 = 复用诊断数据，mixed = 两者都有。 */
  source: "own" | "e3" | "mixed" | "empty";
  /** 缺数据的格，报告里要灰显。 */
  missing: ("状态" | "关系" | "资源")[];
};

export type FamilyStudentProfile = {
  ladder: { level: string; score: number; band: LadderBand }[];
  parentView: {
    total: number;
    band: ThreeBand;
    /** 0—10 原始打分，仅咨询师可见。 */
    rating10: number | null;
  };
  security: {
    needConfirm: ThreeBand;
    fearProbe: ThreeBand;
    needConfirmScore: number;
    fearProbeScore: number;
  };
  scene: FamilyScene | null;
  condition: ConditionView;
  answered: { newItems: number; reusedItems: number };
};

function mean(xs: number[]): number {
  if (!xs.length) return 0;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

/** 0—10 打分折到 1—5，用于和另外三项合并算总分。 */
function foldRating10(v: number): number {
  return Math.min(5, Math.max(1, Math.round((v / 2) * 10) / 10));
}

function resolveCondition(a: FamilyStudentAnswers): ConditionView {
  const buckets: Record<"状态" | "关系" | "资源", number[]> = { 状态: [], 关系: [], 资源: [] };
  const missing: ("状态" | "关系" | "资源")[] = [];
  let fromE3 = 0;
  let fromOwn = 0;

  for (const ref of FAMILY_STUDENT_CONDITION_REFS) {
    const raw = a.e3Scores?.[ref.srcNo] ?? a.condition?.[ref.id];
    if (raw == null) {
      if (!missing.includes(ref.cell)) missing.push(ref.cell);
      continue;
    }
    if (a.e3Scores?.[ref.srcNo] != null) fromE3 += 1;
    else fromOwn += 1;
    buckets[ref.cell].push(ref.reverse ? 6 - raw : raw);
  }

  const source: ConditionView["source"] =
    fromE3 && fromOwn ? "mixed" : fromE3 ? "e3" : fromOwn ? "own" : "empty";

  return {
    state: mean(buckets["状态"]),
    relation: mean(buckets["关系"]),
    resource: mean(buckets["资源"]),
    source,
    missing,
  };
}

export function buildFamilyStudentProfile(a: FamilyStudentAnswers): FamilyStudentProfile {
  const pick = (id: string) => a.items[id] ?? 0;

  /* 台阶：五级各自一分，不合并 */
  const ladder = ["FS01", "FS02", "FS03", "FS04", "FS05"].map((id, i) => {
    const score = pick(id);
    return { level: `L${i + 1}`, score, band: score ? ladderBand(score) : ("未测" as LadderBand) };
  });

  /* 看父母：三项 + 打分折合，均分 */
  const view3 = [pick("FS06"), pick("FS07"), pick("FS08")].filter((x) => x > 0);
  const rating10 = a.items["FS09"] ?? null;
  const folded = rating10 != null ? foldRating10(rating10) : null;
  const all = folded != null ? [...view3, folded] : view3;
  const viewTotal = mean(all);

  /* 安全感：两维各两题，只判三档 */
  const needConfirmScore = mean([pick("FS10"), pick("FS11")].filter((x) => x > 0));
  const fearProbeScore = mean([pick("FS12"), pick("FS13")].filter((x) => x > 0));

  /* 答题量：新题答了几道、条件域复用了几道 */
  const newItems = Object.keys(a.items).filter((k) => k.startsWith("FS")).length;
  const reusedItems = Object.keys(a.e3Scores ?? {}).length;

  return {
    ladder,
    parentView: {
      total: viewTotal,
      band: threeBand(viewTotal),
      rating10,
    },
    security: {
      needConfirm: threeBand(needConfirmScore),
      fearProbe: threeBand(fearProbeScore),
      needConfirmScore,
      fearProbeScore,
    },
    scene: a.scene ?? null,
    condition: resolveCondition(a),
    answered: { newItems, reusedItems },
  };
}
