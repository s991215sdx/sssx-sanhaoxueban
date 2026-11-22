/** 校园版逐学生、逐报告授权。null 仅表示非校园学生，校园历史 NULL 一律归一为空数组。 */
export const CAMPUS_REPORT_DEFS = [
  { key: "e3", label: "学习力诊断报告", group: "学习力测评", resultKinds: ["e3"] },
  { key: "mbti", label: "MBTI 性格报告", group: "学习力测评", resultKinds: ["mbti"] },
  { key: "disc", label: "DISC 行为风格报告", group: "学习力测评", resultKinds: ["disc"] },
  { key: "holland", label: "霍兰德职业兴趣报告", group: "选科及升学测评", resultKinds: ["holland"] },
  { key: "career", label: "选科及升学规划综合报告", group: "选科及升学测评", resultKinds: ["subject4d", "holland"] },
  { key: "mentalsdq", label: "心理健康 · 学生版 A（SDQ）", group: "心理健康测评", resultKinds: ["mentalsdq"] },
  { key: "mentalpa", label: "心理健康 · 学生版 B（PHQ-A）", group: "心理健康测评", resultKinds: ["mentalpa"] },
  { key: "mental", label: "心理健康 · 通用版", group: "心理健康测评", resultKinds: ["mental"] },
  { key: "scl90", label: "心理健康 · 深度评估（SCL-90）", group: "心理健康测评", resultKinds: ["scl90"] },
] as const;

export type CampusReportKind = (typeof CAMPUS_REPORT_DEFS)[number]["key"];
export const CAMPUS_REPORT_KINDS = CAMPUS_REPORT_DEFS.map((d) => d.key) as CampusReportKind[];
export const CAMPUS_MENTAL_KINDS = ["mental", "mentalsdq", "mentalpa", "scl90"] as const;

/** 校园测评目录仅保留策划约定的三类；family/multi5/subject 等不属于校园报告授权模型。 */
export const CAMPUS_ASSESS_CATALOG_KEYS = ["xuanke", "subject4d", "holland", "e3", "mbti", "disc", "mental-a", "mental-b", "mental-c", "mental-d"] as const;

export function normalizeCampusReportKinds(raw: unknown): string[] {
  let value = raw;
  if (typeof value === "string") {
    try { value = JSON.parse(value); } catch { return []; }
  }
  if (!Array.isArray(value)) return [];
  const valid = new Set<string>(CAMPUS_REPORT_KINDS);
  return [...new Set(value.filter((k): k is string => typeof k === "string" && valid.has(k)))];
}

/** null/undefined = 非校园旧权限；数组 = 校园逐报告白名单。 */
export function campusResultAllowed(resultKind: string, allowed: string[] | null | undefined): boolean {
  if (allowed == null) return true;
  if (resultKind === "subject4d") return allowed.includes("career");
  return (CAMPUS_REPORT_KINDS as string[]).includes(resultKind) && allowed.includes(resultKind);
}

export function campusTabAllowed(tab: string, allowed: string[]): boolean {
  if (tab === "zhihui") return allowed.includes("career");
  if (tab === "mental") return CAMPUS_MENTAL_KINDS.some((k) => allowed.includes(k));
  return (CAMPUS_REPORT_KINDS as string[]).includes(tab) && allowed.includes(tab);
}

export function campusTabsFor(allowed: string[]): string[] {
  const out: string[] = [];
  for (const kind of CAMPUS_REPORT_KINDS) {
    const tab = kind === "career" ? "zhihui" : CAMPUS_MENTAL_KINDS.includes(kind as (typeof CAMPUS_MENTAL_KINDS)[number]) ? "mental" : kind;
    if (allowed.includes(kind) && !out.includes(tab)) out.push(tab);
  }
  return out;
}

export function campusCareerPrerequisites(input: {
  hasSubject4d: boolean;
  hasHolland: boolean;
  academics?: { subjects?: { name?: string; lastScore?: number | null }[] } | null;
  expectations?: { school?: string | null; majorCat?: string | null; careers?: string | null } | null;
}) {
  const result = {
    subject4d: input.hasSubject4d,
    holland: input.hasHolland,
    academics: !!input.academics?.subjects?.some((s) => s.lastScore != null),
    expectations: !!(input.expectations?.school?.trim() || input.expectations?.majorCat?.trim() || input.expectations?.careers?.trim()),
  };
  return { ...result, ready: Object.values(result).every(Boolean) };
}
