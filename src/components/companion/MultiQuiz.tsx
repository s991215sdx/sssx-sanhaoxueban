import { useState } from "react";
import { clearQuizDraft, loadQuizDraft, useDraftState } from "@/lib/quizDraft";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { MULTI_DIM_LABEL } from "@contracts/multi";
import type { MultiResult } from "@contracts/multi";
import { ChevronLeft, Sparkles } from "lucide-react";

const LIKERT = [
  { value: 1, label: "完全不符合" },
  { value: 2, label: "不太符合" },
  { value: 3, label: "一般" },
  { value: 4, label: "比较符合" },
  { value: 5, label: "完全符合" },
];

/** 多元智能测评（选做）：40 题 Likert 5 点逐题作答。 */
export default function MultiQuiz({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.assessment.questions.useQuery({ kind: "multi" });
  // 作答进度挂草稿：误退出/刷新后回来接着答，不用重测
  const [idx, setIdx] = useDraftState<number>("multi", "idx", 0);
  const [answers, setAnswers] = useDraftState<number[]>("multi", "answers", []);
  const [resumed, setResumed] = useState(
    () => ((loadQuizDraft(user?.id, "multi")?.answers as unknown[] | undefined)?.length ?? 0) > 0,
  );
  const resetAll = () => {
    clearQuizDraft(user?.id, "multi");
    setIdx(0);
    setAnswers([]);
    setResumed(false);
  };

  const submit = trpc.assessment.submit.useMutation({
    onSuccess: () => {
      clearQuizDraft(user?.id, "multi"); // 提交成功，清除草稿
      utils.assessment.latest.invalidate();
    },
  });

  const questions = data?.kind === "multi" ? data.ratings : undefined;
  const total = questions?.length ?? 0;

  const pick = (value: number) => {
    const next = [...answers];
    next[idx] = value;
    setAnswers(next);
    if (idx + 1 < total) {
      setIdx(idx + 1);
    } else if (questions && next.length === total) {
      // 服务端新增 multi 类型，若本地 tRPC 类型未刷新则以 as any 兜底
      submit.mutate({ kind: "multi", answers: next } as any);
    }
  };

  /* ------- 结果卡 ------- */
  if (submit.isSuccess && submit.data?.kind === "multi") {
    const result = submit.data.result as MultiResult;
    return (
      <div className="paper-card p-6 text-center">
        <Sparkles className="mx-auto text-lime" size={30} />
        <p className="mono mt-3 text-[11px] tracking-wider text-olive-mute">多元智能测评 · 结果</p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {result.top3.map((k) => (
            <span key={k} className="chip !border-lime/50 !bg-lime-pale">
              {MULTI_DIM_LABEL[k]} <b>{result.dims[k].toFixed(1)}</b>
            </span>
          ))}
        </div>
        <p className="mx-auto mt-4 max-w-md text-left text-[14.5px] leading-relaxed text-olive-soft">
          {result.summary}
        </p>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onDone}
            className="flex-1 rounded-xl border border-lime/60 bg-lime-pale py-3 text-[14px] font-semibold text-olive hover:bg-lime/20"
          >
            返回报告
          </button>
          <button
            onClick={() => navigate("/report-detail?tab=multi")}
            className="flex-1 rounded-xl bg-olive py-3 text-[14px] font-semibold text-cream transition-colors hover:bg-lime"
          >
            查看详细报告 →
          </button>
        </div>
      </div>
    );
  }

  /* ------- 作答中 ------- */
  const q = questions?.[Math.min(idx, total - 1)];
  return (
    <div className="paper-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-olive">多元智能测评（选做）</h2>
          <p className="mt-0.5 text-[13px] text-olive-soft">加德纳八大智能 · 40 题约 6 分钟</p>
        </div>
        <button onClick={onDone} className="shrink-0 text-[13px] text-olive-mute hover:text-olive">
          先不测了
        </button>
      </div>

      {resumed && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-lime/50 bg-lime-pale/60 px-3 py-2">
          <span className="text-[12.5px] text-olive">已恢复上次进度（第 {idx + 1} 题），接着答就好。</span>
          <button onClick={resetAll} className="shrink-0 text-[12px] text-olive-mute underline hover:text-olive">
            重新开始
          </button>
        </div>
      )}

      {isLoading || !q ? (
        <div className="flex justify-center py-14">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-deep">
              <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
            </div>
            <span className="mono shrink-0 text-[12px] text-olive-mute">
              {idx + 1} / {total}
            </span>
          </div>

          <p className="mt-6 text-center text-[16.5px] font-medium leading-relaxed text-olive">{q.text}</p>

          <div className="mt-5 grid grid-cols-5 gap-2">
            {LIKERT.map((opt) => (
              <button
                key={opt.value}
                disabled={submit.isPending}
                onClick={() => pick(opt.value)}
                className={`rounded-xl border px-1 py-2.5 text-center text-[11.5px] leading-tight transition-colors sm:text-[13px] ${
                  answers[idx] === opt.value
                    ? "border-lime bg-lime-pale font-medium text-olive"
                    : "border-border bg-cream text-olive-soft hover:border-lime/60 hover:bg-lime-pale/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <button
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="flex items-center gap-1 text-[13.5px] text-olive-mute hover:text-olive disabled:opacity-40"
            >
              <ChevronLeft size={15} />
              上一题
            </button>
            <span className="text-[12.5px] text-olive-mute">按真实情况选，没有对错</span>
          </div>

          {submit.isPending && <p className="mt-3 text-center text-[13px] text-olive-mute">正在生成你的结果…</p>}
          {submit.isError && <p className="mt-3 text-center text-[13px] text-terra">提交没成功，请再选一次最后一题。</p>}
        </>
      )}
    </div>
  );
}
