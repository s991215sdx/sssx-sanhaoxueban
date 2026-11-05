/**
 * 家庭教育测评 · 一套组件两种卷（v236）
 *
 * 学生卷（familystudent，10 题）：台阶五级 → 怎么看父母三题 → 安全感两题。
 * 家长卷（familyparent，55 题 + 24 组 DISC）：家庭支持 → 条件观察 → 认知对照 → 台阶 → 管教 → 投入 → 自身 → 冲突场景 → DISC。
 *
 * 三件事在这个文件里一次解决：
 *
 * 1. **选项集不一**。学生卷是五点量表 + 一道 0—10 打分；家长卷还有六频率（含「不了解」）、
 *    四档经济、五档时间。全部折成 `Step.opts` 一种结构渲染，不再为每种量表写一遍 UI。
 *
 * 2. **条件域不重问**。学生卷里那六道条件题（FC01—FC06）在 E3 学习力诊断里已经问过。
 *    做过 V3.7 的孩子，这里直接跳过不派发；没做过的才补答，答完按 srcNo 回写，将来做诊断时也不重复问。
 *
 * 3. **不贴类型名**。结果卡只报「断/勉强/通/稳」与两个管教分，家长卷不写「专制型」这类标签——
 *    标签一贴上去，家长第一反应是辩解，不是改。
 *
 * v238：同一个组件也多跑一种「家长扫孩子的码」的情况。家长没有账号，题目走公开接口、
 * 提交带码落到孩子名下；其余（题型、跳题、结果卡）完全一致，不做第二套。
 */
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { clearQuizDraft, useDraftResumed, useDraftState } from "@/lib/quizDraft";
import { useScrollToQuestion } from "@/lib/quizScroll";
import { nextOpenIndex } from "@/lib/quizFlow";
import { ChevronLeft, Users, MessageSquare } from "lucide-react";
import FamilyCodeCard from "./FamilyCodeCard";
import { type FamilyStudentProfile } from "@contracts/familyStudent";
import { type FamilyParentProfile } from "@contracts/familyParent";
import { FAMILY_SCENE_KEYS, FP5, FP6, type ParentItem, type StudentRelItem, type ParentPaper, type StudentRelPaper } from "@contracts/familyFullPaper";

type Kind = "familystudent" | "familyparent";

/** 家长卷填卷人。服务端同样只认这三个值（submit 与 submitFamilyParent 的 zod 一致）。 */
export type ParentRespondent = "dad" | "mom" | "other";

type Opt = { value: number; label: string };

type Step = {
  /** 包内编号（FS01 / FC01 / AP01 …），提交时按前缀分流成 items 与 condition。 */
  id: string;
  text: string;
  /** 五点 / 六频率 / 四档 / 五档选项；场景题与 0—10 打分题不用这个。 */
  opts?: Opt[];
  /** 0—10 打分题。 */
  rating?: boolean;
  /** 场景单选：选项值是场景 key（phone / homework …），不是分数。 */
  scene?: { key: string; label: string }[];
  /** DISC 词组：一组四个词，先点「最像」再点「最不像」。 */
  disc?: { gi: number; words: string[] };
};

/** 台阶五级各自问的是什么，结果卡里要写清，不然「L3 勉强」没人看得懂。 */
const LADDER_MEANING: Record<string, string> = {
  L1: "遇到麻烦，第一个找爸妈",
  L2: "心里的事，愿意说",
  L3: "吵完还能开口",
  L4: "规矩可以商量",
  L5: "自己的事自己定",
};

const BAND_STYLE: Record<string, { bg: string; fg: string }> = {
  断: { bg: "rgba(178,90,60,.12)", fg: "#9E4A2C" },
  勉强: { bg: "rgba(199,127,42,.14)", fg: "#8A5A16" },
  通: { bg: "rgba(120,150,60,.16)", fg: "#5C7024" },
  稳: { bg: "rgba(12,112,100,.14)", fg: "#0C7064" },
  未测: { bg: "#F1F2ED", fg: "#8A8F78" },
};

function toOpts(labels: readonly string[], startAt = 1): Opt[] {
  return labels.map((label, i) => ({ value: i + startAt, label }));
}

