import { useState } from "react";
import { Sparkles, SendHorizonal, Loader2 } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { THREE_TIER_PLANS } from "@/data/training/threeTierPlans";
import { RichText } from "@/components/RichText";

/**
 * V57：AI 陪跑问诊（陪跑训练专栏内）。
 * 伴学师描述孩子近期遇到的问题（可选关联学员与能力），AI 结合三阶九能方案库给对策；
 * AI 通道不可用时后端自动降级为规则匹配，界面标注来源。
 */
export default function AiCoachPanel() {
  const [question, setQuestion] = useState("");
  const [ability, setAbility] = useState("");
  const [userId, setUserId] = useState<number | "">("");
  const { data: students } = trpc.coach.myStudents.useQuery();
  const ask = trpc.coach.askAdvice.useMutation();

  const submit = () => {
    if (question.trim().length < 4) return;
    ask.mutate({
      question: question.trim(),
      ability: ability || null,
      userId: userId === "" ? undefined : Number(userId),
    });
  };

  return (
    <section className="paper-card accent-l border-lime p-5">
      <div className="flex items-center gap-2">
        <Sparkles size={16} className="text-olive" />
        <h2 className="text-[16px] font-bold text-olive">AI 陪跑问诊</h2>
        <span className="rounded-full bg-lime-pale px-2 py-px text-[10.5px] font-semibold text-olive-soft">
          结合三阶九能训练方案库
        </span>
      </div>
      <p className="mt-1 text-[12.5px] leading-relaxed text-olive-mute">
        把孩子近期遇到的问题描述给我（表现、场景、持续多久），我会判断对应的学习力短板，给出现在就能做的对策、一周观察点和升级信号。选中学员可带入 TA 的测评结果。
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        <select
          value={userId}
          onChange={(e) => setUserId(e.target.value === "" ? "" : Number(e.target.value))}
          className="rounded-lg border border-border bg-cream px-2.5 py-2 text-[12.5px] text-olive outline-none focus:border-lime"
        >
          <option value="">关联学员（可选，带入测评结果）</option>
          {(students ?? []).map((s) => (
            <option key={s.userId} value={s.userId}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={ability}
          onChange={(e) => setAbility(e.target.value)}
          className="rounded-lg border border-border bg-cream px-2.5 py-2 text-[12.5px] text-olive outline-none focus:border-lime"
        >
          <option value="">判断相关能力（可选）</option>
          {THREE_TIER_PLANS.map((p) => (
            <option key={p.ability} value={p.ability}>
              {p.tier} · {p.ability}
            </option>
          ))}
        </select>
      </div>

      <textarea
        value={question}
        onChange={(e) => setQuestion(e.target.value)}
        rows={3}
        maxLength={2000}
        placeholder="例：初二男生，最近一遇到数学大题就说「我不行」，月考失利后两周都不愿碰数学，作业拖到晚上 11 点……"
        className="mt-2.5 w-full rounded-xl border border-input bg-cream px-3.5 py-2.5 text-[13.5px] leading-relaxed text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25"
      />
      <div className="mt-2.5 flex items-center gap-3">
        <button
          onClick={submit}
          disabled={ask.isPending || question.trim().length < 4}
          className="inline-flex items-center gap-1.5 rounded-xl bg-olive px-4 py-2.5 text-[13.5px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
        >
          {ask.isPending ? <Loader2 size={15} className="animate-spin" /> : <SendHorizonal size={15} />}
          {ask.isPending ? "问诊中…" : "问对策"}
        </button>
        {ask.error && <span className="text-[12px] text-terra">{ask.error.message}</span>}
      </div>

      {ask.data && (
        <div className="mt-4 rounded-xl border border-lime/50 bg-cream/70 p-4">
          <div className="flex items-center gap-2">
            <span className={`rounded-full px-2 py-px text-[10.5px] font-bold ${ask.data.ai ? "bg-olive text-cream" : "bg-butter/60 text-olive-soft"}`}>
              {ask.data.ai ? "AI 生成" : "规则匹配"}
            </span>
            <span className="text-[11px] text-olive-mute">
              {ask.data.ai ? "基于三阶九能方案库与学员测评上下文" : "AI 通道暂不可用，已按方案库匹配"}
            </span>
          </div>
          <div className="mt-2.5 whitespace-pre-line text-[13px] leading-relaxed text-olive">
            <RichText text={ask.data.answer} />
          </div>
        </div>
      )}
    </section>
  );
}
