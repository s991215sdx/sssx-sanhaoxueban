import { useState } from "react";
import { ClipboardList, ChevronDown, ChevronUp, CircleHelp } from "lucide-react";
import { THREE_TIER_PLANS, THREE_TIER_STYLE } from "@/data/training/threeTierPlans";
import { E3V37_ABILITY_TRAINING } from "@/data/training/e3v37Training";
import { METHOD_BY_ID, BOARD_LABEL, type TrainingMethod } from "@/data/training/methods";
import { RichText } from "@/components/RichText";

/**
 * 学习力陪跑训练方案库（三阶九能 · V51）。
 * 按三阶九能组织：每能列出典型问题 + 简要训练方案（一句话）；
 * 详细方案默认折叠，点击「简要方案」才展开（展开后可再逐条收起）。
 * 数据复用 e3v37Training.ts（与学生报告的训练方案口径一致）。
 */
export default function TrainingPlanLibrary() {
  const [openAbility, setOpenAbility] = useState<string | null>(null);
  const [closedMethods, setClosedMethods] = useState<Set<string>>(new Set());

  const toggle = (key: string) => setOpenAbility((cur) => (cur === key ? null : key));
  const toggleMethod = (key: string) =>
    setClosedMethods((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <section className="paper-card p-5">
      <div className="flex items-center gap-2">
        <ClipboardList size={16} className="text-olive" />
        <h2 className="text-[16px] font-bold text-olive">学习力陪跑训练方案（三阶九能）</h2>
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-olive-mute">
        对照学员的表现找到对应的问题，先看「简要方案」，感兴趣再点开看详细做法（步骤、频率、工具）。
        与学员报告中的训练方案口径一致。
      </p>

      <div className="mt-4 space-y-3.5">
        {(["乐学", "会学", "善学"] as const).map((tier) => {
          const st = THREE_TIER_STYLE[tier];
          const plans = THREE_TIER_PLANS.filter((p) => p.tier === tier);
          return (
            <div key={tier} className="rounded-xl border px-3.5 py-3" style={{ borderColor: st.border, background: st.bg }}>
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-[14px] font-bold" style={{ color: st.color }}>
                  {st.label}
                </span>
                <span className="text-[11.5px] text-olive-mute">{st.sub}</span>
              </div>
              <div className="mt-2.5 grid gap-2.5 lg:grid-cols-3">
                {plans.map((p) => {
                  const rx = E3V37_ABILITY_TRAINING[p.ability];
                  const methods = (rx?.methodIds ?? [])
                    .map((id) => METHOD_BY_ID.get(id))
                    .filter((m): m is TrainingMethod => m != null);
                  const open = openAbility === `${tier}-${p.ability}`;
                  return (
                    <div key={p.ability} className="flex flex-col rounded-xl border border-[#a8b08c]/50 bg-white/80 p-3">
                      <div className="text-[14px] font-bold text-olive">{p.ability}</div>
                      {/* 典型问题 */}
                      <ul className="mt-1.5 space-y-1">
                        {p.questions.map((q) => (
                          <li key={q} className="flex items-start gap-1.5 text-[12px] leading-relaxed text-olive-soft">
                            <CircleHelp size={12} className="mt-0.5 shrink-0 text-olive-mute/70" />
                            {q}
                          </li>
                        ))}
                      </ul>
                      {/* 简要方案（一句话）：点击展开/收起详细方案 */}
                      <button
                        type="button"
                        onClick={() => toggle(`${tier}-${p.ability}`)}
                        className="mt-2.5 rounded-lg border border-lime/60 bg-lime-pale px-2.5 py-2 text-left transition hover:bg-lime/20"
                      >
                        <span className="block text-[10.5px] font-semibold tracking-wide text-olive-mute">
                          简要方案 · 点开看详细做法
                        </span>
                        <span className="mt-0.5 flex items-start justify-between gap-1.5 text-[12.5px] font-semibold leading-snug text-olive">
                          {rx?.rationale ?? "结合学员诊断结果匹配训练方法。"}
                          {open ? <ChevronUp size={14} className="mt-0.5 shrink-0" /> : <ChevronDown size={14} className="mt-0.5 shrink-0" />}
                        </span>
                      </button>
                      {/* 详细方案（折叠）：每个方法可再单独收起 */}
                      {open && (
                        <div className="mt-2 space-y-2">
                          {methods.map((m, i) => {
                            const mKey = `${tier}-${p.ability}-${m.id}`;
                            const mOpen = !closedMethods.has(mKey);
                            return (
                              <div key={m.id} className="rounded-lg border border-cream-deep bg-cream/70">
                                <button
                                  type="button"
                                  onClick={() => toggleMethod(mKey)}
                                  className="flex w-full items-center justify-between gap-1.5 px-2.5 py-1.5 text-left"
                                >
                                  <span className="text-[12px] font-semibold text-olive">
                                    {i + 1}. {m.name}
                                    <span className="ml-1 font-normal text-olive-mute">
                                      （{BOARD_LABEL[m.board]} · {m.sub}）
                                    </span>
                                  </span>
                                  {mOpen ? <ChevronUp size={13} className="shrink-0 text-olive-mute" /> : <ChevronDown size={13} className="shrink-0 text-olive-mute" />}
                                </button>
                                {mOpen && (
                                  <div className="space-y-1 border-t border-cream-deep px-2.5 py-2 text-[12px] leading-relaxed text-olive-soft">
                                    {m.problems && <p className="whitespace-pre-line"><b className="text-olive">适用：</b>{m.problems}</p>}
                                    {m.purpose && <p className="whitespace-pre-line"><b className="text-olive">目的：</b>{m.purpose}</p>}
                                    {m.steps.length > 0 && (
                                      <ol className="list-decimal space-y-0.5 pl-5">
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
                            <p className="text-[12px] leading-relaxed text-olive-soft">
                              <RichText text={`**补充约定**：${rx.note}`} />
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
