/**
 * v240 家庭沟通锦囊（独立报告）。
 *
 * 锁五件事：
 *  1. 分数口径：0—100 绝对分 = dims ÷ 满分 × 100，V2 满分 24、V1 满分 12。
 *     这一条错了，整本里每个数字都是错的，而家长第一眼就看数字。
 *  2. 四本永远都在，顺序固定（家长家庭综合版 / 学生家庭综合版 / 学生个人版 / 家长个人版），
 *     每本都带封面，封面上的台词按「谁在看」分开写。
 *  3. 缺数据照实说缺什么，不拿通用建议把页面填满。
 *  4. 只有一位家长时降级成两人写法，徽章、家规条数都要跟着变。
 *  5. 十六格定位要落在正确的格子上——标错一格，整页建议就对着别人说了。
 */
import { describe, expect, it } from "vitest";
import { buildCommKit } from "../contracts/familyCommKit";
import type { DiscDims, DiscResult } from "../contracts/assessments";

/** 造一份 V2 结果的便捷函数（dims 0—24，中性 12）。 */
function discV2(dims: DiscDims): DiscResult {
  const order = ["D", "I", "S", "C"] as const;
  const primary = [...order].sort((a, b) => dims[b] - dims[a])[0];
  return { primary, dims, summary: "", version: 2 };
}

/* 孩子：S 主导（dims 19/24 → 79 分）、C 副维 */
const CHILD = discV2({ D: 8, I: 10, S: 19, C: 12 });
const CHILD_SCORE = { D: 33, I: 42, S: 79, C: 50 };

/* 爸爸：D 主导（21/24 → 88 分）、I 副维 */
const DAD = discV2({ D: 21, I: 14, S: 9, C: 13 });
/* 妈妈：I 主导（17/24 → 71 分）、S 副维 */
const MOM = discV2({ D: 10, I: 17, S: 14, C: 11 });

describe("分数口径", () => {
  it("V2 的 dims 满分 24，折算成 0—100 绝对分", () => {
    const kit = buildCommKit({ disc: CHILD, parents: [{ label: "爸爸", result: DAD }] });
    const child = kit.members.find((m) => m.kind === "student")!;
    expect(child.score).toEqual(CHILD_SCORE);
    expect(child.type).toBe("S");
    expect(child.second).toBe("C");
  });

  it("V1 的 dims 满分 12，不能按 24 折算（否则分数会全部砍半）", () => {
    const v1: DiscResult = { primary: "S", dims: { D: 3, I: 5, S: 10, C: 6 }, summary: "" };
    const kit = buildCommKit({ disc: v1, parents: [] });
    const child = kit.members.find((m) => m.kind === "student")!;
    expect(child.score.S).toBe(83);
    expect(child.score.D).toBe(25);
  });
});

describe("四本的组成", () => {
  it("四本永远都在，顺序固定", () => {
    const kit = buildCommKit({ disc: CHILD, parents: [{ label: "爸爸", result: DAD }] });
    expect(kit.books.map((b) => b.key)).toEqual(["trio", "student", "me", "parent"]);
    expect(kit.books.map((b) => b.label)).toEqual([
      "家长家庭综合版",
      "学生家庭综合版",
      "学生个人版",
      "家长个人版",
    ]);
  });

  it("一位家长 + 孩子 = 两人写法，标题与家规条数跟着降级", () => {
    const kit = buildCommKit({ disc: CHILD, parents: [{ label: "爸爸", result: DAD }] });
    const trio = kit.books[0];
    expect(trio.label).toBe("家长家庭综合版");
    /* 只剩一位家长时，徽章要照实标「两人」，不能还写三个人 */
    expect(trio.cover?.badge).toContain("两人");
    expect(trio.title).toBe("家庭沟通锦囊");
    expect(trio.subtitle).toContain("一个大人一个孩子");
    /* 两人写法只留四条家规，不硬凑六条 */
    const rules = trio.sections.find((s) => s.title.includes("条规矩"))!;
    expect(rules.title).toContain("四");
    /* 没有「第三对」那一节 */
    expect(trio.sections.some((s) => s.title.includes("第三对"))).toBe(false);
  });

  it("两位家长都在时三对都写", () => {
    const kit = buildCommKit({
      disc: CHILD,
      parents: [
        { label: "爸爸", result: DAD },
        { label: "妈妈", result: MOM },
      ],
    });
    const trio = kit.books[0];
    expect(trio.label).toBe("家长家庭综合版");
    expect(trio.cover?.badge).toContain("家长家庭综合版");
    expect(trio.cover?.badge).not.toContain("两人");
    expect(trio.sections.filter((s) => s.title.includes("对")).length).toBe(3);
    expect(kit.books.filter((b) => b.key === "parent").length).toBe(2);
  });
});

