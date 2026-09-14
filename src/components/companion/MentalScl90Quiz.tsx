/**
 * 心理健康深度评估（选做）：SCL-90 症状自评量表（90 题 · 10 因子 · 5 级评分）。
 * 国际应用最广泛的心理症状自评量表，中国常模筛选口径（总分>160 / 阳性项目>43 /
 * 任一因子均分>2），原版标准译本一字未改；第 15 题（想结束自己的生命）为安全
 * 风险题，选「很轻」及以上（≥2）触发红线。适用 16 岁以上，约 15—20 分钟。
 * 分页作答：每页 10 题 × 9 页；草稿可恢复。
 */
import { useState } from "react";
import { clearQuizDraft, loadQuizDraft, useDraftState } from "@/lib/quizDraft";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import {
  SCL90_QUESTIONS,
  SCL90_OPTIONS,
  SCL90_FACTOR_LABEL,
  SCL90_FACTOR_ORDER,
  MENTAL_SCL90_DISCLAIMER,
  MENTAL_SCL90_QUESTION_COUNT,
  MENTAL_SCL90_AGE,
} from "@contracts/mentalHealth";
import type { Scl90Result, MentalV2Band } from "@contracts/mentalHealth";
import { AlertTriangle, PhoneCall, Stethoscope, ChevronLeft, ChevronRight } from "lucide-react";

const LEVEL_STYLE: Record<MentalV2Band, string> = {
  良好: "border-lime/50 bg-lime-pale text-olive",
  关注: "border-butter bg-butter/25 text-olive",
  预警: "border-terra/50 bg-terra/10 text-terra",
  高风险: "border-terra bg-terra/15 text-terra",
};

const FACTOR_LEVEL_STYLE: Record<string, string> = {
  正常: "text-[#5a9326]",
  轻度: "text-[#8a6d1a]",
  中度: "text-[#b45309]",
  偏重: "text-[#8f1313]",
  严重: "text-[#8f1313]",
};

const PAGE_SIZE = 10;
const PAGE_COUNT = Math.ceil(MENTAL_SCL90_QUESTION_COUNT / PAGE_SIZE);

