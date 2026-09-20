import { useState } from "react";
import { Stethoscope, Loader2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { THREE_TIER_PLANS } from "@/data/training/threeTierPlans";
import AbilityPlanCard from "@/components/training/AbilityPlanCard";

/**
 * V57：学员卡上的「陪跑对策」——按孩子的症状（E3 诊断弱项）给出对应训练方案。
 * 弱项 = 九能得分 < 3.8，按分数从低到高取前 4 项；未测则提示先做诊断。
 */
export default function StudentAdvicePanel({ userId }: { userId: number }) {
  const [open, setOpen] = useState(false);
  const { data, isLoading } = trpc.coach.studentDetail.useQuery({ userId }, { enabled: open });

  const e3 = data?.assessments.e3 as
    | { version?: string; abilities?: { label: string; score: number; level: string }[] }
    | undefined;
  const weak =
    e3?.version === "3.7" && e3.abilities
      ? [...e3.abilities].filter((a) => a.score < 3.8).sort((a, b) => a.score - b.score).slice(0, 4)
      : [];
  const tierOf = (ability: string) => THREE_TIER_PLANS.find((p) => p.ability === ability)?.tier ?? "乐学";

  return (
    <div className="mt-3 rounded-xl border border-lime/40 bg-lime-pale/40 p-3" onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 text-left"
      >
        <span className="inline-flex items-center gap-1.5 text-[12.5px] font-bold text-olive">
          <Stethoscope size={14} />
          陪跑对策（按孩子的症状匹配训练方案）
        </span>
        <span className="text-[11px] text-olive-mute">{open ? "收起" : "展开"}</span>
      </button>

      {open && (
        <div className="mt-2.5">
          {isLoading || !data ? (
            <p className="flex items-center gap-2 py-3 text-[12.5px] text-olive-mute">
              <Loader2 size={14} className="animate-spin" /> 正在读取学员诊断结果…
            </p>
          ) : !e3 ? (
            <p className="py-2 text-[12.5px] leading-relaxed text-olive-soft">
              这位同学还没做「学习力诊断（E3 三阶九能）」，先请 TA 在测评中心完成，这里就能自动按弱项匹配对策。
            </p>
          ) : e3.version !== "3.7" ? (
            <p className="py-2 text-[12.5px] leading-relaxed text-olive-soft">
              学习力诊断是旧版结果，请让 TA 重测最新版（V3.7），就能按症状自动匹配对策了。
            </p>
          ) : weak.length === 0 ? (
            <p className="py-2 text-[12.5px] leading-relaxed text-olive-soft">
              三阶九能全部 ≥ 3.8，没有明显弱项——保持现有节奏，可以用「AI 陪跑问诊」聊聊怎么更进一步。
            </p>
          ) : (
            <div className="space-y-2.5">
              <p className="text-[11.5px] text-olive-mute">
                按诊断弱项（前 {weak.length} 项）匹配的训练方案：
              </p>
              {weak.map((a) => (
                <div key={a.label} className="rounded-xl border border-[#a8b08c]/40 bg-white/70 p-2.5">
                  <div className="flex items-center gap-2">
                    <span className="text-[13px] font-bold text-olive">{a.label}</span>
                    <span
                      className={`rounded-full px-1.5 py-px text-[10.5px] font-bold ${
                        a.score < 3.0
                          ? "bg-[#fbe3df] text-[#8f1313]"
                          : a.score < 3.8
                            ? "bg-[#f5e7c1] text-[#8a6d1a]"
                            : "bg-[#f0f7dd] text-[#5a9326]"
                      }`}
                    >
                      {a.score}/5 · {a.level}
                    </span>
                    <span className="ml-auto text-[11px] text-olive-mute">
                      {tierOf(a.label)}系统
                    </span>
                  </div>
                  <div className="mt-2">
                    <AbilityPlanCard tier={tierOf(a.label) as "乐学" | "会学" | "善学"} ability={a.label} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
