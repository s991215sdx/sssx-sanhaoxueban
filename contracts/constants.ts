export const Session = {
  cookieName: "kimi_sid",
  maxAgeMs: 365 * 24 * 60 * 60 * 1000,
} as const;

export const ErrorMessages = {
  unauthenticated: "Authentication required",
  insufficientRole: "Insufficient permissions",
} as const;

export const Paths = {
  login: "/login",
  oauthCallback: "/api/oauth/callback",
} as const;

/** 学段（知识点 stage 枚举，与 db schema 一致）。 */
export const STAGES = ["小学", "初中", "高中"] as const;
export type Stage = (typeof STAGES)[number];

/** 规范年级值（学生档案 grade 下拉、知识点 grade 字段共用）。 */
export const STAGE_GRADES: Record<Stage, readonly string[]> = {
  小学: ["一年级", "二年级", "三年级", "四年级", "五年级", "六年级"],
  初中: ["初一", "初二", "初三"],
  高中: ["高一", "高二", "高三"],
} as const;

export const GRADES: readonly string[] = STAGES.flatMap((s) => STAGE_GRADES[s]);

/** 根据年级反查学段，未知年级返回 null。 */
export function stageOfGrade(grade: string): Stage | null {
  for (const s of STAGES) if ((STAGE_GRADES[s] as readonly string[]).includes(grade)) return s;
  return null;
}
