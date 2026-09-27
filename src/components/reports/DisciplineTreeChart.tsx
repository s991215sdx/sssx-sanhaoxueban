/**
 * V77 升学报告 4.3：本科 12 大学科门类图（借鉴模板图2的树形结构）。
 * 按「自然科学 / 社会科学 / 人文科学」三排归纳（每排 4 个门类），
 * 排首带归纳标签；点击门类展开下设专业类明细；
 * 传入匹配度后高亮推荐门类并标注匹配百分比。
 */
import { useState } from "react";
import { ChevronDown, GraduationCap } from "lucide-react";
import { DISCIPLINE_TREE } from "@/data/reports/shengxueData";

export type DisciplineMatch = { name: string; matchPct: number };

const TIER_STYLE = (pct: number) =>
  pct >= 75 ? "border-lime bg-lime-pale/60" : pct >= 65 ? "border-sky/60 bg-sky-50/50" : "border-amber/50 bg-amber-50/40";

/** 三排归纳（用户定的顺序与分组）。 */
const GROUPS: { label: string; sub: string; names: string[] }[] = [
  { label: "自然科学", sub: "探究自然规律", names: ["理学", "工学", "农学", "医学"] },
  { label: "社会科学", sub: "研究社会运行", names: ["经济学", "管理学", "法学", "教育学"] },
  { label: "人文科学", sub: "关注人与表达", names: ["文学", "历史学", "哲学", "艺术学"] },
];
const GROUP_BAR = ["bg-lime", "bg-sky", "bg-amber"];

export default function DisciplineTreeChart({ matches, topN = 4 }: { matches?: DisciplineMatch[]; topN?: number }) {
  const [open, setOpen] = useState<string[]>([]);
  const pctOf = (name: string) => matches?.find((m) => m.name === name)?.matchPct;
  const ranked = matches ? [...matches].sort((a, b) => b.matchPct - a.matchPct) : [];
  const topNames = new Set(ranked.slice(0, topN).map((m) => m.name));
  const toggle = (key: string) => setOpen((o) => (o.includes(key) ? o.filter((k) => k !== key) : [...o, key]));
  const byName = new Map(DISCIPLINE_TREE.map((d) => [d.name, d]));

  return (
    <div className="mt-3">
      <p className="flex items-center gap-1.5 text-[13px] font-bold text-olive">
        <GraduationCap size={14} className="text-olive" /> 本科 12 大学科门类图
        <span className="ml-1 text-[11px] font-normal text-olive-mute">按自然科学 / 社会科学 / 人文科学三排归纳，点门类展开下设专业类</span>
      </p>
      <div className="mt-2 space-y-3">
        {GROUPS.map((g, gi) => (
          <div key={g.label}>
            {/* 归纳排标签 */}
            <div className="flex items-center gap-2">
              <span className={`rounded-md ${GROUP_BAR[gi]} px-2 py-0.5 text-[11.5px] font-bold text-cream`}>{g.label}</span>
              <span className="text-[11px] text-olive-mute">{g.sub}</span>
              <div className="h-px flex-1 bg-olive/10" />
            </div>
            <div className="mt-1.5 grid grid-cols-2 gap-2 lg:grid-cols-4">
              {g.names.map((name) => {
                const d = byName.get(name);
                if (!d) return null;
                const pct = pctOf(d.name);
                const isTop = topNames.has(d.name);
                const opened = open.includes(d.key);
                return (
                  <button
                    key={d.key}
                    onClick={() => toggle(d.key)}
                    className={`relative rounded-xl border p-2.5 text-left transition-colors ${
                      pct != null ? TIER_STYLE(pct) : "border-olive/12 bg-cream/60 hover:bg-lime-pale/40"
                    } ${isTop ? "ring-1 ring-lime" : ""}`}
                  >
                    {isTop && (
                      <span className="absolute -right-1 -top-1.5 rounded-full bg-lime px-1.5 py-0.5 text-[9.5px] font-bold text-cream">
                        推荐 {pct}%
                      </span>
                    )}
                    <div className="flex items-baseline justify-between gap-1">
                      <span className="text-[13px] font-bold text-olive">{d.name}</span>
                      <span className="rounded-full bg-olive/8 px-1.5 py-0.5 text-[10px] font-semibold text-olive-mute">{d.count} 类</span>
                    </div>
                    <p className="mt-0.5 line-clamp-1 text-[10.5px] leading-relaxed text-olive-mute">{d.note}</p>
                    <span className="mt-1 flex items-center gap-0.5 text-[10.5px] font-semibold text-lime">
                      {opened ? "收起" : `${d.groups.length} 个专业类`} <ChevronDown size={11} className={opened ? "rotate-180" : ""} />
                    </span>
                    {opened && (
                      <div className="mt-1.5 flex flex-wrap gap-1 border-t border-olive/10 pt-1.5" onClick={(e) => e.stopPropagation()}>
                        {d.groups.map((gr) => (
                          <span key={gr} className="rounded-full bg-cream px-1.5 py-0.5 text-[10px] text-olive-soft">{gr}</span>
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-olive-mute">
        门类与专业类依据《普通高等学校本科专业目录》（军事学门类未列入民间招生口径）；「推荐」由测评匹配度生成，绿/蓝/黄底对应匹配度高中低。
      </p>
    </div>
  );
}
