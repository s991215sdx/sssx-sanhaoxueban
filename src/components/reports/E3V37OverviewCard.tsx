import type { E3V37Result } from "@contracts/e3v37";
import { e3v37Level } from "@contracts/e3v37";
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
                style={{ width: `${(d.score / 5) * 100}%`, background: d.level === "正常" ? "#52A965" : d.level === "待提升" ? "#E3B53A" : "#DD3534" }}
              />
            </div>
            <span className={`mono w-16 shrink-0 text-right text-[12px] ${e3v37LevelTextClass(d.level)}`}>
              {d.score}/5 · {d.level}
            </span>
          </div>
        ))}
      </div>
      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {e3.abilities.map((a) => {
          /* v181d：颜色/档名只按分值（与图例一致）；「关注点≤2.0 强制卡点」用红色 ⚠ 提示，不把 ≥3.0 标红 */
          const lv = e3v37Level(a.score);
          const forced = a.level === "卡点" && a.score >= 3.0;
          return (
            <div key={a.key} className="relative rounded-lg bg-cream px-2 py-1.5 text-center">
              {forced && (
                <span
                  title="有关注点均分 ≤2.0，需优先关注"
                  className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#DD3534] text-[9px] font-bold leading-none text-white"
                >
                  !
                </span>
              )}
              <div className="text-[11px] text-olive-mute">{a.label}</div>
              <div className={`mono text-[13px] font-bold ${e3v37LevelTextClass(lv)}`}>{a.score}</div>
              <div className={`text-[10.5px] ${e3v37LevelTextClass(lv)}`}>{lv}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