export default function MentalScl90Quiz({ onDone }: { onDone: () => void }) {
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.assessment.questions.useQuery({ kind: "scl90" });

  /* 草稿校验：题数越界或分值越界直接清草稿从头开始。 */
  const [draftValid] = useState(() => {
    const d = loadQuizDraft("scl90");
    if (!d) return true;
    const a = d.answers as unknown[] | undefined;
    const bad =
      Array.isArray(a) &&
      (a.length > MENTAL_SCL90_QUESTION_COUNT ||
        a.some((v) => v != null && (!Number.isInteger(v) || (v as number) < 1 || (v as number) > 5)));
    if (bad) {
      clearQuizDraft("scl90");
      return false;
    }
    return true;
  });

  const [answers, setAnswers] = useDraftState<(number | null)[]>("scl90", "answers", []);
  const [resumed] = useState(() => draftValid && ((loadQuizDraft("scl90")?.answers as unknown[] | undefined)?.length ?? 0) > 0);
  const [page, setPage] = useState(() => {
    const d = loadQuizDraft("scl90");
    const a = (d?.answers as unknown[] | undefined) ?? [];
    const firstUnanswered = a.findIndex((v) => v == null);
    const p = firstUnanswered === -1 ? 0 : Math.floor(firstUnanswered / PAGE_SIZE);
    return draftValid ? Math.min(p, PAGE_COUNT - 1) : 0;
  });

  const submit = trpc.assessment.submit.useMutation({
    onSuccess: () => {
      clearQuizDraft("scl90");
      utils.assessment.latest.invalidate();
    },
  });

  const items =
    data?.kind === "scl90" && Array.isArray(data.questions) && data.questions.length > 0
      ? (data.questions as typeof SCL90_QUESTIONS)
      : SCL90_QUESTIONS;
  const intro = data?.kind === "scl90" && typeof data.intro === "string" ? data.intro : null;

  const answeredCount = answers.filter((v) => v != null).length;
  const pageStart = page * PAGE_SIZE;
  const pageItems = items.slice(pageStart, pageStart + PAGE_SIZE);
  const pageAnswered = answers.slice(pageStart, pageStart + PAGE_SIZE).filter((v) => v != null).length;

  const setAnswer = (no: number, value: number) => {
    const next = [...answers];
    next[no - 1] = value;
    setAnswers(next);
  };

  const canSubmit = answeredCount === MENTAL_SCL90_QUESTION_COUNT;

  /* ------- 结果卡 ------- */
  if (submit.isSuccess && submit.data?.kind === "scl90") {
    const result = submit.data.result as Scl90Result;
    return (
      <div className="paper-card p-6 text-center">
        <Stethoscope className="mx-auto text-lime" size={30} />
        <p className="mono mt-3 text-[11px] tracking-wider text-olive-mute">心理健康深度评估 · SCL-90 症状自评量表 · 结果</p>
        <div className={`mx-auto mt-3 inline-block rounded-full border px-4 py-1.5 text-[14px] font-bold ${LEVEL_STYLE[result.level]}`}>
          综合状态：{result.level}{result.screeningPositive && result.level === "预警" ? "（筛选阳性）" : ""}
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-cream px-2 py-2.5">
            <div className="text-[11.5px] text-olive-mute">总分</div>
            <div className="mt-0.5 text-[18px] font-bold text-olive">
              {result.total}
              <span className="text-[12px] font-normal text-olive-mute">/450</span>
            </div>
            <div className="text-[10.5px] text-olive-mute">阳性线 &gt;160</div>
          </div>
          <div className="rounded-xl bg-cream px-2 py-2.5">
            <div className="text-[11.5px] text-olive-mute">阳性项目</div>
            <div className="mt-0.5 text-[18px] font-bold text-olive">
              {result.positiveCount}
              <span className="text-[12px] font-normal text-olive-mute">/90</span>
            </div>
            <div className="text-[10.5px] text-olive-mute">阳性线 &gt;43 项</div>
          </div>
          <div className="rounded-xl bg-cream px-2 py-2.5">
            <div className="text-[11.5px] text-olive-mute">总均分</div>
            <div className="mt-0.5 text-[18px] font-bold text-olive">{result.gsi}</div>
            <div className="text-[10.5px] text-olive-mute">1—5 级</div>
          </div>
        </div>
        <div className="mt-3 overflow-hidden rounded-xl border border-border text-left">
          <div className="grid grid-cols-[1fr_auto_auto] gap-x-3 bg-cream-deep/60 px-3 py-1.5 text-[11px] font-semibold text-olive-mute">
            <span>因子（10 项）</span>
            <span className="w-12 text-right">均分</span>
            <span className="w-12 text-right">程度</span>
          </div>
          {SCL90_FACTOR_ORDER.map((k) => (
            <div key={k} className="grid grid-cols-[1fr_auto_auto] gap-x-3 border-t border-border/60 px-3 py-1.5 text-[12.5px]">
              <span className="text-olive-soft">{SCL90_FACTOR_LABEL[k]}</span>
              <span className="mono w-12 text-right text-olive">{result.factors[k].toFixed(2)}</span>
              <span className={`w-12 text-right font-semibold ${FACTOR_LEVEL_STYLE[result.factorLevels[k]]}`}>{result.factorLevels[k]}</span>
            </div>
          ))}
        </div>
        {result.selfHarm && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-terra/60 bg-terra/10 p-3.5 text-left">
            <PhoneCall size={16} className="mt-0.5 shrink-0 text-terra" />
            <p className="text-[12.5px] leading-relaxed text-terra">
              你在第 15 题「想结束自己的生命」上的选择需要被认真对待：请尽快告诉家长或信任的老师你的感受，必要时拨打全国心理援助热线 12356，或前往专业心理/医疗机构。你不需要一个人扛。
            </p>
          </div>
        )}
        <p className="mt-3 text-[13.5px] leading-relaxed text-olive-soft">{result.summary}</p>
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-butter bg-butter/20 p-3.5 text-left">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-terra" />
          <p className="text-[12px] leading-relaxed text-olive-soft">{MENTAL_SCL90_DISCLAIMER}</p>
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
            查看完整评估报告 →
          </button>
        </div>
      </div>
    );
  }

  /* ------- 作答中（分页） ------- */
  return (
    <div className="paper-card p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-olive">心理健康深度评估 · SCL-90 症状自评量表</h2>
          <p className="mt-0.5 text-[13px] text-olive-soft">
            国际通用筛查工具（原版标准 90 题）· {MENTAL_SCL90_AGE} · 已答 {answeredCount}/90
          </p>
        </div>
        <button onClick={onDone} className="shrink-0 text-[13px] text-olive-mute hover:text-olive">
          先不测了
        </button>
      </div>

      {resumed && answeredCount > 0 && answeredCount < MENTAL_SCL90_QUESTION_COUNT && (
        <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-lime/50 bg-lime-pale/60 px-3 py-2">
          <span className="text-[12.5px] text-olive">已恢复上次进度，从第 {page * PAGE_SIZE + 1} 题继续。</span>
          <button
            onClick={() => {
              clearQuizDraft("scl90");
              setAnswers([]);
              setPage(0);
            }}
            className="shrink-0 text-[12px] text-olive-mute underline hover:text-olive"
          >
            重新开始
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-14">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        </div>
      ) : (
        <>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-deep">
              <div
                className="h-full rounded-full bg-lime transition-all"
                style={{ width: `${((page + 1) / PAGE_COUNT) * 100}%` }}
              />
            </div>
            <span className="mono shrink-0 text-[12px] text-olive-mute">
              第 {page + 1} / {PAGE_COUNT} 页
            </span>
          </div>

          {page === 0 && intro && (
            <div className="mt-4 rounded-xl border border-lime/40 bg-lime-pale/50 px-3.5 py-2.5">
              <p className="text-[12.5px] leading-relaxed text-olive-soft">{intro}</p>
            </div>
          )}

          <div className="mt-4 space-y-3">
            {pageItems.map((q) => (
              <div key={q.no} className={`rounded-xl border px-3.5 py-3 ${q.safety ? "border-terra/50 bg-terra/5" : "border-border bg-cream/50"}`}>
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[14px] font-medium leading-relaxed text-olive">
                    <span className="mono mr-1.5 text-[12px] text-olive-mute">{q.no}.</span>
                    {q.text}
                  </p>
                </div>
                <div className="mt-2 grid grid-cols-5 gap-1.5">
                  {SCL90_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      disabled={submit.isPending}
                      onClick={() => setAnswer(q.no, opt.value)}
                      className={`rounded-lg border px-1 py-1.5 text-[11.5px] leading-tight transition-colors ${
                        answers[q.no - 1] === opt.value
                          ? q.safety
                            ? "border-terra bg-terra/15 font-semibold text-terra"
                            : "border-lime bg-lime-pale font-semibold text-olive"
                          : "border-border bg-cream text-olive-soft hover:border-lime/60"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {q.safety && (
                  <p className="mt-2 rounded-lg bg-terra/10 px-2.5 py-1.5 text-[11.5px] leading-relaxed text-terra">
                    这一题是关于生命安全的——无论其他题目答得如何，这一题选了「很轻」或以上，都请务必告诉家长或信任的老师。
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 text-[13.5px] text-olive-mute hover:text-olive disabled:opacity-40"
            >
              <ChevronLeft size={15} />
              上一页
            </button>
            <span className="text-[12.5px] text-olive-mute">
              本页已答 {pageAnswered}/{pageItems.length} · 凭最近一周的真实感觉作答
            </span>
            {page < PAGE_COUNT - 1 ? (
              <button
                onClick={() => {
                  if (pageAnswered < pageItems.length && !window.confirm("本页还有未作答的题，确定先翻页吗？")) return;
                  setPage((p) => Math.min(PAGE_COUNT - 1, p + 1));
                }}
                className="flex items-center gap-1 text-[13.5px] font-semibold text-olive hover:text-lime-deep"
              >
                下一页
                <ChevronRight size={15} />
              </button>
            ) : (
              <button
                onClick={() => {
                  if (!canSubmit) {
                    window.alert(`还有 ${MENTAL_SCL90_QUESTION_COUNT - answeredCount} 题未作答，答完才能生成评估报告。`);
                    return;
                  }
                  submit.mutate({ kind: "scl90", answers: answers.map((v) => v ?? 1) } as any);
                }}
                disabled={submit.isPending}
                className="flex items-center gap-1 rounded-xl bg-olive px-4 py-2 text-[13.5px] font-semibold text-cream hover:bg-lime disabled:opacity-50"
              >
                {submit.isPending ? "正在生成…" : "生成评估报告"}
                <ChevronRight size={15} />
              </button>
            )}
          </div>

          {page === PAGE_COUNT - 1 && (
            <div className="mt-4 flex items-start gap-2 rounded-xl border border-butter bg-butter/20 p-3 text-left">
              <AlertTriangle size={14} className="mt-0.5 shrink-0 text-terra" />
              <p className="text-[11.5px] leading-relaxed text-olive-soft">{MENTAL_SCL90_DISCLAIMER}</p>
            </div>
          )}
          {submit.isError && <p className="mt-3 text-center text-[13px] text-terra">提交没成功，请点「生成评估报告」重试。</p>}
        </>
      )}
    </div>
  );
}
