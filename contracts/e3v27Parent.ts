/**
 * E3 学业诊断 V2.7 · 第二部分 家长卷（三版内容一致）。
 * 用于了解家庭支持系统，并对比家长观察与孩子自评的差异（家长认知盲区判读）。
 * 家长卷为选做：学员进入系统后可随时补填，不阻塞首次流程。
 */
import { E3V27_QUESTIONS, E3V27_RATING_COUNT, type E3V27Stage } from "./e3v27";

/* ------------------------------ 一、家庭支持与环境 ------------------------------ */

export type E3ParentChoiceQ = { key: string; title: string; options: string[] };

export const E3P_FAMILY_QUESTIONS: E3ParentChoiceQ[] = [
  { key: "fatherRole", title: "父亲在教养中的角色", options: ["既要求也陪伴", "只要求不陪伴", "只陪伴不要求", "基本放任"] },
  { key: "motherSupport", title: "母亲对孩子的支持主要体现为", options: ["尊重节奏、无条件支持", "成绩好才肯定", "以生活照料为主", "把自己的目标强加给孩子"] },
  { key: "expectation", title: "父母对成绩的期待", options: ["合理期待，关注过程", "高期待，经常施压", "低期待，放任自流", "期待不稳定"] },
  { key: "communication", title: "亲子沟通频率与质量", options: ["每天有效沟通", "偶尔沟通但有效", "经常沟通但冲突多", "很少沟通"] },
  { key: "space", title: "孩子在家学习空间", options: ["安静独立房间", "与家人共用", "客厅等公共区域"] },
  { key: "incentive", title: "家里最常用的激励方式（只选最常见的一项）", options: ["批评、施压或惩罚", "物质奖励", "表扬、排名或比较", "讨论理想和目标", "情感支持与共同制定规则"] },
  { key: "change", title: "近半年家庭重大变化", options: ["无", "搬家", "家庭成员变动", "父母工作变动", "严重亲子冲突", "其他"] },
];

/** 干扰源（可多选）。 */
export const E3P_INTERFERENCE_OPTIONS = ["手机", "电视", "家人走动", "噪音", "基本没有"];

/* ------------------------------ 二、环境影响观察 ------------------------------ */

export type E3ParentEnvItem = {
  key: string;
  label: string;
  options: string[];
  /** 学生对应题号（用于教练对比） */
  studentNos: number[];
};

export const E3P_ENV_ITEMS: E3ParentEnvItem[] = [
  { key: "peers", label: "同伴圈", options: ["明显积极带动", "影响不大", "明显消极影响", "不了解"], studentNos: [71] },
  { key: "teacher", label: "老师", options: ["总体促进", "影响不大", "明显影响学科投入", "不了解"], studentNos: [72] },
  { key: "parentComm", label: "父母沟通", options: ["支持稳定", "偶尔冲突", "经常冲突", "不了解"], studentNos: [73] },
  { key: "aiPhone", label: "AI/手机使用", options: ["用于学习且有度", "娱乐为主但可控", "明显失控", "不了解"], studentNos: [49, 68] },
];

/* ------------------------------ 三、家长认知对照题（P1-P16，0 不了解 / 1-5） ------------------------------ */

export type E3ParentMirrorQ = { key: string; label: string; text: string; studentNo: number };