export default function FamilyQuiz({
  kind,
  onDone,
  guestCode,
}: {
  kind: Kind;
  /**
   * 家长卷会把「刚填的是哪位」一并带出：扫码页要靠它当场标出自己那份已提交，
   * 否则 refetch 回来之前，家长刚交完就看到自己那格还是「还没填」。
   */
  onDone: (respondent?: ParentRespondent) => void;
  /** v238：家长扫孩子的码时不登录，题目与提交都走公开接口，答案落到码对应的孩子名下。 */
  guestCode?: string;
}) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const isGuest = !!guestCode;

  const { data: selfPaper, isLoading: selfLoading } = trpc.assessment.questions.useQuery(
    { kind } as never,
    { enabled: !isGuest },
  );
  const { data: guestPaper, isLoading: guestLoading } = trpc.assessment.familyParentPaper.useQuery(
    undefined,
    { enabled: isGuest },
  );
  const data = isGuest ? guestPaper : selfPaper;
  const isLoading = isGuest ? guestLoading : selfLoading;

  /* 家长卷先确定填卷人：报告称谓、「谁说的」都要用 */
  const LABELS: { label: string; respondent: "dad" | "mom" | "other" }[] = [
    { label: "爸爸", respondent: "dad" },
    { label: "妈妈", respondent: "mom" },
    { label: "其他家人", respondent: "other" },
  ];
  /* 扫码填的草稿按码分开存：同一部手机先后给两个孩子填，进度不会串 */
  const draftKind = isGuest ? `${kind}.guest.${guestCode}` : kind;
  const [who, setWho] = useDraftState<{ label: string; respondent: "dad" | "mom" | "other" } | null>(
    draftKind,
    "who",
    null,
  );

  const [idx, setIdx] = useDraftState<number>(draftKind, "idx", 0);
  const [vals, setVals] = useDraftState<Record<string, number>>(draftKind, "vals", {});
  const [scene, setScene] = useDraftState<string | null>(draftKind, "scene", null);
  /* DISC：每组选一个「最像」+ 一个「最不像」，两组数组分开存，草稿也一起留着 */
  const [discMost, setDiscMost] = useDraftState<Record<number, number>>(draftKind, "dmost", {});
  const [discLeast, setDiscLeast] = useDraftState<Record<number, number>>(draftKind, "dleast", {});
  const [resumed, setResumed] = useDraftResumed(user?.id, draftKind, "vals");


  const steps = useMemo<Step[]>(() => {
    if (!data) return [];
    /* v250：完整家长卷 55 题 + 24 组 DISC；孩子那一份是关系卷 10 题（孩子的 DISC 走既有 disc 入口） */
    const paper = data as unknown as ParentPaper | StudentRelPaper;
    if (paper.version !== "v250") return [];
    const itemSteps: Step[] = paper.items.map((raw) => {
      if ("kind" in raw) {
        const q = raw as ParentItem;
        if (q.kind === "scene") {
          return {
            id: q.id,
            text: q.text,
            scene: (q.options ?? []).map((label, i) => ({ key: FAMILY_SCENE_KEYS[i] ?? String(i), label })),
          };
        }
        if (q.kind === "scale5") return { id: q.id, text: q.text, opts: toOpts(FP5) };
        if (q.kind === "mirror") return { id: q.id, text: q.text, opts: toOpts(FP6, 0) };
        return { id: q.id, text: q.text, opts: toOpts(q.options ?? []) };
      }
      const q = raw as StudentRelItem;
      return { id: q.id, text: q.text, opts: toOpts(FP5) };
    });
    const discSteps: Step[] = (paper.disc ?? []).map((g, gi) => ({
      id: `DISC${String(gi + 1).padStart(2, "0")}`,
      text: "",
      disc: { gi, words: g.words },
    }));
    return [...itemSteps, ...discSteps];
  }, [data]);

  const total = steps.length;
  const sceneStepId = steps.find((s) => s.scene)?.id ?? null;

  const submit = trpc.assessment.submit.useMutation({
    onSuccess: () => {
      clearQuizDraft(user?.id, kind);
      void utils.assessment.latest.invalidate();
      void utils.assessment.family.invalidate();
    },
  });

  /* 家长扫码那条路：没有登录态，改走公开的 submitFamilyParent，答案落到码对应的孩子名下 */
  const submitGuest = trpc.assessment.submitFamilyParent.useMutation({
    onSuccess: () => clearQuizDraft(user?.id, draftKind),
  });

  const done = isGuest ? submitGuest.isSuccess : submit.isSuccess;
  const pending = isGuest ? submitGuest.isPending : submit.isPending;
  const error = isGuest ? submitGuest.error : submit.error;

  const resetAll = () => {
    clearQuizDraft(user?.id, draftKind);
    setWho(null);
    setIdx(0);
    setVals({});
    setScene(null);
    setResumed(false);
  };

  const answered = (s: Step) =>
    s.disc ? discMost[s.disc.gi] != null && discLeast[s.disc.gi] != null : s.scene ? scene != null : vals[s.id] !== undefined;

  /**
   * 提交。
   *
   * 必须由调用方把「刚点的这一题」一起传进来：setState 是异步的，点完最后一题马上读
   * vals/scene 读到的还是上一帧，会把最后一题丢掉、或者判定成「还没答」卡在原题上。
   */
  const submitAll = (allVals: Record<string, number>, allScene: string | null) => {
    const items: Record<string, number> = {};
    const condition: Record<string, number> = {};
    for (const s of steps) {
      if (s.scene) continue;
      const v = allVals[s.id];
      if (v === undefined) continue;
      if (s.id.startsWith("FC")) condition[s.id] = v;
      else items[s.id] = v;
    }
    /* DISC 24 组：只交完整答完的；缺组由后端按长度校验兜住 */
    const disc = (data as ParentPaper | StudentRelPaper | undefined)?.disc
      ? {
          most: ((data as ParentPaper).disc ?? []).map((_, gi) => discMost[gi] ?? 0),
          least: ((data as ParentPaper).disc ?? []).map((_, gi) => discLeast[gi] ?? 1),
        }
      : undefined;
    if (kind === "familystudent") {
      submit.mutate({
        kind: "familystudent",
        answers: { pack: "standard", items, scene: allScene, condition, disc },
      } as never);
    } else if (isGuest) {
      submitGuest.mutate({
        code: guestCode!,
        answers: {
          pack: "standard",
          respondent: who?.respondent ?? "other",
          label: who?.label ?? "家长",
          items,
          scene: allScene,
          disc,
        },
      });
    } else {
      submit.mutate({
        kind: "familyparent",
        answers: {
          pack: "standard",
          respondent: who?.respondent ?? "other",
          label: who?.label ?? "家长",
          items,
          scene: allScene,
          disc,
        },
      } as never);
    }
  };

  const pick = (s: Step, value: number | string) => {
    const isScene = !!s.scene;
    const nextVals = isScene ? vals : { ...vals, [s.id]: Number(value) };
    const nextScene = isScene ? String(value) : scene;
    if (isScene) setScene(nextScene);
    else setVals(nextVals);
    setResumed(false);

    const isDone = (st: Step) =>
      st.id === s.id ? true : st.scene ? nextScene != null : nextVals[st.id] !== undefined;
    const cur = steps.findIndex((st) => st.id === s.id);
    const next = nextOpenIndex(total, cur + 1, (i) => isDone(steps[i]));
    if (next < 0) submitAll(nextVals, nextScene);
    else setIdx(next);
  };

  /** DISC 一组两击：第一击记「最像」，第二击记「最不像」；点回同一个词视为取消。 */
  const pickDisc = (gi: number, wi: number) => {
    const most = { ...discMost };
    const least = { ...discLeast };
    if (most[gi] == null) {
      most[gi] = wi;
      if (least[gi] === wi) delete least[gi];
    } else if (most[gi] === wi) {
      delete most[gi];
    } else {
      if (least[gi] === wi) delete least[gi];
      else least[gi] = wi;
    }
    setDiscMost(most);
    setDiscLeast(least);
    setResumed(false);
    if (most[gi] == null || least[gi] == null) return;
    const cur = steps.findIndex((st) => st.disc?.gi === gi);
    const isDone = (st: Step) =>
      st.disc ? (st.disc.gi === gi ? true : most[st.disc.gi] != null && least[st.disc.gi] != null)
        : st.scene ? scene != null : vals[st.id] !== undefined;
    const next = nextOpenIndex(total, cur + 1, (i) => isDone(steps[i]));
    if (next < 0) submitAll(vals, scene);
    else setIdx(next);
  };

  const qRef = useScrollToQuestion(`${idx}-${total}`);

  /* ---------------- 结果卡 ---------------- */
  if (done) {
    const payload = (isGuest ? submitGuest.data : submit.data) as { result?: unknown } | undefined;
    const r = payload?.result;
    return (
      <div className="mx-auto max-w-3xl">
        <div className="paper-card p-6">
          {kind === "familystudent" ? (
            <StudentResult r={r as FamilyStudentProfile} onDone={onDone} onReport={() => navigate("/report-detail?tab=family")} />
          ) : (
            <ParentResult
              r={r as FamilyParentProfile}
              who={who?.label ?? "家长"}
              respondent={who?.respondent ?? "other"}
              onDone={onDone}
              guest={isGuest}
            />
          )}
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="paper-card flex justify-center p-14">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
      </div>
    );
  }

  /* ---------------- 家长卷：先选填卷人 ---------------- */
  if (kind === "familyparent" && !who) {
    return (
      <div className="mx-auto max-w-3xl">
        <div className="paper-card p-4 sm:p-6">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-olive" />
            <h2 className="text-lg font-bold text-olive">家长卷 · 家庭关系与管教方式</h2>
          </div>
          <p className="mt-1.5 text-[13.5px] leading-relaxed text-olive-soft">
            这一份由家长本人填写：55 道题 + 24 组性格词，约 12 分钟，全部是选择，没有对错。后半段是 DISC——
            四组词里点「最像」和「最不像」，它决定报告第 5 页能不能画出「你是 D、他是 S」那张对照。
            孩子那份做完之后，系统会把「你以为的」和「他实际答的」放在一起对照——不是为了评判谁，
            是为了找出哪几件事你们理解得不一样。
          </p>
          <p className="mt-4 text-[14px] font-semibold text-olive">正在填写的是哪位家长？</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {LABELS.map((l) => (
              <button
                key={l.label}
                onClick={() => setWho(l)}
                className="rounded-xl border border-border bg-cream px-4 py-2.5 text-[14.5px] font-medium text-olive-soft transition-colors hover:border-olive/40 hover:text-olive"
              >
                {l.label}
              </button>
            ))}
          </div>
          <p className="mt-4 text-[12px] leading-relaxed text-olive-mute">
            爸爸、妈妈可以各填一份，各自的答案分开存、标着是谁填的。
          </p>
        </div>
      </div>
    );
  }

  /* ---------------- 作答中 ---------------- */
  const q = steps[Math.min(idx, total - 1)];
  const n = steps.filter(answered).length;
  /* 场景题与量表题的选项统一成 {key,label}：场景的 key 是 phone/score 这类，量表的 key 是分值。 */
  const choices: { key: string; label: string }[] = q.scene
    ? q.scene
    : (q.opts ?? []).map((o) => ({ key: String(o.value), label: o.label }));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="paper-card p-4 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-olive">
              {kind === "familystudent" ? "家庭关系测评 · 学生卷" : `家庭关系测评 · 家长卷（${who?.label}）`}
            </h2>
            <p className="mt-0.5 text-[13px] text-olive-soft">
              {kind === "familystudent"
                ? `${steps.filter((x) => !x.disc).length} 道题约 4 分钟`
                : `${steps.filter((x) => !x.disc).length} 道题 + ${steps.filter((x) => x.disc).length} 组性格词，约 12 分钟`} · 没有对错，按真实情况选
            </p>
          </div>
          <button onClick={() => onDone()} className="shrink-0 text-[13px] text-olive-mute hover:text-olive">
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

        <div ref={qRef} className="scroll-mt-24">
          <div className="mt-5 flex items-center gap-3">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-cream-deep">
              <div className="h-full rounded-full bg-lime transition-all" style={{ width: `${(n / total) * 100}%` }} />
            </div>
            <span className="mono shrink-0 text-[12px] text-olive-mute">
              {n} / {total}
            </span>
          </div>

          <p className="mt-4 text-center text-[16.5px] font-medium leading-relaxed text-olive">{q.text}</p>
          {q.rating && (
            <p className="mt-1 text-center text-[12px] text-olive-mute">0 分是一点也不合格，10 分是满分父母</p>
          )}

          {q.disc ? (
            <div className="mt-4">
              <p className="text-center text-[12.5px] text-olive-mute">
                这一组四个词里，先点<b className="text-olive">最像他</b>的一个，再点<b className="text-olive">最不像他</b>的一个
              </p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                {q.disc.words.map((w, wi) => {
                  const isMost = discMost[q.disc!.gi] === wi;
                  const isLeast = discLeast[q.disc!.gi] === wi;
                  return (
                    <button
                      key={`${q.id}-${wi}`}
                      disabled={pending}
                      onClick={() => pickDisc(q.disc!.gi, wi)}
                      className={`relative rounded-xl border px-4 py-3 text-left text-[14.5px] leading-relaxed transition-colors ${
                        isMost
                          ? "border-lime bg-lime-pale font-medium text-olive"
                          : isLeast
                            ? "border-[#D9A3A3] bg-[#FDF1F1] text-[#8E4040]"
                            : "border-border bg-cream text-olive-soft hover:border-[#E3B53A]/60 hover:bg-butter-pale/60"
                      }`}
                    >
                      {w}
                      {(isMost || isLeast) && (
                        <span className="ml-2 rounded-full bg-white/70 px-1.5 py-0.5 text-[11px] font-semibold">
                          {isMost ? "最像" : "最不像"}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          ) : q.rating ? (
            <div className="mx-auto mt-4 grid max-w-md grid-cols-6 gap-2">
              {Array.from({ length: 11 }, (_, v) => v).map((v) => (
                <button
                  key={v}
                  disabled={pending}
                  onClick={() => pick(q, v)}
                  className={`rounded-xl border py-2.5 text-[14.5px] font-semibold transition-colors ${
                    vals[q.id] === v
                      ? "border-lime bg-lime-pale text-olive"
                      : "border-border bg-cream text-olive-soft hover:border-[#E3B53A]/60 hover:bg-butter-pale/60"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-5 grid gap-2.5">
              {choices.map((c, i) => {
                const on = q.scene ? scene === c.key : vals[q.id] === Number(c.key);
                return (
                  <button
                    key={`${q.id}-${i}`}
                    disabled={pending}
                    onClick={() => pick(q, c.key)}
                    className={`rounded-xl border px-4 py-3 text-left text-[14.5px] leading-relaxed transition-colors ${
                      on
                        ? "border-lime bg-lime-pale font-medium text-olive"
                        : "border-border bg-cream text-olive-soft hover:border-[#E3B53A]/60 hover:bg-butter-pale/60"
                    }`}
                  >
                    {c.label}
                  </button>
                );
              })}
            </div>
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
            <span className="text-[12.5px] text-olive-mute">
              第 {Math.min(idx + 1, total)} / {total} 题
            </span>
          </div>

          {pending && <p className="mt-3 text-center text-[13px] text-olive-mute">正在提交…</p>}
          {error && (
            <p className="mt-3 text-center text-[13px] text-terra">{error.message ?? "提交没成功，请再点一次最后一题的选项。"}</p>
          )}
        </div>
      </div>

      {/* 场景题：把「只能选一件」说清楚，别让人想多选 */}
      {sceneStepId === q.id && (
        <p className="mt-2 text-center text-[12px] text-olive-mute">只选一件最常吵的——选不出来时，想上一次真的吵起来是什么事。</p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 结果卡                                                              */
/* ------------------------------------------------------------------ */

function Band({ band }: { band: string }) {
  const s = BAND_STYLE[band] ?? BAND_STYLE.未测;
  return (
    <span className="rounded-full px-2 py-0.5 text-[11.5px] font-semibold" style={{ background: s.bg, color: s.fg }}>
      {band}
    </span>
  );
}

function StudentResult({
  r,
  onDone,
  onReport,
}: {
  r: FamilyStudentProfile;
  onDone: () => void;
  onReport: () => void;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <MessageSquare size={18} className="text-olive" />
        <h2 className="text-lg font-bold text-olive">学生卷已提交</h2>
      </div>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-olive-soft">
        这五级是「你和爸妈之间的路通不通」，不是给你打分。断了的那一级，说明那件事你不再指望他们——
        报告里会讲怎么把那一级接回来。
      </p>

      <div className="mt-4 space-y-1.5">
        {r.ladder.map((l) => (
          <div key={l.level} className="flex items-center gap-2.5 rounded-xl bg-cream px-3 py-2">
            <span className="mono w-7 shrink-0 text-[11.5px] text-olive-mute">{l.level}</span>
            <span className="min-w-0 flex-1 text-[13px] text-olive">{LADDER_MEANING[l.level] ?? ""}</span>
            <Band band={l.band} />
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-cream px-3 py-2.5 text-center">
          <div className="text-[11.5px] text-olive-mute">怎么看爸妈</div>
          <div className="mt-0.5 text-[15px] font-bold text-olive">{r.parentView.band}</div>
        </div>
        <div className="rounded-xl bg-cream px-3 py-2.5 text-center">
          <div className="text-[11.5px] text-olive-mute">怕他们担心</div>
          <div className="mt-0.5 text-[15px] font-bold text-olive">{r.security.needConfirm}</div>
        </div>
        <div className="rounded-xl bg-cream px-3 py-2.5 text-center">
          <div className="text-[11.5px] text-olive-mute">难受时躲起来</div>
          <div className="mt-0.5 text-[15px] font-bold text-olive">{r.security.fearProbe}</div>
        </div>
      </div>

      <p className="mt-4 rounded-xl border border-dashed border-olive/20 bg-cream/60 px-3 py-2.5 text-[12.5px] leading-relaxed text-olive-mute">
        接下来请爸妈完成《家长卷》。两边都答完，报告里才会出现「你以为的 vs 他实际答的」对照——
        盲区通常就出在这六项里。
      </p>

      {/* v238：答完当场把码给出去——不然学生还得自己回测评中心找，多数就断了 */}
      <div className="mt-3">
        <FamilyCodeCard compact />
      </div>

      <div className="mt-5 flex gap-3">
        <button
          onClick={onReport}
          className="flex-1 rounded-xl border border-lime/60 bg-lime-pale py-3 text-[14px] font-semibold text-olive hover:bg-butter/25"
        >
          去看家庭报告
        </button>
        <button onClick={onDone} className="flex-1 rounded-xl bg-brand py-3 text-[14px] font-semibold text-cream hover:bg-lime">
          完成，返回
        </button>
      </div>
    </>
  );
}

function ParentResult({
  r,
  who,
  respondent,
  onDone,
  guest,
}: {
  r: FamilyParentProfile;
  who: string;
  /** 交给调用方：扫码页据此立刻把「自己那一格」标成已填 */
  respondent: ParentRespondent;
  onDone: (respondent?: ParentRespondent) => void;
  /** 扫码填的家长：没有账号，答案已落到孩子名下，不需要再做什么 */
  guest?: boolean;
}) {
  return (
    <>
      <div className="flex items-center gap-2">
        <Users size={18} className="text-olive" />
        <h2 className="text-lg font-bold text-olive">{who}的家长卷已提交</h2>
      </div>
      <p className="mt-1.5 text-[13.5px] leading-relaxed text-olive-soft">
        下面两个分不是给家长打分，是看清自己「要求」和「回应」的配比——同一个人可以要求很高，也可以回应很足。
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-cream px-3 py-3 text-center">
          <div className="text-[11.5px] text-olive-mute">要求（管得紧不紧）</div>
          <div className="mt-0.5 text-[20px] font-bold text-olive">{r.style.demand.toFixed(2)}</div>
          <div className="text-[11px] text-olive-mute">满分 5</div>
        </div>
        <div className="rounded-xl bg-cream px-3 py-3 text-center">
          <div className="text-[11.5px] text-olive-mute">回应（听得进不听进）</div>
          <div className="mt-0.5 text-[20px] font-bold text-olive">{r.style.warmth.toFixed(2)}</div>
          <div className="text-[11px] text-olive-mute">满分 5</div>
        </div>
      </div>

      <p className="mt-3 rounded-xl border border-[#E3B53A]/40 bg-butter-pale/50 px-3 py-2.5 text-[13px] leading-relaxed text-olive">
        {r.style.note}
      </p>

      <p className="mt-4 rounded-xl border border-dashed border-olive/20 bg-cream/60 px-3 py-2.5 text-[12.5px] leading-relaxed text-olive-mute">
        {guest
          ? "答案已经交到孩子的账号里了，不需要再做什么。另一位家长可以扫同一张码接着填，各自的答案分开存，报告里标着是谁填的。"
          : "孩子那份答完之后，报告会告诉你：你以为他怎么看你们，和他实际答的，差在哪几项。"}
      </p>

      <button onClick={() => onDone(respondent)} className="mt-5 w-full rounded-xl bg-brand py-3 text-[14px] font-semibold text-cream hover:bg-lime">
        {guest ? "完成" : "完成，返回"}
      </button>
    </>
  );
}
