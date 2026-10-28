/**
 * 家庭教育测评 · 一套组件两种卷（v236）
 *
 * 学生卷（familystudent，14 题）：台阶五级 → 怎么看父母 → 安全感四题 → 冲突场景一题。
 * 家长卷（familyparent，29 题）：台阶五级 → 管教要求/回应 → 猜孩子怎么看 → 家庭投入 → 家长自身 → 冲突场景。
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
 */
import { useMemo } from "react";
import { useNavigate } from "react-router";
import { trpc } from "@/providers/trpc";
import { useAuth } from "@/hooks/useAuth";
import { clearQuizDraft, useDraftResumed, useDraftState } from "@/lib/quizDraft";
import { useScrollToQuestion } from "@/lib/quizScroll";
import { ChevronLeft, Users, MessageSquare } from "lucide-react";
import {
  FAMILY_STUDENT_P5,
  type FamilyItem,
  type FamilyConditionRef,
  type FamilyStudentProfile,
} from "@contracts/familyStudent";
import {
  FAMILY_P5,
  FAMILY_P6,
  FAMILY_P4_MONEY,
  FAMILY_P5_TIME,
  type FamilyParentItem,
  type FamilyParentProfile,
} from "@contracts/familyParent";

type Kind = "familystudent" | "familyparent";

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

