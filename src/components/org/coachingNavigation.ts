import type { CoachingCases } from "./coachingTypes";

/** 工作台与建档是机构级入口，其余页面共享同一名学员主档。 */
export const COACHING_SECTIONS = [
  { key: "workspace", label: "工作台" },
  { key: "profile", label: "画像" },
  { key: "overview", label: "总览" },
  { key: "plan", label: "规划" },
  { key: "execute", label: "执行" },
  { key: "growth", label: "成长" },
  { key: "family", label: "家校" },
  { key: "ops", label: "运营" },
  { key: "intake", label: "建档" },
] as const;

export type CoachingSection = (typeof COACHING_SECTIONS)[number]["key"];

export function sectionForOperation(kind?: string): CoachingSection {
  if (kind === "quality" || kind === "handoff") return "ops";
  if (kind === "session" || kind === "supervision") return "execute";
  if (kind === "record" || kind === "exception" || kind === "crisis") return "growth";
  if (kind === "plan" || kind === "task") return "plan";
  return "overview";
}

/** 所有学员页共用这一解析结果；无效选择才回退到首个可访问主档。 */
export function resolveCoachingCaseId(cases: CoachingCases, selectedCaseId: number): number {
  return cases.some((row) => row.coachingCase.id === selectedCaseId)
    ? selectedCaseId
    : cases[0]?.coachingCase.id ?? 0;
}