export const E3P_MIRROR_QUESTIONS: E3ParentMirrorQ[] = [
  { key: "P1", label: "主动劲头", text: "孩子会主动开始学习，不需要反复催促", studentNo: 1 },
  { key: "P2", label: "效能信念", text: "孩子相信只要自己好好学、方法对，就能学得很厉害", studentNo: 3 },
  { key: "P3", label: "目标清晰", text: "孩子清楚本学期要达到的目标", studentNo: 12 },
  { key: "P4", label: "学习求助", text: "孩子遇到不懂的问题，会主动问老师、同学或查资料", studentNo: 16 },
  { key: "P5", label: "作业闭环", text: "孩子做完作业后会检查、订正并总结", studentNo: 19 },
  { key: "P6", label: "错题重做", text: "孩子会定期重做错题，直到同类题不再错", studentNo: 21 },
  { key: "P7", label: "试卷分析", text: "孩子考后会认真做试卷分析，找出失分原因", studentNo: 28 },
  { key: "P8", label: "复盘习惯", text: "孩子会写复盘日记或学习小结", studentNo: 34 },
  { key: "P9", label: "计划执行", text: "孩子有明确学习计划，并且大部分能完成", studentNo: 29 },
  { key: "P10", label: "学习整理", text: "孩子的资料、试卷、笔记和草稿分类清楚", studentNo: 26 },
  { key: "P11", label: "细节感知", text: "孩子阅读、审题和抄写时较少看错、看漏或抄错", studentNo: 36 },
  { key: "P12", label: "注意稳定", text: "孩子能连续30分钟集中精力学习", studentNo: 39 },
  { key: "P13", label: "情绪觉察", text: "孩子能觉察自己的情绪，并让自己平静下来", studentNo: 53 },
  { key: "P14", label: "规则感", text: "孩子能遵守共同约定的学习规则，不需要反复提醒", studentNo: 60 },
  { key: "P15", label: "睡眠规律", text: "孩子最近一个月睡眠规律", studentNo: 61 },
  { key: "P16", label: "AI使用", text: "孩子用AI是为了弄懂问题，而不是直接抄答案、应付作业", studentNo: 48 },
];

export const E3P_MIRROR_HINTS = ["不了解", "从不", "很少", "有时", "经常", "总是"];

/* ------------------------------ 输入与结果 ------------------------------ */

export type E3V27ParentInput = {
  /** 家庭支持与环境答案：key → 选项下标；interference 为多选下标数组；changeNote/wish 为文字 */
  family: Record<string, number>;
  interference: number[];
  changeNote: string;
  wish: string;
  /** 环境影响观察：key → 选项下标（0-3） */
  envObserve: Record<string, number>;
  /** 认知对照 16 题：0=不了解，1-5 */
  mirror: number[];
};

export type E3V27MirrorDiff = {
  key: string;
  label: string;
  studentNo: number;
  parent: number; // 1-5（0 不了解的不参与偏差）
  student: number; // 学生反向换算后得分
  diff: number; // parent - student
};

export type E3Level3 = "低" | "中" | "高";

export type E3V27ParentResult = {
  version: "v27parent";
  /** 认知盲区：不了解数量与等级 */
  unknownCount: number;
  unknownLevel: E3Level3;
  /** 认知偏差：|家长分-学生反向后得分|≥2 的题数与等级 */
  deviationCount: number;
  deviationLevel: E3Level3;
  /** 高估 / 低估明细（用于家长沟通和陪跑目标校准） */
  overestimates: E3V27MirrorDiff[];
  underestimates: E3V27MirrorDiff[];
  /** 环境影响观察对比（家长观察 vs 学生自评，逐条文字） */
  envNotes: { label: string; parentView: string; note: string }[];
  /** 红线：家长卷反映严重亲子冲突或家庭重大变故 */
  redFlags: string[];
  /** 一句话概要（学员端报告用） */
  summary: string;
  /** 家长沟通要点（伴学师端用） */
  coachNote: string;
};

function level3(count: number): E3Level3 {
  return count >= 6 ? "高" : count >= 3 ? "中" : "低";
}

/**
 * 家长卷判读。需要学生最近一次 V2.7 作答的原始评分（ratings）以计算认知偏差；
 * 学生尚未完成诊断时 ratings 传 null，只输出家庭支持与观察部分。
 */
