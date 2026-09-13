/**
 * E3 学业诊断 V3.7 · 第二部分 家长卷（三版内容一致，keys 已统一为 canonical 命名）。
 * 用于了解家庭支持系统，并对比家长观察与孩子自评的差异（家长认知盲区判读）。
 * 家长卷为选做：学员进入系统后可随时补填，不阻塞首次流程。
 */
import {
  E3V37_QUESTIONS,
  E3V37_RATING_COUNT,
  e3v37Level,
  type E3V37Level,
  type E3V37Stage,
} from "./e3v37";

/* ------------------------------ 一、家庭支持与环境 ------------------------------ */

export type E3V37ParentChoiceQ = {
  key: string;
  title: string;
  options?: string[];
  /** 多选题（干扰源）。 */
  multi?: boolean;
  /** 开放文字题（familyChange 补充说明 / wish）。 */
  open?: boolean;
};

/**
 * 家庭支持与环境 9 题（canonical keys）。
 * 选项文字取自测评表 JSON 原文；distractions 为多选，familyChange/wish 含文字补充。
 */
export const E3V37P_FAMILY_QUESTIONS: E3V37ParentChoiceQ[] = [
  { key: "fatherRole", title: "父亲在教养中的角色", options: ["既要求也陪伴", "只要求不陪伴", "只陪伴不要求", "基本放任"] },
  { key: "motherSupport", title: "母亲对孩子的支持主要体现为", options: ["尊重节奏、无条件支持", "成绩好才肯定", "以生活照料为主", "把自己的目标强加给孩子"] },
  { key: "expectation", title: "父母对成绩的期待", options: ["合理期待，关注过程", "高期待，经常施压", "低期待，放任自流", "期待不稳定"] },
  { key: "communication", title: "亲子沟通频率与质量", options: ["每天有效沟通", "偶尔沟通但有效", "经常沟通但冲突多", "很少沟通"] },
  { key: "studySpace", title: "孩子在家学习空间", options: ["安静独立房间", "与家人共用", "客厅等公共区域"] },
  { key: "distractions", title: "学习干扰源（可多选）", multi: true, options: ["手机", "电视", "家人走动", "噪音", "基本没有"] },
  { key: "incentive", title: "家里最常用的激励方式（只选最常见一项）", options: ["批评、施压或惩罚", "物质奖励", "表扬、排名或比较", "讨论理想和目标", "情感支持与共同制定规则"] },
  { key: "familyChange", title: "近半年家庭重大变化", open: true, options: ["无", "搬家", "家庭成员变动", "父母工作变动", "严重亲子冲突", "其他"] },
  { key: "wish", title: "您最希望陪跑先帮孩子解决的一件事", open: true },
];

/* ------------------------------ 二、条件系统观察 ------------------------------ */

export type E3V37ParentCondItem = {
  key: string;
  label: string;
  options: string[];
  /** 学生对应题号原文引用（如「50—56」「57、58」）。 */
  ref: string;
  /** 解析后的学生对应题号。 */
  refNos: number[];
};

/** 条件系统观察 7 行（0=好 / 1=中 / 2=差 / 3=不了解）。 */
export const E3V37P_COND_OBSERVE: E3V37ParentCondItem[] = [
  { key: "state", label: "状态·精力/情绪", options: ["睡眠规律、白天精神好", "偶有疲惫低落", "经常疲惫/情绪差", "不了解"], ref: "50—56", refNos: [50, 51, 52, 53, 54, 55, 56] },
  { key: "relParent", label: "关系·亲子", options: ["支持稳定", "偶尔冲突", "经常冲突", "不了解"], ref: "57、58", refNos: [57, 58] },
  { key: "relSchool", label: "关系·师生/同伴", options: ["总体促进", "影响不大", "明显消极", "不了解"], ref: "59—61", refNos: [59, 60, 61] },
  { key: "resEnv", label: "资源·环境/工具", options: ["安静有固定位置", "位置不稳定", "工具/资料不足", "不了解"], ref: "62、63", refNos: [62, 63] },
  { key: "resTime", label: "资源·时间", options: ["有自由支配时间", "安排较满", "完全被排满", "不了解"], ref: "64", refNos: [64] },
  { key: "resSupport", label: "资源·学校/家庭", options: ["学校支持到位", "家庭协助到位", "都偏弱", "不了解"], ref: "66、67", refNos: [66, 67] },
  { key: "aiPhone", label: "AI/手机使用", options: ["用于学习且有度", "娱乐为主但可控", "明显失控", "不了解"], ref: "45—49", refNos: [45, 46, 47, 48, 49] },
];

/* ------------------------------ 三、家长认知对照题（P1-P16，0 不了解 / 1-5） ------------------------------ */

