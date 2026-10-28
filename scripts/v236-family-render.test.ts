/* v236 家庭教育报告 · 渲染冒烟：用「黄唯维」案例数据直出报告，锁住文案口径不跑偏。
 *
 * 这里断言的不是像素，是三条硬口径：
 * 1. 台阶取低后要说出「断在哪一级」；
 * 2. 场景不一致要明说「不是同一件事」；
 * 3. 报告里绝不能出现教养方式类型名（专制型/权威型…）——一贴标签家长就只剩辩解。
 */
import { describe, it, expect } from "vitest";
import { createElement as h } from "react";
import { renderToString } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { FamilyReportBody } from "../src/components/reports/FamilyReport";
import { nextOpenIndex } from "../src/lib/quizFlow";
import { buildFamilyStudentProfile } from "@contracts/familyStudent";
import { buildFamilyParentProfile } from "@contracts/familyParent";
import { buildFamilyProfile } from "@contracts/familyProfile";

const STUDENT_ITEMS = {
  FS01: 2, FS02: 1, FS03: 1, FS04: 2, FS05: 3,
  FS06: 4, FS07: 2, FS08: 3, FS09: 8,
  FS10: 3, FS11: 4, FS12: 4, FS13: 5,
};

const PARENT_ITEMS = {
  AP01: 3, AP02: 2, AP03: 2, AP04: 2, AP05: 3,
  BP01: 5, BP02: 4, BP03: 4, BP04: 4,
  BP05: 2, BP06: 2, BP07: 2, BP08: 5,
  EP01: 4, EP02: 4, EP03: 4, EP04: 3, EP05: 3, EP06: 3,
  FP01: 2, FP02: 2, FP03: 3, FP04: 2, FP05: 4,
  GP01: 2, GP02: 3, GP03: 3, GP04: 4,
};

const student = buildFamilyStudentProfile({ items: STUDENT_ITEMS, scene: "phone" });
const parent = buildFamilyParentProfile({ items: PARENT_ITEMS, scene: "score", respondent: "dad" });
const merged = buildFamilyProfile({ student, parent, studentItems: STUDENT_ITEMS });

const render = (el: unknown) => renderToString(h(MemoryRouter, { initialEntries: ["/"] }, el as never));

describe("v236 家庭教育报告渲染", () => {
  const html = render(h(FamilyReportBody, { student, merged, hasParent: true }));

  it("首页结论说出断在哪一级", () => {
    expect(html).toContain("断了");
    expect(html).toContain("L2");
  });

  it("五级台阶逐级呈现，两端分数都印出来", () => {
    expect(html).toContain("遇到麻烦，第一个找爸妈");
    /* SSR 会在文本插值处插注释节点，用正则跨过它 */
    expect(html).toMatch(/孩子[\s\S]{0,20}2 分/);
    expect(html).toMatch(/家长[\s\S]{0,20}3 分/);
  });

  it("盲区六对全摆出来，偏差项标出方向", () => {
    expect(html).toContain("他怎么看你们");
    expect(html).toContain("六项盲区对照");
  });

  it("场景不一致时直说不是同一件事", () => {
    expect(html).toContain("不是同一件事");
  });

  it("不贴教养方式类型名", () => {
    for (const t of ["专制型", "权威型", "放任型", "忽视型"]) {
      expect(html).not.toContain(t);
    }
  });

  it("行动页收在「九十天只练一件」上", () => {
    expect(html).toContain("接下来九十天");
    expect(html).toContain("好好说话");
  });

  it("只有学生一方时也能出报告，不假装有对照", () => {
    const solo = render(h(FamilyReportBody, { student, merged: null, hasParent: false }));
    expect(solo).toContain("五级台阶");
    expect(solo).not.toContain("不是同一件事");
  });
});

describe("v236 答题跳题逻辑", () => {
  it("逐题往后走，答完最后一题返回 -1（该提交了）", () => {
    const total = 14;
    const done = new Set<number>();
    for (let i = 0; i < total; i++) {
      /* 点第 i 题时，这一题必须算作已答——读上一帧 state 就会在这里卡住 */
      const isDone = (k: number) => done.has(k) || k === i;
      const next = nextOpenIndex(total, i + 1, isDone);
      if (i < total - 1) expect(next).toBe(i + 1);
      else expect(next).toBe(-1);
      done.add(i);
    }
  });

  it("跳过中间一题时，答完最后一题会绕回漏掉的那道", () => {
    const total = 14;
    /* 下标 3 没答，其余都答了；答完第 6 题后往后已无题可跳，应绕回 3 */
    const done = new Set([0, 1, 2, 4, 5, 7, 8, 9, 10, 11, 12, 13]);
    const next = nextOpenIndex(total, 6, (k) => done.has(k) || k === 6);
    expect(next).toBe(3);
  });
});
