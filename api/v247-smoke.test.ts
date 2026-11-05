import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import {
  DISC_NEW_GROUPS,
  DISC_NEW_GROUP_COUNT,
  DISC_NEW_TYPE_NAMES,
  DISC_NEW_FACTORS,
  scoreDiscNew,
  discNewTopTypes,
  discNewHlWords,
} from "@contracts/discNew";
import { normalizeAssessKinds, normalizeReportKinds } from "@contracts/invite";

/**
 * v247：复刻版 DISC 接入三好学伴（DISC（学生版新）discnew / DISC（家长版新）discparentnew）。
 * 旧版 disc/discparent 完全不动；新版独立 kind、独立计分、独立报告。
 */
describe("v247 复刻版 DISC 计分", () => {
  it("题库 24 组 × 4 词，每词都有 D/I/S/C 因子", () => {
    expect(DISC_NEW_GROUP_COUNT).toBe(24);
    for (const g of DISC_NEW_GROUPS) {
      expect(g.words.length).toBe(4);
      for (const w of g.words) expect(DISC_NEW_FACTORS).toContain(w.f);
    }
  });

  it("有效作答 → 完整结果（version/主型/百分位/三个我）", () => {
    const most = DISC_NEW_GROUPS.map(() => 0);
    const least = DISC_NEW_GROUPS.map(() => 1);
    const r = scoreDiscNew(most, least, "campus");
    expect(r.version).toBe("new");
    expect(r.scene).toBe("campus");
    // 期望值从题库本身推导：词 0 全选最像 → 主型 = 各组词 0 因子中出现最多者
    const cnt = { D: 0, I: 0, S: 0, C: 0 };
    for (const g of DISC_NEW_GROUPS) cnt[g.words[0].f as keyof typeof cnt] += 1;
    const expectPrimary = (Object.keys(cnt) as (keyof typeof cnt)[]).sort((a, b) => cnt[b] - cnt[a])[0];
    expect(r.primary).toBe(expectPrimary);
    expect(r.top.length).toBeGreaterThan(0);
    expect(r.typeName.length).toBeGreaterThan(0);
    expect(DISC_NEW_TYPE_NAMES[r.typeKey]).toBeTruthy();
    expect(Object.keys(r.net).sort()).toEqual(["C", "D", "I", "S"]);
    expect(Object.keys(r.pct).sort()).toEqual(["C", "D", "I", "S"]);
    expect(Object.keys(r.sceneScores).sort()).toEqual(["C", "D", "I", "S"]);
    expect(Object.keys(r.pressureScores).sort()).toEqual(["C", "D", "I", "S"]);
    // 净分与百分位对应：pct = round(net/24*100)
    for (const f of DISC_NEW_FACTORS) {
      expect(r.pct[f]).toBe(Math.round((r.net[f] / DISC_NEW_GROUP_COUNT) * 100));
    }
    expect(r.order[0]).toBe(expectPrimary);
  });

  it("组合类型保留得分顺序：SC=踏实严谨型，CS=勤奋敬业型", () => {
    const sc = discNewTopTypes({ D: -20, I: -5, S: 20, C: 10 });
    const cs = discNewTopTypes({ D: -20, I: -5, S: 10, C: 20 });
    expect(sc.typeKey).toBe("SC");
    expect(sc.typeName).toBe("踏实严谨型");
    expect(cs.typeKey).toBe("CS");
    expect(cs.typeName).toBe("勤奋敬业型");
  });

  it("家庭场景结果 scene=family", () => {
    const r = scoreDiscNew(DISC_NEW_GROUPS.map(() => 0), DISC_NEW_GROUPS.map(() => 1), "family");
    expect(r.scene).toBe("family");
  });

  it("长度不对直接抛错", () => {
    expect(() => scoreDiscNew([0, 1], [1, 0], "campus")).toThrow();
  });

  it("96 词库高亮每因子恰 4 词", () => {
    expect(discNewHlWords("S", 0)).toHaveLength(4);
    expect(discNewHlWords("D", 33)).toHaveLength(4);
    expect(discNewHlWords("C", -20)).toHaveLength(4);
  });
});

describe("v247 渠道/推送 kind 与报告 kind 开放", () => {
  it("二维码测评套餐与推送白名单支持两个新 kind", () => {
    expect(normalizeAssessKinds(["discnew", "discparentnew", "hack"])).toEqual(["discnew", "discparentnew"]);
  });
  it("测评报告功能开放列表支持两个新报告", () => {
    expect(normalizeReportKinds(["discnew", "discparentnew"])).toEqual(["discnew", "discparentnew"]);
  });
});

describe("v247 接线完整性（源码事实断言）", () => {
  it("服务端：kind 枚举/提交校验/迁移", () => {
    const router = readFileSync("api/profileRouter.ts", "utf-8");
    expect(router).toContain('"discnew"');
    expect(router).toContain('"discparentnew"');
    expect(router).toContain("scoreDiscNew");
    const schema = readFileSync("db/schema.ts", "utf-8");
    expect(schema).toContain('"discnew"');
    expect(schema).toContain('"discparentnew"');
    const mig = readFileSync("api/migrationsEmbedded.ts", "utf-8");
    expect(mig).toContain("discnew");
    expect(mig).toContain("discparentnew");
  });
  it("客户端：答题组件 / 测评中心 / 报告页签 / 答题明细", () => {
    expect(readFileSync("src/components/companion/DiscNewQuiz.tsx", "utf-8")).toContain("discparentnew");
    const center = readFileSync("src/pages/AssessmentCenter.tsx", "utf-8");
    expect(center).toContain("discnew");
    expect(center).toContain("discparentnew");
    const rv = readFileSync("src/components/reports/ReportView.tsx", "utf-8");
    expect(rv).toContain("DiscNewReport");
    expect(rv).toContain('"discnew"');
    expect(rv).toContain('"discparentnew"');
    const ab = readFileSync("src/components/reports/answerBlocks.ts", "utf-8");
    expect(ab).toContain("DISC_NEW_GROUPS");
  });
  it("旧版 DISC 链路未被改动（并存互不影响）", () => {
    const router = readFileSync("api/profileRouter.ts", "utf-8");
    // 旧 disc 计分仍走 DISC_QUESTIONS + DISC 权重表，不被新逻辑替换
    expect(router).toContain("kind === \"disc\"");
  });
});
