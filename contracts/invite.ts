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
