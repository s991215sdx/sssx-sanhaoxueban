import { useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  DISC_NEW_GROUPS,
  DISC_NEW_SCENES,
  DISC_NEW_TYPE_NAMES,
  type DiscNewGroup,
} from "@contracts/discNew";
import { clearQuizDraft, useDraftResumed, useDraftState } from "@/lib/quizDraft";
import { useAuth } from "@/hooks/useAuth";
import { DiscV2GroupsUI, pickDiscV2 } from "@/components/companion/DiscV2Quiz";
import { Compass, Users } from "lucide-react";

/**
 * v247 DISC（学生版新 / 家长版新）：24 组四词迫选（复刻版题库），
 * 与旧版 disc/discparent 并存互不影响。学生版单份最新，家长版可多人各填一份。
 * 场景文案（校园/家庭）由 variant 决定；作答 UI 复用 DiscV2GroupsUI。
 */

export type DiscNewVariant = "student" | "parent";

const LABELS = ["爸爸", "妈妈", "爷爷", "奶奶", "其他家人"] as const;

export default function DiscNewQuiz({
  variant,
  onDone,
  guestCode,
}: {
  variant: DiscNewVariant;
  onDone: () => void;
  /** v247：家长扫码填（/p/<码>），无账号态，提交走公开接口落到码对应的孩子名下。 */
  guestCode?: string;
}) {
  const kind = variant === "student" ? "discnew" : "discparentnew";
  const scene = DISC_NEW_SCENES[variant === "student" ? "campus" : "family"];
  const DRAFT = variant === "student" ? "discnew" : "discparentnew";

  const { user } = useAuth();
  const utils = trpc.useUtils();
  const authed = trpc.assessment.questions.useQuery({ kind } as never, { enabled: !guestCode });
  const guest = trpc.assessment.passPaper.useQuery({ code: guestCode ?? "" }, { enabled: !!guestCode });
  const data = guestCode ? guest.data : authed.data;
  const isLoading = guestCode ? guest.isLoading : authed.isLoading;
  const draftId = guestCode ? `${DRAFT}.${guestCode}` : DRAFT;

  const [label, setLabel] = useDraftState<string>(draftId, "label", "");
  const [customLabel, setCustomLabel] = useDraftState<string>(draftId, "customLabel", "");
  const [idx, setIdx] = useDraftState<number>(draftId, "idx", 0);
  const [most, setMost] = useDraftState<number[]>(draftId, "most", []);
  const [least, setLeast] = useDraftState<number[]>(draftId, "least", []);
  const [resumed, setResumed] = useDraftResumed(user?.id, draftId, "most");
  const resetAll = () => {
    clearQuizDraft(user?.id, draftId);
    setLabel("");
    setCustomLabel("");
    setIdx(0);
    setMost([]);
    setLeast([]);
    setResumed(false);
  };

  const authedSubmit = trpc.assessment.submit.useMutation({
    onSuccess: () => {
      clearQuizDraft(user?.id, draftId);
      void utils.assessment.latest.invalidate();
    },
  });
  const passSubmit = trpc.assessment.submitByPass.useMutation({
    onSuccess: () => clearQuizDraft(user?.id, draftId),
  });
  const submitData = (guestCode ? passSubmit.data : authedSubmit.data) as
    | { kind?: string; result?: { primary?: string; typeName?: string } }
    | undefined;
  const submitted = guestCode ? passSubmit.isSuccess : authedSubmit.isSuccess;
  const submitting = guestCode ? passSubmit.isPending : authedSubmit.isPending;
  const submitFailed = guestCode ? passSubmit.isError : authedSubmit.isError;

  const groups: { words: { t: string }[] }[] =
    (data as { groups?: DiscNewGroup[] } | undefined)?.groups ?? DISC_NEW_GROUPS;
  const total = groups.length;
  const finalLabel = label === "其他家人" ? customLabel.trim() : label;

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
    const payload =
      variant === "student"
        ? { kind: "discnew" as const, answers: { most: m, least: l } }
        : { kind: "discparentnew" as const, answers: { label: finalLabel, most: m, least: l } };
    if (guestCode) passSubmit.mutate({ code: guestCode, input: payload } as never);
    else authedSubmit.mutate(payload as never);
  };

  /* v70/v71 同款：清 pending 定时器 + 到期复核，防"没选满却照跳"的洞 */
  const mostRef = useRef(most);
  mostRef.current = most;
  const leastRef = useRef(least);
  leastRef.current = least;
  const advanceTimer = useRef<number | null>(null);
  const advance = (m: number[], l: number[], cur: number) => {
    if (advanceTimer.current) window.clearTimeout(advanceTimer.current);
    if (m[cur] == null || l[cur] == null) return;
    advanceTimer.current = window.setTimeout(() => {
      advanceTimer.current = null;
      const fm = mostRef.current;
      const fl = leastRef.current;
      if (fm[cur] == null || fl[cur] == null) return;
      if (cur + 1 < total) {
        setIdx(cur + 1);
      } else {
        finish(fm, fl);
      }
    }, 260);
  };

  const pick = (wi: number) => {
    const next = pickDiscV2(most, least, idx, wi);
    setMost(next.most);
    setLeast(next.least);
    setResumed(false);
    advance(next.most, next.least, idx);
  };

  /* ------- 结果卡 ------- */
  if (submitted && submitData?.kind === kind) {
    const result = submitData.result;
    const typeName = result?.typeName ?? DISC_NEW_TYPE_NAMES[result?.primary ?? ""] ?? "";
    const isParent = variant === "parent";
    return (
      <div className="mx-auto max-w-3xl">
        <div className="paper-card p-6 text-center">
          {isParent ? <Users className="mx-auto text-lime" size={30} /> : <Compass className="mx-auto text-lime" size={30} />}
          <p className="mono mt-3 text-[11px] tracking-wider text-olive-mute">
            {scene.reportTitle.replace(/\n/g, "")} · 结果
          </p>
          <div className="mt-2 text-3xl font-bold tracking-wide text-olive">
            {isParent ? `${finalLabel}（家长）的 DISC：` : "你的 DISC："}
            {result?.primary ?? "-"} 型{typeName ? `（${typeName}）` : ""}
          </div>
          <p className="mx-auto mt-4 max-w-md text-[14px] leading-relaxed text-olive-soft">
            {isParent
              ? "可在测评中心再测另一位家长，或到报告页查看完整「三个我」报告——真实的我、场景中的我、压力下的我。"
              : "报告已生成：真实的我、场景中的我、压力下的我，以及行为特征词与相处建议。"}
          </p>
          <div className="mt-6 grid gap-2 sm:grid-cols-2">
            {isParent && (
              <button
                onClick={() => {
                  (guestCode ? passSubmit : authedSubmit).reset();
                  resetAll();
                }}
                className="rounded-xl border border-border bg-cream-card py-3 text-[15px] font-semibold text-olive transition-colors hover:border-[#E3B53A]/60"
              >
                再测一位家长
              </button>
            )}
            <button
              onClick={onDone}
              className={`rounded-xl bg-brand py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime ${isParent ? "" : "sm:col-span-2"}`}
            >
              完成，查看报告 →
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ------- 家长版第一步：选择身份 ------- */
  if (variant === "parent" && !label) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="paper-card p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-olive" />
            <h2 className="text-lg font-bold text-olive">DISC（家长版新）· 24 组最像 / 最不像</h2>
          </div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-olive-soft">
            这份是家长在家庭环境中的行为风格测评（新版题库）：每组 4 个描述词，选 1 个「最像我」和 1
            个「最不像我」。多位家长可以各测一次，报告会呈现「真实的我 / 家庭中的我 / 压力下的我」。
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

  /* ------- 家长版「其他家人」：自定义称呼 ------- */
  if (variant === "parent" && label === "其他家人" && !customLabel.trim()) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="paper-card p-4 sm:p-6">
          <h2 className="text-lg font-bold text-olive">怎么称呼这位家人？</h2>
          <p className="mt-1 text-[13.5px] text-olive-soft">比如「外公」「姑姑」「姐姐」，会显示在报告里。</p>
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
              className="flex-1 rounded-xl bg-brand py-2.5 text-[14px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
            >
              开始测评 →
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* ------- 作答中 ------- */
  return (
    <div className="mx-auto max-w-3xl">
      <div className="paper-card p-4 sm:p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-olive">
              {variant === "parent" ? `DISC（家长版新）· ${finalLabel}` : "DISC（学生版新）"}
            </h2>
            <p className="mt-0.5 text-[13px] text-olive-soft">
              {variant === "parent"
                ? `24 组描述词：请站在「${finalLabel}」在家庭中的真实状态，选最像与最不像。`
                : `24 组描述词：${scene.tip}，凭第一反应选最像与最不像。`}
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
            groups={groups as never}
            idx={idx}
            most={most}
            least={least}
            onPick={pick}
            onPrev={() => {
              setSubmitHint(null);
              setIdx((i) => Math.max(0, i - 1));
            }}
            pending={submitting}
            error={submitFailed}
            showSubmit={idx === total - 1}
            onSubmit={() => finish(most, least)}
            submitPending={submitting}
            submitHint={submitHint}
          />
        )}
      </div>
    </div>
  );
}
