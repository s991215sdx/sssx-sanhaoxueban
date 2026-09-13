import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { trpc } from "@/providers/trpc";
import QuizCard, { type GradeResult } from "@/components/QuizCard";
import FeynmanChat from "@/components/FeynmanChat";
import { ArrowLeft, Check, ListChecks, AlertTriangle, Eye, EyeOff } from "lucide-react";
import type { Question } from "@db/schema";

type Step = "check" | "learn" | "practice" | "feynman" | "done";

const STEP_META: { key: Step; label: string }[] = [
  { key: "check", label: "先备检测" },
  { key: "learn", label: "精讲学习" },
  { key: "practice", label: "小试牛刀" },
  { key: "feynman", label: "讲给 AI 听" },
  { key: "done", label: "提问清单" },
];

export default function PreviewSession() {
  const { code = "" } = useParams();
  const navigate = useNavigate();
  const utils = trpc.useUtils();

  const detail = trpc.graph.detail.useQuery({ code }, { enabled: !!code });
  const [step, setStep] = useState<Step>("learn");
  const [sessionId, setSessionId] = useState<number | null>(null);
  const [checkQuestions, setCheckQuestions] = useState<Question[]>([]);
  const [prereqKps, setPrereqKps] = useState<{ id: number; code: string; title: string }[]>([]);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [checkResults, setCheckResults] = useState<GradeResult[] | null>(null);
  const [practiceQuestions, setPracticeQuestions] = useState<Question[]>([]);
  const [practiceResults, setPracticeResults] = useState<GradeResult[] | null>(null);
  const [showExampleAnswer, setShowExampleAnswer] = useState(false);
  const [finishData, setFinishData] = useState<{
    classQuestions: string[];
    stats: { prereq: { total: number; correct: number }; practice: { total: number; correct: number }; feynman: { hit: number; total: number } };
  } | null>(null);
  const startedRef = useRef(false);

  const start = trpc.preview.start.useMutation({
    onSuccess: (d) => {
      setSessionId(d.sessionId);
      setCheckQuestions(d.checkQuestions as Question[]);
      setPrereqKps(d.prereqKps);
      setStep(d.checkQuestions.length > 0 ? "check" : "learn");
    },
  });
  const submitCheck = trpc.preview.submitCheck.useMutation({
    onSuccess: (d) => setCheckResults(d.results),
  });
  const submitPractice = trpc.preview.submitPractice.useMutation({
    onSuccess: (d) => setPracticeResults(d.results),
  });
  const finish = trpc.preview.finish.useMutation({
    onSuccess: (d) => {
      setFinishData(d);
      utils.graph.overview.invalidate();
      utils.dashboard.summary.invalidate();
    },
  });

  const kp = detail.data;
  useEffect(() => {
    if (kp && kp.hasContent && !startedRef.current) {
      startedRef.current = true;
      start.mutate({ kpId: kp.id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kp?.id, kp?.hasContent]);

  const practiceQuery = trpc.preview.getPractice.useQuery(
    { sessionId: sessionId! },
    { enabled: sessionId != null && step === "practice" },
  );
  useEffect(() => {
    if (practiceQuery.data && practiceQuestions.length === 0) {
      setPracticeQuestions(practiceQuery.data as Question[]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [practiceQuery.data]);

  const resultMap = useMemo(
    () => new Map((checkResults ?? practiceResults ?? []).map((r) => [r.questionId, r])),
    [checkResults, practiceResults],
  );

  const activeQuestions = step === "check" ? checkQuestions : practiceQuestions;
  const allAnswered = activeQuestions.every((q) => (answers[q.id] ?? "").trim() !== "");
  const stepIndex = STEP_META.findIndex((s) => s.key === step);
  const checkFailedKps =
    step === "check" && checkResults
      ? prereqKps.filter((p) => checkResults.some((r) => r.kpId === p.id && !r.correct))
      : [];

  const handleSubmitQuiz = () => {
    if (!sessionId || !allAnswered) return;
    const payload = activeQuestions.map((q) => ({ questionId: q.id, given: answers[q.id] ?? "" }));
    if (step === "check") submitCheck.mutate({ sessionId, answers: payload });
    else submitPractice.mutate({ sessionId, answers: payload });
  };

  const nextStep = () => {
    setAnswers({});
    if (step === "check") setStep("learn");
    else if (step === "learn") setStep("practice");
    else if (step === "practice") setStep("feynman");
  };

  const enterDone = () => {
    if (sessionId && !finishData) finish.mutate({ sessionId });
    setStep("done");
  };

  if (detail.isLoading || !kp) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-9 w-9 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate("/preview")} className="rounded-lg p-1.5 text-olive-mute hover:bg-lime-pale hover:text-olive">
          <ArrowLeft size={20} />
        </button>
        <div>
          <div className="mono text-[11px] tracking-wider text-olive-mute">{kp.chapter}</div>
          <h1 className="text-2xl font-bold tracking-tight text-olive">{kp.title}</h1>
        </div>
      </div>

      {/* 步骤条 */}
      <div className="flex items-center">
        {STEP_META.map((s, i) => {
          const state = i < stepIndex ? "done" : i === stepIndex ? "active" : "todo";
          return (
            <div key={s.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={`mono flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold transition-colors ${
                    state === "done"
                      ? "bg-lime text-white"
                      : state === "active"
                        ? "bg-olive text-cream ring-4 ring-lime/25"
                        : "bg-secondary text-olive-mute"
                  }`}
                >
                  {state === "done" ? <Check size={15} /> : i + 1}
                </span>
                <span
                  className={`whitespace-nowrap text-[11px] ${state === "active" ? "font-semibold text-olive" : "text-olive-mute"}`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEP_META.length - 1 && (
                <div className={`mx-1 mb-5 h-0.5 flex-1 rounded ${i < stepIndex ? "bg-lime" : "bg-border"}`} />
              )}
            </div>
          );
        })}
      </div>

      {/* 步骤 1：先备检测 */}
      {step === "check" && (
        <div className="space-y-4">
          <div className="paper-card accent-l border-lime p-5">
            <h2 className="font-bold text-olive">先看看地基牢不牢</h2>
            <p className="mt-1 text-sm text-olive-soft">
              这节课要用到：{prereqKps.map((p) => `「${p.title}」`).join("、")}。
              做 {checkQuestions.length} 道小题检测一下，全对就可以放心学新内容。
            </p>
          </div>
          {checkQuestions.map((q, i) => (
            <QuizCard
              key={q.id}
              q={q}
              index={i}
              value={answers[q.id] ?? ""}
              onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
              result={checkResults ? resultMap.get(q.id) : undefined}
              kpTitle={prereqKps.find((p) => p.id === q.kpId)?.title}
            />
          ))}
          {!checkResults ? (
            <button
              onClick={handleSubmitQuiz}
              disabled={!allAnswered || submitCheck.isPending}
              className="w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
            >
              {submitCheck.isPending ? "批改中…" : "提交检测"}
            </button>
          ) : (
            <div className="space-y-3">
              {checkFailedKps.length > 0 && (
                <div className="paper-card accent-l border-terra p-5">
                  <div className="flex items-center gap-2 font-semibold text-olive">
                    <AlertTriangle size={17} className="text-terra" />
                    发现地基漏洞
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-olive-soft">
                    {checkFailedKps.map((p) => `「${p.title}」`).join("、")}
                    还不牢固，直接学新内容会吃力。建议先把漏洞补上（错题本已为你准备好入口），
                    也可以硬着头皮继续——但明天上课要重点听这部分。
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Link to="/gaps" className="rounded-xl border border-olive px-4 py-2 text-sm font-medium text-olive hover:bg-lime-pale">
                      去查漏补缺
                    </Link>
                    <button onClick={nextStep} className="rounded-xl bg-olive px-4 py-2 text-sm font-medium text-cream hover:bg-lime">
                      先继续预习
                    </button>
                  </div>
                </div>
              )}
              {checkFailedKps.length === 0 && (
                <div className="paper-card accent-l border-lime p-5">
                  <div className="flex items-center gap-2 font-semibold text-olive">
                    <Check size={17} className="text-lime" />
                    地基很牢，全对！开始今天的新内容吧。
                  </div>
                  <button onClick={nextStep} className="mt-3 rounded-xl bg-olive px-5 py-2.5 text-sm font-medium text-cream hover:bg-lime">
                    进入精讲 →
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 步骤 2：精讲学习 */}
      {step === "learn" && (
        <div className="space-y-4">
          {kp.summary.map((s, i) => (
            <div key={i} className="paper-card flex gap-4 p-5">
              <span className="mono flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lime-pale text-[14px] font-bold text-olive">
                {i + 1}
              </span>
              <div>
                <h3 className="font-bold text-olive">{s.heading}</h3>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-olive-soft">{s.body}</p>
              </div>
            </div>
          ))}

          <div className="paper-card border-butter bg-butter/25 p-5">
            <div className="mono text-[10px] tracking-wider text-olive-mute">例题</div>
            <p className="mt-2 text-[15px] font-medium leading-relaxed text-olive">{kp.example.stem}</p>
            <p className="mt-2 text-[14px] leading-relaxed text-olive-soft">
              <span className="font-semibold text-olive">分析：</span>
              {kp.example.analysis}
            </p>
            <button
              onClick={() => setShowExampleAnswer((v) => !v)}
              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-olive hover:text-lime"
            >
              {showExampleAnswer ? <EyeOff size={15} /> : <Eye size={15} />}
              {showExampleAnswer ? "收起答案" : "查看答案"}
            </button>
            {showExampleAnswer && (
              <p className="mono mt-2 rounded-lg bg-cream px-3 py-2 text-[14.5px] font-semibold text-olive">
                {kp.example.answer}
              </p>
            )}
          </div>

          <button
            onClick={nextStep}
            className="w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
          >
            我看完了，开始小试牛刀 →
          </button>
        </div>
      )}

      {/* 步骤 3：小试牛刀 */}
      {step === "practice" && (
        <div className="space-y-4">
          <div className="paper-card accent-l border-lime p-5">
            <h2 className="font-bold text-olive">不动笔，不算预习</h2>
            <p className="mt-1 text-sm text-olive-soft">做 {practiceQuestions.length} 道题试试水，做错了也没关系——错题正是明天上课要听的重点。</p>
          </div>
          {practiceQuery.isLoading && (
            <div className="flex justify-center py-10">
              <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
            </div>
          )}
          {practiceQuestions.map((q, i) => (
            <QuizCard
              key={q.id}
              q={q}
              index={i}
              value={answers[q.id] ?? ""}
              onChange={(v) => setAnswers((a) => ({ ...a, [q.id]: v }))}
              result={practiceResults ? resultMap.get(q.id) : undefined}
            />
          ))}
          {practiceQuestions.length > 0 &&
            (!practiceResults ? (
              <button
                onClick={handleSubmitQuiz}
                disabled={!allAnswered || submitPractice.isPending}
                className="w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
              >
                {submitPractice.isPending ? "批改中…" : "提交练习"}
              </button>
            ) : (
              <button
                onClick={nextStep}
                className="w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
              >
                下一步：讲给 AI 听 →
              </button>
            ))}
        </div>
      )}

      {/* 步骤 4：费曼输出 */}
      {step === "feynman" && sessionId && <FeynmanChat sessionId={sessionId} onDone={enterDone} />}

      {/* 步骤 5：课堂提问清单 */}
      {step === "done" && (
        <div className="space-y-4">
          <div className="paper-card border-butter bg-butter/30 p-6">
            <div className="flex items-center gap-2">
              <ListChecks size={19} className="text-olive" />
              <h2 className="text-lg font-bold text-olive">明天的课堂提问清单</h2>
            </div>
            <p className="mt-1 text-sm text-olive-soft">带着这些问题去上课，听课效率翻倍。可以抄在便利贴上。</p>
            <ol className="mt-4 space-y-3">
              {(finishData?.classQuestions ?? []).map((q, i) => (
                <li key={i} className="flex gap-3 rounded-xl bg-cream-card/80 p-4">
                  <span className="mono flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-olive text-[12px] font-bold text-cream">
                    {i + 1}
                  </span>
                  <span className="text-[14.5px] leading-relaxed text-olive">{q}</span>
                </li>
              ))}
            </ol>
            {finish.isPending && <p className="mt-4 text-sm text-olive-mute">正在生成…</p>}
          </div>

          {finishData && (
            <div className="paper-card p-5">
              <h3 className="font-bold text-olive">本次预习成绩单</h3>
              <div className="mt-3 grid grid-cols-3 gap-3 text-center">
                {[
                  { t: "先备检测", v: finishData.stats.prereq.total ? `${finishData.stats.prereq.correct}/${finishData.stats.prereq.total}` : "—" },
                  { t: "小试牛刀", v: `${finishData.stats.practice.correct}/${finishData.stats.practice.total}` },
                  { t: "关键点覆盖", v: `${finishData.stats.feynman.hit}/${finishData.stats.feynman.total}` },
                ].map((s) => (
                  <div key={s.t} className="rounded-xl bg-lime-pale/60 py-3">
                    <div className="mono text-xl font-bold text-olive">{s.v}</div>
                    <div className="mt-0.5 text-[11px] text-olive-mute">{s.t}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Link
            to="/preview"
            className="block w-full rounded-xl bg-olive py-3 text-center text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
          >
            完成，返回预习中心
          </Link>
        </div>
      )}
    </div>
  );
}
