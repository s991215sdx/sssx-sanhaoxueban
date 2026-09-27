/**
 * V77 升学报告 5.2：分数段 × 升学路径参考矩阵（借鉴模板图3）。
 * 物理/历史两张表（按学生首选自动切换），冲/稳/保分档 + 分数段展开，
 * 每条路径列出该分数段可报院校；传入预估分可高亮所在分数段。
 */
import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { SCORE_PATH_MATRIX } from "@/data/reports/scoreMatrix";
import type { PathMatrixBand } from "@/data/reports/scoreMatrix";

const TIER_BADGE: Record<string, string> = {
  "冲": "bg-rose/90 text-cream",
  "稳": "bg-lime text-cream",
  "保": "bg-sky text-cream",
};

/** 分数段归一化比较："680以上"→680；"670-680"→670；"480以下"→480。 */
function bandFloor(score: string): number {
  const m = score.match(/(\d+)/g);
  if (!m) return 0;
  return score.includes("以下") ? parseInt(m[0], 10) - 1 : parseInt(m[0], 10);
}

export default function ScorePathMatrix({ first, estScore }: { first: "物理" | "历史"; estScore?: number | null }) {
  const bands = SCORE_PATH_MATRIX[first] ?? [];
  const [tier, setTier] = useState<"全部" | "冲" | "稳" | "保">("全部");
  const [open, setOpen] = useState<string[]>([]);

  const activeBand = useMemo(() => {
    if (estScore == null) return null;
    const sorted = [...bands].sort((a, b) => bandFloor(b.score) - bandFloor(a.score));
    for (const b of sorted) {
      const m = b.score.match(/(\d+)(?:-(\d+))?/);
      if (!m) continue;
      const lo = parseInt(m[1], 10);
      const hi = m[2] ? parseInt(m[2], 10) : b.score.includes("以上") ? Infinity : lo;
      if (estScore >= lo && estScore <= hi) return b.score;
    }
    return null;
  }, [bands, estScore]);

  const shown = bands.filter((b) => tier === "全部" || b.tier === tier);
  const toggle = (k: string) => setOpen((o) => (o.includes(k) ? o.filter((x) => x !== k) : [...o, k]));

  const renderBand = (b: PathMatrixBand) => {
    const isActive = b.score === activeBand;
    const opened = open.includes(b.score) || isActive;
    return (
      <div
        key={b.score}
        className={`overflow-hidden rounded-xl border transition-colors ${
          isActive ? "border-lime ring-1 ring-lime" : "border-olive/12"
        }`}
      >
        <button onClick={() => toggle(b.score)} className="flex w-full items-center gap-2 bg-cream/70 px-3 py-2 text-left hover:bg-lime-pale/40">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${TIER_BADGE[b.tier]}`}>{b.tier}</span>
          <span className="text-[13px] font-bold text-olive">{b.score} 分</span>
          {isActive && <span className="rounded-full bg-lime px-2 py-0.5 text-[10.5px] font-bold text-cream">当前预估所在段</span>}
          <span className="ml-auto text-[11px] text-olive-mute">{opened ? "收起 ▴" : `${b.cells.filter((c) => c.schools.length > 0).length} 条路径可报 ▾`}</span>
        </button>
        {opened && (
          <div className="space-y-2 border-t border-olive/10 px-3 py-2.5">
            {b.cells.map((c) => (
              <div key={c.path}>
                <p className="flex items-center gap-1 text-[12px] font-bold text-olive">
                  <MapPin size={11} className="text-terra" /> {c.path}
                </p>
                {c.schools.length > 0 ? (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {c.schools.map((s) => (
                      <span key={s} className="rounded-full bg-cream px-2 py-0.5 text-[11px] text-olive-soft">{s}</span>
                    ))}
                  </div>
                ) : (
                  <p className="mt-0.5 text-[11.5px] text-olive-mute">该分数段此路径机会较少，可关注更高分段或换路径组合。</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {(["全部", "冲", "稳", "保"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTier(t)}
            className={`rounded-full px-3 py-1 text-[11.5px] font-bold transition-colors ${
              tier === t ? "bg-olive text-cream" : "bg-olive/8 text-olive-mute hover:bg-olive/15"
            }`}
          >
            {t === "全部" ? "全部" : `${t}档`}
          </button>
        ))}
        <span className="ml-auto text-[11px] text-olive-mute">{first}类 · {bands.length} 个分数段</span>
      </div>
      <div className="mt-2 space-y-2">{shown.map(renderBand)}</div>
      <p className="mt-2 text-[11px] leading-relaxed text-olive-mute">
        数据为 2023 年广东投档口径示例（借鉴《多元升学规划方案》模板），用于建立「分数段-路径-冲稳保」概念；正式填报请以当年一分一段表与招生计划为准。
      </p>
    </div>
  );
}
