/** 树洞心情：1-5 自绘 SVG 小脸（不用 emoji，贴合设计系统色板）。 */

export const MOOD_LABELS: Record<number, string> = {
  1: "很糟",
  2: "不太好",
  3: "一般般",
  4: "还不错",
  5: "很好",
};

const FACE_COLORS: Record<number, { bg: string; fg: string }> = {
  1: { bg: "#cf6a3c", fg: "#fffef6" },
  2: { bg: "#d9a05b", fg: "#35421e" },
  3: { bg: "#cfe07a", fg: "#35421e" },
  4: { bg: "#9ccb52", fg: "#35421e" },
  5: { bg: "#7cb83c", fg: "#fffef6" },
};

const MOUTHS: Record<number, string> = {
  1: "M16 33 Q24 26 32 33", // 深皱眉
  2: "M16 32 Q24 28.5 32 32",
  3: "M17 30.5 L31 30.5", // 平嘴
  4: "M16 29 Q24 34 32 29",
  5: "M15 28 Q24 37 33 28", // 大笑
};

export default function MoodFace({ mood, size = 44 }: { mood: number; size?: number }) {
  const c = FACE_COLORS[mood] ?? FACE_COLORS[3]!;
  const mouth = MOUTHS[mood] ?? MOUTHS[3]!;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role="img" aria-label={MOOD_LABELS[mood] ?? "心情"}>
      <circle cx="24" cy="24" r="22" fill={c.bg} />
      <circle cx="17" cy="20" r="2.4" fill={c.fg} />
      <circle cx="31" cy="20" r="2.4" fill={c.fg} />
      <path d={mouth} stroke={c.fg} strokeWidth="2.6" strokeLinecap="round" fill="none" />
    </svg>
  );
}
