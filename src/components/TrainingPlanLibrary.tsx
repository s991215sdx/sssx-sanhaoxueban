import { ClipboardList } from "lucide-react";
import { THREE_TIER_PLANS, THREE_TIER_STYLE } from "@/data/training/threeTierPlans";
import AbilityPlanCard from "@/components/training/AbilityPlanCard";

/**
 * 学习力陪跑训练方案库（三阶九能 · V51）。
 * 按三阶九能组织：每能列出典型问题 + 简要训练方案（一句话）；
 * 详细方案默认折叠，点击「简要方案」才展开。
 * 单能卡片渲染抽到 AbilityPlanCard，供「按学员症状给对策」复用（V57）。
 */
export default function TrainingPlanLibrary() {
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
                {plans.map((p) => (
                  <AbilityPlanCard key={p.ability} tier={p.tier} ability={p.ability} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
