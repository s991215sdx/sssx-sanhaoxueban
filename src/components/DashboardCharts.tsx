import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, Cell } from "recharts";

type RadarDatum = { chapter: string; full: string; score: number };
type WeeklyDatum = { day: string; total: number; correct: number };

/**
 * Dashboard 的 recharts 图表集合，单独成文件并通过 React.lazy 按需加载，
 * 让 recharts 不进首屏 bundle。
 */
export default function DashboardCharts({
  radar,
  weekly,
  stats,
}: {
  radar: RadarDatum[];
  weekly: WeeklyDatum[];
  stats: {
    totalAttempts: number;
    previewsDone: number;
    activeErrors: number;
    mastered: number;
    totalKps: number;
  };
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="paper-card p-5 lg:col-span-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-olive">章节掌握度</h2>
          <span className="mono text-xs text-olive-mute">
            {stats.mastered}/{stats.totalKps} 个知识点已掌握
          </span>
        </div>
        <div className="mt-2 h-64">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={radar} outerRadius="72%">
              <PolarGrid stroke="#d9dcb8" />
              <PolarAngleAxis dataKey="chapter" tick={{ fill: "#556339", fontSize: 13 }} />
              <Radar dataKey="score" stroke="#7cb83c" fill="#7cb83c" fillOpacity={0.35} strokeWidth={2.5} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="paper-card p-5 lg:col-span-2">
        <h2 className="font-bold text-olive">近 7 天答题</h2>
        <div className="mt-2 h-44">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weekly} barSize={18}>
              <XAxis dataKey="day" tick={{ fill: "#8b9468", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {weekly.map((w, i) => (
                  <Cell key={i} fill={w.total > 0 ? "#7cb83c" : "#e8e9c8"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-3 text-center">
          {[
            { n: stats.totalAttempts, t: "本周答题" },
            { n: stats.previewsDone, t: "完成预习" },
            { n: stats.activeErrors, t: "待攻克错题" },
          ].map((s) => (
            <div key={s.t}>
              <div className="mono text-xl font-bold text-olive">{s.n}</div>
              <div className="mt-0.5 text-[11px] text-olive-mute">{s.t}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
