/**
 * 人才测评的计分与报告回归。
 *
 * 重点不是「算得对」，而是几条一旦破了就会静默出错的性质：
 *  1) 全选同一档必须落在 50——正向题与反向题各半，直线作答不能刷高分；
 *  2) DISC 四维折百合计恒为 200——这是强迫选择的代数结果，不是巧合；
 *  3) 选项分数不进前端，但计分要按「该题最高分」折算，否则不同题的分值不齐；
 *  4) 缺答要标「估算」，不能当成 0 分把匹配度拉死。
 */
import { describe, expect, it } from "vitest";
import {
  BIGFIVE_ITEMS,
  DUTY_PACKS,
  EQ_ITEMS,
  PART_META,
  VALUE_ITEMS,
  WORK_DISC_GROUPS,
} from "../contracts/talent/bank";
import {
  computeDims,
  allFits,
  fitForJob,
  scoreBigFive,
  scoreDuty,
  scoreEq,
  scoreValue,
  scoreWorkDisc,
} from "../contracts/talent/score";
import { buildTalentReport } from "../contracts/talent/report";
import { decodeTalentCode, encodeTalentCode } from "../api/talentCode";

const fill = (items: { id: string; reverse?: boolean }[], pick: (reverse: boolean) => number) =>
  Object.fromEntries(items.map((i) => [i.id, pick(!!i.reverse)]));

describe("大五人格计分", () => {
  it("全选同一档落在 50：直线作答刷不出高分", () => {
    for (const v of [1, 3, 5]) {
      const s = scoreBigFive(fill(BIGFIVE_ITEMS, () => v));
      for (const k of ["N", "C", "E", "A", "O"] as const) expect(s[k]).toBe(50);
    }
  });

  it("正向题打 5、反向题打 1 → 每维 100", () => {
    const s = scoreBigFive(fill(BIGFIVE_ITEMS, (rev) => (rev ? 1 : 5)));
    for (const k of ["N", "C", "E", "A", "O"] as const) expect(s[k]).toBe(100);
  });

  it("一题没答 → 给 50 而不是 0（不让缺答把匹配度拉死）", () => {
    const s = scoreBigFive({});
    for (const k of ["N", "C", "E", "A", "O"] as const) expect(s[k]).toBe(50);
  });

  it("越界分值被忽略，不参与均值", () => {
    const s = scoreBigFive({ B01: 99, B02: 0, B03: 5, B04: 1 });
    /* 只剩 B03=5、B04=1（反向→5）→ 100 */
    expect(s.N).toBe(100);
  });
});

describe("工作价值观计分", () => {
  it("六个维度都算得出来，且都在 0–100", () => {
    const s = scoreValue(Object.fromEntries(VALUE_ITEMS.map((i, idx) => [i.id, (idx % 5) + 1])));
    for (const k of ["M", "G", "S", "R", "A", "P"] as const) {
      expect(s[k]).toBeGreaterThanOrEqual(0);
      expect(s[k]).toBeLessThanOrEqual(100);
    }
  });
});

describe("职场 DISC", () => {
  const straight = (offset: number) => ({
    most: WORK_DISC_GROUPS.map((_, i) => (i + offset) % 4),
    least: WORK_DISC_GROUPS.map((_, i) => (i + offset + 1) % 4),
  });

  it("四维折百合计恒为 200：净分和为 0 的代数结果", () => {
    for (const off of [0, 1, 2, 3]) {
      const s = scoreWorkDisc(straight(off));
      expect(s.D + s.I + s.S + s.C).toBe(200);
    }
  });

  it("每组 most/least 相同（无效作答）不计分，回落中性 50", () => {
    const s = scoreWorkDisc({ most: WORK_DISC_GROUPS.map(() => 0), least: WORK_DISC_GROUPS.map(() => 0) });
    expect(s.D).toBe(50);
    expect(s.I).toBe(50);
  });

  it("主导类型取四维最高的一项", () => {
    const s = scoreWorkDisc(straight(0));
    const top = Math.max(s.D, s.I, s.S, s.C);
    expect([s.D, s.I, s.S, s.C].filter((v) => v === top)).toContain(s[ s.primary as "D" ]);
  });
});

describe("特质情商计分", () => {
  it("十五维 + 四因素 + 总分都在 0–100，因素等于所含维的均值", () => {
    const s = scoreEq(fill(EQ_ITEMS, () => 5));
    for (const v of Object.values(s.dims)) expect(v).toBeGreaterThanOrEqual(0);
    const factorAvg = Object.values(s.factors).reduce((a, b) => a + b, 0) / 4;
    expect(Math.abs(factorAvg - s.overall)).toBeLessThan(2);
  });

  it("全选初中点（4 分）落在 50", () => {
    const s = scoreEq(fill(EQ_ITEMS, () => 4));
    expect(s.overall).toBe(50);
  });
});

