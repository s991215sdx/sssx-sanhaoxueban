import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { completedRecordsForStudent, getReportTabCompletion } from "@contracts/reportCompletion";

const at = (day: number) => `2026-11-${String(day).padStart(2, "0")}T08:00:00.000Z`;

describe("学员报告栏目完成状态", () => {
  it("有结果显示已完成，没有结果或只有其他测评不高亮", () => {
    expect(getReportTabCompletion("mbti", [{ kind: "mbti", createdAt: at(1) }])).toMatchObject({ highlighted: true, complete: true, label: "已完成" });
    expect(getReportTabCompletion("mbti", [])).toMatchObject({ highlighted: false, complete: false, label: "未完成" });
    expect(getReportTabCompletion("mbti", [{ kind: "disc", createdAt: at(1) }])).toMatchObject({ highlighted: false, matchedKinds: [] });
  });

  it("严格限定当前学员，其他学员的结果不能误标", () => {
    const records = completedRecordsForStudent([
      { userId: 101, kind: "mbti", createdAt: at(1) },
      { userId: 202, kind: "disc", createdAt: at(2) },
    ], 101);
    expect(records).toEqual([{ kind: "mbti", createdAt: at(1) }]);
    expect(getReportTabCompletion("disc", records).highlighted).toBe(false);
  });

  it("没有结果记录就不算完成，答题任务本身不会点亮栏目", () => {
    const savedResults = [] as { kind: string; createdAt: string }[];
    expect(getReportTabCompletion("e3", savedResults).highlighted).toBe(false);
    expect(getReportTabCompletion("combined", savedResults).matchedKinds).toEqual([]);
  });

  it("重复测评只按同一报告计一次，并保留最新完成时间", () => {
    const records = [
      { kind: "mbti", createdAt: at(3) },
      { kind: "mbti", createdAt: at(1) },
      { kind: "disc", createdAt: at(2) },
    ];
    expect(getReportTabCompletion("mbti", records)).toMatchObject({ matchedKinds: ["mbti"], latestCompletedAt: at(3) });
    expect(getReportTabCompletion("combined", records)).toMatchObject({ highlighted: true, complete: false, label: "已测 2/3 项", latestCompletedAt: at(3) });
  });

  it("综合、心理变体和家庭报告按实际来源映射", () => {
    expect(getReportTabCompletion("combined", [{ kind: "mbti", createdAt: at(1) }, { kind: "disc", createdAt: at(2) }, { kind: "e3", createdAt: at(3) }])).toMatchObject({ complete: true, label: "已完成" });
    expect(getReportTabCompletion("zhihui", [{ kind: "subject4d", createdAt: at(1) }])).toMatchObject({ complete: false, label: "已测 1/2 项" });
    expect(getReportTabCompletion("mental", [{ kind: "scl90", createdAt: at(1) }]).complete).toBe(true);
    expect(getReportTabCompletion("family", [{ kind: "familyparent", createdAt: at(1) }]).complete).toBe(true);
    expect(getReportTabCompletion("commkit", [{ kind: "discparent", createdAt: at(1) }]).complete).toBe(true);
    expect(getReportTabCompletion("academics", [], true)).toMatchObject({ complete: true, label: "已填写" });
  });

  it("教师与学生报告页均传入当前学员的完整结果记录", () => {
    expect(readFileSync("src/components/StudentDetailDrawer.tsx", "utf8")).toContain("completedRecords: data.completedRecords");
    expect(readFileSync("api/profileRouter.ts", "utf8")).toContain("const completedRecords = completedRecordsForStudent(rows, userId)");
    expect(readFileSync("src/components/reports/ReportView.tsx", "utf8")).toContain("getReportTabCompletion");
  });
});
