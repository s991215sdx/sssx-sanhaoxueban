import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { DISC_PARENT_V2_GROUPS, type DiscWordGroup } from "@contracts/assessments";
import { clearQuizDraft, loadQuizDraft, useDraftState } from "@/lib/quizDraft";
import { DiscV2GroupsUI, pickDiscV2 } from "@/components/companion/DiscV2Quiz";
import { Users } from "lucide-react";

/** 家长 DISC（家庭版）V2 作答草稿 key。 */
const DRAFT = "discparentv2";

const LABELS = ["爸爸", "妈妈", "爷爷", "奶奶", "其他家人"] as const;

/**
 * 家长 DISC 家庭版 V2（强迫选择）：24 组家庭/亲子视角描述词，每组选「最像我」+「最不像我」，
 * 维度映射与学生版逐组一致（scoreDiscV2 计分），保证亲子对照同尺可比。
 * 开始前先选家长身份（多位家长可各测一次，结果与孩子校园 DISC 做冲突对照分析）。
 */
export default function DiscParentQuiz({ onDone }: { onDone: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.assessment.questions.useQuery({ kind: "discparent" } as never);

  // 作答进度挂草稿：误退出/刷新后回来接着答
  const [label, setLabel] = useDraftState<string>(DRAFT, "label", "");
  const [customLabel, setCustomLabel] = useDraftState<string>(DRAFT, "customLabel", "");
  const [idx, setIdx] = useDraftState<number>(DRAFT, "idx", 0);
  const [most, setMost] = useDraftState<number[]>(DRAFT, "most", []);
  const [least, setLeast] = useDraftState<number[]>(DRAFT, "least", []);
  const [resumed, setResumed] = useState(
    () => ((loadQuizDraft(DRAFT)?.most as unknown[] | undefined)?.length ?? 0) > 0,
  );
  const resetAll = () => {
    clearQuizDraft(DRAFT);
    setLabel("");
    setCustomLabel("");
    setIdx(0);
    setMost([]);
    setLeast([]);
    setResumed(false);
  };

  const submit = trpc.assessment.submit.useMutation({
    onSuccess: () => {
      clearQuizDraft(DRAFT); // 提交成功，草稿使命完成（状态保留供成功卡展示）
      void utils.assessment.latest.invalidate();
    },
  });

  const groups: DiscWordGroup[] =
    (data as { groups?: DiscWordGroup[] } | undefined)?.groups ?? DISC_PARENT_V2_GROUPS;
  const total = groups.length;

  /** 最终称呼：预设身份或「其他家人」的自定义称呼（≤12 字）。 */
  const finalLabel = label === "其他家人" ? customLabel.trim() : label;

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
    submit.mutate({ kind: "discparent", answers: { label: finalLabel, answers: { most: m, least: l } } } as never);
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

  const pick = (wi: number) => {
    const next = pickDiscV2(most, least, idx, wi);
    setMost(next.most);
    setLeast(next.least);
    advance(next.most, next.least, idx);
  };

  /* ------- 结果卡 ------- */
  if (submit.isSuccess && (submit.data as { kind?: string }).kind === "discparent") {
    const result = (submit.data as { result?: { primary?: string } }).result;
    return (
      <div className="mx-auto max-w-3xl">
        <div className="paper-card p-6 text-center">
          <Users className="mx-auto text-lime" size={30} />
          <p className="mono mt-3 text-[11px] tracking-wider text-olive-mute">家长 DISC（家庭版）· 结果</p>
          <div className="mt-2 text-3xl font-bold tracking-wide text-olive">
            {label}（家长）的 DISC：{result?.primary ?? "-"} 型
          </div>
          <p className="mx-auto mt-4 max-w-md text-[14px] leading-relaxed text-olive-soft">
            可在测评中心再测另一位家长，或到报告页查看亲子对照分析——多位家长的结果会放在一起和孩子的校园 DISC 对照。
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            <button
              onClick={() => {
                submit.reset(); // 退出成功态，回到身份选择
                resetAll();
              }}
              className="rounded-xl border border-border bg-cream-card py-3 text-[15px] font-semibold text-olive transition-colors hover:border-lime/60"
            >
              再测一位家长
            </button>
            <button
              onClick={onDone}
              className="rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
            >
              完成，返回测评中心
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ------- 第一步：选择家长身份 ------- */
  if (!label) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="paper-card p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-olive" />
            <h2 className="text-lg font-bold text-olive">家长 DISC（家庭版）· 24 组最像 / 最不像</h2>
          </div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-olive-soft">
            这份是家长在家庭环境中的行为风格测评：每组 4 个描述，选 1 个「最像我」和 1 个「最不像我」。
            多位家长可以各测一次，测过的会放在一起和孩子对照分析。
          </p>
          <p className="mt-4 text-[14px] font-semibold text-olive">正在填写的是哪位家长？</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {LABELS.map((l) => (
              <button
                key={l}
                onClick={() => setLabel(l)}
                className="rounded-xl border border-border bg-cream px-4 py-2.5 text-[14.5px] font-medium text-olive-soft transition-colors hover:border-olive/40 hover:text-olive"
              >
                {l}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  /* ------- 「其他家人」：先填自定义称呼 ------- */
  if (label === "其他家人" && !customLabel.trim()) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="paper-card p-4 sm:p-6">
          <h2 className="text-lg font-bold text-olive">怎么称呼这位家人？</h2>
          <p className="mt-1 text-[13.5px] text-olive-soft">比如「外公」「姑姑」「姐姐」，会显示在亲子对照分析里。</p>
          <input
            value={customLabel}
            onChange={(e) => setCustomLabel(e.target.value)}
            placeholder="填写称呼（≤12 字）"
            maxLength={12}
            className="mt-3 w-full rounded-xl border border-input bg-cream px-4 py-2.5 text-[15px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25"
          />
          <div className="mt-4 flex gap-2">
            <button
              onClick={() => setLabel("")}
              className="flex-1 rounded-xl border border-border bg-cream-card py-2.5 text-[14px] text-olive-mute hover:text-olive"
            >
              返回重选
            </button>
            <button
              disabled={!customLabel.trim()}
              className="flex-1 rounded-xl bg-olive py-2.5 text-[14px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
            >
              开始测评 →
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ------- 作答中（逐组最像/最不像） ------- */
  return (
    <div className="mx-auto max-w-3xl">
      <div className="paper-card p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-olive">家长 DISC（家庭版）· {finalLabel}</h2>
            <p className="mt-0.5 text-[13px] text-olive-soft">
              24 组家庭场景描述：请站在「{finalLabel}」在家庭中的真实状态，选最像与最不像。
            </p>
          </div>
          <button onClick={onDone} className="shrink-0 text-[13px] text-olive-mute hover:text-olive">
            先跳过这测
          </button>
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