describe("缺数据不硬编", () => {
  it("什么都没有时四本都标缺，且说清缺什么", () => {
    const kit = buildCommKit({});
    expect(kit.books).toHaveLength(4);
    for (const b of kit.books) {
      expect(b.ready).toBe(false);
      expect(b.missing && b.missing.length).toBeTruthy();
      expect(b.sections).toHaveLength(0);
    }
  });

  it("只有孩子时：个人版能出，两本综合版都缺家长", () => {
    const kit = buildCommKit({ disc: CHILD });
    const byKey = Object.fromEntries(kit.books.map((b) => [b.key, b]));
    expect(byKey.me.ready).toBe(true);
    expect(byKey.trio.ready).toBe(false);
    expect(byKey.trio.missing).toContain("家长");
    expect(byKey.student.ready).toBe(false);
    expect(byKey.student.missing).toContain("爸妈");
  });

  it("只有家长时：家长个人版能出，其余缺孩子那份", () => {
    const kit = buildCommKit({ parents: [{ label: "妈妈", result: MOM }] });
    const byKey = Object.fromEntries(kit.books.map((b) => [b.key, b]));
    expect(byKey.parent.ready).toBe(true);
    expect(byKey.me.ready).toBe(false);
    expect(byKey.me.missing).toContain("DISC");
    expect(byKey.trio.ready).toBe(false);
  });
});

describe("十六格定位", () => {
  const findGrid = (kit: ReturnType<typeof buildCommKit>) =>
    kit.books[0].sections.flatMap((s) => s.blocks).find((b) => b.t === "table" && b.mark);

  it("爸爸 D × 孩子 S 落在第 1 行第 3 列（D 行、S 列）", () => {
    const kit = buildCommKit({ disc: CHILD, parents: [{ label: "爸爸", result: DAD }] });
    const grid = findGrid(kit);
    expect(grid && grid.t === "table" ? grid.mark : null).toEqual({ row: 0, col: 2 });
  });

  it("妈妈 I × 孩子 S 落在第 2 行第 3 列", () => {
    const kit = buildCommKit({ disc: CHILD, parents: [{ label: "妈妈", result: MOM }] });
    const grid = findGrid(kit);
    expect(grid && grid.t === "table" ? grid.mark : null).toEqual({ row: 1, col: 2 });
  });

  it("关系判定按环距说：D 与 S 是对角、I 与 S 是相邻、S 与 S 是同一格", () => {
    const d = buildCommKit({ disc: CHILD, parents: [{ label: "爸爸", result: DAD }] });
    expect(d.books[0].sections[3].lead).toContain("对角");
    const i = buildCommKit({ disc: CHILD, parents: [{ label: "妈妈", result: MOM }] });
    expect(i.books[0].sections[3].lead).toContain("相邻");
    const s = buildCommKit({ disc: CHILD, parents: [{ label: "爸爸", result: discV2({ D: 8, I: 10, S: 20, C: 12 }) }] });
    expect(s.books[0].sections[3].lead).toContain("同一格");
  });
});

describe("家长家庭综合版的结构性判断", () => {
  const trio = () =>
    buildCommKit({
      disc: CHILD,
      parents: [
        { label: "爸爸", result: DAD },
        { label: "妈妈", result: MOM },
      ],
    }).books[0];

  it("决定权归属写的是 D 分最高的那个人（爸爸 D 88）", () => {
    const t = trio();
    const lead = t.sections[0].blocks.find((b) => b.t === "lead")!;
    expect(lead.t === "lead" ? lead.text : "").toContain("爸爸拿着决定权（D 88）");
  });

  it("最沉默的那个人按 S 分最高取（孩子 S 79），不是按类型猜", () => {
    const t = trio();
    const lead = t.sections[0].blocks.find((b) => b.t === "lead")!;
    expect(lead.t === "lead" ? lead.text : "").toContain("孩子负责不说话（S 79）");
  });

  it("「这周只做一件事」点名的是同一个人，不在同一份里换人", () => {
    const t = trio();
    const last = t.sections[t.sections.length - 1];
    const quote = last.blocks.find((b) => b.t === "quote");
    const lead = t.sections[0].blocks.find((b) => b.t === "lead");
    expect(lead?.t === "lead" && lead.text.includes("孩子负责不说话")).toBe(true);
    expect(quote?.t === "quote" && quote.text).toBe("「你怎么看？」");
  });
});

