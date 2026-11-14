/**
 * v283 家长 DISC 扫码直测（公开页 /pd，无需登录、无需邀请码）。
 *
 * 场景：机构/学校把一张固定二维码贴在门店或发给家长群，家长扫码即测——
 * 先挂在公共池（userId=0），孩子建档后由伴学师/管理员在「家长扫码」板块融合到孩子名下，
 * 融合后与孩子账号里直接填的家长 DISC 完全同权（家长报告、亲子对照自动出现）。
 *
 * 作答体验与学生端 DiscV2 一致：24 组四词强迫选择（最像 + 最不像）。
 */
import { useRef, useState } from "react";
import { Link } from "react-router";
import { trpc } from "@/providers/trpc";
import { DISC_PARENT_V2_GROUPS, type DiscResult, type DiscWordGroup } from "@contracts/assessments";
import { clearQuizDraft, useDraftResumed, useDraftState } from "@/lib/quizDraft";
import { DiscV2GroupsUI, pickDiscV2 } from "@/components/companion/DiscV2Quiz";
import StandaloneParentDiscReport from "@/components/reports/StandaloneParentDiscReport";
import { FileText, Users } from "lucide-react";

const DRAFT = "parentdisc-qr";
/** 查看钥匙：测完后存本机，家长随时点「查看我的报告」回看，无需登录。 */
const VIEWER_KEY = "sanhao.parentdisc.viewer";
const LABELS = ["爸爸", "妈妈", "爷爷", "奶奶", "其他家人"] as const;
const RESPONDENT_OF: Record<string, "dad" | "mom" | "other"> = {
  爸爸: "dad",
  妈妈: "mom",
  爷爷: "other",
  奶奶: "other",
  其他家人: "other",
};

type Stage = "identity" | "custom" | "phone" | "quiz";

