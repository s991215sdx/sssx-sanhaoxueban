import { useMemo } from "react";
import { trpc } from "@/providers/trpc";
import { MOOD_LABELS } from "./MoodFace";

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** UTC+8 的 dayStr（与后端口径一致）。 */
function dayStr(offset = 0): string {
  return new Date(Date.now() + 8 * 3600 * 1000 + offset * 86400 * 1000).toISOString().slice(0, 10);
}

const BAR_COLORS: Record<number, string> = {
  1: "#cf6a3c",
  2: "#d9a05b",
  3: "#cfe07a",
  4: "#9ccb52",
  5: "#7cb83c",
};

/** 近 7 天心情：纯 CSS 柱，高度 = mood/5，无记录灰矮柱，今天高亮。 */
export default function WeekMoodBars() {
  const { data, isLoading } = trpc.treehole.weekMood.useQuery();

  const days = useMemo(() => {
    const byDay = new Map((data ?? []).map((d) => [d.day, d.mood]));
    const today = dayStr(0);
    return Array.from({ length: 7 }, (_, i) => {
      const day = dayStr(i - 6);
      const mood = byDay.get(day) ?? null;
      const weekday = WEEKDAYS[new Date(day + "T00:00:00Z").getUTCDay()];
      return { day, mood, weekday, isToday: day === today };
    });
  }, [data]);

  if (isLoading) {
    return (
      <div className="paper-card flex h-40 items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-lime border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="paper-card p-5">
      <div className="mono text-[10px] tracking-wider text-olive-mute">近 7 天心情</div>
      <div className="mt-4 flex h-28 items-end gap-2 sm:gap-3">
        {days.map((d) => (
          <div key={d.day} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
            {d.mood !== null && (
              <span className="mono text-[10px] text-olive-mute">{MOOD_LABELS[Math.round(d.mood)]}</span>
            )}
            <div
              className={`w-full rounded-t-lg transition-all ${
                d.mood === null ? "bg-olive/15" : d.isToday ? "ring-2 ring-olive/40" : ""
              }`}
              style={{
                maxWidth: "2.25rem",
                height: d.mood !== null ? `${(d.mood / 5) * 88}px` : "10px",
                backgroundColor: d.mood !== null ? BAR_COLORS[Math.round(d.mood)] : undefined,
              }}
              title={d.mood !== null ? `${d.day} ${MOOD_LABELS[Math.round(d.mood)]}` : `${d.day} 没有记录`}
            />
            <span className={`text-[11px] ${d.isToday ? "font-bold text-olive" : "text-olive-mute"}`}>
              {d.isToday ? "今天" : `周${d.weekday}`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
