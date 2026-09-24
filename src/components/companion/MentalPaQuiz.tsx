import { useState } from "react";
import { clearQuizDraft, loadQuizDraft, useDraftState } from "@/lib/quizDraft";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import {
  MENTAL_PA_SECTIONS,
  MENTAL_V2_OPTIONS,
  MENTAL_PA_DISCLAIMER,
  MENTAL_V2_ITEM9_NOTICE,
  MENTAL_PA_QUESTION_COUNT,
} from "@contracts/mentalHealth";
import type { MentalV2Band, MentalV2Result, MentalV2Section } from "@contracts/mentalHealth";
import { ChevronLeft, HeartHandshake, AlertTriangle, PhoneCall } from "lucide-react";

const LEVEL_STYLE: Record<MentalV2Band, string> = {
  良好: "border-lime/50 bg-lime-pale text-olive",
  关注: "border-butter bg-butter/25 text-olive",
  预警: "border-terra/50 bg-terra/10 text-terra",
  高风险: "border-terra bg-terra/15 text-terra",
};

/** 展开为带分段信息的扁平题列（保持全局题号顺序）。 */
type FlatItem = { no: number; text: string; section: MentalV2Section };
const flatten = (sections: MentalV2Section[]): FlatItem[] =>
  sections.flatMap((section) => section.questions.map((q) => ({ ...q, section })));

/**
 * 心理健康筛查（选做）V2：PHQ-9（抑郁筛查 9 题）+ GAD-7（焦虑筛查 7 题），
 * 国际通用筛查量表，四级评分 0-3，两段式逐题作答。
 */
