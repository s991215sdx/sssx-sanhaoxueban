import { useState } from "react";
import { clearQuizDraft, loadQuizDraft, useDraftState } from "@/lib/quizDraft";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { HOLLAND_ORDER, HOLLAND_LABEL } from "@contracts/holland";
import type { HollandResult } from "@contracts/holland";
import { ChevronLeft, Map } from "lucide-react";

const OPTIONS = ["完全不喜欢", "不太喜欢", "一般", "比较喜欢", "非常喜欢"] as const;

/** 霍兰德职业兴趣测评（选做）：36 道 Likert 五级题逐题作答。 */
export default function HollandQuiz({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.assessment.questions.useQuery({ kind: "holland" });
  // 作答进度挂草稿：误退出/刷新后回来接着答，不用重测
  const [idx, setIdx] = useDraftState<number>("holland", "idx", 0);
  const [answers, setAnswers] = useDraftState<number[]>("holland", "answers", []);
  const [resumed, setResumed] = useState(
    () => ((loadQuizDraft("holland")?.answers as unknown[] | undefined)?.length ?? 0) > 0,
  );
  const resetAll = () => {
    clearQuizDraft("holland");
    setIdx(0);
    setAnswers([]);
    setResumed(false);
  };

  const submit = trpc.assessment.submit.useMutation({
    onSuccess: () => {
      clearQuizDraft("holland"); // 提交成功，清除草稿
      utils.assessment.latest.invalidate();
    },
  });

  const questions = data?.kind === "holland" ? data.ratings : undefined;
  const total = questions?.length ?? 0;

  const pick = (value: number) => {
    const next = [...answers];
    next[idx] = value;
    setAnswers(next);
    if (idx + 1 < total) {
      setIdx(idx + 1);
    } else if (questions && next.length === total) {
      submit.mutate({ kind: "holland", answers: next } as any);
    }
  };

  /* ------- 结果卡 ------- */
  if (submit.isSuccess && submit.data?.kind === "holland") {
    const result = submit.data.result as HollandResult;
    return (
      <div className="paper-card p-6 text-center">
        <Map className="mx-auto text-lime" size={30} />
        <p className="mono mt-3 text-[11px] tracking-wider text-olive-mute">霍兰德职业兴趣测评 · 结果</p>
        <div className="mt-4 rounded-xl bg-cream px-3 py-3">
          <div className="text-[11.5px] text-olive-mute">职业兴趣代码</div>
          <div className="mono mt-0.5 text-[22px] font-bold tracking-widest text-olive">{result.code}</div>
          <div className="mt-1 text-[12.5px] text-olive-soft">{result.keywords}</div>
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-olive-soft">{result.summary}</p>
        <div className="mx-auto mt-4 max-w-md space-y-2 text-left">
          {HOLLAND_ORDER.map((k) => (
            <div key={k} className="flex items-center gap-3">
              <span className="w-20 shrink-0 text-[12.5px] text-olive-soft">
                {k} {HOLLAND_LABEL[k]}
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
                <div className="h-full rounded-full bg-lime" style={{ width: `${(result.dims[k] / 5) * 100}%` }} />
              </div>
              <span className="mono w-8 text-right text-[12.5px] text-olive">{result.dims[k].toFixed(1)}</span>
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
            onClick={() => navigate("/report-detail?tab=holland")}
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
          <h2 className="text-lg font-bold text-olive">霍兰德职业兴趣测评（选做）</h2>
          <p className="mt-0.5 text-[13px] text-olive-soft">按喜欢程度自评 · 36 题约 5 分钟</p>
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

          <p className="mt-2 text-center text-[12px] text-olive-mute">你对下面这件事的喜欢程度？</p>
          <p className="mt-3 text-center text-[16.5px] font-medium leading-relaxed text-olive">{q.text}</p>

          <div className="mt-5 grid gap-2.5">
            {OPTIONS.map((opt, i) => (
              <button
                key={opt}
                disabled={submit.isPending}
                onClick={() => pick(i + 1)}
                className={`rounded-xl border px-4 py-3 text-center text-[14.5px] leading-relaxed transition-colors ${
                  answers[idx] === i + 1
                    ? "border-lime bg-lime-pale font-medium text-olive"
                    : "border-border bg-cream text-olive-soft hover:border-lime/60 hover:bg-lime-pale/50"
                }`}
              >
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
            <span className="text-[12.5px] text-olive-mute">没有对错，凭第一感觉选</span>
          </div>

          {submit.isPending && <p className="mt-3 text-center text-[13px] text-olive-mute">正在生成你的结果…</p>}
          {submit.isError && <p className="mt-3 text-center text-[13px] text-terra">提交没成功，请再选一次最后一题。</p>}
        </>
      )}
    </div>
  );
}