export type E3V37ParentMirrorQ = {
  key: string;
  kp: string;
  text: string;
  /** 学生对应题号原文引用（如「5—10」）。 */
  ref: string;
  /** 解析后的学生对应题号（区间引用已展开）。 */
  refNos: number[];
};

export const E3V37P_MIRROR_QUESTIONS: E3V37ParentMirrorQ[] = [
  { key: "P1", kp: "动力·兴趣", text: "孩子对某些学科本身感兴趣，常常主动钻研", ref: "1", refNos: [1] },
  { key: "P2", kp: "动力·目标", text: "孩子清楚今年要达到的目标", ref: "3", refNos: [3] },
  { key: "P3", kp: "动力·来源", text: "孩子学习更多是「我要学」，而不是靠催促和奖励", ref: "5—10", refNos: [5, 6, 7, 8, 9, 10] },
  { key: "P4", kp: "信心·效能", text: "孩子相信自己努力就能学好", ref: "13", refNos: [13] },
  { key: "P5", kp: "信心·比较优势", text: "孩子有明确能胜过别人的领域", ref: "11", refNos: [11] },
  { key: "P6", kp: "韧劲·抗挫折", text: "孩子考试失利后能较快调整、重新投入", ref: "18", refNos: [18] },
  { key: "P7", kp: "韧劲·坚持", text: "孩子背单词、刷题能长期坚持，不三天打鱼", ref: "19", refNos: [19] },
  { key: "P8", kp: "会学·学懂", text: "孩子遇到不懂会主动问老师、同学或查资料", ref: "24", refNos: [24] },
  { key: "P9", kp: "会学·记住", text: "孩子会自己动手画结构图、思维导图整理知识", ref: "26", refNos: [26] },
  { key: "P10", kp: "会学·会用", text: "孩子会整理错题并定期重做", ref: "28", refNos: [28] },
  { key: "P11", kp: "善学·计划", text: "孩子有明确学习计划，且大部分能完成", ref: "36", refNos: [36] },
  { key: "P12", kp: "善学·复盘", text: "孩子会写复盘小结，考后做试卷分析", ref: "44", refNos: [44] },
  { key: "P13", kp: "善学·智学", text: "孩子用AI是为了弄懂问题，不是直接抄答案", ref: "47", refNos: [47] },
  { key: "P14", kp: "条件·状态", text: "孩子最近睡眠规律、白天精神好", ref: "50", refNos: [50] },
  { key: "P15", kp: "条件·关系", text: "孩子和老师、同学关系总体舒服", ref: "59—61", refNos: [59, 60, 61] },
  { key: "P16", kp: "条件·资源", text: "孩子在家有安静固定的学习位置", ref: "62", refNos: [62] },
];

export const E3V37P_MIRROR_HINTS = ["不了解", "从不", "很少", "有时", "经常", "总是"];

/* ------------------------------ 输入与结果 ------------------------------ */

export type E3V37ParentInput = {
  /** 家庭支持与环境单选答案：key → 选项下标。 */
  family: Record<string, number>;
  /** 干扰源多选：选项下标数组。 */
  distractions: number[];
  /** familyChange 的文字补充说明。 */
  familyChangeNote: string;
  /** 最希望先解决的一件事（开放文字）。 */
  wish: string;
  /** 条件系统观察：key → 选项下标（0-3，3=不了解）。 */
  condObserve: Record<string, number>;
  /** 认知对照 16 题：0=不了解，1-5。 */
  mirror: number[];
};

export type E3V37ParentBlindSpot = {
  key: string;
  kp: string;
  /** 家长评分 1-5（0=不了解不参与）。 */
  parentScore: number;
  /** 学生对应题（refNos）反向后均分。 */
  studentScore: number;
  /** parentScore - studentScore。 */
  gap: number;
};

export type E3V37ParentCondView = {
  key: string;
  label: string;
  parentView: string;
  /** 学生对应题（refNos）反向后均分；学生未作答为 null。 */
  studentScore: number | null;
  studentLevel: E3V37Level | null;
  note: string;
};

export type E3V37ParentLevel3 = "低" | "中" | "高";

export type E3V37ParentResult = {
  version: "3.7";
  /** 一句话概要（学员端报告用）。 */
  summary: string;
  /** 家长对条件三格（含 AI/手机使用）的观察，与学生自评对照。 */
  condView: E3V37ParentCondView[];
  /** 认知盲区：|家长分 - 学生反向后均分| ≥ 2 的对照题。 */
  blindSpots: E3V37ParentBlindSpot[];
  /** 高估（gap ≥ 2）。 */
  overestimates: E3V37ParentBlindSpot[];
  /** 低估（gap ≤ -2）。 */
  underestimates: E3V37ParentBlindSpot[];
  /** 认知对照「不了解」数量与等级。 */
  unknownCount: number;
  unknownLevel: E3V37ParentLevel3;
  /** 红线：familyChange 选了「严重亲子冲突」。 */
  severeConflict: boolean;
};

