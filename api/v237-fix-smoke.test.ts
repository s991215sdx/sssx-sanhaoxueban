import { describe, it } from "vitest";
import { readFileSync } from "fs";

/**
 * v237：修复 v236 家庭卷「场景题导致永远无法提交」的致命 bug。
 * 学生卷 FS14 / 家长卷 HP01 的答案走 scene 字段、不进 items，
 * familyPackOf 若不豁免这两个 id，standard/lite 都凑不齐 → 每份提交都被拒。
 */
describe("v237 家庭卷场景题提交豁免", () => {
  it("familyPackOf 支持场景题 id 豁免", () => {
    const src = readFileSync("api/profileRouter.ts", "utf-8");
    if (!/sceneIds: readonly string\[\] = \[\]/.test(src)) throw new Error("familyPackOf 缺场景豁免参数");
    if (!/items\[id\] != null \|\| sceneIds\.includes\(id\)/.test(src)) throw new Error("complete 判定未豁免场景题");
  });

  it("学生卷豁免 FS14、家长卷豁免 HP01", () => {
    const src = readFileSync("api/profileRouter.ts", "utf-8");
    if (!/familyPackOf\(a\.items, FAMILY_STUDENT_PACKS, a\.pack, \["FS14"\]\)/.test(src))
      throw new Error("学生卷未豁免 FS14");
    if (!/familyPackOf\(a\.items, FAMILY_PARENT_PACKS, a\.pack, \["HP01"\]\)/.test(src))
      throw new Error("家长卷未豁免 HP01");
  });

  it("前端提交确实把场景题排除在 items 外（与豁免口径一致）", () => {
    const src = readFileSync("src/components/family/FamilyQuiz.tsx", "utf-8");
    if (!/if \(s\.scene\) continue;/.test(src)) throw new Error("FamilyQuiz 场景题分流逻辑变了，需同步复核豁免口径");
  });
});
