/**
 * V3.7 三阶九能判读页的阈值与配色（全局统一口径）。
 * 红 <3.0（≈百分制<50）「卡点」；黄 3.0-3.7（≈50-69）「待提升」；绿 ≥3.8（≈≥70）「正常」。
 */
import type { E3V37Level } from "@contracts/e3v37";

export type { E3V37Level };

/** 三档判定的颜色常量：text=文字色，bar=条形/描边色，bg=底色。 */
export const E3V37_LEVEL_STYLE: Record<E3V37Level, { text: string; bar: string; bg: string }> = {
  卡点: { text: "#A82524", bar: "#DD3534", bg: "#FAF2E4" },
  待提升: { text: "#8A6500", bar: "#FCCE45", bg: "#FAF0CC" },
  正常: { text: "#2F7A41", bar: "#52A965", bg: "#E9F3E6" }, // bg = lime-pale
};

/** 章节条款卡（CombinedSection.items level）的 Tailwind 类。 */
export const E3V37_LEVEL_CLASS: Record<E3V37Level, string> = {
  正常: "border-lime/50 bg-lime-pale text-[#2F7A41]",
  待提升: "border-[#8A6500]/50 bg-[#FAF0CC] text-[#8A6500]",
  卡点: "border-[#A82524]/50 bg-[#FAF2E4] text-[#A82524]",
};

/** 判读页统一的图例文案。 */
export const E3V37_LEVEL_CAPTION = "红 <3.0 卡点 · 黄 3.0-3.7 待提升 · 绿 ≥3.8 正常";

/** 判定文字色（Tailwind arbitrary class）。 */
export function e3v37LevelTextClass(level: E3V37Level): string {
  return level === "卡点" ? "text-[#A82524]" : level === "待提升" ? "text-[#8A6500]" : "text-[#2F7A41]";
}

/** 判定条色（hex，供 inline style / recharts 使用）。 */
export function e3v37LevelBarColor(level: E3V37Level): string {
  return E3V37_LEVEL_STYLE[level].bar;
}

/**
 * v106：三阶板块色（与产品「三阶九能阶梯图」同色系）。
 * solid=实心色（圆点/色块），text=白底上的可读文字色，tint=分组标题横幅的浅底色。
 * 乐学=青绿、会学=亮黄、善学=橙。
 */
export const E3V37_SYSTEM_COLOR: Record<"乐学" | "会学" | "善学", { solid: string; text: string; tint: string }> = {
  乐学: { solid: "#3991A5", text: "#2A6E7E", tint: "#E3F0F3" },
  会学: { solid: "#FCCE45", text: "#8A6500", tint: "#FFF7D8" },
  善学: { solid: "#FA872A", text: "#B05E14", tint: "#FDEBD9" },
};
