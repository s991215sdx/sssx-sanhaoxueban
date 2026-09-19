/**
 * 学员端功能模块开关（v50）：
 * 新学员（邀请注册）默认只开「测评中心」，其余模块由伴学师/管理员按学员逐个开启；
 * enabledModules 为 null 表示全功能（存量学员兼容）。
 */

/** 可开关的学员模块（测评中心 / 后台 / 工作台不在此列，始终可用）。 */
export const STUDENT_MODULE_KEYS = ["preview", "gaps", "papers", "treehole", "companion", "report"] as const;
export type StudentModuleKey = (typeof STUDENT_MODULE_KEYS)[number];

export const STUDENT_MODULES: { key: StudentModuleKey; label: string }[] = [
  { key: "preview", label: "预习中心" },
  { key: "gaps", label: "查漏补缺" },
  { key: "papers", label: "试卷分析" },
  { key: "treehole", label: "树洞心情" },
  { key: "companion", label: "伴学师" },
  { key: "report", label: "学习报告" },
];

/** 邀请注册新学员的默认开启模块。 */
export const DEFAULT_INVITE_MODULES: string[] = ["assessments"];

/** 路径 → 模块归属（用于路由与侧边栏门禁；返回 null 表示不受开关限制）。 */
export function moduleForPath(pathname: string): string | null {
  const p = pathname;
  if (p.startsWith("/admin") || p.startsWith("/tutor") || p.startsWith("/welcome")) return null;
  if (p === "/") return "home";
  if (p.startsWith("/assessments")) return "assessments";
  if (p.startsWith("/preview")) return "preview";
  if (p.startsWith("/gaps") || p.startsWith("/learn")) return "gaps";
  if (p.startsWith("/papers")) return "papers";
  if (p.startsWith("/treehole")) return "treehole";
  if (p.startsWith("/companion")) return "companion";
  if (p.startsWith("/report")) return "report";
  return null;
}

/** 过滤出合法模块 key（未知 key 丢弃），保持传入顺序。 */
export function sanitizeModules(modules: unknown): string[] {
  if (!Array.isArray(modules)) return [];
  const known = new Set<string>([...STUDENT_MODULE_KEYS, "assessments"]);
  return modules.filter((m): m is string => typeof m === "string" && known.has(m));
}
