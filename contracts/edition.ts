/**
 * v227：机构版本（edition）与功能权限包。
 * 平台超管开通机构时二选一（校园版/机构版），并可勾选开通哪些功能；
 * 保存进 organizations.edition + settings.services，开通后随时可改。
 * 机构管理员对自己机构只读（school.context 下发），修改权仅平台超管。
 * 关键约定：默认全部开启 = 存量机构行为零变化；只有显式关闭才生效。
 */

export const ORG_EDITIONS = [
  {
    key: "school",
    label: "校园版",
    desc: "学校专用：学校管理控制台、指导老师体系、测评中心批量推送、选科意向与月考成绩门禁",
  },
  {
    key: "org",
    label: "机构版",
    desc: "教培机构专用：机构后台、伴学师体系、完整测评与报告能力",
  },
] as const;

export type OrgEdition = (typeof ORG_EDITIONS)[number]["key"];

/** 功能开关清单：key 全局统一，label/desc 给配置界面用。 */
export const ORG_SERVICES = [
  { key: "assessCenter", label: "测评中心与批量推送", desc: "测评目录、组选推送、进度看板、预警中心" },
  { key: "xuanke", label: "选科规划", desc: "智慧测评套件、选科意向、月考成绩与选科升学报告" },
  { key: "intention", label: "选科统计与成长档案", desc: "选科意向分析、选科统计、成长档案下钻" },
  { key: "library", label: "资料库", desc: "学习资料库模块" },
  { key: "aiCoach", label: "AI 陪练与树洞", desc: "AI 对话陪练、心情树洞" },
  { key: "reportAssign", label: "报告查看需分配", desc: "开启后伴学老师须管理员逐个分配才能看学员报告" },
] as const;

export type OrgServiceKey = (typeof ORG_SERVICES)[number]["key"];
export type OrgServices = Record<OrgServiceKey, boolean>;

const EDITION_KEYS = new Set<string>(ORG_EDITIONS.map((e) => e.key));
const SERVICE_KEYS = new Set<string>(ORG_SERVICES.map((s) => s.key));

/** 校验版本字符串；非法返回 null。 */
export function normalizeEdition(raw: unknown): OrgEdition | null {
  return typeof raw === "string" && EDITION_KEYS.has(raw) ? (raw as OrgEdition) : null;
}

/**
 * 归一化功能开关输入：
 * - 对象 { key: boolean }：剔除未知 key，布尔强转；
 * - 字符串数组（=开启项清单）：清单内的置 true；
 * - null/undefined 表示「未配置」（走默认全开）；
 * 其余非法输入返回 null。
 */
export function normalizeServices(raw: unknown): Partial<OrgServices> | null {
  if (raw == null) return null;
  if (Array.isArray(raw)) {
    const out: Partial<OrgServices> = {};
    for (const item of raw) {
      if (typeof item === "string" && SERVICE_KEYS.has(item)) out[item as OrgServiceKey] = true;
    }
    return out;
  }
  if (typeof raw === "object") {
    const out: Partial<OrgServices> = {};
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      if (SERVICE_KEYS.has(k)) out[k as OrgServiceKey] = !!v;
    }
    return out;
  }
  return null;
}

/** 默认功能包：两个版本都全部开启——存量机构零行为变化，关闭需显式配置。 */
export function defaultServices(_edition: OrgEdition): OrgServices {
  const out = {} as OrgServices;
  for (const s of ORG_SERVICES) out[s.key] = true;
  return out;
}

/** 生效值 = 默认全开 覆盖 已存储配置（存储中未出现的 key 视为开启）。 */
export function resolveServices(edition: OrgEdition, stored: Partial<OrgServices> | null | undefined): OrgServices {
  return { ...defaultServices(edition), ...(stored ?? {}) };
}