export default function MentalPaQuiz({ onDone }: { onDone: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.assessment.questions.useQuery({ kind: "mentalpa" });

  /* 旧版草稿（30 题、1-5 分）与 V2（16 题、0-3 分）不兼容：
     首个 state 初始化时校验，题数越界或分值越界直接清草稿从头开始。 */
  const [draftValid] = useState(() => {
    const d = loadQuizDraft(user?.id, "mentalpa");
    if (!d) return true;
    const a = d.answers as unknown[] | undefined;
    const i = d.idx as number | undefined;
    const bad =
      (Array.isArray(a) &&
        (a.length > MENTAL_PA_QUESTION_COUNT ||
          a.some((v) => !Number.isInteger(v) || (v as number) < 0 || (v as number) > 3))) ||
      (typeof i === "number" && i > MENTAL_PA_QUESTION_COUNT - 1);
    if (bad) {
      clearQuizDraft(user?.id, "mentalpa");
      return false;
    }
    return true;
  });

  // 作答进度挂草稿：误退出/刷新后回来接着答，不用重测
  const [idx, setIdx] = useDraftState<number>("mentalpa", "idx", 0);
  const [answers, setAnswers] = useDraftState<number[]>("mentalpa", "answers", []);
  const [resumed, setResumed] = useState(
    () => draftValid && ((loadQuizDraft(user?.id, "mentalpa")?.answers as unknown[] | undefined)?.length ?? 0) > 0,
  );
  const resetAll = () => {
    clearQuizDraft(user?.id, "mentalpa");
    setIdx(0);
    setAnswers([]);
    setResumed(false);
  };

  const submit = trpc.assessment.submit.useMutation({
    onSuccess: () => {
      clearQuizDraft(user?.id, "mentalpa"); // 提交成功，清除草稿
      utils.assessment.latest.invalidate();
    },
  });

  const sections =
    data?.kind === "mentalpa" && Array.isArray(data.sections) && data.sections.length > 0
      ? (data.sections as MentalV2Section[])
      : MENTAL_PA_SECTIONS;
  const options =
    data?.kind === "mentalpa" && Array.isArray(data.options) && data.options.length > 0
      ? (data.options as unknown as typeof MENTAL_V2_OPTIONS)
      : MENTAL_V2_OPTIONS;
  const items = flatten(sections);
  const total = items.length;

  const pick = (value: number) => {
    const next = [...answers];
    next[idx] = value;
    setAnswers(next);
    if (idx + 1 < total) {
      setIdx(idx + 1);
    } else if (next.length === total) {
      submit.mutate({ kind: "mentalpa", answers: next } as any);
    }
  };

  /* ------- 结果卡 ------- */
  if (submit.isSuccess && submit.data?.kind === "mentalpa") {
    const result = submit.data.result as unknown as MentalV2Result;
    return (
      <div className="paper-card p-6 text-center">
        <HeartHandshake className="mx-auto text-lime" size={30} />
        <p className="mono mt-3 text-[11px] tracking-wider text-olive-mute">心理健康筛查 · 学生版 B（PHQ-A + GAD-7）· 结果</p>
        <div className={`mx-auto mt-3 inline-block rounded-full border px-4 py-1.5 text-[14px] font-bold ${LEVEL_STYLE[result.level]}`}>
          综合状态：{result.level}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-cream px-2 py-2.5">
            <div className="text-[11.5px] text-olive-mute">PHQ-A 青少年抑郁筛查</div>
            <div className="mt-0.5 text-[18px] font-bold text-olive">{result.phq9}<span className="text-[12px] font-normal text-olive-mute">/27</span></div>
            <div className={`mt-0.5 text-[11.5px] ${result.phq9Level === "良好" ? "text-olive-mute" : "text-terra"}`}>{result.phq9Level}</div>
          </div>
          <div className="rounded-xl bg-cream px-2 py-2.5">
            <div className="text-[11.5px] text-olive-mute">GAD-7 焦虑筛查（标准版）</div>
            <div className="mt-0.5 text-[18px] font-bold text-olive">{result.gad7}<span className="text-[12px] font-normal text-olive-mute">/21</span></div>
            <div className={`mt-0.5 text-[11.5px] ${result.gad7Level === "良好" ? "text-olive-mute" : "text-terra"}`}>{result.gad7Level}</div>
          </div>
          <div className="rounded-xl bg-cream px-2 py-2.5">
            <div className="text-[11.5px] text-olive-mute">明显困扰项（≥2 分）</div>
            <div className="mt-0.5 text-[18px] font-bold text-olive">{result.positives}<span className="text-[12px] font-normal text-olive-mute">/16</span></div>
            <div className="mt-0.5 text-[11.5px] text-olive-mute">题</div>
          </div>
        </div>
        {result.selfHarm && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-terra/60 bg-terra/10 p-3.5 text-left">
            <PhoneCall size={16} className="mt-0.5 shrink-0 text-terra" />
            <p className="text-[12.5px] leading-relaxed text-terra">
              你在第 9 题上的选择需要被认真对待：请尽快告诉家长或信任的老师你的感受，必要时拨打全国心理援助热线 12356，或前往专业心理/医疗机构。你不需要一个人扛。
            </p>
          </div>
        )}
        <p className="mt-3 text-[13.5px] leading-relaxed text-olive-soft">{result.summary}</p>
        {/* 免责声明（必须展示） */}
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-butter bg-butter/20 p-3.5 text-left">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-terra" />
          <p className="text-[12px] leading-relaxed text-olive-soft">{MENTAL_PA_DISCLAIMER}</p>
        </div>
        <div className="mt-6 flex gap-3">
          <button
            onClick={onDone}
            className="flex-1 rounded-xl border border-lime/60 bg-lime-pale py-3 text-[14px] font-semibold text-olive hover:bg-lime/20"
          >
            返回报告
          </button>
          <button
            onClick={() => navigate("/report-detail?tab=mental")}
            className="flex-1 rounded-xl bg-olive py-3 text-[14px] font-semibold text-cream transition-colors hover:bg-lime"
          >
            查看详细报告 →
          </button>
        </div>
      </div>
    );
  }

  /* ------- 作答中 ------- */
  const q = items[Math.min(idx, total - 1)];
  const isFirstOfSection = q && q.section.questions[0]?.no === q.no;
  const isLast = idx === total - 1;
  return (
    <div className="paper-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-olive">心理健康筛查 · 学生版 B（PHQ-A + GAD-7）</h2>
          <p className="mt-0.5 text-[13px] text-olive-soft">国际通用筛查工具 · 适用 11 岁以上 · 16 题约 3 分钟 · 结果仅供筛查参考</p>
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

          {/* 分段标题与说明（进入新分段时突出显示） */}
          <div className={`mt-4 rounded-xl px-3.5 py-2.5 ${isFirstOfSection ? "border border-lime/40 bg-lime-pale/50" : "bg-cream-deep/40"}`}>
            <p className="text-[12.5px] font-semibold text-olive">{q.section.title}</p>
            {isFirstOfSection && (
              <p className="mt-0.5 text-[12px] leading-relaxed text-olive-mute">{q.section.description}</p>
            )}
            <p className="mt-1 text-[12.5px] text-olive-soft">{q.section.intro}</p>
          </div>

          <p className="mt-4 text-center text-[16.5px] font-medium leading-relaxed text-olive">{q.text}</p>

          <div className="mt-5 grid gap-2.5">
            {options.map((opt) => (
              <button
                key={opt.value}
                disabled={submit.isPending}
                onClick={() => pick(opt.value)}
                className={`rounded-xl border px-4 py-3 text-center text-[14.5px] leading-relaxed transition-colors ${
                  answers[idx] === opt.value
                    ? "border-lime bg-lime-pale font-medium text-olive"
                    : "border-border bg-cream text-olive-soft hover:border-lime/60 hover:bg-lime-pale/50"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* PHQ-9 第 9 题（自伤念头）红线提示 */}
          {q.no === 9 && (
            <p className="mt-3 rounded-lg bg-terra/10 px-3 py-2 text-[12px] leading-relaxed text-terra">
              {MENTAL_V2_ITEM9_NOTICE}
            </p>
          )}

          <div className="mt-5 flex items-center justify-between">
            <button
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              disabled={idx === 0}
              className="flex items-center gap-1 text-[13.5px] text-olive-mute hover:text-olive disabled:opacity-40"
            >
              <ChevronLeft size={15} />
              上一题
            </button>
            <span className="text-[12.5px] text-olive-mute">如实作答，结果只有你自己看到</span>
          </div>

          {/* 末尾（最后一题）展示免责声明 */}
          {isLast && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-butter bg-butter/20 p-3 text-left">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-terra" />
              <p className="text-[11.5px] leading-relaxed text-olive-soft">{MENTAL_PA_DISCLAIMER}</p>
            </div>
          )}

          {submit.isPending && <p className="mt-3 text-center text-[13px] text-olive-mute">正在生成你的结果…</p>}
          {submit.isError && <p className="mt-3 text-center text-[13px] text-terra">提交没成功，请再选一次最后一题。</p>}
        </>
      )}
    </div>
  );
}