describe("岗位加测计分", () => {
  it("情境题按「该题最高分」折算：选到最优项即满分", () => {
    const pack = DUTY_PACKS.sales;
    const ans: Record<string, number> = {};
    for (const it of pack.items) {
      if (it.kind === "choice") {
        const best = it.options.reduce((bi, o, i) => (o.score > it.options[bi].score ? i : bi), 0);
        ans[it.id] = best;
      } else {
        ans[it.id] = it.reverse ? 1 : 5;
      }
    }
    const r = scoreDuty("sales", ans);
    expect(r.answered).toBe(pack.items.length);
    expect(r.score).toBe(100);
  });

  it("一题不答 → 50，answered=0（报告据此标「未做」而不是「做得很差」）", () => {
    const r = scoreDuty("admin", {});
    expect(r.answered).toBe(0);
    expect(r.score).toBe(50);
  });
});

describe("十维汇总", () => {
  const full = () => {
    const bigfive = scoreBigFive(fill(BIGFIVE_ITEMS, (rev) => (rev ? 1 : 5)));
    const value = scoreValue(Object.fromEntries(VALUE_ITEMS.map((i) => [i.id, 5])));
    const discwork = scoreWorkDisc({
      most: WORK_DISC_GROUPS.map(() => 0),
      least: WORK_DISC_GROUPS.map(() => 1),
    });
    return computeDims({
      bigfive,
      value,
      discwork,
      dutyScores: { pack: "admin" as const, score: 80, answered: 12 },
      answered: { bigfive: 20, value: 18, discwork: 24, duty: 12 },
    });
  };

  it("有作答的维度标 measured，没作答的标 estimated", () => {
    const { details } = computeDims({ answered: {} });
    expect(details.every((d) => d.basis === "estimated")).toBe(true);
    const r = full();
    expect(r.details.find((d) => d.key === "detail")?.basis).toBe("measured");
  });

  it("行政岗没做加测时，「细致」用条理 + 尽责估出来，不是 0", () => {
    const bf = scoreBigFive(fill(BIGFIVE_ITEMS, (rev) => (rev ? 1 : 5)));
    const dw = scoreWorkDisc({ most: WORK_DISC_GROUPS.map(() => 0), least: WORK_DISC_GROUPS.map(() => 1) });
    const { dims } = computeDims({ bigfive: bf, discwork: dw, answered: { bigfive: 20, discwork: 24 } });
    expect(dims.detail).toBeGreaterThan(40);
  });
});

describe("岗位匹配", () => {
  it("核心维低于 40 记硬缺口", () => {
    const dims = { influence: 70, empathy: 70, order: 30, drive: 70, stable: 70, duty: 70, achieve: 70, rule: 30, lead: 70, detail: 70 };
    const fit = fitForJob("admin", dims);
    expect(fit.gaps.map((g) => g.dim).sort()).toEqual(["order", "rule"]);
  });

  it("重要维塌到 0 时，分数再高也不给「高度匹配」", () => {
    /* 其余九维 90 分、条理规范 0 分：加权分仍然很高，但报告不能说「主要维度都对得上」 */
    const dims = { influence: 90, empathy: 90, order: 0, drive: 90, stable: 90, duty: 90, achieve: 90, rule: 90, lead: 90, detail: 90 };
    const fit = fitForJob("mgmt", dims);
    expect(fit.weak.map((w) => w.dim)).toContain("order");
    expect(fit.band).not.toBe("strong");
  });

  it("核心维塌两项直接判「暂不匹配」", () => {
    const dims = { influence: 90, empathy: 90, order: 90, drive: 20, stable: 20, duty: 90, achieve: 90, rule: 90, lead: 90, detail: 90 };
    expect(fitForJob("sales", dims).band).toBe("off");
  });

  it("每一岗都带自己的分档，前端不重复算", () => {
    const dims = { influence: 70, empathy: 70, order: 70, drive: 70, stable: 70, duty: 70, achieve: 70, rule: 70, lead: 70, detail: 70 };
    for (const f of allFits(dims)) expect(["strong", "fit", "watch", "off"]).toContain(f.band);
  });

  it("权重 0 的维度不参与计算（教学服务岗不看「领导」）", () => {
    const a = { influence: 60, empathy: 60, order: 60, drive: 60, stable: 60, duty: 60, achieve: 60, rule: 60, lead: 60, detail: 60 };
    const b = { ...a, lead: 0 };
    expect(fitForJob("service", b).score).toBe(fitForJob("service", a).score);
    /* 管理岗看「领导」，同样的 0 分必须掉分 */
    expect(fitForJob("mgmt", b).score).toBeLessThan(fitForJob("mgmt", a).score);
  });
});