export function scoreE3V27Parent(
  input: E3V27ParentInput,
  studentStage: E3V27Stage | null,
  studentRatings: number[] | null,
): E3V27ParentResult {
  const mirror = input.mirror;
  const unknownCount = mirror.filter((v) => v === 0).length;

  // 学生反向换算后得分
  const studentAdjusted = new Map<number, number>();
  if (studentStage && studentRatings && studentRatings.length === E3V27_RATING_COUNT) {
    for (const q of E3V27_QUESTIONS[studentStage]) {
      if (q.no > E3V27_RATING_COUNT) break;
      const raw = studentRatings[q.no - 1];
      studentAdjusted.set(q.no, q.reverse ? 6 - raw : raw);
    }
  }

  const diffs: E3V27MirrorDiff[] = [];
  if (studentAdjusted.size > 0) {
    E3P_MIRROR_QUESTIONS.forEach((q, i) => {
      const parent = mirror[i] ?? 0;
      if (parent === 0) return; // 不了解不参与偏差
      const student = studentAdjusted.get(q.studentNo);
      if (student == null) return;
      diffs.push({ key: q.key, label: q.label, studentNo: q.studentNo, parent, student, diff: parent - student });
    });
  }
  const deviationCount = diffs.filter((d) => Math.abs(d.diff) >= 2).length;
  const overestimates = diffs.filter((d) => d.diff >= 2);
  const underestimates = diffs.filter((d) => d.diff <= -2);

  // 环境影响观察对比
  const envNotes = E3P_ENV_ITEMS.map((item) => {
    const idx = input.envObserve[item.key];
    const parentView = idx == null ? "未填" : item.options[idx] ?? "未填";
    let note = "";
    if (idx === 3) note = "家长不了解这方面，建议陪跑中主动观察并与家长同步。";
    else if (idx === 2) note = `家长认为${item.label}有明显负面影响，需优先核实并处理。`;
    else if (idx === 0) note = `${item.label}状态良好，继续保持。`;
    else note = `${item.label}影响不大，保持关注即可。`;
    return { label: item.label, parentView, note };
  });

  // 红线：严重亲子冲突 / 家庭重大变故
  const redFlags: string[] = [];
  const changeIdx = input.family["change"];
  if (changeIdx != null && changeIdx === 4) {
    redFlags.push("家长卷反映近半年有严重亲子冲突：只记录行为事实，先修复关系再谈学习；持续 3 天无缓解应建议家长寻求专业心理资源。");
  } else if (changeIdx != null && changeIdx >= 1 && changeIdx !== 0) {
    // 搬家/成员变动/工作变动/其他：非红线，但写入提示
    const label = E3P_FAMILY_QUESTIONS.find((q) => q.key === "change")?.options[changeIdx] ?? "";
    if (label && label !== "无") {
      redFlags.push(`家长卷反映近半年家庭变化「${label}」：关注孩子适应情况，变化期适当降低学业加压。`);
    }
  }
  const commIdx = input.family["communication"];
  if (commIdx === 3) {
    redFlags.push("亲子沟通「很少沟通」：陪跑目标先包含恢复基本沟通频率。");
  }

  const unknownLevel = level3(unknownCount);
  const deviationLevel = level3(deviationCount);

  const summary =
    studentAdjusted.size === 0
      ? "家长卷已收到；孩子完成学业诊断后，可生成家长观察与孩子自评的对照分析。"
      : `家长对孩子学习状态的了解程度「${unknownLevel}」（不了解 ${unknownCount} 项），观察与孩子自评的偏差「${deviationLevel}」（${deviationCount} 项差异明显）。`;

  const coachNote =
    studentAdjusted.size === 0
      ? "孩子尚未完成 V2.7 诊断，暂无认知对照；先参考家庭支持与环境观察部分。"
      : [
          unknownLevel !== "低" ? `家长「不了解」偏多（${unknownCount} 项），陪跑中主动向家长同步孩子的真实学习状态。` : "",
          deviationLevel !== "低"
            ? `认知偏差${deviationLevel}（${deviationCount} 项）：${[
                overestimates.length ? `高估 ${overestimates.map((d) => d.label).join("、")}` : "",
                underestimates.length ? `低估 ${underestimates.map((d) => d.label).join("、")}` : "",
              ]
                .filter(Boolean)
                .join("；")}，用于家长沟通和陪跑目标校准。`
            : "家长观察与孩子自评基本一致。",
          envNotes.find((n) => n.note.includes("明显负面")) ? "环境影响观察中有明显负面项，优先核实处理。" : "",
        ]
          .filter(Boolean)
          .join(" ");

  return {
    version: "v27parent",
    unknownCount,
    unknownLevel,
    deviationCount,
    deviationLevel,
    overestimates,
    underestimates,
    envNotes,
    redFlags,
    summary,
    coachNote,
  };
}

export function isE3V27ParentResult(r: unknown): r is E3V27ParentResult {
  return !!r && typeof r === "object" && (r as { version?: string }).version === "v27parent";
}