function level3(count: number): E3V37ParentLevel3 {
  return count >= 6 ? "高" : count >= 3 ? "中" : "低";
}

function round1(x: number): number {
  return Math.round(x * 10) / 10;
}

/** 「严重亲子冲突」在 familyChange 选项中的下标。 */
export const E3V37P_SEVERE_CONFLICT_INDEX = 4;

/**
 * 家长卷判读。需要学生最近一次 V3.7 作答的原始评分（70 题）以计算认知对照；
 * 学生尚未完成诊断时 studentRatings 传 null，只输出家庭支持与观察部分。
 */
export function scoreE3V37Parent(
  input: E3V37ParentInput,
  studentStage: E3V37Stage | null,
  studentRatings: number[] | null,
): E3V37ParentResult {
  if (input.mirror.length !== E3V37P_MIRROR_QUESTIONS.length) {
    throw new Error(`E3 V3.7 家长认知对照题数量应为 ${E3V37P_MIRROR_QUESTIONS.length}，实际 ${input.mirror.length}`);
  }
  const unknownCount = input.mirror.filter((v) => v === 0).length;

  // 学生反向换算后得分
  const studentAdjusted = new Map<number, number>();
  if (studentStage && studentRatings && studentRatings.length === E3V37_RATING_COUNT) {
    for (const q of E3V37_QUESTIONS[studentStage]) {
      const raw = studentRatings[q.no - 1];
      studentAdjusted.set(q.no, q.reverse ? 6 - raw : raw);
    }
  }
  const studentMean = (nos: number[]): number | null => {
    if (studentAdjusted.size === 0) return null;
    const vals = nos.map((no) => studentAdjusted.get(no)).filter((v): v is number => v != null);
    return vals.length ? round1(vals.reduce((s, v) => s + v, 0) / vals.length) : null;
  };

  // 认知对照：盲区（|差|≥2）
  const diffs: E3V37ParentBlindSpot[] = [];
  E3V37P_MIRROR_QUESTIONS.forEach((q, i) => {
    const parentScore = input.mirror[i] ?? 0;
    if (parentScore === 0) return; // 不了解不参与偏差
    const studentScore = studentMean(q.refNos);
    if (studentScore == null) return;
    diffs.push({ key: q.key, kp: q.kp, parentScore, studentScore, gap: round1(parentScore - studentScore) });
  });
  const blindSpots = diffs.filter((d) => Math.abs(d.gap) >= 2);
  const overestimates = blindSpots.filter((d) => d.gap >= 2);
  const underestimates = blindSpots.filter((d) => d.gap <= -2);

  // 条件系统观察对照
  const condView: E3V37ParentCondView[] = E3V37P_COND_OBSERVE.map((item) => {
    const idx = input.condObserve[item.key];
    const parentView = idx == null ? "未填" : item.options[idx] ?? "未填";
    const studentScore = studentMean(item.refNos);
    const studentLevel = studentScore == null ? null : e3v37Level(studentScore);
    let note = "";
    if (idx === 3) note = "家长不了解这方面，建议陪跑中主动观察并与家长同步。";
    else if (idx === 2) note = `家长认为${item.label}状况较差，需优先核实并处理。`;
    else if (idx === 0) note = `${item.label}状态良好，继续保持。`;
    else note = `${item.label}总体一般，保持关注即可。`;
    if (studentScore != null && studentScore <= 2.0) {
      note += ` 学生自评对应题均分 ${studentScore}（≤2.0），为明显短板。`;
    }
    return { key: item.key, label: item.label, parentView, studentScore, studentLevel, note };
  });

  const changeIdx = input.family["familyChange"];
  const severeConflict = changeIdx === E3V37P_SEVERE_CONFLICT_INDEX;

  const unknownLevel = level3(unknownCount);
  const summary =
    studentAdjusted.size === 0
      ? "家长卷已收到；孩子完成学业诊断后，可生成家长观察与孩子自评的对照分析。"
      : `家长对孩子学习状态的了解程度「${unknownLevel}」（不了解 ${unknownCount} 项），观察与孩子自评的明显差异 ${blindSpots.length} 项（高估 ${overestimates.length} / 低估 ${underestimates.length}）。`;

  return {
    version: "3.7",
    summary,
    condView,
    blindSpots,
    overestimates,
    underestimates,
    unknownCount,
    unknownLevel,
    severeConflict,
  };
}

/** 判断 V3.7 家长卷结果（类型守卫）。 */
export function isE3V37ParentResult(r: unknown): r is E3V37ParentResult {
  return !!r && typeof r === "object" && (r as { version?: string }).version === "3.7";
}
