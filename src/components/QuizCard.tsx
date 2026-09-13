import { useState } from "react";
import { CheckCircle2, XCircle, Lightbulb } from "lucide-react";
import type { Question } from "@db/schema";

export type GradeResult = {
  questionId: number;
  correct: boolean;
  answer: string;
  explanation: string;
  kpId?: number;
};

const LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * 单题答题卡。受控组件：
 * - value / onChange 维护作答
 * - result 为空时可作答，有结果后锁定并展示解析
 */
export default function QuizCard({
  q,
  index,
  value,
  onChange,
  result,
  kpTitle,
}: {
  q: Question;
  index: number;
  value: string;
  onChange: (v: string) => void;
  result?: GradeResult;
  kpTitle?: string;
}) {
  const [showHint, setShowHint] = useState(false);
  const graded = !!result;

  return (
    <div
      className={`paper-card p-5 transition-colors ${
        graded ? (result.correct ? "border-lime/60" : "border-terra/50") : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <span className="mono mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-olive text-[13px] font-bold text-cream">
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            {kpTitle && <span className="chip text-olive-mute">{kpTitle}</span>}
            <span className="chip text-olive-mute">{"★".repeat(q.difficulty)}</span>
          </div>
          <p className="mt-2 text-[15.5px] leading-relaxed text-olive">{q.stem}</p>
        </div>
        {graded &&
          (result.correct ? (
            <CheckCircle2 className="shrink-0 text-lime" size={24} />
          ) : (
            <XCircle className="shrink-0 text-terra" size={24} />
          ))}
      </div>

      {q.type === "choice" && q.options ? (
        <div className="mt-4 grid gap-2">
          {q.options.map((opt, i) => {
            const letter = LETTERS[i];
            const selected = value === letter;
            const isAnswer = graded && result.answer === letter;
            const isWrongPick = graded && selected && !result.correct;
            return (
              <button
                key={letter}
                type="button"
                disabled={graded}
                onClick={() => onChange(letter)}
                className={`flex items-center gap-3 rounded-xl border px-4 py-2.5 text-left text-[15px] transition-all ${
                  isAnswer
                    ? "border-lime bg-lime-pale font-medium text-olive"
                    : isWrongPick
                      ? "border-terra bg-terra/10 text-olive"
                      : selected
                        ? "border-olive bg-lime-pale/70 text-olive"
                        : "border-border bg-cream text-olive-soft hover:border-olive/40 hover:bg-lime-pale/40"
                } ${graded ? "cursor-default" : "cursor-pointer"}`}
              >
                <span
                  className={`mono flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[12px] font-bold ${
                    isAnswer ? "bg-lime text-white" : selected ? "bg-olive text-cream" : "bg-secondary text-olive-soft"
                  }`}
                >
                  {letter}
                </span>
                <span className="min-w-0">{opt}</span>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="mt-4">
          <input
            value={value}
            disabled={graded}
            onChange={(e) => onChange(e.target.value)}
            placeholder="写下你的答案…"
            className={`w-full rounded-xl border bg-cream px-4 py-2.5 text-[15px] text-olive outline-none transition-colors placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25 ${
              graded ? (result.correct ? "border-lime bg-lime-pale" : "border-terra bg-terra/5") : "border-input"
            }`}
          />
          {graded && !result.correct && (
            <p className="mt-2 text-sm text-olive">
              正确答案：<span className="mono font-semibold text-lime">{result.answer}</span>
            </p>
          )}
        </div>
      )}

      {!graded && q.hint && (
        <div className="mt-3">
          {showHint ? (
            <p className="rounded-lg bg-butter/40 px-3 py-2 text-[13.5px] leading-relaxed text-olive">
              💡 {q.hint}
            </p>
          ) : (
            <button
              type="button"
              onClick={() => setShowHint(true)}
              className="inline-flex items-center gap-1.5 text-[13px] text-olive-mute transition-colors hover:text-olive"
            >
              <Lightbulb size={14} /> 需要提示
            </button>
          )}
        </div>
      )}

      {graded && (
        <div className="mt-4 rounded-xl border border-border bg-cream/70 px-4 py-3">
          <div className="mono text-[10px] tracking-wider text-olive-mute">解析</div>
          <p className="mt-1 text-[14px] leading-relaxed text-olive">{result.explanation}</p>
        </div>
      )}
    </div>
  );
}