export default function FamilyQuiz({ kind, onDone }: { kind: Kind; onDone: () => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.assessment.questions.useQuery({ kind } as never);
  const { data: latest } = trpc.assessment.latest.useQuery();

  /* 家长卷先确定填卷人：报告称谓、「谁说的」都要用 */
  const LABELS: { label: string; respondent: "dad" | "mom" | "other" }[] = [
    { label: "爸爸", respondent: "dad" },
    { label: "妈妈", respondent: "mom" },
    { label: "其他家人", respondent: "other" },
  ];
  const [who, setWho] = useDraftState<{ label: string; respondent: "dad" | "mom" | "other" } | null>(
    kind,
    "who",
    null,
  );

  const [idx, setIdx] = useDraftState<number>(kind, "idx", 0);
  const [vals, setVals] = useDraftState<Record<string, number>>(kind, "vals", {});
  const [scene, setScene] = useDraftState<string | null>(kind, "scene", null);
  const [resumed, setResumed] = useDraftResumed(user?.id, kind, "vals");

  /* 做过 E3 V3.7（70 题）的孩子，六道条件题不重答——服务端按题号复用那六道的分 */
  const e3Ready = useMemo(() => {
    const raw = (latest?.raw ?? []).find((r) => r.kind === "e3");
    const a = raw?.answers as { ratings?: number[] } | undefined;
    return Array.isArray(a?.ratings) && a.ratings.length === 70;
  }, [latest]);

  const steps = useMemo<Step[]>(() => {
    if (!data) return [];
    if (data.kind === "familystudent") {
      const items = data.items as FamilyItem[];
      const refs = data.conditionRefs as FamilyConditionRef[];
      const base: Step[] = items.map((q) => {
        if (q.options) return { id: q.id, text: q.text, scene: q.options.map((o) => ({ key: o.value, label: o.label })) };
        if (q.scale === 10) return { id: q.id, text: q.text, rating: true };
        return { id: q.id, text: q.text, opts: toOpts(FAMILY_STUDENT_P5) };
      });
      const cond: Step[] = e3Ready
        ? []
        : refs.map((r) => ({ id: r.id, text: r.text, opts: toOpts(FAMILY_STUDENT_P5) }));
      return [...base, ...cond];
    }
    if (data.kind === "familyparent") {
      const items = data.items as FamilyParentItem[];
      const scenes = data.sceneOptions as readonly { value: string; label: string }[];
      return items.map((q) => {
        if (q.scale === "scene") {
          return { id: q.id, text: q.text, scene: scenes.map((o) => ({ key: o.value, label: o.label })) };
        }
        if (q.scale === "p6") return { id: q.id, text: q.text, opts: toOpts(FAMILY_P6, 0) };
        if (q.scale === "p4money") return { id: q.id, text: q.text, opts: toOpts(FAMILY_P4_MONEY) };
        if (q.scale === "p5time") return { id: q.id, text: q.text, opts: toOpts(FAMILY_P5_TIME) };
        return { id: q.id, text: q.text, opts: toOpts(FAMILY_P5) };
      });
    }
    return [];
  }, [data, e3Ready]);

  const total = steps.length;
  const sceneStepId = steps.find((s) => s.scene)?.id ?? null;

  const submit = trpc.assessment.submit.useMutation({
    onSuccess: () => {
      clearQuizDraft(user?.id, kind);
      void utils.assessment.latest.invalidate();
      void utils.assessment.family.invalidate();
    },
  });

  const resetAll = () => {
    clearQuizDraft(user?.id, kind);
    setWho(null);
    setIdx(0);
    setVals({});
    setScene(null);
    setResumed(false);
  };

  const answered = (s: Step) => (s.scene ? scene != null : vals[s.id] !== undefined);

  const firstOpen = (from: number) => {
    for (let i = from; i < total; i++) if (!answered(steps[i])) return i;
    for (let i = 0; i < total; i++) if (!answered(steps[i])) return i;
    return -1;
  };

  const finish = () => {
    const items: Record<string, number> = {};
    const condition: Record<string, number> = {};
    for (const s of steps) {
      if (s.scene) continue;
      const v = vals[s.id];
      if (v === undefined) continue;
      if (s.id.startsWith("FC")) condition[s.id] = v;
      else items[s.id] = v;
    }
    if (kind === "familystudent") {
      submit.mutate({
        kind: "familystudent",
        answers: { pack: "standard", items, scene, condition },
      } as never);
    } else {
      submit.mutate({
        kind: "familyparent",
        answers: {
          pack: "standard",
          respondent: who?.respondent ?? "other",
          label: who?.label ?? "家长",
          items,
          scene,
        },
      } as never);
    }
  };

  const pick = (s: Step, value: number | string) => {
    if (s.scene) {
      setScene(String(value));
      setResumed(false);
      goNext(s.id);
      return;
    }
    setVals((v) => ({ ...v, [s.id]: Number(value) }));
    setResumed(false);
    goNext(s.id);
  };

  /** 当前题答完就往后走；全答完就提交。 */
  const goNext = (id: string) => {
    const cur = steps.findIndex((s) => s.id === id);
    const next = firstOpen(cur + 1);
    if (next < 0) {
      finish();
      return;
    }
    setIdx(next);
  };

  const qRef = useScrollToQuestion(`${idx}-${total}`);

  /* ---------------- 结果卡 ---------------- */
  if (submit.isSuccess && (submit.data as { kind?: string }).kind === kind) {
    const r = (submit.data as { result?: unknown }).result;
    return (
      <div className="mx-auto max-w-3xl">
        <div className="paper-card p-6">
          {kind === "familystudent" ? (
            <StudentResult r={r as FamilyStudentProfile} onDone={onDone} onReport={() => navigate("/report-detail?tab=family")} />
          ) : (
            <ParentResult r={r as FamilyParentProfile} who={who?.label ?? "家长"} onDone={onDone} />
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
            这一份由家长本人填写，29 道题约 6 分钟，全部是选择，没有对错。
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
            爸爸、妈妈可以各填一份，报告里分开放；两份都填，能看出父母之间本身的一致程度。
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
              {kind === "familystudent" ? "14 道题约 3 分钟" : "29 道题约 6 分钟"} · 没有对错，按真实情况选
            </p>
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

          {q.rating ? (
            <div className="mx-auto mt-4 grid max-w-md grid-cols-6 gap-2">
              {Array.from({ length: 11 }, (_, v) => v).map((v) => (
                <button
                  key={v}
                  disabled={submit.isPending}
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
                    disabled={submit.isPending}
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

          {submit.isPending && <p className="mt-3 text-center text-[13px] text-olive-mute">正在提交…</p>}
          {submit.isError && (
            <p className="mt-3 text-center text-[13px] text-terra">{submit.error?.message ?? "提交没成功，请再点一次最后一题的选项。"}</p>
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
        接下来请家长完成《家长卷》。两边都答完，报告里才会出现「你以为的 vs 他实际答的」对照——
        盲区通常就出在这六项里。
      </p>

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

function ParentResult({ r, who, onDone }: { r: FamilyParentProfile; who: string; onDone: () => void }) {
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
        孩子那份答完之后，报告会告诉你：你以为他怎么看你们，和他实际答的，差在哪几项。
      </p>

      <button onClick={onDone} className="mt-5 w-full rounded-xl bg-brand py-3 text-[14px] font-semibold text-cream hover:bg-lime">
        完成，返回
      </button>
    </>
  );
}
