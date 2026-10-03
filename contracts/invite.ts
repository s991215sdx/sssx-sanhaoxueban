/**
 * 注册邀请渠道（二维码引流注册）共享常量与纯函数。
 * 管理端建渠道 → 生成二维码（/invite/{code}）→ 家长扫码填基础信息注册 → 注册记录绑定渠道用于效果统计。
 */

/** 渠道类型（管理端下拉选项）。 */
export const INVITE_CHANNEL_KINDS = ["地推", "异业合作", "线上社群", "老带新", "其他"] as const;
export type InviteChannelKind = (typeof INVITE_CHANNEL_KINDS)[number];

/** 注册表单年级选项。 */
export const INVITE_GRADES = [
  "一年级",
  "二年级",
  "三年级",
  "四年级",
  "五年级",
  "六年级",
  "初一",
  "初二",
  "初三",
  "高一",
  "高二",
  "高三",
] as const;

/** 渠道码格式：8～24 位小写字母+数字（生成时剔除了易混淆字符）。 */
export const INVITE_CODE_RE = /^[a-z0-9]{8,24}$/;

/** 渠道码归一化（扫码链接里可能带大小写/空白差异）。 */
export function normalizeInviteCode(raw: string): string {
  return (raw ?? "").trim().toLowerCase();
}

/**
 * v80 二维码「测评报告功能」：渠道可勾选注册学员客户端自动可见的测评报告
 * （对应管理端需求：发码时选择打开/关闭测评报告，并指定打开哪些）。
 * key 与 ReportView 的 tab 一致；"all" 表示全部报告。
 */
export const INVITE_REPORT_KINDS = [
  { key: "combined", label: "综合学习力报告" },
  { key: "guidance", label: "升学指导报告" },
  { key: "e3", label: "学业诊断报告" },
  { key: "subject", label: "学科能力评估" },
  { key: "mbti", label: "MBTI 性格详版" },
  { key: "disc", label: "DISC 行为详版" },
  { key: "multi5", label: "多元智能五项" },
  { key: "anchor", label: "职业锚" },
  { key: "holland", label: "职业兴趣" },
  { key: "mental", label: "心理健康" },
  { key: "parent", label: "家长报告" },
] as const;

/** 校验并归一化报告种类数组：剔除未知 key、去重、限量；返回 null 表示非法输入。兼容 JSON 字符串。 */
export function normalizeReportKinds(raw: unknown): string[] | null {
  let list = raw;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(list)) return [];
  const valid = new Set(INVITE_REPORT_KINDS.map((k) => k.key));
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const k = item.trim();
    if (k === "all") return ["all"];
    if (valid.has(k as (typeof INVITE_REPORT_KINDS)[number]["key"]) && !out.includes(k)) out.push(k);
    if (out.length > 16) break;
  }
  return out;
}

/**
 * v82 二维码「测评套餐」：渠道可勾选注册学员注册后一站式连做的测评。
 * key 与测评中心 AssessmentCenter 的 TESTS kind 一致（mental 一项覆盖四套心理量表）；
 * "all" 表示全部测评。未勾选的测评在客户端隐藏，由伴学师后台推送（releasedAssessments）后开放。
 */
export const INVITE_ASSESS_KINDS = [
  { key: "mbti", label: "MBTI 性格快测" },
  { key: "disc", label: "DISC 行为风格" },
  { key: "e3", label: "E3 学业诊断" },
  { key: "multi5", label: "多元智能五项" },
  { key: "subject", label: "学科能力测评" },
  { key: "anchor", label: "职业锚测评" },
  { key: "holland", label: "霍兰德职业兴趣" },
  { key: "mental", label: "心理健康筛查" },
  { key: "e3parent", label: "家长卷 · 家庭支持" },
  { key: "discparent", label: "家长 DISC（家庭版）" },
] as const;

/** 校验并归一化测评种类数组：剔除未知 key、去重、限量；返回 null 表示非法输入。兼容 JSON 字符串。 */
export function normalizeAssessKinds(raw: unknown): string[] | null {
  let list = raw;
  if (typeof list === "string") {
    try {
      list = JSON.parse(list);
    } catch {
      return null;
    }
  }
  if (list == null) return [];
  if (!Array.isArray(list)) return null;
  const valid = new Set(INVITE_ASSESS_KINDS.map((k) => k.key));
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const k = item.trim();
    if (k === "all") return ["all"];
    if (valid.has(k as (typeof INVITE_ASSESS_KINDS)[number]["key"]) && !out.includes(k)) out.push(k);
    if (out.length > 16) break;
  }
  return out;
}
