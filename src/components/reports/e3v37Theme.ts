/**
 * V3.7 三阶九能判读页的阈值与配色（全局统一口径）。
 * 红 <3.0（≈百分制<50）「卡点」；黄 3.0-3.7（≈50-69）「待提升」；绿 ≥3.8（≈≥70）「正常」。
 */
import type { E3V37Level } from "@contracts/e3v37";

export type { E3V37Level };

/** 三档判定的颜色常量：text=文字色，bar=条形/描边色，bg=底色。 */
export const E3V37_LEVEL_STYLE: Record<E3V37Level, { text: string; bar: string; bg: string }> = {
  卡点: { text: "#8f1313", bar: "#b91c1c", bg: "#fbe3df" },
  待提升: { text: "#8a6d1a", bar: "#c7a23a", bg: "#f5e7c1" },
  正常: { text: "#5a9326", bar: "#7cb83c", bg: "#f0f7dd" }, // bg = lime-pale
};

/** 章节条款卡（CombinedSection.items level）的 Tailwind 类。 */
export const E3V37_LEVEL_CLASS: Record<E3V37Level, string> = {
  正常: "border-lime/50 bg-lime-pale text-[#5a9326]",
  待提升: "border-[#8a6d1a]/50 bg-[#f5e7c1] text-[#8a6d1a]",
  卡点: "border-[#8f1313]/50 bg-[#fbe3df] text-[#8f1313]",
};

/** 判读页统一的图例文案。 */
export const E3V37_LEVEL_CAPTION = "红 <3.0 卡点 · 黄 3.0-3.7 待提升 · 绿 ≥3.8 正常";

/** 判定文字色（Tailwind arbitrary class）。 */
export function e3v37LevelTextClass(level: E3V37Level): string {
  return level === "卡点" ? "text-[#8f1313]" : level === "待提升" ? "text-[#8a6d1a]" : "text-[#5a9326]";
}

/** 判定条色（hex，供 inline style / recharts 使用）。 */
export function e3v37LevelBarColor(level: E3V37Level): string {
  return E3V37_LEVEL_STYLE[level].bar;
}
