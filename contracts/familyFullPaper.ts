/**
 * 家庭教育认知测评 · 完整版题包（v250）
 *
 * 这一套题对应《家庭教育认知报告 · 完整版》（10 节 + 附录，13 页）的全部取数位。
 * 与 v235 的「关系卷」（29 题）不是替代关系，而是**包住它**：
 *
 *   家长卷 55 题 = 家庭支持 9 + 条件观察 7 + 认知对照 16 + 关系现状 18（台阶 5 · 管教 8 · 自身 4 · 场景 1）+ 投入 5
 *   孩子卷      = E3 70 评分题（已有）+ 关系 10 题（本文件 S01—S10）+ 心理量表 16（已有 PHQ-9 + GAD-7）
 *   双方各加 DISC 24 组（学生版 / 家长版词组，维度逐组对齐，可同尺对照）
 *
 * 三条不能动的口径：
 * 1. **编号即契约**。P01—P55 / S01—S10 一旦发布不再改号，报告附录按号回指。
 * 2. **家长卷含 DISC**。报告 PART02 要「你是 D、他是 S」的双方四维分，家长那一半只能自己答，
 *    所以家长的码必须把 DISC 一起发下去——这是 v250 相对 v238 最大的一处改动。
 * 3. **认知对照 16 题沿用 E3 家长卷的题干**。同一件事不能在两份卷子里问出两种说法，
 *    这里只重新编号（P17—P32），题干与「对应学生题号」原样搬过来。
 */
import {
  DISC_V2_GROUPS,
  DISC_PARENT_V2_GROUPS,
  type DiscWordGroup,
} from "./assessments";
import { E3V37P_FAMILY_QUESTIONS, E3V37P_COND_OBSERVE, E3V37P_MIRROR_QUESTIONS } from "./e3v37Parent";

/* ------------------------------------------------------------------ */
/* 一、选项集                                                          */
/* ------------------------------------------------------------------ */

/** 五点量表（程度递增），台阶 / 管教 / 自身 / 投入通用。 */
export const FP5 = ["很不符合", "不太符合", "一般", "比较符合", "完全符合"] as const;
/** 六点频率：0=不了解，不参与计分。认知对照专用。 */
export const FP6 = ["不了解", "从不", "很少", "有时", "经常", "总是"] as const;
/** 学生关系卷：五点，正向。 */
export const FS5 = FP5;

export type ParentBlock =
  | "support"   /* 家庭支持 9 */
  | "observe"   /* 条件观察 7 */
  | "mirror"    /* 认知对照 16 */
  | "ladder"    /* 五级台阶 5 */
  | "style"     /* 管教 8 */
  | "invest"    /* 投入 5 */
  | "self"      /* 自身 4 */
  | "scene";    /* 冲突场景 1 */

export type ParentItem = {
  /** P01—P55，发布后不改号。 */
  id: string;
  block: ParentBlock;
  /** 归属维度：台阶 L1—L5 / 管教「要求」「回应」/ 自身「睡眠」… / 条件观察的 key。 */
  dim?: string;
  text: string;
  kind: "choice" | "multi" | "open" | "scale5" | "mirror" | "scene";
  /** kind=choice / multi / scene 时的选项文字；scale5 与 mirror 用固定选项集。 */
  options?: string[];
  /** 反向题：算分时 5+1-原值（仅 scale5）。 */
  reverse?: boolean;
  /** 题干下的补充说明（例如「只选最常见一项」）。 */
  note?: string;
};

export const FAMILY_SCENE_KEYS = ["phone", "homework", "score", "sleep", "friend", "privacy"] as const;
export type FamilySceneKey = (typeof FAMILY_SCENE_KEYS)[number];

export const FAMILY_SCENE_LABEL: Record<FamilySceneKey, string> = {
  phone: "手机",
  homework: "作业拖延",
  score: "成绩",
  sleep: "作息",
  friend: "交友",
  privacy: "隐私（关门、翻手机）",
};

/* ------------------------------------------------------------------ */
/* 二、家长卷 55 题                                                    */
/* ------------------------------------------------------------------ */

/** P01—P09：家庭支持与环境（沿用 E3 家长卷 9 题，选项文字原样）。 */
const SUPPORT_ITEMS: ParentItem[] = E3V37P_FAMILY_QUESTIONS.map((q, i) => {
  const id = `P${String(i + 1).padStart(2, "0")}`;
  if (q.multi) {
    return { id, block: "support" as const, dim: q.key, text: q.title, kind: "multi" as const, options: q.options };
  }
  if (q.open) {
    return {
      id,
      block: "support" as const,
      dim: q.key,
      text: q.title,
      kind: "open" as const,
      options: q.options,
      note: q.key === "familyChange" ? "选「无」可直接跳过说明" : "一句话即可，可以不填",
    };
  }
  return { id, block: "support" as const, dim: q.key, text: q.title, kind: "choice" as const, options: q.options };
});

