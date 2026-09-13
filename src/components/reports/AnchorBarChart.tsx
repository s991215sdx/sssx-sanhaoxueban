/**
 * 职业锚八型条形图（「兴趣与方向」章节图表折叠用）：
 * 全 8 型按分数从高到低降序排列，Top2 标琥珀。
 */
import { ANCHOR_ORDER, ANCHOR_LABEL } from "@contracts/careerAnchor";
import type { AnchorResult } from "@contracts/careerAnchor";

export default function AnchorBarChart({ anchor }: { anchor: AnchorResult }) {
  const sorted = [...ANCHOR_ORDER].sort((a, b) => anchor.dims[b] - anchor.dims[a]);
  return (
    <div className="paper-card p-5">
      <h3 className="font-bold text-olive">职业锚 · 八型得分（从高到低）</h3>
      <p className="mt-1 text-[12.5px] text-olive-mute">
        琥珀条是你的主导锚（Top2）——它们决定你长期坚持一件事时需要什么回报。
      </p>
      <div className="mt-3 space-y-1.5">
        {sorted.map((k) => {
          const isTop = anchor.top2.includes(k);
          return (
            <div key={k} className="flex items-center gap-2">
              <span className={`w-28 shrink-0 truncate text-[12px] ${isTop ? "font-bold text-[#8a6d1a]" : "font-medium text-olive"}`}>
                {ANCHOR_LABEL[k]}
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.max(3, Math.min(100, (anchor.dims[k] / 5) * 100))}%`,
                    background: isTop ? "#c7a23a" : "#7cb83c",
                  }}
                />
              </div>
              <span className={`mono w-10 shrink-0 text-right text-[11.5px] ${isTop ? "font-bold text-[#8a6d1a]" : "text-olive-soft"}`}>
                {anchor.dims[k].toFixed(1)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
