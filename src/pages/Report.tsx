import { trpc } from "@/providers/trpc";
import { MasteryBar, scoreColor, scoreLabel } from "@/components/ScoreRing";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell, Tooltip } from "recharts";
import { MessageSquareHeart } from "lucide-react";

const PIE_COLORS = ["#7cb83c", "#cfe07a", "#cf6a3c", "#556339", "#f9de81"];

export default function Report() {
  const { data, isLoading } = trpc.dashboard.summary.useQuery(undefined, { retry: 6, retryDelay: 3000 });
  const { data: chapters } = trpc.graph.overview.useQuery(undefined, { retry: 6, retryDelay: 3000 });

  if (isLoading || !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-olive">学习报告</h1>
        <p className="mt-1 text-[15px] text-olive-soft">给爸爸妈妈看的部分：客观数据 + 可执行建议，不焦虑、只看趋势。</p>
      </div>

      {/* 给家长的话 */}
      <div className="paper-card border-butter bg-butter/30 p-6">
        <div className="flex items-center gap-2">
          <MessageSquareHeart size={18} className="text-olive" />
          <h2 className="font-bold text-olive">给家长的话</h2>
        </div>
        <ul className="mt-3 space-y-2">
          {data.suggestions.map((s, i) => (
            <li key={i} className="flex gap-2.5 text-[14.5px] leading-relaxed text-olive">
              <span className="mono mt-0.5 shrink-0 text-olive-mute">{i + 1}.</span>
              {s}
            </li>
          ))}
        </ul>
        <p className="mt-4 border-t border-olive/10 pt-3 text-[13px] text-olive-mute">
          小提醒：掌握度是滚动更新的估值，单次波动正常；连续一周的趋势比某一天的分数更值得关注。
        </p>
      </div>

      {/* 图表区 */}
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="paper-card p-5">
          <h3 className="font-bold text-olive">章节掌握度</h3>
          <div className="mt-2 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data.radar} outerRadius="70%">
                <PolarGrid stroke="#d9dcb8" />
                <PolarAngleAxis dataKey="chapter" tick={{ fill: "#556339", fontSize: 12 }} />
                <Radar dataKey="score" stroke="#7cb83c" fill="#7cb83c" fillOpacity={0.35} strokeWidth={2.5} />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="paper-card p-5">
          <h3 className="font-bold text-olive">错因分布</h3>
          {data.causeDist.length === 0 ? (
            <p className="flex h-60 items-center justify-center text-sm text-olive-mute">还没有错题数据</p>
          ) : (
            <div className="mt-2 h-60">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data.causeDist} dataKey="count" nameKey="cause" innerRadius={52} outerRadius={80} paddingAngle={3}>
                    {data.causeDist.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "#fffef6", border: "1px solid #d9dcb8", borderRadius: 12, fontSize: 13 }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
          {data.causeDist.length > 0 && (
            <div className="mt-1 flex flex-wrap justify-center gap-x-4 gap-y-1">
              {data.causeDist.map((c, i) => (
                <span key={c.cause} className="flex items-center gap-1.5 text-xs text-olive-soft">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {c.cause} {c.count}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="paper-card p-5">
          <h3 className="font-bold text-olive">近 7 天正确率</h3>
          <div className="mt-2 h-60">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={data.weekly.map((w) => ({ ...w, pct: w.total ? Math.round((w.correct / w.total) * 100) : 0 }))}
                barSize={20}
              >
                <XAxis dataKey="day" tick={{ fill: "#8b9468", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fill: "#8b9468", fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
                <Tooltip
                  formatter={(v) => [`${v}%`, "正确率"]}
                  contentStyle={{ background: "#fffef6", border: "1px solid #d9dcb8", borderRadius: 12, fontSize: 13 }}
                />
                <Bar dataKey="pct" radius={[6, 6, 0, 0]}>
                  {data.weekly.map((w, i) => (
                    <Cell key={i} fill={w.total > 0 ? "#7cb83c" : "#e8e9c8"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 知识点明细 */}
      {chapters?.map((ch) => (
        <div key={ch.name} className="paper-card p-5">
          <div className="flex items-baseline justify-between">
            <h3 className="font-bold text-olive">{ch.name}</h3>
            <span className="mono text-xs" style={{ color: scoreColor(ch.avg) }}>
              均分 {ch.avg}
            </span>
          </div>
          <div className="mt-3 divide-y divide-border">
            {ch.kps.map((k) => (
              <div key={k.id} className="flex items-center gap-4 py-2.5">
                <span className="w-40 shrink-0 truncate text-[14px] text-olive sm:w-56">{k.title}</span>
                <MasteryBar score={k.score} className="flex-1" />
                <span className="mono w-8 text-right text-xs text-olive-mute">{k.score}</span>
                <span className="w-14 text-right text-xs" style={{ color: scoreColor(k.score) }}>
                  {scoreLabel(k.score)}
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
