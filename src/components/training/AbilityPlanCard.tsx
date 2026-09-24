import { useState } from "react";
import { ChevronDown, ChevronUp, CircleHelp, Check } from "lucide-react";
import { THREE_TIER_PLANS } from "@/data/training/threeTierPlans";
import { E3V37_ABILITY_TRAINING } from "@/data/training/e3v37Training";
import { METHOD_BY_ID, BOARD_LABEL, type TrainingMethod } from "@/data/training/methods";
import { RichText } from "@/components/RichText";

/**
 * 单个能力的陪跑训练卡：典型问题 + 简要方案（点击展开详细做法）。
 * 训练方案库（V51）与「按学员症状给对策」（V57）共用。
 * V61：每个方法可勾选入「开方」清单；详情展开区加大，方便阅读。
 */
export default function AbilityPlanCard({
  tier,
  ability,
  selectedIds,
  onToggleSelect,
}: {
  tier: "乐学" | "会学" | "善学";
  ability: string;
  /** V61 开方：已勾选的方法 id 集合（不传则不显示勾选框） */
  selectedIds?: Set<string>;
  onToggleSelect?: (method: TrainingMethod, ability: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [closedMethods, setClosedMethods] = useState<Set<string>>(new Set());

  const plan = THREE_TIER_PLANS.find((p) => p.tier === tier && p.ability === ability);
  const rx = E3V37_ABILITY_TRAINING[ability];
  const methods = (rx?.methodIds ?? [])
    .map((id) => METHOD_BY_ID.get(id))
    .filter((m): m is TrainingMethod => m != null);
  if (!plan) return null;

  const toggleMethod = (key: string) =>
    setClosedMethods((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <div className="flex flex-col rounded-xl border border-[#a8b08c]/50 bg-white/80 p-3.5">
      <div className="text-[14.5px] font-bold text-olive">{plan.ability}</div>
      {/* 典型问题 */}
      <ul className="mt-1.5 space-y-1">
        {plan.questions.map((q) => (
          <li key={q} className="flex items-start gap-1.5 text-[12.5px] leading-relaxed text-olive-soft">
            <CircleHelp size={12} className="mt-0.5 shrink-0 text-olive-mute/70" />
            {q}
          </li>
        ))}
      </ul>
      {/* 简要方案（一句话）：点击展开/收起详细方案 */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="mt-2.5 rounded-lg border border-lime/60 bg-lime-pale px-3 py-2.5 text-left transition hover:bg-lime/20"
      >
        <span className="block text-[10.5px] font-semibold tracking-wide text-olive-mute">
          简要方案 · 点开看详细做法
        </span>
        <span className="mt-0.5 flex items-start justify-between gap-1.5 text-[13px] font-semibold leading-snug text-olive">
          {rx?.rationale ?? "结合学员诊断结果匹配训练方法。"}
          {open ? <ChevronUp size={14} className="mt-0.5 shrink-0" /> : <ChevronDown size={14} className="mt-0.5 shrink-0" />}
        </span>
      </button>
      {/* 详细方案（折叠）：每个方法可勾选入开方清单，也可再单独收起 */}
      {open && (
        <div className="mt-2 space-y-2">
          {methods.map((m, i) => {
            const mKey = `${tier}-${ability}-${m.id}`;
            const mOpen = !closedMethods.has(mKey);
            const selected = selectedIds?.has(m.id) ?? false;
            return (
              <div key={m.id} className={`rounded-lg border ${selected ? "border-lime bg-lime-pale/50" : "border-cream-deep bg-cream/70"}`}>
                <div className="flex w-full items-center gap-2 px-3 py-2">
                  {/* V61：勾选入开方清单 */}
                  {onToggleSelect && (
                    <button
                      type="button"
                      title={selected ? "从开方清单移除" : "加入开方清单"}
                      onClick={() => onToggleSelect(m, ability)}
                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors ${
                        selected ? "border-olive bg-olive text-cream" : "border-border bg-white text-transparent hover:border-lime"
                      }`}
                    >
                      <Check size={13} strokeWidth={3} />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleMethod(mKey)}
                    className="flex flex-1 items-center justify-between gap-1.5 text-left"
                  >
                    <span className="text-[13px] font-semibold text-olive">
                      {i + 1}. {m.name}
                      <span className="ml-1 font-normal text-olive-mute">
                        （{BOARD_LABEL[m.board]} · {m.sub}）
                      </span>
                    </span>
                    {mOpen ? <ChevronUp size={13} className="shrink-0 text-olive-mute" /> : <ChevronDown size={13} className="shrink-0 text-olive-mute" />}
                  </button>
                </div>
                {mOpen && (
                  <div className="space-y-1.5 border-t border-cream-deep px-3.5 py-2.5 text-[13px] leading-relaxed text-olive-soft">
                    {m.problems && <p className="whitespace-pre-line"><b className="text-olive">适用：</b>{m.problems}</p>}
                    {m.purpose && <p className="whitespace-pre-line"><b className="text-olive">目的：</b>{m.purpose}</p>}
                    {m.steps.length > 0 && (
                      <ol className="list-decimal space-y-1 pl-5">
                        {m.steps.map((s, si) => (
                          <li key={si}>{s}</li>
                        ))}
                      </ol>
                    )}
                    {m.schedule && <p><b className="text-olive">频率：</b>{m.schedule}</p>}
                    {m.tool && m.tool !== "无" && <p><b className="text-olive">工具：</b>{m.tool}</p>}
                  </div>
                )}
              </div>
            );
          })}
          {rx?.note && (
            <p className="text-[12.5px] leading-relaxed text-olive-soft">
              <RichText text={`**补充约定**：${rx.note}`} />
            </p>
          )}
        </div>
      )}
    </div>
  );
}