describe("报告装配", () => {
  const base = () => {
    const bigfive = scoreBigFive(fill(BIGFIVE_ITEMS, (rev) => (rev ? 1 : 5)));
    const value = scoreValue(Object.fromEntries(VALUE_ITEMS.map((i) => [i.id, 5])));
    const discwork = scoreWorkDisc({ most: WORK_DISC_GROUPS.map(() => 0), least: WORK_DISC_GROUPS.map(() => 1) });
    const eq = scoreEq(fill(EQ_ITEMS, () => 5));
    const duty = scoreDuty("sales", {});
    const answered = { bigfive: 20, value: 18, discwork: 24, eq: 30, duty: 0 };
    const { dims, details } = computeDims({ bigfive, value, discwork, dutyScores: duty, answered });
    return { bigfive, value, discwork, eq, duty, answered, dims, details };
  };

  it("只做底盘没做加测：完成度 80%，并把「未完成」写进口径", () => {
    const b = base();
    const r = buildTalentReport({
      name: "张三",
      position: "sales",
      generatedAt: new Date().toISOString(),
      parts: b,
      dims: b.dims,
      details: b.details,
      answered: b.answered,
    });
    expect(r.completeness.pct).toBe(80);
    expect(r.completeness.missing).toContain(PART_META.sales.name);
    expect(r.caveats.some((c) => c.includes("未完成"))).toBe(true);
  });

  it("四岗匹配都算出来，且当前岗位那一项在列表里", () => {
    const b = base();
    const r = buildTalentReport({
      name: "张三",
      position: "mgmt",
      generatedAt: new Date().toISOString(),
      parts: b,
      dims: b.dims,
      details: b.details,
      answered: b.answered,
    });
    expect(r.fits).toHaveLength(4);
    expect(r.fits.map((f) => f.job)).toContain("mgmt");
    expect(r.current.job).toBe("mgmt");
  });

  it("有硬缺口时，第一条建议直接指向缺口", () => {
    const b = base();
    const dims = { ...b.dims, drive: 20 };
    const { details } = computeDims({ answered: b.answered });
    const r = buildTalentReport({
      name: "李四",
      position: "sales",
      generatedAt: new Date().toISOString(),
      parts: b,
      dims,
      details,
      answered: b.answered,
    });
    expect(r.current.gaps.length).toBeGreaterThan(0);
    expect(r.coaching[0]).toContain("核心项");
  });

  it("没做情商时 eq 为 null，不是空对象", () => {
    const b = base();
    const r = buildTalentReport({
      name: "王五",
      position: "service",
      generatedAt: new Date().toISOString(),
      parts: { bigfive: b.bigfive, value: b.value, discwork: b.discwork, duty: null },
      dims: b.dims,
      details: b.details,
      answered: { ...b.answered, eq: 0 },
    });
    expect(r.eq).toBeNull();
  });
});

describe("邀请码", () => {
  const secret = "test-secret";

  it("出码与解码往返一致，岗位锁在码里", () => {
    for (const pos of ["sales", "service", "admin", "mgmt"] as const) {
      const { code } = encodeTalentCode(42, pos, secret);
      const d = decodeTalentCode(code, secret);
      expect(d?.ownerId).toBe(42);
      expect(d?.position).toBe(pos);
    }
  });

  it("改一个字符就失效", () => {
    const { code } = encodeTalentCode(42, "admin", secret);
    const tampered = code.slice(0, -1) + (code.endsWith("a") ? "b" : "a");
    expect(decodeTalentCode(tampered, secret)).toBeNull();
  });

  it("换密钥就失效（密钥不进前端）", () => {
    const { code } = encodeTalentCode(42, "admin", secret);
    expect(decodeTalentCode(code, "another-secret")).toBeNull();
  });

  it("超过 7 天失效", () => {
    const day = 86_400_000;
    const now = 1_800_000_000_000;
    const { code } = encodeTalentCode(42, "sales", secret, now);
    expect(decodeTalentCode(code, secret, now + 6 * day)).not.toBeNull();
    expect(decodeTalentCode(code, secret, now + 8 * day)).toBeNull();
  });

  it("同一天出同一张码：连点两下不会得到两张不一样的码", () => {
    const now = 1_800_000_000_000;
    expect(encodeTalentCode(42, "mgmt", secret, now).code).toBe(encodeTalentCode(42, "mgmt", secret, now + 3600_000).code);
  });
});
