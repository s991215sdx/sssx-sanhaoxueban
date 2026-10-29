/**
 * v235 家庭测评：学生包 / 家长包 / 合并层 的计分口径回归。
 *
 * 用「黄唯维」案例（D86/I58 + S78/C52，L2 断）做基准，
 * 断言的数就是《家庭教育认知报告》正文里引用的那几个数。
 */
import { describe, it, expect } from "vitest";
import {
  FAMILY_STUDENT_ITEMS,
  FAMILY_STUDENT_CONDITION_REFS,
  e3ScoresOf,
  itemsOf,
  buildFamilyStudentProfile,
  FAMILY_STUDENT_PACKS,
} from "@contracts/familyStudent";
import {
  FAMILY_PARENT_ITEMS,
  parentItemsOf,
  buildFamilyParentProfile,
  styleQuadrant,
} from "@contracts/familyParent";
import {
  mergeLadder,
  pairBlindSpots,
  decideBranch,
  buildFamilyProfile,
  worstLevels,
  ladderHeadline,
  ladderBand,
} from "@contracts/familyProfile";

/* 学生：L1 勉强、L2 断；看父母「认可但不被懂」 */
const STUDENT_ITEMS = {
  FS01: 2, FS02: 1, FS03: 1, FS04: 2, FS05: 3,
  FS06: 4, FS07: 2, FS08: 3, FS09: 8,
  FS10: 3, FS11: 4, FS12: 4, FS13: 5,
};

/* 家长：要求 4.25 / 回应 1.75 → 专制型 */
const PARENT_ITEMS = {
  AP01: 3, AP02: 2, AP03: 2, AP04: 2, AP05: 3,
  BP01: 5, BP02: 4, BP03: 4, BP04: 4,
  BP05: 2, BP06: 2, BP07: 2, BP08: 5,
  EP01: 4, EP02: 4, EP03: 4, EP04: 3, EP05: 3, EP06: 3,
  FP01: 2, FP02: 2, FP03: 3, FP04: 2, FP05: 4,
  GP01: 2, GP02: 3, GP03: 3, GP04: 4,
};

