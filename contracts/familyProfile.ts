/**
 * 家庭教育测评 · 合并层
 *
 * 职责：把学生包与家长包合成一份「可用于报告取数」的画像。
 * 三件事：
 *   1. 台阶取低（孩子说通、家长说断，按断算）
 *   2. 盲区配对（家长猜的 6 项 vs 孩子答的 6 项）
 *   3. 分支判定（加固版 / 修复版）—— 决定报告走哪一套文案
 *
 * 不含任何文案。文案在报告组装层，这里只出事实与档位。
 */

import type { FamilyStudentProfile } from "./familyStudent";
import type { FamilyParentProfile } from "./familyParent";
import { FAMILY_MIRROR_PAIRS } from "./familyParent";

/* ------------------------------------------------------------------ */
/* 一、台阶合并                                                        */
/* ------------------------------------------------------------------ */

/**
 * 台阶档位。
 *
 * 「未测」不是一种台阶状态，而是「这次没答到这一级」——速测版只问 L1/L2，
 * L3—L5 就没有分。报告里必须显示成「未测」而不是「断」，否则等于凭空给人判了一刀。
 */
export type LadderBand = "断" | "勉强" | "通" | "稳" | "未测";

/**
 * 单级判定（1—5 分）。
 *
 * 阈值定在 1.5 而不是 2.0：报告案例里 L1「不太符合」= 2 分，必须判「勉强」，
 * 否则 PART00 那句「门没关」就落空。
 *
 * @param offset 阈值偏移。寄宿家庭传 +0.4（可相处时间本就更少，整体放宽）。
 */
export function ladderBand(score: number, offset = 0): LadderBand {
  const s = score + offset;
  if (s <= 1.5) return "断";
  if (s <= 3.4) return "勉强";
  if (s <= 4.4) return "通";
  return "稳";
}

export type LadderMerge = {
  level: string;
  student: number;
  parent: number;
  band: LadderBand;
  /** 双方分差 ≥1.5：报告加一句「他认为这一级和你认为的不一样」。 */
  diverged: boolean;
  /** 只有一方作答：报告标「单方判断，仅供参考」。 */
  singleSide: boolean;
};

export function mergeLadder(
  student: { level: string; score: number }[],
  parent: { level: string; score: number }[],
  opts: { boarding?: boolean } = {},
): LadderMerge[] {
  const offset = opts.boarding ? 0.4 : 0;
  return ["L1", "L2", "L3", "L4", "L5"].map((level) => {
    const s = student.find((x) => x.level === level)?.score ?? 0;
    const p = parent.find((x) => x.level === level)?.score ?? 0;
    const singleSide = !s || !p;
    const low = singleSide ? s || p : Math.min(s, p);
    return {
      level,
      student: s,
      parent: p,
      band: low > 0 ? ladderBand(low, offset) : ("未测" as LadderBand),
      diverged: !singleSide && Math.abs(s - p) >= 1.5,
      singleSide,
    };
  });
}

/* ------------------------------------------------------------------ */
/* 二、盲区配对                                                        */
/* ------------------------------------------------------------------ */

export type BlindSpot = {
  key: string;
  label: string;
  /** 家长猜的（0=不了解，不参与）。 */
  parentScore: number;
  /** 孩子答的（已按需翻转）。 */
  studentScore: number;
  /** 家长 - 孩子。正值=高估，负值=低估。 */
  gap: number;
  /** |gap| ≥ 1.5 记为盲区。 */
  blind: boolean;
};

