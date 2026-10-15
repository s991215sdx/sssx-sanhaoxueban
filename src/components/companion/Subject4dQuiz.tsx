import { useMemo } from "react";
import { clearQuizDraft, useDraftResumed, useDraftState } from "@/lib/quizDraft";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import {
  SUBJECT4D_BANK,
  SUBJECT4D_DIM_COLOR,
  SUBJECT4D_DIM_LABEL,
  SUBJECT4D_OPTIONS,
  SUBJECT4D_SUBJECTS,
  type Subject4dResult,
} from "@contracts/subject4d";
import { Compass, ChevronLeft, Sparkles } from "lucide-react";

/**
 * V175 学科四维测评：9 科 × 4 维 × 3 题 = 108 题李克特量表。
 * 逐题作答、断点续答（quizDraft）、完成后出结果摘要并写入智慧生涯报告数据源。
 */
export default function Subject4dQuiz({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.assessment.questions.useQuery({ kind: "subject4d" });
  const [answers, setAnswers] = useDraftState<Record<string, number[]>>("subject4d", "answers", {});
  const [resumed, setResumed] = useDraftResumed(user?.id, "subject4d", "answers");

  const submit = trpc.assessment.submit.useMutation({
    onSuccess: () => {
      clearQuizDraft(user?.id, "subject4d");
      utils.assessment.latest.invalidate();
      utils.zhihui.reportData.invalidate();
    },
  });

  const bank = useMemo(
    () => (data?.kind === "subject4d" ? (data.bank as typeof SUBJECT4D_BANK) : SUBJECT4D_BANK),
    [data],
  );

  /* 进度定位：第一个未答完的科目 */
  const curSubject = SUBJECT4D_SUBJECTS.find((s) => (answers[s]?.length ?? 0) < bank[s].length);
  const curIdx = curSubject ? (answers[curSubject]?.length ?? 0) : 0;
  const totalAll = SUBJECT4D_SUBJECTS.reduce((n, s) => n + bank[s].length, 0);
  const doneAll = SUBJECT4D_SUBJECTS.reduce((n, s) => n + (answers[s]?.length ?? 0), 0);

  const pick = (optIdx: number) => {
    if (!curSubject) return;
    const next = { ...answers, [curSubject]: [...(answers[curSubject] ?? []), optIdx] };
    setAnswers(next);
    setResumed(false);
    const finished = SUBJECT4D_SUBJECTS.every((s) => (next[s]?.length ?? 0) === bank[s].length);
    if (finished) {
      submit.mutate({ kind: "subject4d", answers: next } as never);
    }
  };

  const back = () => {
    if (!curSubject) return;
    const si = SUBJECT4D_SUBJECTS.indexOf(curSubject);
    const arr = [...(answers[curSubject] ?? [])];
    if (arr.length > 0) {
      arr.pop();
      setAnswers({ ...answers, [curSubject]: arr });
      return;
    }
    if (si > 0) {
      const prev = SUBJECT4D_SUBJECTS[si - 1];
      const prevArr = [...(answers[prev] ?? [])];
      prevArr.pop();
      setAnswers({ ...answers, [prev]: prevArr });
    }
  };

  /* ------- 结果卡 ------- */
  if (submit.isSuccess && submit.data?.kind === "subject4d") {
    const result = submit.data.result as Subject4dResult;
    const ranked = SUBJECT4D_SUBJECTS.map((s) => ({ s, v: result.subjects[s]?.潜力指数 ?? 0 })).sort((a, b) => b.v - a.v);
    const top = ranked.slice(0, 3);
    return (
      <div className="paper-card mx-auto max-w-xl p-8 text-center">
        <Sparkles className="mx-auto text-brand" size={36} />
        <h2 className="mt-3 text-[20px] font-bold text-olive">学科四维测评完成</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-olive-mute">
          9 科 × 4 维共 108 题已完成，结果已写入你的智慧生涯档案。
        </p>
        <div className="mt-5 space-y-2 text-left">
          {top.map(({ s, v }, i) => (
            <div key={s} className="flex items-center gap-3 rounded-lg bg-mint-pale/50 px-4 py-2.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-[12px] font-bold text-white">{i + 1}</span>
              <span className="text-[14px] font-semibold text-olive">{s}</span>
              <span className="ml-auto text-[14px] font-bold text-brand">{v.toFixed(2)}</span>
            </div>
          ))}
        </div>
        <p className="mt-4 text-[12.5px] text-olive-mute">潜力指数 = 兴趣 / 能力倾向 / 观念 / 效能感 四维均值</p>
        <div className="mt-6 flex justify-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/zhihui-report")}
            className="rounded-lg bg-brand px-5 py-2.5 text-[14px] font-semibold text-cream hover:bg-lime"
          >
            查看智慧生涯规划报告
          </button>
          <button type="button" onClick={onDone} className="rounded-lg border border-border px-5 py-2.5 text-[14px] text-olive">
            返回测评中心
          </button>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return <p className="py-10 text-center text-[13px] text-olive-mute">题库加载中…</p>;
  }

  /* ------- 答题页 ------- */
  const item = curSubject ? bank[curSubject][curIdx] : null;
  const subjectIdx = curSubject ? SUBJECT4D_SUBJECTS.indexOf(curSubject) : 0;
  const dimLabel = item ? SUBJECT4D_DIM_LABEL[item.dim] : "";
  const dimColor = item ? SUBJECT4D_DIM_COLOR[item.dim] : "#0EA875";

  return (
    <div className="mx-auto max-w-2xl">
      <div className="paper-card p-6">
        <div className="flex items-center gap-2 text-olive">
          <Compass size={20} className="text-brand" />
          <h2 className="text-[18px] font-bold">学科四维测评</h2>
          <span className="ml-auto text-[12px] text-olive-mute">
            总进度 {doneAll}/{totalAll}
          </span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-mint-pale">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${(doneAll / totalAll) * 100}%` }} />
        </div>

        {resumed && (
          <p className="mt-2 text-[12px] text-terra">已恢复上次未完成的作答，从断点继续。</p>
        )}

        {curSubject && item ? (
          <>
            <div className="mt-6 flex items-center gap-2">
              <span className="rounded-lg bg-brand px-3 py-1 text-[13px] font-bold text-cream">{curSubject}</span>
              <span className="text-[12.5px] text-olive-mute">
                第 {subjectIdx + 1} 科 / 9 · 本科第 {curIdx + 1} 题 / {bank[curSubject].length}
              </span>
              <span
                className="ml-auto rounded-full px-2.5 py-0.5 text-[11px] font-semibold text-white"
                style={{ background: dimColor }}
              >
                {dimLabel}
              </span>
            </div>
            <p className="mt-5 min-h-[72px] text-[16.5px] font-medium leading-relaxed text-olive">{item.text}</p>
            <div className="mt-5 space-y-2">
              {SUBJECT4D_OPTIONS.map((opt, i) => (
                <button
                  key={opt}
                  type="button"
                  onClick={() => pick(i)}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-[14.5px] transition ${
                    i === 0 || i === 1
                      ? "border-border bg-cream-card text-olive hover:border-lime hover:bg-mint-pale/60"
                      : "border-border bg-white text-olive-mute hover:border-lime hover:bg-mint-pale/40"
                  }`}
                >
                  {opt}
                </button>
              ))}
            </div>
            <div className="mt-5 flex items-center justify-between">
              <button
                type="button"
                onClick={back}
                disabled={subjectIdx === 0 && curIdx === 0}
                className="inline-flex items-center gap-1 rounded-lg px-3 py-2 text-[13px] text-olive-mute hover:text-olive disabled:opacity-30"
              >
                <ChevronLeft size={15} /> 上一题
              </button>
              <button
                type="button"
                onClick={() => {
                  clearQuizDraft(user?.id, "subject4d");
                  setAnswers({});
                }}
                className="text-[12.5px] text-olive-mute/70 underline hover:text-terra"
              >
                重新开始
              </button>
            </div>
          </>
        ) : (
          <p className="py-8 text-center text-[13px] text-olive-mute">提交中…</p>
        )}
      </div>
    </div>
  );
}
