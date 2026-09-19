import type { E3V37Result } from "@contracts/e3v37";
import { E3V37_LEVEL_CAPTION, e3v37LevelTextClass } from "./e3v37Theme";

/**
 * 三阶九能体检一张图（V52 起替代九能雷达，置于综合详细报告）：
 * 三阶均分条 + 九能小格，红 <3.0 卡点 · 黄 3.0-3.7 待提升 · 绿 ≥3.8 正常，凹陷处就是发力点。
 */
export default function E3V37OverviewCard({ e3 }: { e3: E3V37Result }) {
  return (
    <div className="paper-card p-5">
      <h3 className="font-bold text-olive">三阶九能体检一张图</h3>
      <p className="mt-1 text-[12.5px] text-olive-mute">{E3V37_LEVEL_CAPTION}，凹陷处就是发力点。</p>
      <div className="mt-3 space-y-1.5">
        {e3.systems.core.map((d) => (
          <div key={d.key} className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-[12.5px] font-semibold text-olive">{d.key}</span>
            <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
              <div
                className="h-full rounded-full"
                style={{ width: `${(d.score / 5) * 100}%`, background: d.level === "正常" ? "#7cb83c" : d.level === "待提升" ? "#c7a23a" : "#b91c1c" }}
              />
            </div>
            <span className={`mono w-16 shrink-0 text-right text-[12px] ${e3v37LevelTextClass(d.level)}`}>
              {d.score}/5 · {d.level}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {e3.abilities.map((a) => (
          <div key={a.key} className="rounded-lg bg-cream px-2 py-1.5 text-center">
            <div className="text-[11px] text-olive-mute">{a.label}</div>
            <div className={`mono text-[13px] font-bold ${e3v37LevelTextClass(a.level)}`}>{a.score}</div>
            <div className={`text-[10.5px] ${e3v37LevelTextClass(a.level)}`}>{a.level}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
