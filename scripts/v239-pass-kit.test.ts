/**
 * v239 测评码 + 家庭沟通锦囊。
 *
 * 锁三件事：
 *  1. 码的形状、时段有效期、防篡改——这张码能换到孩子的短会话，改一位编号就读到别人家孩子的账号，是最严重的那种错；
 *  2. 「家长卷」与「孩子卷」的边界——家长卷可以匿名交，孩子那几份不行；
 *  3. 锦囊四个版本永远都在、且不拿套话填满：数据缺哪块就照实说缺。
 */
import { describe, expect, it } from "vitest";
import {
  PASS_SIG_LEN,
  PASS_SLOT_HOURS,
  isParentPass,
  normalizePassCode,
  passDefOf,
  passExpiresAt,
  passPath,
  passSlotAt,
} from "../contracts/passCode";
import { decodePassCode, encodePassCode, passRemainingMs } from "../api/passCode";
import { buildFamilyKit } from "../contracts/familyKit";

const SECRET = "test-secret-for-pass-code";
const HOUR = 3600 * 1000;
/** 一个固定时刻，避免测试跟着真实时间漂：2026-11-01 10:00 UTC */
const NOW = Date.UTC(2026, 10, 1, 10, 0, 0);

describe("测评码格式", () => {
  it("码是「编号-代号-时段-签名」四段，签名固定 6 位", () => {
    const made = encodePassCode(18, "e3", SECRET, NOW);
    expect(made).not.toBeNull();
    const parts = made!.code.split("-");
    expect(parts).toHaveLength(4);
    expect(parts[1]).toBe("e3");
    expect(parts[3]).toHaveLength(PASS_SIG_LEN);
  });

  it("代号用两字母，扫出来短、手输也不费劲", () => {
    expect(encodePassCode(1, "mbti", SECRET, NOW)!.code.split("-")[1]).toBe("mb");
    expect(encodePassCode(1, "familyparent", SECRET, NOW)!.code.split("-")[1]).toBe("fp");
    expect(encodePassCode(1, "discparent", SECRET, NOW)!.code.split("-")[1]).toBe("dp");
  });

  it("同一孩子、同一测评、同一时段出同一张码——连点两下不该出现两张", () => {
    const a = encodePassCode(7, "disc", SECRET, NOW);
    const b = encodePassCode(7, "disc", SECRET, NOW + 1000);
    expect(a!.code).toBe(b!.code);
  });

  it("扫码链接统一小写、固定 /p/ 前缀", () => {
    expect(passPath("A1-MB-8F3K-QW7XD2")).toBe("/p/a1-mb-8f3k-qw7xd2");
    expect(normalizePassCode(" a1—mb—8f3k—qw7xd2 ")).toBe("a1-mb-8f3k-qw7xd2");
  });
});

describe("测评码有效期与防篡改", () => {
  it("往返能解出孩子与测评", () => {
    const made = encodePassCode(18, "familyparent", SECRET, NOW)!;
    const hit = decodePassCode(made.code, SECRET, NOW);
    expect(hit).toEqual({ userId: 18, kind: "familyparent", slot: made.slot });
  });

  it("改一位编号就解不开（别人的孩子不能靠猜）", () => {
    const made = encodePassCode(18, "e3", SECRET, NOW)!;
    const [id, slug, slot, sig] = made.code.split("-");
    const forged = `${id === "i" ? "j" : "i"}-${slug}-${slot}-${sig}`;
    expect(decodePassCode(forged, SECRET, NOW)).toBeNull();
  });

  it("换个密钥也解不开", () => {
    const made = encodePassCode(18, "e3", SECRET, NOW)!;
    expect(decodePassCode(made.code, "another-secret", NOW)).toBeNull();
  });

  it("同一张码换一个测评代号也解不开", () => {
    const made = encodePassCode(18, "e3", SECRET, NOW)!;
    const [, , slot, sig] = made.code.split("-");
    const swapped = `i-mb-${slot}-${sig}`;
    expect(decodePassCode(swapped, SECRET, NOW)).toBeNull();
  });

  it("当前时段和上一时段都认，跨两个时段作废", () => {
    const made = encodePassCode(18, "e3", SECRET, NOW)!;
    const inWindow = NOW + PASS_SLOT_HOURS * HOUR;
    const outOfWindow = NOW + PASS_SLOT_HOURS * 2 * HOUR + 1000;
    expect(decodePassCode(made.code, SECRET, inWindow)).not.toBeNull();
    expect(decodePassCode(made.code, SECRET, outOfWindow)).toBeNull();
  });

  it("剩余时间不超过两个时段", () => {
    const made = encodePassCode(18, "e3", SECRET, NOW)!;
    expect(passRemainingMs(made.slot, NOW)).toBeLessThanOrEqual(PASS_SLOT_HOURS * 2 * HOUR);
    expect(passExpiresAt(made.slot)).toBeGreaterThan(NOW);
  });
});

describe("家长卷与孩子卷的边界", () => {
  it("只有三种家长卷允许匿名提交", () => {
    const parents = ["familyparent", "e3parent", "discparent"];
    for (const k of parents) expect(isParentPass(passDefOf(k)!.kind)).toBe(true);
    for (const k of ["e3", "mbti", "familystudent", "mental", "scl90"]) {
      const def = passDefOf(k);
      /* scl90 不在出码清单里：心理四套合成一项「心理健康」，出四张码现场反而不知道给哪张 */
      if (!def) continue;
      expect(isParentPass(def.kind)).toBe(false);
    }
  });

  it("每一项都能查到名字与时长（扫码页要用它告诉家长要多久）", () => {
    const def = passDefOf("subject4d")!;
    expect(def.minutes).toBeGreaterThan(0);
    expect(def.brief.length).toBeGreaterThan(4);
  });
});

