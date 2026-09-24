import { useState } from "react";
import { clearQuizDraft, loadQuizDraft, useDraftState } from "@/lib/quizDraft";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { MULTI5_DIM_ORDER, MULTI5_DIM_LABEL } from "@contracts/multi5";
import type { Multi5Result } from "@contracts/multi5";
import { ChevronLeft, Sparkles } from "lucide-react";

const OPTION_LETTER = ["A", "B", "C", "D"] as const;

/** 多元智能五项客观题测评（选做）：40 道单选题逐题作答，有唯一正确答案。 */
export default function Multi5Quiz({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.assessment.questions.useQuery({ kind: "multi5" });
  // 作答进度挂草稿：误退出/刷新后回来接着答，不用重测
  const [idx, setIdx] = useDraftState<number>("multi5", "idx", 0);
  const [answers, setAnswers] = useDraftState<number[]>("multi5", "answers", []);
  const [resumed, setResumed] = useState(
    () => ((loadQuizDraft(user?.id, "multi5")?.answers as unknown[] | undefined)?.length ?? 0) > 0,
  );
  const resetAll = () => {
    clearQuizDraft(user?.id, "multi5");
    setIdx(0);
    setAnswers([]);
    setResumed(false);
  };

  const submit = trpc.assessment.submit.useMutation({
    onSuccess: () => {
      clearQuizDraft(user?.id, "multi5"); // 提交成功，清除草稿
      utils.assessment.latest.invalidate();
    },
  });

  const questions = data?.kind === "multi5" ? data.questions : undefined;
  const total = questions?.length ?? 0;

  const pick = (value: number) => {
    const next = [...answers];
    next[idx] = value;
    setAnswers(next);
    if (idx + 1 < total) {
      setIdx(idx + 1);
    } else if (questions && next.length === total) {
      submit.mutate({ kind: "multi5", answers: next } as any);
    }
  };

  /* ------- 结果卡 ------- */
  if (submit.isSuccess && submit.data?.kind === "multi5") {
    const result = submit.data.result as Multi5Result;
    const topKey = [...MULTI5_DIM_ORDER].sort(
      (a, b) => result.dims[b] - result.dims[a] || MULTI5_DIM_ORDER.indexOf(a) - MULTI5_DIM_ORDER.indexOf(b),
    )[0];
    return (
      <div className="paper-card p-6 text-center">
        <Sparkles className="mx-auto text-lime" size={30} />
        <p className="mono mt-3 text-[11px] tracking-wider text-olive-mute">多元智能五项测评 · 结果</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-cream px-2 py-2.5">
            <div className="text-[11.5px] text-olive-mute">综合水平</div>
            <div className="mt-0.5 text-[18px] font-bold text-olive">{result.overall}</div>
          </div>
          <div className="rounded-xl bg-cream px-2 py-2.5">
            <div className="text-[11.5px] text-olive-mute">细心指数</div>
            <div className="mt-0.5 text-[18px] font-bold text-olive">{result.carefulIndex}%</div>
          </div>
          <div className="rounded-xl bg-cream px-2 py-2.5">
            <div className="text-[11.5px] text-olive-mute">最强维度</div>
            <div className="mt-0.5 text-[15px] font-bold text-olive">{MULTI5_DIM_LABEL[topKey]}</div>
          </div>
        </div>
        <div className="mx-auto mt-4 max-w-md space-y-2 text-left">
          {MULTI5_DIM_ORDER.map((k) => (
            <div key={k} className="flex items-center gap-3">
              <span className="w-16 shrink-0 text-[12.5px] text-olive-soft">{MULTI5_DIM_LABEL[k]}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
                <div className="h-full rounded-full bg-lime" style={{ width: `${result.dims[k]}%` }} />
              </div>
              <span className="mono w-8 text-right text-[12.5px] text-olive">{result.dims[k]}</span>
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onDone}
            className="flex-1 rounded-xl border border-lime/60 bg-lime-pale py-3 text-[14px] font-semibold text-olive hover:bg-lime/20"
          >
            返回报告
          </button>
          <button
            onClick={() => navigate("/report-detail?tab=multi5")}
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
          <h2 className="text-lg font-bold text-olive">多元智能五项测评（选做）</h2>
          <p className="mt-0.5 text-[13px] text-olive-soft">客观题有标准答案 · 40 题约 8 分钟</p>
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

          <p className="mt-2 text-center text-[12px] text-olive-mute">{MULTI5_DIM_LABEL[q.dim]} · 单选题</p>
          <p className="mt-3 text-center text-[16.5px] font-medium leading-relaxed text-olive">{q.text}</p>

          <div className="mt-5 grid gap-2.5">
            {q.options.map((opt, i) => (
              <button
                key={i}
                disabled={submit.isPending}
                onClick={() => pick(i)}
                className={`rounded-xl border px-4 py-3 text-left text-[14.5px] leading-relaxed transition-colors ${
                  answers[idx] === i
                    ? "border-lime bg-lime-pale font-medium text-olive"
                    : "border-border bg-cream text-olive-soft hover:border-lime/60 hover:bg-lime-pale/50"
                }`}
              >
                <span className="mono mr-2 text-[12px] font-bold text-olive-mute">{OPTION_LETTER[i]}</span>
                {opt}
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
            <span className="text-[12.5px] text-olive-mute">认真作答，题目有对错</span>
          </div>

          {submit.isPending && <p className="mt-3 text-center text-[13px] text-olive-mute">正在生成你的结果…</p>}
          {submit.isError && <p className="mt-3 text-center text-[13px] text-terra">提交没成功，请再选一次最后一题。</p>}
        </>
      )}
    </div>
  );
}
