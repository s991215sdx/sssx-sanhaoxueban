import { useState } from "react";
import { clearQuizDraft, loadQuizDraft, useDraftResumed, useDraftState } from "@/lib/quizDraft";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { ANCHOR_ORDER, ANCHOR_LABEL } from "@contracts/careerAnchor";
import type { AnchorResult } from "@contracts/careerAnchor";
import { ChevronLeft, Compass } from "lucide-react";

const OPTIONS = ["完全不符合", "不太符合", "一般", "比较符合", "非常符合"] as const;

/** 职业锚测评（选做）：40 道 Likert 五级题逐题作答。 */
export default function AnchorQuiz({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.assessment.questions.useQuery({ kind: "anchor" });
  // 作答进度挂草稿：误退出/刷新后回来接着答，不用重测
  const [idx, setIdx] = useDraftState<number>("anchor", "idx", 0);
  const [answers, setAnswers] = useDraftState<number[]>("anchor", "answers", []);
  // v70：跟随 uid 重算（换号/新注册账号不再误显示"已恢复进度"）
  const [resumed, setResumed] = useDraftResumed(user?.id, "anchor", "answers");
  const resetAll = () => {
    clearQuizDraft(user?.id, "anchor");
    setIdx(0);
    setAnswers([]);
    setResumed(false);
  };

  const submit = trpc.assessment.submit.useMutation({
    onSuccess: () => {
      clearQuizDraft(user?.id, "anchor"); // 提交成功，清除草稿
      utils.assessment.latest.invalidate();
    },
  });

  const questions = data?.kind === "anchor" ? data.ratings : undefined;
  const total = questions?.length ?? 0;

  const pick = (value: number) => {
    const next = [...answers];
    next[idx] = value;
    setAnswers(next);
    setResumed(false); // 已开始新作答，"已恢复进度"提示条使命完成
    if (idx + 1 < total) {
      setIdx(idx + 1);
    } else if (questions && next.length === total) {
      submit.mutate({ kind: "anchor", answers: next } as any);
    }
  };

  /* ------- 结果卡 ------- */
  if (submit.isSuccess && submit.data?.kind === "anchor") {
    const result = submit.data.result as AnchorResult;
    return (
      <div className="paper-card p-6 text-center">
        <Compass className="mx-auto text-lime" size={30} />
        <p className="mono mt-3 text-[11px] tracking-wider text-olive-mute">职业锚测评 · 结果</p>
        <p className="mt-3 text-[13.5px] leading-relaxed text-olive-soft">{result.summary}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {result.top2.map((k, i) => (
            <div key={k} className="rounded-xl bg-cream px-2 py-2.5">
              <div className="text-[11.5px] text-olive-mute">职业锚 Top{i + 1}</div>
              <div className="mt-0.5 text-[15px] font-bold text-olive">{ANCHOR_LABEL[k]}</div>
              <div className="mono text-[12px] text-olive-mute">{result.dims[k].toFixed(1)} / 5</div>
            </div>
          ))}
        </div>
        <div className="mx-auto mt-4 max-w-md space-y-2 text-left">
          {ANCHOR_ORDER.map((k) => (
            <div key={k} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-[12.5px] text-olive-soft">{ANCHOR_LABEL[k]}</span>
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
            onClick={() => navigate("/report-detail?tab=anchor")}
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
          <h2 className="text-lg font-bold text-olive">职业锚测评（选做）</h2>
          <p className="mt-0.5 text-[13px] text-olive-soft">按符合程度自评 · 40 题约 6 分钟</p>
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

          <p className="mt-4 text-center text-[16.5px] font-medium leading-relaxed text-olive">{q.text}</p>

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