describe("家庭沟通锦囊", () => {
  const student = {
    ladder: [],
    parentView: { total: 3, band: "中" as const, rating10: 7 },
    security: { needConfirm: "高" as const, fearProbe: "低" as const, needConfirmScore: 4, fearProbeScore: 2 },
    scene: "phone" as never,
    condition: { cells: [], missing: [], fromE3: 0, fromOwn: 0 },
    answered: { newItems: 14, reusedItems: 0 },
  };

  const merged = {
    ladder: [
      { level: "L1", student: 4, parent: 4, band: "通" as const, diverged: false, singleSide: false },
      { level: "L2", student: 2, parent: 3, band: "勉强" as const, diverged: false, singleSide: false },
      { level: "L3", student: 1, parent: 2, band: "断" as const, diverged: false, singleSide: false },
      { level: "L4", student: 3, parent: 3, band: "勉强" as const, diverged: false, singleSide: false },
      { level: "L5", student: 3, parent: 4, band: "勉强" as const, diverged: false, singleSide: false },
    ],
    blind: [
      { key: "p_phone", label: "他愿不愿意跟你说手机的事", parentScore: 4, studentScore: 2, gap: 2, blind: true },
    ],
    scene: { student: "phone", parent: "score", match: false },
    branch: { branch: "repair" as const, reason: "断在 L3" },
  };

  it("四个版本永远都在，顺序固定（孩子、家长、父母、子女）", () => {
    const kit = buildFamilyKit({ merged: merged as never, student: student as never, hasParent: true, parentCount: 2 });
    expect(kit.map((k) => k.key)).toEqual(["student", "parent", "parents", "children"]);
  });

  it("断掉的那一级会被挑出来当目标，而不是挑最轻的", () => {
    const kit = buildFamilyKit({ merged: merged as never, student: student as never, hasParent: true, parentCount: 2 });
    expect(kit[0].headline).toContain("L3");
  });

  it("偏差最大的盲区会进家长版标题，方向也说对（高估 / 低估）", () => {
    const kit = buildFamilyKit({ merged: merged as never, student: student as never, hasParent: true, parentCount: 2 });
    expect(kit[1].headline).toContain("高");
    expect(kit[1].blocks[0].lines[0]).toContain("4 分");
    expect(kit[1].blocks[0].lines[0]).toContain("2 分");
  });

  it("只收到一份家长卷时，父母版照实说「先补齐另一位」，不硬编配合建议", () => {
    const kit = buildFamilyKit({ merged: merged as never, student: student as never, hasParent: true, parentCount: 1 });
    const parents = kit.find((k) => k.key === "parents")!;
    expect(parents.ready).toBe(true);
    expect(parents.missing).toContain("另一位");
  });

  it("孩子那份没答时，孩子版与子女版都标「缺」，而不是拿套话凑", () => {
    const kit = buildFamilyKit({ merged: null, student: null, hasParent: false, parentCount: 0 });
    expect(kit[0].ready).toBe(false);
    expect(kit[1].ready).toBe(false);
    expect(kit[3].ready).toBe(false);
    expect(kit[0].missing).toBeTruthy();
  });

  it("每一份都给了可照念的话与别说的话（锦囊不能只有分析）", () => {
    const kit = buildFamilyKit({ merged: merged as never, student: student as never, hasParent: true, parentCount: 2 });
    for (const part of kit) {
      expect(part.say.length).toBeGreaterThan(0);
      expect(part.avoid.length).toBeGreaterThan(0);
      expect(part.blocks.length).toBeGreaterThan(0);
    }
  });
});

describe("锦囊在报告里的实际渲染", () => {
  it("报告正文能带出「家庭沟通锦囊」与四个入口，不报渲染错", async () => {
    const { createElement: h } = await import("react");
    const { renderToString } = await import("react-dom/server");
    const { MemoryRouter } = await import("react-router");
    const { FamilyReportBody } = await import("../src/components/reports/FamilyReport");
    const { buildFamilyStudentProfile } = await import("@contracts/familyStudent");
    const { buildFamilyParentProfile } = await import("@contracts/familyParent");
    const { buildFamilyProfile } = await import("@contracts/familyProfile");

    const items = {
      FS01: 2, FS02: 1, FS03: 1, FS04: 2, FS05: 3,
      FS06: 4, FS07: 2, FS08: 3, FS09: 8,
      FS10: 3, FS11: 4, FS12: 4, FS13: 5,
    };
    const parentItems = {
      AP01: 3, AP02: 2, AP03: 2, AP04: 2, AP05: 3,
      BP01: 5, BP02: 4, BP03: 4, BP04: 4,
      BP05: 2, BP06: 2, BP07: 2, BP08: 5,
      EP01: 4, EP02: 4, EP03: 4, EP04: 3, EP05: 3, EP06: 3,
      FP01: 2, FP02: 2, FP03: 3, FP04: 2, FP05: 4,
      GP01: 2, GP02: 3, GP03: 3, GP04: 4,
    };
    const student = buildFamilyStudentProfile({ items, scene: "phone" });
    const parent = buildFamilyParentProfile({ items: parentItems, scene: "score", respondent: "dad" });
    const merged = buildFamilyProfile({ student, parent, studentItems: items });

    const html = renderToString(
      h(MemoryRouter, { initialEntries: ["/"] },
        h(FamilyReportBody, { student, merged, hasParent: true, parentCount: 1 }) as never),
    );
    expect(html).toContain("家庭沟通锦囊");
    expect(html).toContain("孩子本人");
    expect(html).toContain("家长本人");
    expect(html).toContain("多人 · 父母版");
    expect(html).toContain("多人 · 子女版");
  });
});
