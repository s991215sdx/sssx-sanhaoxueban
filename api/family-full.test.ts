/**
 * v250 完整版题包与 13 页报告的计分回归。
 *
 * 断言的是「口径」不是「文案」：题量、取低判定、DISC 折百、缺数据不瞎填。
 * 版式靠 scripts/fam-preview.ts 出 PDF 逐页比对，不在这里测。
 */
import { describe, it, expect } from "vitest";
import {
  FAMILY_PARENT_FULL_ITEMS,
  FAMILY_STUDENT_REL_ITEMS,
  buildParentFullPaper,
  buildStudentRelPaper,
  parentBlockCounts,
} from "@contracts/familyFullPaper";
import { buildFamilyFullReport, anxietyBand, moodBand } from "@contracts/familyFullReport";
import { renderFamilyReportPages } from "../src/pages/famReportHtml";
import { SAMPLE_INPUT } from "../scripts/fam-sample";

describe("题包结构", () => {
  it("家长卷 55 题，编号 P01—P55 连续且不重复", () => {
    expect(FAMILY_PARENT_FULL_ITEMS).toHaveLength(55);
    const ids = FAMILY_PARENT_FULL_ITEMS.map((x) => x.id);
    expect(new Set(ids).size).toBe(55);
    ids.forEach((id, i) => expect(id).toBe(`P${String(i + 1).padStart(2, "0")}`));
  });

  it("分块计数与报告「依据」栏的口径一致", () => {
    const c = parentBlockCounts();
    expect(c.support).toBe(9);
    expect(c.observe).toBe(7);
    expect(c.mirror).toBe(16);
    expect(c.ladder).toBe(5);
    expect(c.style).toBe(8);
    expect(c.invest).toBe(5);
    expect(c.self).toBe(4);
    expect(c.scene).toBe(1);
  });

  it("孩子关系卷 10 题：台阶 5 + 看父母 3 + 安全感 2", () => {
    expect(FAMILY_STUDENT_REL_ITEMS).toHaveLength(10);
    expect(FAMILY_STUDENT_REL_ITEMS.filter((x) => /^L\d$/.test(x.dim))).toHaveLength(5);
  });

  it("家长的码里含 24 组 DISC（这是 v250 相对 v238 的关键改动）", () => {
    const p = buildParentFullPaper();
    expect(p.items).toHaveLength(55);
    expect(p.disc).toHaveLength(24);
    expect(p.disc.every((g) => g.words.length === 4)).toBe(true);
    expect(buildStudentRelPaper().disc).toHaveLength(24);
  });
});

describe("完整版报告取数", () => {
  const r = buildFamilyFullReport(SAMPLE_INPUT);

  it("台阶取低：孩子 1 分、家长 2 分 → 判断", () => {
    const l2 = r.ladder.rows[1];
    expect(l2.childScore).toBe(1);
    expect(l2.parentScore).toBe(2);
    expect(l2.verdict).toBe("断");
    expect(r.ladder.firstBroken).toBe("L2");
  });

  it("DISC 折百：四维合计恒为 200，主导型取最高维", () => {
    const p = r.disc.parent!;
    const sum = p.pct.D + p.pct.I + p.pct.S + p.pct.C;
    expect(sum).toBe(200);
    expect(p.primary).toBe("D");
    expect(r.disc.child!.primary).toBe("S");
    expect(r.disc.cell).toEqual({ row: "D", col: "S" });
  });

  it("要求/回应按 8 道管教题折百，且要求高于回应", () => {
    expect(r.stage.demand).toBeGreaterThan(70);
    expect(r.stage.warmth).toBeLessThan(40);
  });

  it("量表分级：GAD-7 11 分是中度、PHQ-9 8 分是轻度", () => {
    expect(anxietyBand(11)).toBe("中度区间");
    expect(moodBand(8)).toBe("轻度区间");
    expect(r.plan.moodBand).toBe("轻度区间");
  });

  it("缺数据时不编：没有 E3 就没有偏离题、预算为空", () => {
    const bare = buildFamilyFullReport({
      ...SAMPLE_INPUT,
      e3Ratings: null,
      studentDisc: null,
      parentDisc: null,
      studentDiscDims: null,
      parentDiscDims: null,
    });
    expect(bare.deviation.hasData).toBe(false);
    expect(bare.deviation.total).toBe(0);
    expect(bare.disc.cell).toBeNull();
    expect(bare.appendix.studentRows).toHaveLength(0);
  });

  it("13 页渲染齐全，页脚页码 01—13 都在", () => {
    const html = renderFamilyReportPages(r);
    expect((html.match(/class="page/g) ?? []).length).toBe(13);
    for (let i = 2; i <= 13; i += 1) {
      expect(html).toContain(`<span class="pn">${String(i).padStart(2, "0")}</span>`);
    }
    expect(html).toContain("PART 09");
    expect(html).toContain("APPENDIX");
  });
});