/** P10—P16：条件系统观察 7 题（0 好 / 1 中 / 2 差 / 3 不了解）。 */
const OBSERVE_ITEMS: ParentItem[] = E3V37P_COND_OBSERVE.map((q, i) => ({
  id: `P${String(i + 10).padStart(2, "0")}`,
  block: "observe",
  dim: q.key,
  text: q.label,
  kind: "choice",
  options: q.options,
  note: `孩子卷对应第 ${q.ref} 题`,
}));

/** P17—P32：认知对照 16 题（家长猜孩子，0=不了解）。 */
const MIRROR_ITEMS: ParentItem[] = E3V37P_MIRROR_QUESTIONS.map((q, i) => ({
  id: `P${String(i + 17).padStart(2, "0")}`,
  block: "mirror",
  dim: q.kp,
  text: q.text,
  kind: "mirror",
  note: `孩子卷对应第 ${q.ref} 题`,
}));

/** P33—P55：关系现状 18 + 投入 5（v235 关系卷重编号，题干沿用）。 */
const RELATION_ITEMS: ParentItem[] = [
  /* 台阶 5 —— 与孩子卷 S01—S05 一一对应 */
  { id: "P33", block: "ladder", dim: "L1", kind: "scale5", text: "孩子遇到麻烦，第一个会来找我们" },
  { id: "P34", block: "ladder", dim: "L2", kind: "scale5", text: "孩子心里的事，愿意跟我们说" },
  { id: "P35", block: "ladder", dim: "L3", kind: "scale5", text: "吵完之后，孩子还能主动跟我们说话" },
  { id: "P36", block: "ladder", dim: "L4", kind: "scale5", text: "家里的规矩，孩子可以跟我们商量" },
  { id: "P37", block: "ladder", dim: "L5", kind: "scale5", text: "孩子自己的事，大部分由他自己决定" },

  /* 管教·要求 4 */
  { id: "P38", block: "style", dim: "要求", kind: "scale5", text: "我对孩子的要求很明确，说到的必须做到" },
  { id: "P39", block: "style", dim: "要求", kind: "scale5", text: "孩子的时间怎么安排，基本由我定" },
  { id: "P40", block: "style", dim: "要求", kind: "scale5", text: "成绩一不好，我会立刻给他加任务" },
  { id: "P41", block: "style", dim: "要求", kind: "scale5", text: "孩子喊累的时候，我很少因此降低要求" },

  /* 管教·回应 4（P45 反向） */
  { id: "P42", block: "style", dim: "回应", kind: "scale5", text: "孩子说他的想法时，我会先听完再表态" },
  { id: "P43", block: "style", dim: "回应", kind: "scale5", text: "只要理由说得通，孩子可以改我定的规矩" },
  { id: "P44", block: "style", dim: "回应", kind: "scale5", text: "孩子情绪不好时，我会先把学习的事放一放" },
  { id: "P45", block: "style", dim: "回应", kind: "scale5", reverse: true, text: "我很少主动问孩子今天过得怎么样" },

  /* 投入 5 */
  { id: "P46", block: "invest", dim: "时间", kind: "choice", options: ["几乎没有", "15 分钟以内", "15—30 分钟", "30—60 分钟", "1 小时以上"], text: "我每天能陪孩子说上话的时间（不谈学习）" },
  { id: "P47", block: "invest", dim: "经济", kind: "choice", options: ["比较紧张", "刚好够用", "比较宽裕", "很宽裕"], text: "家里在孩子学习上的花销" },
  { id: "P48", block: "invest", dim: "了解", kind: "scale5", text: "我了解孩子的朋友和日常在做什么" },
  { id: "P49", block: "invest", dim: "话题", kind: "scale5", text: "我会跟孩子聊他感兴趣的事，不只是学习" },
  { id: "P50", block: "invest", dim: "条件", kind: "scale5", text: "孩子需要的资料和工具，我能及时给他备齐" },

  /* 自身 4（P53 高分=一个人扛；P54 高分=更偏回避，两题都按原始分读，不反向） */
  { id: "P51", block: "self", dim: "睡眠", kind: "scale5", text: "我最近的睡眠质量" },
  { id: "P52", block: "self", dim: "情绪", kind: "scale5", text: "我最近的情绪状态，比半年前" },
  { id: "P53", block: "self", dim: "负担", kind: "scale5", text: "家里的事，主要是我一个人在扛" },
  /* 安全感·家长自己那一半：报告 PART04 里「你」那个点靠这一题定位 */
  { id: "P54", block: "self", dim: "回避", kind: "scale5", reverse: true, text: "孩子不说话的时候，我更愿意等他自己开口，而不是追着问" },

  /* 场景 1 */
  {
    id: "P55",
    block: "scene",
    dim: "高频冲突",
    kind: "scene",
    options: FAMILY_SCENE_KEYS.map((k) => FAMILY_SCENE_LABEL[k]),
    text: "你和孩子最容易吵起来的是哪件事（只能选一件）",
  },
];

