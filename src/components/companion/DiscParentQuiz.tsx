import { useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { DISC_PARENT_V2_GROUPS, type DiscWordGroup } from "@contracts/assessments";
import { clearQuizDraft, useDraftResumed, useDraftState } from "@/lib/quizDraft";
import { useAuth } from "@/hooks/useAuth";
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
export default function DiscParentQuiz({
  onDone,
  guestCode,
}: {
  onDone: () => void;
  /** v239：家长扫码填（/p/<码>）。没有账号态，题目与提交都走公开接口，答案落到码对应的孩子名下。 */
  guestCode?: string;
}) {
  const { user } = useAuth();
  const utils = trpc.useUtils();
  const authed = trpc.assessment.questions.useQuery({ kind: "discparent" } as never, { enabled: !guestCode });
  const guest = trpc.assessment.passPaper.useQuery({ code: guestCode ?? "" }, { enabled: !!guestCode });
  const data = guestCode ? guest.data : authed.data;
  const isLoading = guestCode ? guest.isLoading : authed.isLoading;
  /* 草稿按人或按码分开：同一台手机上，爸爸填一半、妈妈接着扫码，不该看到爸爸的进度 */
  const draftId = guestCode ? `${DRAFT}.${guestCode}` : DRAFT;

  // 作答进度挂草稿：误退出/刷新后回来接着答
  const [label, setLabel] = useDraftState<string>(draftId, "label", "");
  const [customLabel, setCustomLabel] = useDraftState<string>(draftId, "customLabel", "");
  const [idx, setIdx] = useDraftState<number>(draftId, "idx", 0);
  const [most, setMost] = useDraftState<number[]>(draftId, "most", []);
  const [least, setLeast] = useDraftState<number[]>(draftId, "least", []);
  // v70：跟随 uid 重算（换号/新注册账号不再误显示"已恢复进度"）
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
      clearQuizDraft(user?.id, draftId); // 提交成功，草稿使命完成（状态保留供成功卡展示）
      void utils.assessment.latest.invalidate();
    },
  });
  const passSubmit = trpc.assessment.submitByPass.useMutation({
    onSuccess: () => clearQuizDraft(user?.id, draftId),
  });
  /* 两条路的返回形状对齐（kind + result），下面只写一次结果卡 */
  const submitData = (guestCode ? passSubmit.data : authedSubmit.data) as
    | { kind?: string; result?: { primary?: string } }
    | undefined;
  const submitted = guestCode ? passSubmit.isSuccess : authedSubmit.isSuccess;
  const submitting = guestCode ? passSubmit.isPending : authedSubmit.isPending;
  const submitFailed = guestCode ? passSubmit.isError : authedSubmit.isError;

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
    const payload = { kind: "discparent" as const, answers: { label: finalLabel, answers: { most: m, least: l } } };
    if (guestCode) passSubmit.mutate({ code: guestCode, input: payload } as never);
    else authedSubmit.mutate(payload as never);
  };

  /* v70：先清 pending 定时器再决定重挂——260ms 内取消选择不再留下"没选满却照跳"的洞。
     v71：到期复核（ref 最新数组），防御绕过 pick 的状态变化。 */
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
      if (fm[cur] == null || fl[cur] == null) return; // 到期复核：该组已被改动/清空，不跳
      if (cur + 1 < total) {
        setIdx(cur + 1);
      } else {
        /* V65：最后一组不再静默——走统一提交入口（漏组会跳过去并提示） */
        finish(fm, fl);
      }
    }, 260);
  };

  const pick = (wi: number) => {
    const next = pickDiscV2(most, least, idx, wi);
    setMost(next.most);
    setLeast(next.least);
    setResumed(false); // 已开始新作答，"已恢复进度"提示条使命完成
    advance(next.most, next.least, idx);
  };

  /* ------- 结果卡 ------- */
  if (submitted && submitData?.kind === "discparent") {
    const result = submitData.result;
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
                (guestCode ? passSubmit : authedSubmit).reset(); // 退出成功态，回到身份选择
                resetAll();
              }}
              className="rounded-xl border border-border bg-cream-card py-3 text-[15px] font-semibold text-olive transition-colors hover:border-[#E3B53A]/60"
            >
              再测一位家长
            </button>
            <button
              onClick={onDone}
              className="rounded-xl bg-brand py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
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
              className="flex-1 rounded-xl bg-brand py-2.5 text-[14px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
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
