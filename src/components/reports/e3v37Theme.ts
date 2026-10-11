/**
 * V3.7 三阶九能判读页的阈值与配色（全局统一口径）。
 * 红 <3.0（≈百分制<50）「卡点」；黄 3.0-3.7（≈50-69）「待提升」；绿 ≥3.8（≈≥70）「正常」。
 */
import type { E3V37Level } from "@contracts/e3v37";

export type { E3V37Level };

/** 三档判定的颜色常量：text=文字色，bar=条形/描边色，bg=底色。 */
export const E3V37_LEVEL_STYLE: Record<E3V37Level, { text: string; bar: string; bg: string }> = {
  卡点: { text: "#8f1313", bar: "#b91c1c", bg: "#FAF3EB" },
  待提升: { text: "#C79400", bar: "#FFC600", bg: "#f5e7c1" },
  正常: { text: "#2F8F60", bar: "#3CC078", bg: "#E4F7EC" }, // bg = lime-pale
};

/** 章节条款卡（CombinedSection.items level）的 Tailwind 类。 */
export const E3V37_LEVEL_CLASS: Record<E3V37Level, string> = {
  正常: "border-lime/50 bg-lime-pale text-[#2F8F60]",
  待提升: "border-[#C79400]/50 bg-[#f5e7c1] text-[#C79400]",
  卡点: "border-[#8f1313]/50 bg-[#FAF3EB] text-[#8f1313]",
};

/** 判读页统一的图例文案。 */
export const E3V37_LEVEL_CAPTION = "红 <3.0 卡点 · 黄 3.0-3.7 待提升 · 绿 ≥3.8 正常";

/** 判定文字色（Tailwind arbitrary class）。 */
export function e3v37LevelTextClass(level: E3V37Level): string {
  return level === "卡点" ? "text-[#8f1313]" : level === "待提升" ? "text-[#C79400]" : "text-[#2F8F60]";
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
  乐学: { solid: "#15C7BA", text: "#0E9488", tint: "#E2FAF7" },
  会学: { solid: "#FFCA01", text: "#C79400", tint: "#FFF6D9" },
  善学: { solid: "#FE7B01", text: "#D96A00", tint: "#FFE9DB" },
};