export const FAMILY_PARENT_FULL_ITEMS: ParentItem[] = [
  ...SUPPORT_ITEMS,
  ...OBSERVE_ITEMS,
  ...MIRROR_ITEMS,
  ...RELATION_ITEMS,
];

/* ------------------------------------------------------------------ */
/* 三、孩子关系卷 10 题（S01—S10）                                      */
/* ------------------------------------------------------------------ */

export type StudentRelItem = {
  id: string;
  dim: string;
  text: string;
  reverse?: boolean;
};

export const FAMILY_STUDENT_REL_ITEMS: StudentRelItem[] = [
  { id: "S01", dim: "L1", text: "遇到麻烦，我第一个想到的是找爸妈" },
  { id: "S02", dim: "L2", text: "我心里的事，愿意跟爸妈说" },
  { id: "S03", dim: "L3", text: "跟爸妈吵完，我还能主动跟他们说话" },
  { id: "S04", dim: "L4", text: "家里的规矩，我可以跟他们商量" },
  { id: "S05", dim: "L5", text: "我自己的事，大部分由我自己决定" },
  { id: "S06", dim: "评价", text: "我觉得我的爸妈是合格的父母" },
  { id: "S07", dim: "理解", text: "我觉得爸妈理解我" },
  { id: "S08", dim: "信任", text: "我相信爸妈站在我这边" },
  { id: "S09", dim: "回避", text: "心里难受的时候，我更愿意自己待着，不想被问" },
  { id: "S10", dim: "需确认", text: "他们没回我消息，我会想着是不是我做错了什么" },
];

/* ------------------------------------------------------------------ */
/* 四、DISC 24 组（双方同尺）                                          */
/* ------------------------------------------------------------------ */

/** 家长的 DISC 词组（家庭/亲子视角）。 */
export const FAMILY_PARENT_DISC: DiscWordGroup[] = DISC_PARENT_V2_GROUPS;
/** 孩子的 DISC 词组（校园/日常视角）。 */
export const FAMILY_STUDENT_DISC: DiscWordGroup[] = DISC_V2_GROUPS;

/* ------------------------------------------------------------------ */
/* 五、组卷                                                            */
/* ------------------------------------------------------------------ */

export type ParentPaper = {
  kind: "familyparent";
  version: "v250";
  /** 55 题，含家庭支持 / 条件观察 / 认知对照 / 关系现状 / 投入 */
  items: ParentItem[];
  /** 24 组 DISC，家长必须一起答（报告 PART02 家长一侧唯一的取数口） */
  disc: DiscWordGroup[];
  counts: { items: number; discGroups: number };
};

export type StudentRelPaper = {
  kind: "familystudent";
  version: "v250";
  items: StudentRelItem[];
  disc: DiscWordGroup[];
  counts: { items: number; discGroups: number };
};

/** 家长的码发这一整份：55 题 + 24 组 DISC。 */
export function buildParentFullPaper(): ParentPaper {
  return {
    kind: "familyparent",
    version: "v250",
    items: FAMILY_PARENT_FULL_ITEMS,
    disc: FAMILY_PARENT_DISC,
    counts: { items: FAMILY_PARENT_FULL_ITEMS.length, discGroups: FAMILY_PARENT_DISC.length },
  };
}

/** 孩子的码发关系 10 题 + 24 组 DISC（E3 70 题与心理量表 16 题走各自既有入口，不重复派发）。 */
export function buildStudentRelPaper(): StudentRelPaper {
  return {
    kind: "familystudent",
    version: "v250",
    items: FAMILY_STUDENT_REL_ITEMS,
    disc: FAMILY_STUDENT_DISC,
    counts: { items: FAMILY_STUDENT_REL_ITEMS.length, discGroups: FAMILY_STUDENT_DISC.length },
  };
}

/** 分块计数，报告「依据」栏与施测页的进度条都用它，避免两处手写数字对不上。 */
export function parentBlockCounts(): Record<ParentBlock, number> {
  const out = { support: 0, observe: 0, mirror: 0, ladder: 0, style: 0, invest: 0, self: 0, scene: 0 };
  for (const it of FAMILY_PARENT_FULL_ITEMS) out[it.block] += 1;
  return out;
}
