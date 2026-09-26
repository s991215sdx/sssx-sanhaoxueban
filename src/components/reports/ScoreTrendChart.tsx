import { useMemo, useState } from "react";
import { TrendingUp } from "lucide-react";

/**
 * V72：成绩变化曲线——按考试记录（academic_records，新→旧）画出各科的得分率
 * （得分/满分×100，满分取当次记录值，缺省按 100）变化折线，悬停看原始分数。
 * 记录数 ≥2 才画图，否则提示先多次录入。
 */
export type ScoreRecord = {
  id: number;
  examName: string;
  subjects: { name: string; fullScore: number | null; lastScore: number | null }[];
  createdAt: Date | string;
};

const PALETTE = ["#5a9326", "#cf6a3c", "#3a6ea5", "#b03a5b", "#8a6d1a", "#4a8a8a", "#7a5ba8", "#a8763e", "#3e8a5a", "#a83e6a"];

export default function ScoreTrendChart({ records }: { records: ScoreRecord[] }) {
  const [hover, setHover] = useState<{ si: number; ri: number } | null>(null);

  /* 旧→新 排序（时间轴从左到右） */
  const chron = useMemo(() => [...records].reverse(), [records]);

  /* 出现次数 ≥2 的科目才画线（单次记录画不出趋势） */
  const subjects = useMemo(() => {
    const count = new Map<string, number>();
    for (const r of chron) for (const s of r.subjects) if (s.lastScore != null) count.set(s.name, (count.get(s.name) ?? 0) + 1);
    return [...count.entries()].filter(([, c]) => c >= 2).map(([name]) => name).slice(0, 8);
  }, [chron]);

  const W = 560;
  const H = 220;
  const PAD = { l: 36, r: 12, t: 14, b: 34 };
  const iw = W - PAD.l - PAD.r;
  const ih = H - PAD.t - PAD.b;

  if (chron.length < 2 || subjects.length === 0) {
    return (
      <div className="paper-card p-5">
        <div className="flex items-center gap-2">
          <TrendingUp size={16} className="text-olive" />
          <h3 className="font-bold text-olive">成绩变化曲线</h3>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-olive-mute">
          每保存一次带分数的成绩，这里就多一个点。再录一次大考成绩（至少两次、同一科目），就能看到变化曲线。
        </p>
      </div>
    );
  }

  const xOf = (ri: number) => PAD.l + (chron.length === 1 ? iw / 2 : (ri / (chron.length - 1)) * iw);
  const yOf = (pct: number) => PAD.t + ih - (pct / 100) * ih;
  const labelOf = (r: ScoreRecord) => r.examName?.trim() || new Date(r.createdAt).toLocaleDateString("zh-CN", { month: "numeric", day: "numeric" });

  return (
    <div className="paper-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <TrendingUp size={16} className="text-olive" />
        <h3 className="font-bold text-olive">成绩变化曲线</h3>
        <span className="text-[11.5px] text-olive-mute">得分率 = 得分 ÷ 满分，悬停看原始分</span>
      </div>
      <div className="mt-3 overflow-x-auto">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[420px]">
          {/* 横向网格线：0/25/50/75/100% */}
          {[0, 25, 50, 75, 100].map((p) => (
            <g key={p}>
              <line x1={PAD.l} x2={W - PAD.r} y1={yOf(p)} y2={yOf(p)} stroke={p === 0 ? "#b9bfa0" : "#e6e9d4"} strokeWidth={p === 0 ? 1.2 : 1} />
              <text x={PAD.l - 6} y={yOf(p) + 3.5} textAnchor="end" fontSize={10} fill="#8a9170">{p}%</text>
            </g>
          ))}
          {chron.map((r, ri) => (
            <text key={ri} x={xOf(ri)} y={H - 10} textAnchor="middle" fontSize={10.5} fill="#556339" className="max-w-[70px]">
              {labelOf(r).slice(0, 8)}
            </text>
          ))}
          {subjects.map((name, si) => {
            const color = PALETTE[si % PALETTE.length];
            const pts = chron
              .map((r, ri) => {
                const s = r.subjects.find((x) => x.name === name && x.lastScore != null);
                if (!s || s.lastScore == null) return null;
                const full = s.fullScore ?? 100;
                const pct = Math.min(100, (s.lastScore / Math.max(1, full)) * 100);
                return { ri, pct, raw: s.lastScore, full };
              })
              .filter((p): p is NonNullable<typeof p> => p != null);
            const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${xOf(p.ri).toFixed(1)},${yOf(p.pct).toFixed(1)}`).join(" ");
            return (
              <g key={name}>
                <path d={path} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
                {pts.map((p) => (
                  <circle
                    key={p.ri}
                    cx={xOf(p.ri)}
                    cy={yOf(p.pct)}
                    r={hover?.si === si && hover?.ri === p.ri ? 5.5 : 3.8}
                    fill="#fff"
                    stroke={color}
                    strokeWidth={2.2}
                    onMouseEnter={() => setHover({ si, ri: p.ri })}
                    onMouseLeave={() => setHover(null)}
                  />
                ))}
              </g>
            );
          })}
          {hover != null && (() => {
            const r = chron[hover.ri];
            const name = subjects[hover.si];
            const s = r?.subjects.find((x) => x.name === name && x.lastScore != null);
            if (!r || !s || s.lastScore == null) return null;
            const full = s.fullScore ?? 100;
            return (
              <g>
                <rect x={Math.min(W - 150, xOf(hover.ri) + 8)} y={Math.max(2, yOf(Math.min(100, (s.lastScore / Math.max(1, full)) * 100)) - 34)} width={142} height={28} rx={6} fill="#3C2E25" opacity={0.92} />
                <text x={Math.min(W - 150, xOf(hover.ri) + 8) + 71} y={Math.max(2, yOf(Math.min(100, (s.lastScore / Math.max(1, full)) * 100)) - 15)} textAnchor="middle" fontSize={11} fill="#f5f2e8">
                  {name} {s.lastScore}/{full} 分
                </text>
              </g>
            );
          })()}
        </svg>
      </div>
      {/* 图例 */}
      <div className="mt-2 flex flex-wrap gap-3">
        {subjects.map((name, si) => (
          <span key={name} className="inline-flex items-center gap-1.5 text-[12px] text-olive-soft">
            <span className="inline-block h-2 w-4 rounded-full" style={{ background: PALETTE[si % PALETTE.length] }} />
            {name}
          </span>
        ))}
      </div>
    </div>
  );
}
