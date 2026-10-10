import { clearQuizDraft, useDraftResumed, useDraftState } from "@/lib/quizDraft";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import {
  SUBJECT_ORDER,
  SUBJECT_STAGE_LABEL,
  type SubjectAssessmentResult,
  type SubjectName,
} from "@contracts/subjectAssessment";
import { BookOpenCheck, ChevronLeft, GraduationCap } from "lucide-react";

const OPTIONS = ["完全做不到", "很少做到", "有时做到", "基本做到", "完全做到"] as const;

/** 学科能力测评（V78 · 选做）：先选科，再逐题自评每科「听懂/记住/运用」学习环节达成度。 */
export default function SubjectQuiz({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.assessment.questions.useQuery({ kind: "subject" });
  const [picked, setPicked] = useDraftState<SubjectName[]>("subject", "picked", []);
  const [answers, setAnswers] = useDraftState<Record<string, number[]>>("subject", "answers", {});
  const [resumed, setResumed] = useDraftResumed(user?.id, "subject", "answers");
  const resetAll = () => {
    clearQuizDraft(user?.id, "subject");
    setPicked([]);
    setAnswers({});
    setResumed(false);
  };

  const submit = trpc.assessment.submit.useMutation({
    onSuccess: () => {
      clearQuizDraft(user?.id, "subject");
      utils.assessment.latest.invalidate();
    },
  });

  const bank = data?.kind === "subject" ? data.bank : undefined;
  const pickedValid = picked.filter((s) => bank?.[s]);

  /* 当前位置：第一个未答完的科目；科内题号 = 已答题数 */
  const curSubject = pickedValid.find((s) => (answers[s]?.length ?? 0) < (bank?.[s]?.length ?? 0));
  const curIdx = curSubject ? (answers[curSubject]?.length ?? 0) : 0;
  const totalAll = pickedValid.reduce((n, s) => n + (bank?.[s]?.length ?? 0), 0);
  const doneAll = pickedValid.reduce((n, s) => n + (answers[s]?.length ?? 0), 0);

  const pick = (value: number) => {
    if (!curSubject) return;
    const next = { ...answers, [curSubject]: [...(answers[curSubject] ?? []), value] };
    setAnswers(next);
    setResumed(false);
    const finished =
      pickedValid.every((s) => (next[s]?.length ?? 0) === (bank?.[s]?.length ?? 0)) && pickedValid.length > 0;
    if (finished) {
      const payload = Object.fromEntries(pickedValid.map((s) => [s, next[s]!]));
      submit.mutate({ kind: "subject", answers: payload } as never);
    }
  };

  const back = () => {
    if (!curSubject) return;
    const arr = [...(answers[curSubject] ?? [])];
    if (arr.length > 0) {
      arr.pop();
      setAnswers({ ...answers, [curSubject]: arr });
      return;
    }
    // 本科未答：退回上一科最后一题
    const si = pickedValid.indexOf(curSubject);
    if (si > 0) {
      const prev = pickedValid[si - 1];
      const prevArr = [...(answers[prev] ?? [])];
      prevArr.pop();
      setAnswers({ ...answers, [prev]: prevArr });
    }
  };

  /* ------- 结果卡 ------- */
  if (submit.isSuccess && submit.data?.kind === "subject") {
    const result = submit.data.result as SubjectAssessmentResult;
    return (
      <div className="paper-card p-6 text-center">
        <BookOpenCheck className="mx-auto text-lime" size={30} />
        <p className="mono mt-3 text-[11px] tracking-wider text-olive-mute">学科能力测评 · 结果</p>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {result.subjects.map((s) => (
            <span key={s.name} className="rounded-full border border-lime/50 bg-lime-pale/60 px-2.5 py-0.5 text-[12px] font-semibold text-olive">
              {s.name} {s.overall} · {s.grade}
            </span>
          ))}
        </div>
        <p className="mx-auto mt-4 max-w-lg text-[13.5px] leading-relaxed text-olive-soft">{result.summary}</p>
        <div className="mx-auto mt-4 max-w-md space-y-2 text-left">
          {result.subjects.map((s) => (
            <div key={s.name} className="rounded-xl bg-cream px-3 py-2">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-olive">{s.name}</span>
                <span className="text-[11.5px] text-olive-mute">
                  综合 {s.overall}/5 · 短板「{s.stages.find((x) => x.stage === s.weakest)?.stage ?? s.weakest}」
                </span>
              </div>
              <div className="mt-1.5 space-y-1">
                {s.stages.map((st) => (
                  <div key={st.stage} className="flex items-center gap-2">
                    <span className="w-14 shrink-0 text-[11.5px] text-olive-soft">{st.stage}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-deep">
                      <div
                        className={`h-full rounded-full ${st.avg < 2.5 ? "bg-terra" : st.avg < 3.5 ? "bg-[#f2a65a]" : "bg-lime"}`}
                        style={{ width: `${(st.avg / 5) * 100}%` }}
                      />
                    </div>
                    <span className="mono w-7 text-right text-[11.5px] text-olive">{st.avg}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => {
              /* v81：再测其他科——清空本次选择回到选科，不强制返回测评中心 */
              resetAll();
              submit.reset();
            }}
            className="flex-1 rounded-xl border border-lime/60 bg-lime-pale py-3 text-[14px] font-semibold text-olive hover:bg-lime/20"
          >
            再测其他科
          </button>
          <button
            onClick={onDone}
            className="flex-1 rounded-xl border border-border bg-cream-card py-3 text-[14px] font-semibold text-olive-soft hover:bg-lime-pale"
          >
            返回测评中心
          </button>
          <button
            onClick={() => navigate("/report-detail?tab=subject")}
            className="flex-1 rounded-xl bg-olive py-3 text-[14px] font-semibold text-cream transition-colors hover:bg-lime"
          >
            查看报告 →
          </button>
        </div>
        <p className="mt-3 text-center text-[12px] text-olive-mute">
          再测的科目会与已测结果合并进同一份报告；重复测同一科以最新一次为准。
        </p>
      </div>
    );
  }

  /* ------- 选科 ------- */
  if (!curSubject && pickedValid.length === 0) {
    return (
      <div className="paper-card p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-olive">学科能力测评（选做）</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-olive-soft">
              按「听懂 → 记住 → 运用」三个学习环节，自评每科日常学习行为的达成度（1-5 级）。先选要测的学科，建议选当前在读的主要科目；每科 13-25 题约 3 分钟，可一次测几科。
            </p>
          </div>
          <button onClick={onDone} className="shrink-0 text-[13px] text-olive-mute hover:text-olive">
            先不测了
          </button>
        </div>
        {resumed && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-lime/50 bg-lime-pale/60 px-3 py-2">
            <span className="text-[12.5px] text-olive">检测到上次未完成的作答。</span>
            <button onClick={resetAll} className="shrink-0 text-[12px] text-olive-mute underline hover:text-olive">
              清空重来
            </button>
          </div>
        )}
        {isLoading || !bank ? (
          <div className="flex justify-center py-14">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
          </div>
        ) : (
          <>
            <div className="mt-5 grid grid-cols-3 gap-2.5">
              {SUBJECT_ORDER.map((s) => {
                const on = picked.includes(s);
                return (
                  <button
                    key={s}
                    onClick={() => setPicked((p) => (on ? p.filter((x) => x !== s) : [...p, s]))}
                    className={`rounded-xl border px-2 py-3 text-center transition-colors ${
                      on
                        ? "border-lime bg-lime-pale font-bold text-olive"
                        : "border-border bg-cream text-olive-soft hover:border-lime/60"
                    }`}
                  >
                    <div className="text-[14.5px]">{s}</div>
                    <div className="mono mt-0.5 text-[10.5px] text-olive-mute">{bank[s].length} 题</div>
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPicked([...pickedValid])}
              disabled={picked.length === 0}
              className="mt-5 w-full rounded-xl bg-olive py-3.5 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
            >
              开始测评（已选 {picked.length} 科）
            </button>
          </>
        )}
      </div>
    );
  }

  /* ------- 作答中 ------- */
  const q = curSubject ? bank?.[curSubject]?.[Math.min(curIdx, (bank?.[curSubject]?.length ?? 1) - 1)] : undefined;
  return (
    <div className="paper-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-olive">学科能力测评 · {curSubject}</h2>
          <p className="mt-0.5 text-[12.5px] text-olive-soft">
            {q ? SUBJECT_STAGE_LABEL[q.stage] : ""} · 按平时真实做到的程度选
          </p>
        </div>
        <button onClick={onDone} className="shrink-0 text-[13px] text-olive-mute hover:text-olive">
          先不测了
        </button>
      </div>

      {isLoading || !q ? (
        <div className="flex justify-center py-14">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="mt-5 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-deep">
              <div
                className="h-full rounded-full bg-lime transition-all"
                style={{ width: `${totalAll > 0 ? (doneAll / totalAll) * 100 : 0}%` }}
              />
            </div>
            <span className="mono shrink-0 text-[12px] text-olive-mute">
              {curSubject} {curIdx + 1} / {curSubject ? (bank?.[curSubject]?.length ?? 0) : 0}
            </span>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5 text-[11px] text-olive-mute">
            <GraduationCap size={13} />
            {q.behavior && <span className="rounded-full bg-cream px-2 py-px">{q.behavior}</span>}
            {q.task && <span className="rounded-full bg-cream px-2 py-px">{q.task}</span>}
            <span className="rounded-full bg-cream px-2 py-px">目标 {q.level} 阶</span>
          </div>

          <p className="mt-3 text-center text-[16.5px] font-medium leading-relaxed text-olive">{q.point}</p>

          <div className="mt-5 grid gap-2.5">
            {OPTIONS.map((opt, i) => (
              <button
                key={opt}
                disabled={submit.isPending}
                onClick={() => pick(i + 1)}
                className="rounded-xl border border-border bg-cream px-4 py-3 text-center text-[14.5px] leading-relaxed text-olive-soft transition-colors hover:border-lime/60 hover:bg-lime-pale/50"
              >
                {opt}
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <button
              onClick={back}
              disabled={doneAll === 0}
              className="flex items-center gap-1 text-[13.5px] text-olive-mute hover:text-olive disabled:opacity-40"
            >
              <ChevronLeft size={15} />
              上一题
            </button>
            <span className="text-[12.5px] text-olive-mute">凭平时真实情况选，没有对错</span>
          </div>

          {submit.isPending && <p className="mt-3 text-center text-[13px] text-olive-mute">正在生成你的学科画像…</p>}
          {submit.isError && <p className="mt-3 text-center text-[13px] text-terra">提交没成功，请再选一次最后一条。</p>}
        </>
      )}
    </div>
  );
}
