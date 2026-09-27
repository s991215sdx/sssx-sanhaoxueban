/**
 * V77 升学报告 5.1：全升学路径图。
 * 竖向时间线式呈现「当前学段 → 后续学段」的全部主流路径：
 * 每一档（学段节点）为标题条，下设路线卡片（名称 / 适用条件 / 说明）。
 * 小学版展示 小升初 → 中考 → 高考 三档，初中版展示 中考 → 高考 两档，
 * 高中版展示 高考及出口 一档。第一档默认展开，其余折叠，避免一屏信息过载。
 */
import { useState } from "react";
import { ChevronDown, Flag, Footprints } from "lucide-react";
import type { PathwayStage } from "@/data/reports/shengxueData";

const STAGE_DOT = ["bg-lime", "bg-sky", "bg-amber", "bg-olive"];

export default function FullPathwayMap({ stages }: { stages: PathwayStage[] }) {
  const [collapsed, setCollapsed] = useState<string[]>(
    stages.slice(1).map((s) => s.key),
  );
  const isCollapsed = (key: string) => collapsed.includes(key);
  const toggle = (key: string) =>
    setCollapsed((c) => (isCollapsed(key) ? c.filter((k) => k !== key) : [...c, key]));

  return (
    <div className="mt-3">
      <p className="flex items-center gap-1.5 text-[13px] font-bold text-olive">
        <Footprints size={14} className="text-olive" /> 全升学路径图
        <span className="ml-1 text-[11px] font-normal text-olive-mute">覆盖主流升学方式，点击档位折叠/展开</span>
      </p>
      <ol className="mt-2">
        {stages.map((s, i) => {
          const folded = isCollapsed(s.key);
          return (
            <li key={s.key} className="relative pl-6 pb-3 last:pb-0">
              {/* 时间线 */}
              <span className={`absolute left-[7px] top-4 h-full w-0.5 ${i < stages.length - 1 ? "bg-olive/15" : "bg-transparent"}`} />
              <span className={`absolute left-1 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-cream ${STAGE_DOT[i % STAGE_DOT.length]}`} />
              <button
                onClick={() => toggle(s.key)}
                className="flex w-full items-center justify-between rounded-xl border border-olive/12 bg-cream/70 px-3 py-2 text-left transition-colors hover:bg-lime-pale/40"
              >
                <span>
                  <span className="block text-[13.5px] font-bold text-olive">{s.title}</span>
                  <span className="block text-[11px] text-olive-mute">{s.subtitle}</span>
                </span>
                <ChevronDown size={14} className={`shrink-0 text-olive-mute transition-transform ${folded ? "" : "rotate-180"}`} />
              </button>
              {!folded && (
                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  {s.routes.map((r) => (
                    <div key={r.name} className="rounded-xl border border-olive/10 bg-cream/50 p-2.5">
                      <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-olive">
                        <Flag size={11} className="shrink-0 text-lime" /> {r.name}
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-olive-soft">
                        <span className="font-semibold text-sky">适用：</span>{r.cond}
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-olive-mute">{r.note}</p>
                    </div>
                  ))}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
