import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { clearQuizDraft, loadQuizDraft, useDraftState } from "@/lib/quizDraft";
import { ChevronLeft, Sparkles } from "lucide-react";

type ChoiceKind = "mbti" | "disc";

const DIM_LABEL: Record<string, string> = {
  E: "外向 E",
  I: "内向 I",
  S: "实感 S",
  N: "直觉 N",
  T: "思考 T",
  F: "情感 F",
  J: "计划 J",
  P: "灵活 P",
  D: "掌控 D",
  C: "严谨 C",
};

/** 向导第 2/3 阶段：MBTI（28 题）与 DISC（24 题）逐题二选一。 */
export default function ChoiceStage({
  kind,
  title,
  subtitle,
  onNext,
  onSkip,
}: {
  kind: ChoiceKind;
  title: string;
  subtitle: string;
  onNext: () => void;
  onSkip: () => void;
}) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.assessment.questions.useQuery({ kind });
  // 作答进度挂草稿：误退出后回来接着答，不用重测
  const [idx, setIdx] = useDraftState<number>(kind, "idx", 0);
  const [answers, setAnswers] = useDraftState<(0 | 1)[]>(kind, "answers", []);
  const [resumed, setResumed] = useState(
    () => ((loadQuizDraft(kind)?.answers as unknown[] | undefined)?.length ?? 0) > 0,
  );
  const resetAll = () => {
    clearQuizDraft(kind);
    setIdx(0);
    setAnswers([]);
    setResumed(false);
  };

  const submit = trpc.assessment.submit.useMutation({
    onSuccess: () => {
      clearQuizDraft(kind);
      utils.assessment.latest.invalidate();
      utils.profile.get.invalidate();
    },
  });

  // V37 起 DISC 改为 V2 强迫选择（DiscV2Quiz），ChoiceStage 只服务 MBTI；这里按 mbti 收窄题包类型
  const questions = data?.kind === "mbti" ? data.questions : undefined;
  const total = questions?.length ?? 0;

  const pick = (choice: 0 | 1) => {
    const next = [...answers];
    next[idx] = choice;
    setAnswers(next);
    if (idx + 1 < total) {
      setIdx(idx + 1);
    } else if (questions && next.length === total) {
      submit.mutate({ kind, answers: next } as { kind: ChoiceKind; answers: (0 | 1)[] });
    }
  };

  /* ------- 结果卡 ------- */
  if (submit.isSuccess && (submit.data.kind === "mbti" || submit.data.kind === "disc")) {
    const outcome = submit.data;
    const result = outcome.result;
    const big = outcome.kind === "mbti" ? outcome.result.type : `${outcome.result.primary} 主导`;
    return (
      <div className="paper-card p-6 text-center">
        <Sparkles className="mx-auto text-lime" size={30} />
        <p className="mono mt-3 text-[11px] tracking-wider text-olive-mute">{title} · 结果</p>
        <div className="mt-2 text-4xl font-bold tracking-widest text-olive">{big}</div>
        <div className="mt-4 flex flex-wrap justify-center gap-1.5">
          {Object.entries(result.dims).map(([k, v]) => (
            <span key={k} className="chip">
              {DIM_LABEL[k] ?? k} <b>{v}</b>
            </span>
          ))}
        </div>
        <p className="mx-auto mt-4 max-w-md text-left text-[14.5px] leading-relaxed text-olive-soft">{result.summary}</p>
        <button
          onClick={onNext}
          className="mt-6 w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
        >
          下一步 →
        </button>
      </div>
    );
  }

  /* ------- 作答中 ------- */
  const q = questions?.[Math.min(idx, total - 1)];
  return (
    <div className="paper-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-olive">{title}</h2>
          <p className="mt-0.5 text-[13px] text-olive-soft">{subtitle}</p>
        </div>
        <button onClick={onSkip} className="shrink-0 text-[13px] text-olive-mute hover:text-olive">
          先跳过这测
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

          <div className="mt-5 grid gap-3">
            {(["a", "b"] as const).map((side, i) => (
              <button
                key={side}
                disabled={submit.isPending}
                onClick={() => pick(i as 0 | 1)}
                className={`rounded-2xl border px-5 py-4 text-left text-[15px] leading-relaxed transition-colors ${
                  answers[idx] === i
                    ? "border-lime bg-lime-pale font-medium text-olive"
                    : "border-border bg-cream text-olive-soft hover:border-lime/60 hover:bg-lime-pale/50"
                }`}
              >
                <span className="mono mr-2 text-[12px] font-bold text-olive-mute">{side.toUpperCase()}</span>
                {q[side]}
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
            <span className="text-[12.5px] text-olive-mute">凭第一反应选，没有对错</span>
          </div>

          {submit.isPending && <p className="mt-3 text-center text-[13px] text-olive-mute">正在生成你的结果…</p>}
          {submit.isError && <p className="mt-3 text-center text-[13px] text-terra">提交没成功，请再选一次最后一题。</p>}
        </>
      )}
    </div>
  );
}
