/**
 * 报告头部概要九宫格：渲染 combined.overviewCards。
 * tone="red"→红框红字 / "amber"→黄 / "green"→绿；无 tone 用默认米色卡。
 */
export type OverviewCardTone = "red" | "amber" | "green";
export type OverviewCardData = { label: string; value: string; note: string; tone?: OverviewCardTone };

const TONE_CLASS: Record<OverviewCardTone, string> = {
  red: "border-[#8f1313]/50 bg-[#fbe3df]",
  amber: "border-[#8a6d1a]/50 bg-[#f5e7c1]",
  green: "border-[#5a9326]/50 bg-lime-pale",
};
const TONE_TEXT: Record<OverviewCardTone, string> = {
  red: "text-[#8f1313]",
  amber: "text-[#8a6d1a]",
  green: "text-[#5a9326]",
};

export default function OverviewGrid({ cards }: { cards: OverviewCardData[] }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className={`rounded-xl border px-2.5 py-2.5 text-center ${c.tone ? TONE_CLASS[c.tone] : "border-transparent bg-cream"}`}
        >
          <div className={`text-[11.5px] ${c.tone ? `${TONE_TEXT[c.tone]} opacity-80` : "text-olive-mute"}`}>{c.label}</div>
          <div className={`mt-0.5 text-[15px] font-bold ${c.tone ? TONE_TEXT[c.tone] : "text-olive"}`}>{c.value}</div>
          <div className={`mt-0.5 text-[11px] leading-snug ${c.tone ? `${TONE_TEXT[c.tone]} opacity-80` : "text-olive-soft"}`}>{c.note}</div>
        </div>
      ))}
    </div>
  );
}
