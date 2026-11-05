/**
 * 完整版报告样例数据（v250）
 *
 * 用途：给渲染层喂一份「和原版样例同一个人」的作答，用来逐页比对版式。
 * 这里只造原始作答（题目编号 → 选值），所有分数由 contracts 现算——
 * 换句话说，样例报告里的每个数字都是算出来的，不是抄上去的。
 */
import type { FullReportInput } from "@contracts/familyFullReport";
import { DISC_PARENT_V2_GROUPS, DISC_V2_GROUPS, type DiscV2Answers } from "@contracts/assessments";

/**
 * 造一份 DISC 作答：先给定「最像」与「最不像」各自的维度配额（两者各 24 个，
 * 四维净分自然加和为 0），逐组落成词下标；同组撞车时把「最不像」顺移一位。
 */
function makeDisc(most: Record<string, number>, least: Record<string, number>, groups: typeof DISC_V2_GROUPS): DiscV2Answers {
  const types = ["D", "I", "S", "C"] as const;
  const mostSeq: string[] = [];
  const leastSeq: string[] = [];
  for (const t of types) for (let i = 0; i < most[t]; i += 1) mostSeq.push(t);
  for (const t of types) for (let i = 0; i < least[t]; i += 1) leastSeq.push(t);
  const outMost: number[] = [];
  const outLeast: number[] = [];
  for (let i = 0; i < groups.length; i += 1) {
    const g = groups[i];
    const mi = g.types.indexOf(mostSeq[i] as "D");
    let li = g.types.indexOf(leastSeq[i] as "D");
    if (mi >= 0 && li === mi) li = (mi + 1) % 4;
    if (mi < 0) continue;
    outMost.push(mi);
    outLeast.push(li < 0 ? (mi + 1) % 4 : li);
  }
  return { most: outMost, least: outLeast };
}

/** 学生 E3 70 题：按原版样例的分数摆（3/8=3、24/28/36/44=2、40/54/55/65=4 …）。 */
function e3Ratings(): number[] {
  const r = new Array(70).fill(3);
  const set = (no: number, v: number) => {
    r[no - 1] = v;
  };
  set(3, 3);
  set(8, 3);
  set(13, 4);
  set(18, 3);
  set(24, 2);
  set(28, 2);
  set(36, 2);
  set(44, 2);
  set(40, 4);
  set(50, 2);
  set(54, 4);
  set(55, 4);
  set(57, 2);
  set(60, 4);
  set(62, 4);
  set(65, 4);
  return r;
}

export const SAMPLE_INPUT: FullReportInput = {
  meta: {
    studentName: "黄唯维",
    grade: "初三",
    age: 14,
    respondent: "dad",
    respondentLabel: "爸爸",
    date: new Date(2026, 9, 26),
    reportNo: "SH-2026-1026-037",
    consultant: "唐老师",
  },
  studentRel: { S01: 2, S02: 1, S03: 1, S04: 1, S05: 2, S06: 3, S07: 2, S08: 2, S09: 4, S10: 2 },
  parentItems: {
    /* 家庭支持 P01—P09 */
    P01: 1, P02: 2, P03: 1, P04: 2, P05: 0, P06: 0, P07: 2, P08: 0, P09: 1,
    /* 条件观察 P10—P16（0 好 / 1 中 / 2 差 / 3 不了解） */
    P10: 1, P11: 1, P12: 1, P13: 0, P14: 1, P15: 0, P16: 1,
    /* 认知对照 P17—P32（0 不了解 / 1—5） */
    P17: 4, P18: 3, P19: 2, P20: 4, P21: 3, P22: 3, P23: 2, P24: 3,
    P25: 3, P26: 2, P27: 3, P28: 2, P29: 3, P30: 2, P31: 4, P32: 4,
    /* 台阶 P33—P37 */
    P33: 3, P34: 2, P35: 2, P36: 1, P37: 3,
    /* 管教 P38—P45 */
    P38: 5, P39: 4, P40: 4, P41: 3, P42: 2, P43: 2, P44: 1, P45: 5,
    /* 投入 P46—P50 */
    P46: 2, P47: 1, P48: 4, P49: 3, P50: 5,
    /* 自身 P51—P54 */
    P51: 3, P52: 2, P53: 2, P54: 3,
  },
  parentScene: "phone",
  parentDisc: makeDisc({ D: 14, I: 5, S: 3, C: 2 }, { D: 4, I: 2, S: 9, C: 9 }, DISC_PARENT_V2_GROUPS),
  studentDisc: makeDisc({ D: 2, I: 5, S: 13, C: 4 }, { D: 8, I: 5, S: 3, C: 8 }, DISC_V2_GROUPS),
  e3Ratings: e3Ratings(),
  mental: { anxiety: 11, mood: 8, selfHarm: 0 },
  stage: "junior",
};