export function pairBlindSpots(
  studentItems: Record<string, number>,
  parentMirror: { id: string; score: number }[],
): BlindSpot[] {
  const out: BlindSpot[] = [];
  for (const pair of FAMILY_MIRROR_PAIRS) {
    const p = parentMirror.find((m) => m.id === pair.parent)?.score ?? 0;
    const raw = studentItems[pair.student] ?? 0;
    if (!p || !raw) continue; // 任一方没答，不配对
    const s = pair.reverse ? 6 - raw : raw;
    out.push({
      key: pair.parent,
      label: pair.label,
      parentScore: p,
      studentScore: s,
      gap: Math.round((p - s) * 10) / 10,
      blind: Math.abs(p - s) >= 1.5,
    });
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* 三、分支判定                                                        */
/* ------------------------------------------------------------------ */

/**
 * 报告两条支线：
 * - reinforced 加固版：他觉得你们够好、也被理解 —— 目标从「修复」改成「加固」
 * - mixed 混合：认可父母，但觉得不被懂 —— 最常见，也是「扬长补短」最好的切口
 * - repair 修复版：两项都低 —— 走原报告的修复主线
 */
export type FamilyBranch = "reinforced" | "mixed" | "repair";

export function decideBranch(
  student: FamilyStudentProfile,
  items: Record<string, number>,
): {
  branch: FamilyBranch;
  /** 孩子给父母的 0—10 分（仅咨询师可见，报告不印）。 */
  rating10: number | null;
  /** 一句可直接用的判断（报告首页用）。 */
  reason: string;
} {
  const overall = items["FS06"] ?? 0;
  const understood = items["FS07"] ?? 0;
  const rating10 = student.parentView.rating10;

  if (overall >= 4 && understood >= 3.5) {
    return {
      branch: "reinforced",
      rating10,
      reason: "他觉得你们是合格的父母，也觉得被理解——底子是通的，要做的是加固",
    };
  }
  if (overall >= 4) {
    return {
      branch: "mixed",
      rating10,
      reason: "他不怀疑你们爱他，他只是不指望你们懂他",
    };
  }
  return {
    branch: "repair",
    rating10,
    reason: "他给父母的评价不高，说明有几件事长期没被接住，要先修",
  };
}

/* ------------------------------------------------------------------ */
/* 四、总装配                                                          */
/* ------------------------------------------------------------------ */

export type FamilyProfile = {
  ladder: LadderMerge[];
  blind: BlindSpot[];
  branch: ReturnType<typeof decideBranch>;
  /** 家长认为最常吵的 vs 孩子认为最常吵的。 */
  scene: { student: string | null; parent: string | null; match: boolean };
  /** 数据完整度：缺哪几块，报告要灰显或撤页。 */
  coverage: {
    ladder: "full" | "partial" | "none";
    security: "full" | "none";
    blind: number; // 成功配对几项（0—6）
    condition: "own" | "e3" | "mixed" | "empty";
  };
};

export function buildFamilyProfile(input: {
  student: FamilyStudentProfile;
  parent: FamilyParentProfile;
  studentItems: Record<string, number>;
  boarding?: boolean;
}): FamilyProfile {
  const { student, parent, studentItems, boarding } = input;
  const ladder = mergeLadder(student.ladder, parent.ladder, { boarding });
  const blind = pairBlindSpots(studentItems, parent.mirror);

  const answeredLevels = ladder.filter((l) => !l.singleSide).length;
  const coverageLadder: FamilyProfile["coverage"]["ladder"] =
    answeredLevels === 5 ? "full" : answeredLevels > 0 ? "partial" : "none";

  return {
    ladder,
    blind,
    branch: decideBranch(student, studentItems),
    scene: {
      student: student.scene,
      parent: parent.scene,
      match: !!student.scene && student.scene === parent.scene,
    },
    coverage: {
      ladder: coverageLadder,
      security: student.security.fearProbeScore > 0 && student.security.needConfirmScore > 0 ? "full" : "none",
      blind: blind.length,
      condition: student.condition.source,
    },
  };
}

/* ------------------------------------------------------------------ */
/* 五、报告取数小工具                                                  */
/* ------------------------------------------------------------------ */

/** 报告正文只展开「断」和「勉强」两级——五级全讲，家长记不住。 */
export function worstLevels(ladder: LadderMerge[]): LadderMerge[] {
  return ladder.filter((l) => l.band === "断" || l.band === "勉强");
}

/** 台阶的一句话结论（给 PART01 标题用）。 */
export function ladderHeadline(ladder: LadderMerge[]): string {
  const answered = ladder.filter((l) => l.band !== "未测");
  if (!answered.length) return "这次没有答到台阶题";
  const broken = answered.filter((l) => l.band === "断");
  if (!broken.length) {
    const shaky = answered.filter((l) => l.band === "勉强");
    return shaky.length ? `没有断掉的，${shaky[0].level} 这一级是勉强的` : "答到的几级都是通的";
  }
  return `断在 ${broken.map((b) => b.level).join("、")}`;
}