describe("题包结构", () => {
  it("学生包 14 题、快版 9 题，编号不重复", () => {
    expect(FAMILY_STUDENT_ITEMS).toHaveLength(14);
    expect(itemsOf("standard")).toHaveLength(14);
    expect(itemsOf("lite")).toHaveLength(9);
    const ids = FAMILY_STUDENT_ITEMS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("家长包 29 题、快版 10 题，编号不重复", () => {
    expect(FAMILY_PARENT_ITEMS).toHaveLength(29);
    expect(parentItemsOf("standard")).toHaveLength(29);
    expect(parentItemsOf("lite")).toHaveLength(10);
    const ids = FAMILY_PARENT_ITEMS.map((q) => q.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("快版是完整版的子集（不能有专属题）", () => {
    const all = new Set(FAMILY_STUDENT_ITEMS.map((q) => q.id));
    for (const id of FAMILY_STUDENT_PACKS.lite) expect(all.has(id)).toBe(true);
  });
});

describe("学生包计分", () => {
  const p = buildFamilyStudentProfile({
    items: STUDENT_ITEMS,
    scene: "phone",
    condition: { FC01: 2, FC02: 2, FC03: 2, FC04: 4, FC05: 2, FC06: 4 },
  });

  it("台阶：L1 是勉强，L2 是断（阈值 1.5 的关键用例）", () => {
    expect(p.ladder[0].band).toBe("勉强"); // FS01 = 2
    expect(p.ladder[1].band).toBe("断");   // FS02 = 1
  });

  it("看父母：三项 + 打分折合，均分 3.25", () => {
    // (4 + 2 + 3 + 8/2) / 4 = 3.25
    expect(p.parentView.total).toBeCloseTo(3.25, 2);
    expect(p.parentView.rating10).toBe(8);
  });

  it("安全感：怕追问 高、需确认 中", () => {
    expect(p.security.fearProbe).toBe("高");   // (4+5)/2 = 4.5
    expect(p.security.needConfirm).toBe("中"); // (3+4)/2 = 3.5
  });

  it("条件域：本次作答，三格均分已处理反向", () => {
    expect(p.condition.source).toBe("own");
    expect(p.condition.state).toBeCloseTo(3.0, 2);    // 50=2, 54=2(反)→4
    expect(p.condition.relation).toBeCloseTo(2.0, 2); // 57=2, 58=4(反)→2
  });

  it("有 E3 数据时优先复用，不重复计本次作答", () => {
    const p2 = buildFamilyStudentProfile({
      items: STUDENT_ITEMS,
      scene: "phone",
      condition: { FC01: 5, FC02: 5, FC03: 5, FC04: 1, FC05: 5, FC06: 1 },
      e3Scores: { 50: 2, 54: 2, 57: 2, 58: 4, 64: 2, 65: 4 },
    });
    expect(p2.condition.source).toBe("e3");
    expect(p2.condition.relation).toBeCloseTo(2.0, 2);
  });
});

describe("家长包计分", () => {
  const p = buildFamilyParentProfile({ items: PARENT_ITEMS, scene: "score", respondent: "dad" });

  it("管教：要求 4.25、回应 1.75 → 专制型", () => {
    expect(p.style.demand).toBeCloseTo(4.25, 2);
    expect(p.style.warmth).toBeCloseTo(1.75, 2); // BP08=5 反向 → 1
    expect(p.style.quadrant).toBe("专制型");
  });

  it("四象限边界：要求 3.5 / 回应 3.0", () => {
    expect(styleQuadrant(3.5, 3.0)).toBe("权威型");
    expect(styleQuadrant(3.5, 2.9)).toBe("专制型");
    expect(styleQuadrant(3.4, 3.0)).toBe("放任型");
    expect(styleQuadrant(3.4, 2.9)).toBe("忽视型");
  });

  it("自身：GP04 反向，负担分 = 6 - 原值", () => {
    expect(p.self.burden).toBe(2); // GP04 = 4
  });

  it("记录填卷人（决定报告称谓）", () => {
    expect(p.respondent).toBe("dad");
  });
});

describe("合并层", () => {
  const student = buildFamilyStudentProfile({
    items: STUDENT_ITEMS,
    scene: "phone",
    condition: { FC01: 2, FC02: 2, FC03: 2, FC04: 4, FC05: 2, FC06: 4 },
  });
  const parent = buildFamilyParentProfile({ items: PARENT_ITEMS, scene: "score", respondent: "dad" });

  it("台阶取低：孩子说 2、家长说 3，按 2 判", () => {
    const m = mergeLadder(student.ladder, parent.ladder);
    expect(m[0].student).toBe(2);
    expect(m[0].parent).toBe(3);
    expect(m[0].band).toBe("勉强");
  });

  it("家长只答两级时，其余标单方", () => {
    const m = mergeLadder(student.ladder, parent.ladder.slice(0, 2));
    expect(m[0].singleSide).toBe(false);
    expect(m[2].singleSide).toBe(true);
  });

  it("寄宿家庭阈值整体放宽 0.4：1.2 分原本判断，放宽后算勉强", () => {
    expect(ladderBand(1.2, 0)).toBe("断");
    expect(ladderBand(1.2, 0.4)).toBe("勉强"); // 1.6 > 1.5
    expect(ladderBand(2, 0)).toBe("勉强");
    expect(ladderBand(1, 0.4)).toBe("断");     // 1.4，仍在断的区间
  });

  it("盲区配对：6 对里 2 对超过 1.5", () => {
    const blind = pairBlindSpots(STUDENT_ITEMS, parent.mirror);
    expect(blind).toHaveLength(6);
    expect(blind.filter((b) => b.blind)).toHaveLength(2);
  });

  it("分支：认可父母但不被理解 → mixed", () => {
    const b = decideBranch(student, STUDENT_ITEMS);
    expect(b.branch).toBe("mixed");
    expect(b.rating10).toBe(8);
  });

  it("场景比对：手机 vs 成绩 → 不一致", () => {
    const fp = buildFamilyProfile({
      student,
      parent,
      studentItems: STUDENT_ITEMS,
    });
    expect(fp.scene.match).toBe(false);
  });

  it("报告只展开断与勉强两级", () => {
    const m = mergeLadder(student.ladder, parent.ladder);
    const w = worstLevels(m);
    expect(w.length).toBeLessThanOrEqual(5);
    expect(w.every((l) => l.band === "断" || l.band === "勉强")).toBe(true);
    expect(ladderHeadline(m)).toContain("断在");
  });
});

describe("速测版与 E3 复用", () => {
  const lite = buildFamilyStudentProfile({ items: { FS01: 3, FS02: 4 } });

  it("速测版没答到的级别是「未测」，不是「断」", () => {
    expect(lite.ladder[0].band).toBe("勉强"); // 3 分
    expect(lite.ladder[2].band).toBe("未测"); // FS03 没答
    const m = mergeLadder(lite.ladder, []);
    expect(m[2].band).toBe("未测");
    /* 未测不能混进「要修复」的清单，否则报告凭空给人判一刀 */
    expect(worstLevels(m).some((l) => l.level === "L3")).toBe(false);
  });

  it("一级都没答时，台阶结论直说没答到，不硬下判断", () => {
    expect(ladderHeadline(mergeLadder([], []))).toContain("没有答到");
  });

  it("E3 原始分按题号回填：srcNo 从 1 起，数组下标从 0 起", () => {
    const ratings = Array.from({ length: 70 }, (_, i) => (i + 1 === 50 ? 2 : 3));
    const got = e3ScoresOf(ratings);
    expect(got[50]).toBe(2);
    expect(got[57]).toBe(3);
    expect(FAMILY_STUDENT_CONDITION_REFS.every((r) => got[r.srcNo] != null)).toBe(true);
  });

  it("E3 数据不合格时不硬凑分数，宁可缺", () => {
    expect(e3ScoresOf(null)).toEqual({});
    expect(e3ScoresOf([1, 2, 3])).toEqual({}); // 长度不对，没一道落到 50/54/57/58/64/65
    expect(e3ScoresOf(Array.from({ length: 70 }, () => 0))).toEqual({}); // 0 分不是合法五点分
  });
});
