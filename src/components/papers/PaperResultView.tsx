import { useNavigate } from "react-router";
import { BANDS } from "@contracts/content";
import { ArrowRight, BookMarked, Lightbulb, TrendingUp } from "lucide-react";
import type { PaperSummary } from "./shared";

/** 新建流第 3 步 / 详情页共用：分析结果（可捞分总览 + 三区分布 + 建议 + 收卷提示）。 */
export default function PaperResultView({ summary, onDone }: { summary: PaperSummary; onDone?: () => void }) {
  const navigate = useNavigate();
  const bandTotal = Math.max(
    1,
    (summary.bandCounts["1"] ?? 0) + (summary.bandCounts["2"] ?? 0) + (summary.bandCounts["3"] ?? 0),
  );
  const linked = summary.linkedErrorIds.length;

  return (
    <div className="space-y-4">
      {/* 得分概览 */}
      <div className="paper-card p-5">
        <div className="mono text-[10px] tracking-wider text-olive-mute">得分概览 · 共 {summary.total} 题</div>
        <div className="mt-3 flex h-3.5 overflow-hidden rounded-full bg-cream-deep">
          {summary.right > 0 && (
            <div className="bg-lime" style={{ width: `${(summary.right / summary.total) * 100}%` }} />
          )}
          {summary.half > 0 && (
            <div className="bg-butter" style={{ width: `${(summary.half / summary.total) * 100}%` }} />
          )}
          {summary.wrong > 0 && (
            <div className="bg-terra" style={{ width: `${(summary.wrong / summary.total) * 100}%` }} />
          )}
        </div>
        <div className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
          <span className="flex items-center gap-1.5 text-olive">
            <span className="h-2.5 w-2.5 rounded-full bg-lime" /> 做对 <b className="mono">{summary.right}</b>
          </span>
          <span className="flex items-center gap-1.5 text-olive">
            <span className="h-2.5 w-2.5 rounded-full bg-butter" /> 半对 <b className="mono">{summary.half}</b>
          </span>
          <span className="flex items-center gap-1.5 text-olive">
            <span className="h-2.5 w-2.5 rounded-full bg-terra" /> 做错 <b className="mono">{summary.wrong}</b>
          </span>
        </div>
      </div>

      {/* 所见即所得：这张卷子还能捞回多少分 */}
      {summary.totalLost > 0 && (
        <div className="paper-card border-lime/60 bg-lime-pale/50 p-5">
          <div className="flex items-center justify-center gap-2 text-center">
            <TrendingUp size={18} className="text-olive" />
            <span className="text-[14px] font-medium text-olive">这张卷子还藏着</span>
            <span className="mono text-[30px] font-bold leading-none text-olive">{summary.totalLost}</span>
            <span className="text-[14px] font-medium text-olive">分可以捞回来</span>
          </div>
          <p className="mt-1.5 text-center text-[12.5px] text-olive-soft">
            不用全会，只要搞定下面这几个区间——下次考试这些分直接是你的。
          </p>

          <div className="mt-4 grid gap-2.5 sm:grid-cols-3">
            {BANDS.map((b) => {
              const stat = summary.bandScores[String(b.band)] ?? { count: 0, lost: 0 };
              if (stat.count === 0) return null;
              return (
                <div key={b.band} className="rounded-xl border border-border bg-cream-card p-3.5 text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                    <span className="text-[12.5px] font-semibold text-olive">{b.short}</span>
                  </div>
                  <div className="mono mt-1.5 text-[22px] font-bold leading-none text-olive">+{stat.lost} 分</div>
                  <div className="mt-1 text-[11.5px] text-olive-mute">{stat.count} 题 · 搞定就涨分</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 三区分布横条 */}
      <div className="paper-card p-5">
        <div className="mono text-[10px] tracking-wider text-olive-mute">三个提分区间分布</div>
        <div className="mt-3 space-y-3">
          {BANDS.map((b) => {
            const n = summary.bandCounts[String(b.band)] ?? 0;
            const stat = summary.bandScores[String(b.band)] ?? { count: 0, lost: 0 };
            return (
              <div key={b.band} className="flex items-center gap-3">
                <span className="w-24 shrink-0 text-[12.5px] font-medium text-olive">{b.short}</span>
                <div className="h-3 flex-1 overflow-hidden rounded-full bg-cream-deep">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{ width: `${(n / bandTotal) * 100}%`, backgroundColor: b.color }}
                  />
                </div>
                <span className="mono w-8 shrink-0 text-right text-[13px] font-bold text-olive">{n}</span>
                {stat.lost > 0 && (
                  <span className="mono w-14 shrink-0 text-right text-[12px] font-bold" style={{ color: b.color }}>
                    +{stat.lost}分
                  </span>
                )}
              </div>
            );
          })}
        </div>
        {summary.topCauses.length > 0 && (
          <div className="mt-3.5 flex flex-wrap items-center gap-2">
            <span className="text-[12px] text-olive-mute">主要错因：</span>
            {summary.topCauses.slice(0, 3).map((c) => (
              <span key={c.cause} className="chip !text-[11px] text-olive-soft">
                {c.cause} ×{c.count}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 每区一句话建议 */}
      <div className="space-y-2.5">
        {summary.advice.map((a, i) => (
          <div key={i} className="paper-card accent-l border-lime p-4">
            <div className="flex items-start gap-2">
              <Lightbulb size={15} className="mt-0.5 shrink-0 text-lime" />
              <p className="text-[13.5px] leading-relaxed text-olive">{a}</p>
            </div>
          </div>
        ))}
      </div>

      {linked > 0 && (
        <div className="paper-card flex items-center gap-2.5 border-lime/50 bg-lime-pale/60 p-4">
          <BookMarked size={16} className="shrink-0 text-olive" />
          <p className="text-[13.5px] text-olive">
            已自动把 <b className="mono">{linked}</b> 道错题收进错题本，并排好了复习节奏。
          </p>
        </div>
      )}

      <div className="flex flex-col gap-2 sm:flex-row">
        <button
          onClick={() => navigate("/gaps")}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
        >
          去查漏补缺，把 {summary.totalLost > 0 ? `这 ${summary.totalLost} 分` : "错题"} 捞回来
          <ArrowRight size={16} />
        </button>
        {onDone && (
          <button
            onClick={onDone}
            className="rounded-xl border border-olive px-5 py-3 text-[14.5px] font-medium text-olive hover:bg-lime-pale"
          >
            回到试卷列表
          </button>
        )}
      </div>
    </div>
  );
}