describe("封面", () => {
  const full = () =>
    buildCommKit({
      studentName: "小黄",
      grade: "初三",
      disc: CHILD,
      parents: [
        { label: "爸爸", result: DAD },
        { label: "妈妈", result: MOM },
      ],
    });

  it("能出的四本都有封面，徽章写清是哪一本、多少节", () => {
    for (const b of full().books) {
      expect(b.cover, b.key).toBeTruthy();
      expect(b.cover!.badge).toContain(b.label);
      expect(b.cover!.badge).toContain("节");
      expect(b.cover!.lines).toHaveLength(2);
      expect(b.cover!.eyebrow.length).toBeGreaterThan(5);
      expect(b.cover!.footNote.length).toBeGreaterThan(20);
    }
  });

  it("家长家庭综合版封面：台词按各自的类型取，孩子那句不是家长的台词", () => {
    const c = full().books[0].cover!;
    expect(c.visual.t).toBe("say-cards");
    if (c.visual.t !== "say-cards") return;
    const child = c.visual.items.find((i) => i.name === "小黄")!;
    const dad = c.visual.items.find((i) => i.name === "爸爸")!;
    /* 孩子是 S：说「……哦，快了」；爸爸是 D：说「作业还没写完？」 */
    expect(child.say).toContain("哦，快了");
    expect(dad.say).toContain("作业还没写完");
    expect(child.say).not.toBe(dad.say);
    /* 三个人各一张卡，不能少人 */
    expect(c.visual.items).toHaveLength(3);
  });

  it("学生家庭综合版封面：声音条按 D／I 高的那维，孩子写「你」", () => {
    const c = full().books[1].cover!;
    expect(c.visual.t).toBe("voice-bars");
    if (c.visual.t !== "voice-bars") return;
    expect(c.visual.rows.map((r) => r.name)).toEqual(["爸", "妈", "你"]);
    /* 爸爸 D 88 最响；孩子 S 79 但 D／I 只有 42，不该排在前面 */
    expect(c.visual.rows[0].value).toBeGreaterThan(c.visual.rows[2].value);
    expect(c.visual.strong).toContain("把话拿回来");
  });

  it("个人版封面：四维从高到低，第一行标主导", () => {
    for (const key of ["me", "parent"] as const) {
      const b = full().books.find((x) => x.key === key)!;
      const v = b.cover!.visual;
      expect(v.t, key).toBe("dim-rank");
      if (v.t !== "dim-rank") continue;
      expect(v.rows).toHaveLength(4);
      expect(v.rows[0].tag).toBe("主导");
      const vals = v.rows.map((r) => r.value);
      expect([...vals].sort((a, b) => b - a)).toEqual(vals);
      expect(v.lines).toHaveLength(2);
    }
  });

  it("缺数据的那本不出封面——封面只给能翻的册子", () => {
    const kit = buildCommKit({ disc: CHILD });
    const trio = kit.books.find((b) => b.key === "trio")!;
    expect(trio.ready).toBe(false);
    expect(trio.cover).toBeUndefined();
  });
});

describe("渲染", () => {
  it("报告能渲染出四本切换、扉页与十六格标记，不报错", async () => {
    const { createElement: h } = await import("react");
    const { renderToString } = await import("react-dom/server");
    const { MemoryRouter } = await import("react-router");
    const { default: FamilyCommKit } = await import("../src/components/reports/FamilyCommKit");

    const html = renderToString(
      h(
        MemoryRouter,
        { initialEntries: ["/"] },
        h(FamilyCommKit, {
          disc: CHILD,
          discParents: [
            { label: "爸爸", result: DAD },
            { label: "妈妈", result: MOM },
          ],
          profile: { name: "小黄", grade: "初三" },
        }) as never,
      ),
    );
    expect(html).toContain("家庭沟通锦囊");
    expect(html).toContain("家长家庭综合版");
    expect(html).toContain("学生家庭综合版");
    expect(html).toContain("学生个人版");
    expect(html).toContain("标色的那一格");
    expect(html).toContain("小黄");
  });

  it("缺数据时渲染空态，不渲染空白章节", async () => {
    const { createElement: h } = await import("react");
    const { renderToString } = await import("react-dom/server");
    const { MemoryRouter } = await import("react-router");
    const { default: FamilyCommKit } = await import("../src/components/reports/FamilyCommKit");

    const html = renderToString(
      h(MemoryRouter, { initialEntries: ["/"] }, h(FamilyCommKit, { disc: null, discParents: [] }) as never),
    );
    expect(html).toContain("还出不来");
  });
});