export default function ParentDiscJoinPage() {
  const utils = trpc.useUtils();
  const paper = trpc.assessment.standaloneDiscPaper.useQuery();

  const [stage, setStage] = useDraftState<Stage>(DRAFT, "stage", "identity");
  const [label, setLabel] = useDraftState<string>(DRAFT, "label", "");
  const [customLabel, setCustomLabel] = useDraftState<string>(DRAFT, "customLabel", "");
  const [phone, setPhone] = useDraftState<string>(DRAFT, "phone", "");
  const [idx, setIdx] = useDraftState<number>(DRAFT, "idx", 0);
  const [most, setMost] = useDraftState<number[]>(DRAFT, "most", []);
  const [least, setLeast] = useDraftState<number[]>(DRAFT, "least", []);
  const [resumed, setResumed] = useDraftResumed(undefined, DRAFT, "most");
  const resetAll = () => {
    clearQuizDraft(undefined, DRAFT);
    setStage("identity");
    setLabel("");
    setCustomLabel("");
    setPhone("");
    setIdx(0);
    setMost([]);
    setLeast([]);
    setResumed(false);
  };

  const submit = trpc.assessment.submitStandaloneDisc.useMutation({
    onSuccess: (data) => {
      clearQuizDraft(undefined, DRAFT);
      void utils.assessment.standaloneDiscs.invalidate();
      /* 存下查看钥匙：本机随时回看；融合到孩子名下后这份数据依然有效 */
      if (data?.id && data?.viewKey) {
        try {
          window.localStorage.setItem(VIEWER_KEY, JSON.stringify({ id: data.id, viewKey: data.viewKey }));
        } catch {
          /* 隐私模式等写不进就算，报告页本身仍展示完整结果 */
        }
      }
    },
  });

  /* ------- 「查看我的报告」回看 ------- */
  const [review, setReview] = useState<{ id: number; viewKey: string } | null>(null);
  const [reviewHint, setReviewHint] = useState<string | null>(null);
  const reviewQuery = trpc.assessment.standaloneDiscReport.useQuery(
    { id: review?.id ?? 0, viewKey: review?.viewKey ?? "" },
    { enabled: !!review },
  );
  const openViewer = () => {
    setReviewHint(null);
    try {
      const raw = window.localStorage.getItem(VIEWER_KEY);
      const saved = raw ? (JSON.parse(raw) as { id?: unknown; viewKey?: unknown }) : null;
      if (saved && typeof saved.id === "number" && typeof saved.viewKey === "string") {
        setReview({ id: saved.id, viewKey: saved.viewKey });
      } else {
        setReviewHint("这台手机上还没有测评记录，先完成一次测评即可随时回看。");
      }
    } catch {
      setReviewHint("这台手机上还没有测评记录，先完成一次测评即可随时回看。");
    }
  };

  const groups: DiscWordGroup[] = paper.data?.groups ?? DISC_PARENT_V2_GROUPS;
  const total = groups.length;
  const finalLabel = label === "其他家人" ? customLabel.trim() : label;

  const firstIncomplete = (m: number[], l: number[]) => {
    for (let i = 0; i < total; i++) if (m[i] == null || l[i] == null) return i;
    return -1;
  };
  const [submitHint, setSubmitHint] = useState<string | null>(null);

  const finish = (m: number[], l: number[]) => {
    const bad = firstIncomplete(m, l);
    if (bad >= 0) {
      setIdx(bad);
      setSubmitHint(`第 ${bad + 1} 组还没选完（最像、最不像各选 1 个），已帮你跳过去`);
      return;
    }
    setSubmitHint(null);
    submit.mutate({
      respondent: RESPONDENT_OF[label] ?? "other",
      label: finalLabel,
      phone: phone.trim(),
      answers: { most: m, least: l },
    });
  };

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
      if (cur + 1 < total) setIdx(cur + 1);
      else finish(fm, fl);
    }, 260);
  };
  const pick = (wi: number) => {
    const next = pickDiscV2(most, least, idx, wi);
    setMost(next.most);
    setLeast(next.least);
    setResumed(false);
    advance(next.most, next.least, idx);
  };

  const shell = (children: React.ReactNode) => (
    <div className="min-h-screen bg-cream px-4 py-10">
      <div className="mx-auto max-w-2xl">{children}</div>
    </div>
  );

  /* ------- 回看模式：凭查看钥匙取回已测报告 ------- */
  if (review) {
    if (reviewQuery.isLoading) {
      return shell(
        <div className="paper-card flex justify-center py-14">
          <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
        </div>,
      );
    }
    if (reviewQuery.isError || !reviewQuery.data) {
      return shell(
        <div className="paper-card p-6 text-center">
          <p className="text-[14.5px] text-olive">没有找到这台手机上的测评记录，可能已过期或被清除。</p>
          <button
            onClick={() => {
              setReview(null);
              try {
                window.localStorage.removeItem(VIEWER_KEY);
              } catch {
                /* ignore */
              }
            }}
            className="mt-4 rounded-xl bg-brand px-6 py-2.5 text-[14px] font-semibold text-cream transition-colors hover:bg-lime"
          >
            返回
          </button>
        </div>,
      );
    }
    const rd = reviewQuery.data;
    return shell(
      <div className="space-y-4">
        <div className="paper-card p-4 text-center">
          <FileText className="mx-auto text-lime" size={26} />
          <p className="mono mt-2 text-[11px] tracking-wider text-olive-mute">家长 DISC 行为风格 · 我的报告</p>
          <p className="mt-1 text-[12.5px] text-olive-mute">
            测于 {rd.createdAt ? new Date(rd.createdAt).toLocaleString("zh-CN") : "-"}
          </p>
        </div>
        <StandaloneParentDiscReport label={rd.label} result={rd.result as unknown as DiscResult} />
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => {
              submit.reset();
              resetAll();
              setReview(null);
            }}
            className="rounded-xl border border-border bg-cream-card py-3 text-[15px] font-semibold text-olive transition-colors hover:border-[#E3B53A]/60"
          >
            再测一位家长
          </button>
          <Link
            to="/login"
            className="rounded-xl bg-brand py-3 text-center text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
          >
            完成，返回首页
          </Link>
        </div>
      </div>,
    );
  }

  /* ------- 结果卡：测完立即展示完整 DISC 报告 ------- */
  if (submit.isSuccess && submit.data?.kind === "discparent") {
    return shell(
      <div className="space-y-4">
        <div className="paper-card p-6 text-center">
          <Users className="mx-auto text-lime" size={30} />
          <p className="mono mt-3 text-[11px] tracking-wider text-olive-mute">家长 DISC 行为风格 · 测评完成</p>
          <p className="mx-auto mt-3 max-w-md text-[13.5px] leading-relaxed text-olive-soft">
            下面是{finalLabel}的完整测评报告。这份报告已保存在这台手机上，之后打开本页点「查看我的报告」即可随时回看。
          </p>
        </div>
        <StandaloneParentDiscReport label={finalLabel} result={submit.data.result as DiscResult} />
        <div className="grid gap-2 sm:grid-cols-2">
          <button
            onClick={() => {
              submit.reset();
              resetAll();
            }}
            className="rounded-xl border border-border bg-cream-card py-3 text-[15px] font-semibold text-olive transition-colors hover:border-[#E3B53A]/60"
          >
            再测一位家长
          </button>
          <Link
            to="/login"
            className="rounded-xl bg-brand py-3 text-center text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
          >
            完成，返回首页
          </Link>
        </div>
      </div>,
    );
  }

  /* ------- 第一步：选择家长身份 ------- */
  if (stage === "identity" || !label) {
    return shell(
      <div className="paper-card p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-olive" />
          <h1 className="text-lg font-bold text-olive">家长 DISC 行为风格测评</h1>
        </div>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-olive-soft">
          24 组家庭场景描述：每组 4 个词，选 1 个「最像我」和 1 个「最不像我」，大约 5 分钟。
          结果会并入孩子的测评档案，帮助老师给出更贴合的亲子沟通建议。多位家长可以各测一次。
        </p>
        <p className="mt-4 text-[14px] font-semibold text-olive">正在填写的是哪位家长？</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {LABELS.map((l) => (
            <button
              key={l}
              onClick={() => {
                setLabel(l);
                setStage(l === "其他家人" ? "custom" : "phone");
              }}
              className="rounded-xl border border-border bg-cream px-4 py-2.5 text-[14.5px] font-medium text-olive-soft transition-colors hover:border-olive/40 hover:text-olive"
            >
              {l}
            </button>
          ))}
        </div>
        <div className="mt-5 border-t border-border pt-4">
          <button
            onClick={openViewer}
            className="inline-flex items-center gap-1.5 rounded-xl border border-lime/50 bg-lime-pale/50 px-4 py-2 text-[13.5px] font-medium text-olive transition-colors hover:border-lime"
          >
            <FileText size={15} />
            查看我的报告（在这台手机测过就能看）
          </button>
          {reviewHint && <p className="mt-2 text-[12.5px] text-terra">{reviewHint}</p>}
        </div>
      </div>,
    );
  }

  /* ------- 「其他家人」：自定义称呼 ------- */
  if (stage === "custom" || (label === "其他家人" && !customLabel.trim())) {
    return shell(
      <div className="paper-card p-4 sm:p-6">
        <h2 className="text-lg font-bold text-olive">怎么称呼这位家人？</h2>
        <p className="mt-1 text-[13.5px] text-olive-soft">比如「外公」「姑姑」，会显示在亲子对照分析里。</p>
        <input
          value={customLabel}
          onChange={(e) => setCustomLabel(e.target.value)}
          placeholder="填写称呼（≤12 字）"
          maxLength={12}
          className="mt-3 w-full rounded-xl border border-input bg-cream px-4 py-2.5 text-[15px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25"
        />
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => {
              setStage("identity");
              setLabel("");
            }}
            className="flex-1 rounded-xl border border-border bg-cream-card py-2.5 text-[14px] text-olive-mute hover:text-olive"
          >
            返回重选
          </button>
          <button
            onClick={() => customLabel.trim() && setStage("phone")}
            disabled={!customLabel.trim()}
            className="flex-1 rounded-xl bg-brand py-2.5 text-[14px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
          >
            下一步 →
          </button>
        </div>
      </div>,
    );
  }

  /* ------- 第二步：手机号（可选）+ 开始 ------- */
  if (stage === "phone") {
    return shell(
      <div className="paper-card p-4 sm:p-6">
        <h2 className="text-lg font-bold text-olive">{finalLabel} · 开始前</h2>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-olive-soft">
          留一下手机号（选填）：孩子建档后，老师可以通过手机号把这份测评关联到孩子名下，
          并入家长报告。手机号只对机构老师可见。
        </p>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, "").slice(0, 11))}
          placeholder="手机号（选填）"
          inputMode="numeric"
          className="mt-3 w-full rounded-xl border border-input bg-cream px-4 py-2.5 text-[15px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25"
        />
        {phone && phone.length !== 11 && <p className="mt-1 text-[12px] text-terra">手机号是 11 位数字</p>}
        <div className="mt-4 flex gap-2">
          <button
            onClick={() => setStage(label === "其他家人" ? "custom" : "identity")}
            className="flex-1 rounded-xl border border-border bg-cream-card py-2.5 text-[14px] text-olive-mute hover:text-olive"
          >
            返回
          </button>
          <button
            onClick={() => setStage("quiz")}
            disabled={!!phone && phone.length !== 11}
            className="flex-1 rounded-xl bg-brand py-2.5 text-[14px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
          >
            开始测评 →
          </button>
        </div>
      </div>,
    );
  }

  /* ------- 作答中 ------- */
  return (
    <div className="min-h-screen bg-cream px-4 py-6">
      <div className="mx-auto max-w-2xl">
        <div className="paper-card p-4 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-olive">家长 DISC · {finalLabel}</h2>
              <p className="mt-0.5 text-[13px] text-olive-soft">
                24 组家庭场景描述：请站在「{finalLabel}」在家庭中的真实状态，选最像与最不像。
              </p>
            </div>
            <button onClick={resetAll} className="shrink-0 text-[13px] text-olive-mute hover:text-olive">
              重新开始
            </button>
          </div>

          {resumed && (
            <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-lime/50 bg-lime-pale/60 px-3 py-2">
              <span className="text-[12.5px] text-olive">已恢复上次进度（第 {idx + 1} 组），接着答就好。</span>
              <button onClick={resetAll} className="shrink-0 text-[12px] text-olive-mute underline hover:text-olive">
                清空重来
              </button>
            </div>
          )}

          {paper.isLoading ? (
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
          {submit.isError && (
            <p className="mt-2 text-[12.5px] text-terra">
              {submit.error instanceof Error ? submit.error.message : "提交失败，请检查网络后重试"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
