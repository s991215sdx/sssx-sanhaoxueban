import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import QuizCard, { type GradeResult } from "@/components/QuizCard";
import type { Question } from "@db/schema";
import { PartyPopper } from "lucide-react";

type VariantQuestion = Question & { kpTitle: string };

/**
 * 变式训练：针对一道错题的知识点（优先根因）出变式题，
 * 连续答对 3 题判定该错题“已掌握”。
 */
export default function VariantTrainer({
  errorId,
  initialStreak,
  onResult,
}: {
  errorId: number;
  initialStreak: number;
  onResult?: (correct: boolean) => void;
}) {
  const [questions, setQuestions] = useState<VariantQuestion[]>([]);
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState("");
  const [result, setResult] = useState<GradeResult | null>(null);
  const [streak, setStreak] = useState(initialStreak);
  const [mastered, setMastered] = useState(false);
  const utils = trpc.useUtils();

  const variantQuery = trpc.gaps.getVariant.useQuery({ errorId });
  useEffect(() => {
    if (variantQuery.data) setQuestions(variantQuery.data as VariantQuestion[]);
  }, [variantQuery.data]);

  const submit = trpc.gaps.submitVariant.useMutation({
    onSuccess: (d) => {
      setResult({ questionId: questions[idx].id, correct: d.correct, answer: d.answer, explanation: d.explanation });
      setStreak(d.streak);
      if (d.mastered) setMastered(true);
      onResult?.(d.correct);
      utils.gaps.listErrors.invalidate();
      utils.dashboard.summary.invalidate();
    },
  });

  if (variantQuery.isLoading) {
    return (
      <div className="flex justify-center py-8">
        <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
      </div>
    );
  }
  if (questions.length === 0) {
    return <p className="py-4 text-sm text-olive-mute">这个知识点暂时没有可用的变式题。</p>;
  }

  if (mastered) {
    return (
      <div className="paper-card border-lime bg-lime-pale/60 p-6 text-center">
        <PartyPopper className="mx-auto text-lime" size={30} />
        <p className="mt-2 text-lg font-bold text-olive">连续答对 3 题，这道错题已攻克！</p>
        <p className="mt-1 text-sm text-olive-soft">已自动从复习队列中移除，知识点掌握度已更新。</p>
      </div>
    );
  }

  const q = questions[idx % questions.length];

  return (
    <div className="space-y-3">
      {/* 连对进度 */}
      <div className="flex items-center justify-between">
        <span className="mono text-xs tracking-wider text-olive-mute">
          变式训练 · 第 {idx + 1} 题
        </span>
        <span className="flex items-center gap-1.5 text-xs text-olive-mute">
          连对
          {[0, 1, 2].map((i) => (
            <span key={i} className={`h-2.5 w-2.5 rounded-full ${i < streak ? "bg-lime" : "bg-border"}`} />
          ))}
          即可攻克
        </span>
      </div>

      <QuizCard
        key={q.id}
        q={q}
        index={idx}
        value={value}
        onChange={setValue}
        result={result ?? undefined}
        kpTitle={q.kpTitle}
      />

      {!result ? (
        <button
          onClick={() => submit.mutate({ errorId, questionId: q.id, given: value })}
          disabled={!value.trim() || submit.isPending}
          className="w-full rounded-xl bg-olive py-2.5 text-[14.5px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
        >
          {submit.isPending ? "批改中…" : "提交答案"}
        </button>
      ) : (
        <button
          onClick={() => {
            setIdx((i) => i + 1);
            setValue("");
            setResult(null);
          }}
          className="w-full rounded-xl bg-olive py-2.5 text-[14.5px] font-semibold text-cream transition-colors hover:bg-lime"
        >
          {result.correct ? "下一题 →" : "没关系，再来一题 →"}
        </button>
      )}
    </div>
  );
}
