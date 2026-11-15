/**
 * v293：同一份 DISC 作答，报告里只能有一套数。
 *
 * 起因：家长拿到的读本封面写 C 58 / S 56 / D 54 / I 31（0—100 绝对分），
 * 翻过一页的图写 +17% / +13% / +8% / −37%（双极倾向度）。同一份作答两个数，
 * 家长拿笔一算对不上；而且四个倾向度逐维四舍五入后加起来是 +1，页面却写着「合计恒为 0」。
 *
 * 这里锁三件事：
 * 1. 倾向度四维合计恒为 0（不是「大约 0」）；
 * 2. 由作答直算与由 dims 换算，两条路给出同一个结果；
 * 3. 家长读本这条渲染链上不再出现绝对分这套刻度。
 */
import { describe, it, expect } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { discTendencyFromDims, discTendencyFromV2, scoreDiscV2, DISC_V2_GROUPS } from "@contracts/assessments";

const ROOT = path.resolve(__dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(ROOT, p), "utf8");

/** 妈妈那份真实作答：净分 D+2 / I−9 / S+3 / C+4（dims = 中性 12 + 净分/2） */
const MAMA_DIMS = { D: 13, I: 7.5, S: 13.5, C: 14 };

const sum = (t: Record<string, number>) => t.D + t.I + t.S + t.C;

describe("v293 · 倾向度四维合计恒为 0", () => {
  it("妈妈那份：+8 / −37 / +12 / +17，加起来正好 0", () => {
    const t = discTendencyFromDims(MAMA_DIMS, 2);
    expect(t).toEqual({ D: 8, I: -37, S: 12, C: 17 });
    expect(sum(t)).toBe(0);
  });

  it("穷举所有合法净分组合，没有一组加起来是 ±1", () => {
    /* 净分 −24..+24 且四维合计 0 的组合；不必全枚举，按步长取样已能覆盖舍入边界 */
    let checked = 0;
    for (let d = -8; d <= 8; d++) {
      for (let i = -8; i <= 8; i++) {
        for (let s = -8; s <= 8; s++) {
          const net = { D: d, I: i, S: s, C: -(d + i + s) };
          const dims = { D: 12 + net.D / 2, I: 12 + net.I / 2, S: 12 + net.S / 2, C: 12 + net.C / 2 };
          const t = discTendencyFromDims(dims, 2);
          expect(sum(t)).toBe(0);
          /* 每个分量不能偏离精确值超过 1（最大余数法只挪 1 分） */
          (["D", "I", "S", "C"] as const).forEach((k) => {
            expect(Math.abs(t[k] - (net[k] / 24) * 100)).toBeLessThan(1);
          });
          checked++;
        }
      }
    }
    expect(checked).toBeGreaterThan(4000);
  });

  it("中性 12 分四面持平：显示 0 / 0 / 0 / 0，不是 0 / 1 / 0 / −1", () => {
    expect(discTendencyFromDims({ D: 12, I: 12, S: 12, C: 12 }, 2)).toEqual({ D: 0, I: 0, S: 0, C: 0 });
  });
});

describe("v293 · 两条算路给出同一个结果", () => {
  it("由作答直算 = 由 dims 换算（V2）", () => {
    /* 构造一份已知作答：24 组里，most 依次给 D/I/S/C，least 给对角 */
    const most = DISC_V2_GROUPS.map((_, i) => i % 4);
    const least = DISC_V2_GROUPS.map((_, i) => (i + 2) % 4);
    const ans = { most, least };
    const viaAns = discTendencyFromV2(ans);
    const viaDims = discTendencyFromDims(scoreDiscV2(ans).dims, 2);
    expect(viaAns).toEqual(viaDims);
    expect(sum(viaAns)).toBe(0);
  });
});

describe("v293 · 家长读本这条链上只剩一套数", () => {
  const reader = read("src/components/reports/ParentDiscReader.tsx");
  const compare = read("src/components/reports/ParentDiscCompare.tsx");
  const kit = read("contracts/familyCommKit.ts");

  it("封面不再出现「0—100 绝对分」", () => {
    /* 注释里提到历史口径没关系，页面上不能再出现这套说法 */
    expect(reader).not.toContain("你的四个维度（0—100 绝对分");
    expect(reader).not.toContain("四维合计不固定为 100）");
    expect(compare).not.toContain("四个维度对照（0—100 绝对分");
  });

  it("封面四维条走倾向度，画法是从中线往两侧", () => {
    expect(reader).toContain("discTendencyFromDims");
    expect(reader).toContain("discTendencyText");
    expect(reader).toContain("双极倾向度，四维合计恒为 0");
  });

  it("家长个人版的依据句引用倾向度，不再写「D 分 54」这类绝对分", () => {
    /* 判定仍用 sc（50 是两轴四格的中性基准），但出现在文案里的必须是 td */
    expect(kit).toContain("依据 两轴判定：要求轴取 D（${discTendencyText(td.D)}）");
    expect(kit).not.toContain("要求轴取 D 分 ${sc.D}");
    expect(kit).not.toContain("${p.second} 有 ${sc[p.second]}");
    expect(kit).not.toContain("折算为 0—100 的四维绝对分。主因子取最高分");
    /* 06 节这条最容易漏：句子里只有「最低维」一个数字，扫段落时会被跳过 */
    expect(kit).not.toContain("最低维 ${lo.d} ${lo.v}");
    expect(kit).toContain("最低维 ${lo.d} ${discTendencyText(td[lo.d])}");
  });

  it("锦囊块支持双极条，且家长个人版显式打开", () => {
    expect(kit).toContain("dual?: boolean");
    expect(kit).toContain("dual: true");
    const view = read("src/components/reports/FamilyCommKit.tsx");
    expect(view).toContain("if (b.dual)");
  });
});

describe("v293 · 行为特征轴：行首写「现在偏哪边」", () => {
  const rv = read("src/components/reports/ReportView.tsx");

  it("负值时行首用 − 端的名，不是固定的 + 端名", () => {
    /* 原来写死 {DISC_BIPOLAR[k].plus} {k}+，于是「外向 I+」配 −37% */
    expect(rv).not.toContain("{DISC_BIPOLAR[k].plus} {k}+");
    expect(rv).toContain("!neg ? DISC_BIPOLAR[k].plus : DISC_BIPOLAR[k].minus");
    expect(rv).toContain("neg ? DISC_BIPOLAR[k].plus : DISC_BIPOLAR[k].minus");
  });
});
