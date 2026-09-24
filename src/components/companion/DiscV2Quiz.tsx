import { useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { DISC_V2_GROUPS, type DiscWordGroup } from "@contracts/assessments";
import { clearQuizDraft, loadQuizDraft, useDraftState } from "@/lib/quizDraft";
import { ChevronLeft, Compass } from "lucide-react";

/**
 * DISC V2（国际通行强迫选择格式）：24 组，每组 4 个描述词，
 * 各选 1 个「最像我」+ 1 个「最不像我」（不能是同一个词）。
 * 本文件导出通用词组作答 UI（DiscV2GroupsUI，家长版复用）与学生版完整答题组件。
 */

/** 通用：一组 4 词的「最像/最不像」选择 UI（受控，状态由父组件持有）。 */
export function DiscV2GroupsUI({
  groups,
  idx,
  most,
  least,
  onPick,
  onPrev,
  pending,
  error,
  showSubmit,
  onSubmit,
  submitPending,
  submitHint,
}: {
  groups: DiscWordGroup[];
  idx: number;
  most: number[];
  least: number[];
  onPick: (wordIdx: number) => void;
  onPrev: () => void;
  pending: boolean;
  error: boolean;
  /** 最后一组显示「完成提交」手动按钮（防止恢复进度/漏组时无法提交） */
  showSubmit?: boolean;
  onSubmit?: () => void;
  submitPending?: boolean;
  submitHint?: string | null;
}) {
  const total = groups.length;
  const g = groups[Math.min(idx, total - 1)];
  if (!g) return null;
  return (
    <>
      <div className="mt-5 flex items-center gap-3">
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-deep">
          <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${((idx + 1) / total) * 100}%` }} />
        </div>
        <span className="mono shrink-0 text-[12px] text-olive-mute">
          {idx + 1} / {total}
        </span>
      </div>

      <p className="mt-5 text-center text-[15px] leading-relaxed text-olive-soft">
        下面 4 个描述里，选 <b className="text-olive">1 个最像我</b>，再选 <b className="text-terra">1 个最不像我</b>
      </p>

      <div className="mt-4 grid gap-2.5">
        {g.words.map((w, wi) => {
          const isMost = most[idx] === wi;
          const isLeast = least[idx] === wi;
          return (
            <button
              key={wi}
              disabled={pending}
              onClick={() => onPick(wi)}
              className={`flex items-center justify-between gap-3 rounded-2xl border px-5 py-3.5 text-left text-[15px] leading-relaxed transition-colors ${
                isMost
                  ? "border-lime bg-lime-pale font-medium text-olive"
                  : isLeast
                    ? "border-terra/60 bg-terra/10 font-medium text-olive"
                    : "border-border bg-cream text-olive-soft hover:border-lime/60 hover:bg-lime-pale/50"
              }`}
            >
              <span>{w}</span>
              {isMost && (
                <span className="shrink-0 rounded-full bg-lime px-2.5 py-0.5 text-[11.5px] font-bold text-white">最像我</span>
              )}
              {isLeast && (
                <span className="shrink-0 rounded-full bg-terra px-2.5 py-0.5 text-[11.5px] font-bold text-white">最不像我</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-between">
        <button
          onClick={onPrev}
          disabled={idx === 0}
          className="flex items-center gap-1 text-[13.5px] text-olive-mute hover:text-olive disabled:opacity-40"
        >
          <ChevronLeft size={15} />
          上一组
        </button>
        <span className="text-[12.5px] text-olive-mute">凭第一反应选，没有对错</span>
      </div>

      {pending && <p className="mt-3 text-center text-[13px] text-olive-mute">正在生成结果…</p>}
      {error && <p className="mt-3 text-center text-[13px] text-terra">提交没成功，请检查每组都选了最像和最不像后再试。</p>}

      {showSubmit && (
        <button
          onClick={onSubmit}
          disabled={submitPending}
          className="mt-4 w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-50"
        >
          {submitPending ? "正在生成结果…" : "完成提交 →"}
        </button>
      )}
      {submitHint && <p className="mt-2 text-center text-[13px] text-terra">{submitHint}</p>}
    </>
  );
}

/** V2 选择逻辑：点词 → 先填「最像」槽，再填「最不像」槽；点已选的词可取消。 */
export function pickDiscV2(most: number[], least: number[], idx: number, wi: number): { most: number[]; least: number[] } {
  const m = [...most];
  const l = [...least];
  if (m[idx] === wi) {
    m[idx] = undefined as unknown as number; // 取消最像
    return { most: m, least: l };
  }
  if (l[idx] === wi) {
    l[idx] = undefined as unknown as number; // 取消最不像
    return { most: m, least: l };
  }
  if (m[idx] == null) {
    m[idx] = wi;
    return { most: m, least: l };
  }
  l[idx] = wi; // 填/改最不像
  return { most: m, least: l };
}

const DRAFT = "discv2";

/** 学生版 DISC V2：24 组强迫选择。 */
export default function DiscV2Quiz({
  title = "DISC 行为风格",
  subtitle = "24 组描述词：每组选 1 个「最像我」+ 1 个「最不像我」，找到最适合你的带动方式",
  onNext,
  onSkip,
}: {
  title?: string;
  subtitle?: string;
  onNext: () => void;
  onSkip?: () => void;
}) {
  const utils = trpc.useUtils();
  const { isLoading } = trpc.assessment.questions.useQuery({ kind: "disc" } as never);

  const [idx, setIdx] = useDraftState<number>(DRAFT, "idx", 0);
  const [most, setMost] = useDraftState<number[]>(DRAFT, "most", []);
  const [least, setLeast] = useDraftState<number[]>(DRAFT, "least", []);
  const [resumed, setResumed] = useState(
    () => ((loadQuizDraft(DRAFT)?.most as unknown[] | undefined)?.length ?? 0) > 0,
  );
  const resetAll = () => {
    clearQuizDraft(DRAFT);
    setIdx(0);
    setMost([]);
    setLeast([]);
    setResumed(false);
  };

  const submit = trpc.assessment.submit.useMutation({
    onSuccess: () => {
      clearQuizDraft(DRAFT);
      void utils.assessment.latest.invalidate();
    },
  });

  const groups = DISC_V2_GROUPS;
  const total = groups.length;

  /** 第一组未答完的组号（0 起），全部答完返回 -1 */
  const firstIncomplete = (m: number[], l: number[]) => {
    for (let i = 0; i < total; i++) if (m[i] == null || l[i] == null) return i;
    return -1;
  };

  const [submitHint, setSubmitHint] = useState<string | null>(null);

  /** 统一提交入口：全答完→提交；有漏组→跳到漏组并提示 */
  const finish = (m: number[], l: number[]) => {
    const bad = firstIncomplete(m, l);
    if (bad >= 0) {
      setIdx(bad);
      setSubmitHint(`第 ${bad + 1} 组还没选完（最像、最不像各选 1 个），已帮你跳过去`);
      return;
    }
    setSubmitHint(null);
    submit.mutate({ kind: "disc", answers: { most: m, least: l } } as never);
  };

  const advance = (m: number[], l: number[], cur: number) => {
    if (m[cur] == null || l[cur] == null) return;
    window.setTimeout(() => {
      if (cur + 1 < total) {
        setIdx(cur + 1);
      } else {
        /* V65：最后一组不再静默——走统一提交入口（漏组会跳过去并提示） */
        finish(m, l);
      }
    }, 260);
  };

  /* V65 恢复进度兜底：草稿若已全答完（上次在提交前被中断，如关掉页面），
     进入页面自动补提交一次，避免学生卡在"全选完却没有任何按钮"的第 24 组。 */
  const autoTriedRef = useRef(false);
  useEffect(() => {
    if (autoTriedRef.current) return;
    autoTriedRef.current = true;
    if (firstIncomplete(most, least) === -1 && most.length >= total) finish(most, least);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (wi: number) => {
    const next = pickDiscV2(most, least, idx, wi);
    setMost(next.most);
    setLeast(next.least);
    advance(next.most, next.least, idx);
  };

  /* ------- 结果卡 ------- */
  if (submit.isSuccess && (submit.data as { kind?: string }).kind === "disc") {
    const result = (submit.data as { result?: { primary?: string } }).result;
    return (
      <div className="mx-auto max-w-3xl">
        <div className="paper-card p-6 text-center">
          <Compass className="mx-auto text-lime" size={30} />
          <p className="mono mt-3 text-[11px] tracking-wider text-olive-mute">DISC 行为风格 · 结果</p>
          <div className="mt-2 text-3xl font-bold tracking-wide text-olive">你的 DISC：{result?.primary ?? "-"} 主导</div>
          <p className="mx-auto mt-4 max-w-md text-[14px] leading-relaxed text-olive-soft">
            新版题目（最像 / 最不像）测完啦，报告里的 DISC 分析已同步更新。
          </p>
          <button
            onClick={onNext}
            className="mt-6 w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
          >
            完成 →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="paper-card p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-olive">{title}</h2>
            <p className="mt-0.5 text-[13px] text-olive-soft">{subtitle}</p>
          </div>
          {onSkip && (
            <button onClick={onSkip} className="shrink-0 text-[13px] text-olive-mute hover:text-olive">
              先跳过这测
            </button>
          )}
        </div>

        {resumed && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-lime/50 bg-lime-pale/60 px-3 py-2">
            <span className="text-[12.5px] text-olive">已恢复上次进度（第 {idx + 1} 组），接着答就好。</span>
            <button onClick={resetAll} className="shrink-0 text-[12px] text-olive-mute underline hover:text-olive">
              重新开始
            </button>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-14">
            <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
          </div>
        ) : (
          <DiscV2GroupsUI
            groups={groups}
            idx={idx}
            most={most}
            least={least}
            onPick={pick}
            onPrev={() => {
              setSubmitHint(null);
              setIdx((i) => Math.max(0, i - 1));
            }}
            pending={submit.isPending}
            error={submit.isError}
            showSubmit={idx === total - 1}
            onSubmit={() => finish(most, least)}
            submitPending={submit.isPending}
            submitHint={submitHint}
          />
        )}
      </div>
    </div>
  );
}
