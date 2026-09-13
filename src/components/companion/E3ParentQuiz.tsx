import { useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  E3V37P_FAMILY_QUESTIONS,
  E3V37P_COND_OBSERVE,
  E3V37P_MIRROR_QUESTIONS,
  E3V37P_MIRROR_HINTS,
  type E3V37ParentResult,
} from "@contracts/assessments";
import { clearQuizDraft, loadQuizDraft, useDraftState } from "@/lib/quizDraft";
import { Users } from "lucide-react";

const CHIP_BASE =
  "rounded-xl border px-3.5 py-2 text-[13.5px] font-medium transition-colors";
const CHIP_ON = "border-olive bg-olive text-cream";
const CHIP_OFF = "border-border bg-cream text-olive-soft hover:border-olive/40";

/** 家长卷作答草稿 key（mirror 内部用 -1 表示未答；提交时保证全部 >= 0，0=不了解）。 */
const DRAFT = "e3parent";

/**
 * E3 V3.7 第二部分 · 家长卷（选做，约 8 分钟）。
 * 进入系统后可随时补填；用于家庭支持系统了解 + 家长观察与孩子自评对照。
 */
export default function E3ParentQuiz({ onDone }: { onDone: () => void }) {
  const utils = trpc.useUtils();
  const { data, isLoading } = trpc.assessment.questions.useQuery({ kind: "e3parent" });

  /* 旧版（V2.7）草稿结构不同（family 用的是旧 keys，mirror 的 -1=未答语义也不同）：
     首个 state 初始化时校验 family 是否含新版 key「fatherRole」，不含则视为旧草稿直接丢弃。 */
  const [draftValid] = useState(() => {
    const d = loadQuizDraft(DRAFT);
    if (!d) return true;
    const fam = d.family as Record<string, number> | undefined;
    if (fam && Object.keys(fam).length > 0 && !("fatherRole" in fam)) {
      clearQuizDraft(DRAFT);
      return false;
    }
    return true;
  });

  // 作答进度挂草稿：误退出/刷新后回来接着填，不用重填
  const [family, setFamily] = useDraftState<Record<string, number>>(DRAFT, "family", {});
  const [distractions, setDistractions] = useDraftState<number[]>(DRAFT, "distractions", []);
  const [familyChangeNote, setFamilyChangeNote] = useDraftState<string>(DRAFT, "familyChangeNote", "");
  const [wish, setWish] = useDraftState<string>(DRAFT, "wish", "");
  const [condObserve, setCondObserve] = useDraftState<Record<string, number>>(DRAFT, "condObserve", {});
  const [mirror, setMirror] = useDraftState<number[]>(DRAFT, "mirror", () => Array(16).fill(-1)); // -1 未答（提交时 0=不了解）
  const [resumed, setResumed] = useState(() => {
    if (!draftValid) return false;
    const d = loadQuizDraft(DRAFT);
    if (!d) return false;
    const fam = (d.family as Record<string, number> | undefined) ?? {};
    const mir = (d.mirror as number[] | undefined) ?? [];
    const cond = (d.condObserve as Record<string, number> | undefined) ?? {};
    return (
      Object.keys(fam).length > 0 ||
      ((d.distractions as number[] | undefined)?.length ?? 0) > 0 ||
      Object.keys(cond).length > 0 ||
      mir.some((v) => v >= 0)
    );
  });
  const resetAll = () => {
    clearQuizDraft(DRAFT);
    setFamily({});
    setDistractions([]);
    setFamilyChangeNote("");
    setWish("");
    setCondObserve({});
    setMirror(Array(16).fill(-1));
    setResumed(false);
  };

  const submit = trpc.assessment.submit.useMutation({
    onSuccess: () => {
      clearQuizDraft(DRAFT); // 提交成功，清除草稿
      void utils.assessment.latest.invalidate();
    },
  });

  if (isLoading || !data || (data as { kind?: string }).kind !== "e3parent") {
    return (
      <div className="paper-card flex justify-center p-14">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-lime border-t-transparent" />
      </div>
    );
  }

  /* 后端并行开发中：按约定形状读取，缺失字段回退到契约常量。 */
  const q = data as unknown as {
    studentDone?: boolean;
    familyQuestions?: typeof E3V37P_FAMILY_QUESTIONS;
    condObserve?: typeof E3V37P_COND_OBSERVE;
    mirrorQuestions?: typeof E3V37P_MIRROR_QUESTIONS;
  };
  const studentDone = q.studentDone ?? false;
  const familyQuestions = q.familyQuestions ?? E3V37P_FAMILY_QUESTIONS;
  const condObserveItems = q.condObserve ?? E3V37P_COND_OBSERVE;
  const mirrorQuestions = q.mirrorQuestions ?? E3V37P_MIRROR_QUESTIONS;

  if (submit.isSuccess && (submit.data as { kind?: string }).kind === "e3parent") {
    const r = (submit.data as { result?: unknown }).result as E3V37ParentResult | undefined;
    return (
      <div className="paper-card accent-l border-lime p-6">
        <h2 className="text-lg font-bold text-olive">家长卷已提交</h2>
        <p className="mt-2 text-[14px] leading-relaxed text-olive-soft">{r?.summary ?? "已收到，将与孩子自评一起对照分析。"}</p>
        {r?.severeConflict && (
          <div className="mt-3 rounded-xl border border-terra/40 bg-terra/10 p-3.5">
            <p className="text-[13px] leading-relaxed text-terra">
              您提到近半年有较严重的亲子冲突：建议先修复关系、再谈学习，陪跑师会优先跟进这部分。
            </p>
          </div>
        )}
        <button
          onClick={onDone}
          className="mt-4 w-full rounded-xl bg-olive py-3 text-[15px] font-semibold text-cream transition-colors hover:bg-lime"
        >
          完成，返回测评中心
        </button>
      </div>
    );
  }

  const familyDone = familyQuestions
    .filter((fq) => !fq.multi && !(fq.open && !fq.options))
    .every((fq) => family[fq.key] != null);
  const condDone = condObserveItems.every((it) => condObserve[it.key] != null);
  const mirrorDone = mirror.every((v) => v >= 0);
  const ready = familyDone && condDone && mirrorDone;

  const inputCls =
    "mt-2 w-full rounded-xl border border-input bg-cream px-4 py-2.5 text-[15px] text-olive outline-none placeholder:text-olive-mute/70 focus:border-lime focus:ring-2 focus:ring-lime/25";

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="paper-card p-4 sm:p-6">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-olive" />
          <h2 className="text-lg font-bold text-olive">家长卷（约 8 分钟 · 选做）</h2>
        </div>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-olive-soft">
          这份问卷请<b>由家长独立填写</b>，不要询问孩子；答案没有好坏之分。它用于了解家庭支持系统，
          并对比家长观察与孩子自评之间的差异。没填完也可以以后再来——进入系统后随时可补。
        </p>
        {!studentDone && (
          <p className="mt-2 rounded-xl border border-butter bg-butter/60 px-3.5 py-2.5 text-[13px] text-olive">
            孩子还没完成学业诊断：现在可以先填，等孩子测完后会自动生成「家长观察 × 孩子自评」对照分析。
          </p>
        )}
        {resumed && (
          <div className="mt-3 flex items-center justify-between gap-2 rounded-xl border border-lime/50 bg-lime-pale/60 px-3 py-2">
            <span className="text-[12.5px] text-olive">已恢复上次填到一半的内容，接着填就好。</span>
            <button onClick={resetAll} className="shrink-0 text-[12px] text-olive-mute underline hover:text-olive">
              重新开始
            </button>
          </div>
        )}
      </div>

      {/* 一、家庭支持与环境 */}
      <div className="paper-card p-4 sm:p-5">
        <h3 className="font-bold text-olive">一、家庭支持与环境</h3>
        <div className="mt-3 space-y-5">
          {familyQuestions.map((fq, qi) => (
            <div key={fq.key}>
              <p className="text-[14.5px] font-medium text-olive">
                <span className="mono mr-1.5 text-[12px] text-olive-mute">{qi + 1}.</span>
                {fq.title}
              </p>
              {fq.multi && fq.options ? (
                /* 学习干扰源：多选，「基本没有」与其他选项互斥 */
                <div className="mt-2 flex flex-wrap gap-2">
                  {fq.options.map((op, oi) => {
                    const on = distractions.includes(oi);
                    return (
                      <button
                        key={op}
                        onClick={() =>
                          setDistractions((arr) => {
                            const last = fq.options!.length - 1;
                            if (oi === last) return on ? [] : [oi];
                            const withoutNone = arr.filter((x) => x !== last);
                            return on ? withoutNone.filter((x) => x !== oi) : [...withoutNone, oi];
                          })
                        }
                        className={`${CHIP_BASE} ${on ? CHIP_ON : CHIP_OFF}`}
                      >
                        {op}
                      </button>
                    );
                  })}
                </div>
              ) : fq.options ? (
                /* 单选 chips；familyChange 选了「无」以外的项时出补充说明文本框 */
                <>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {fq.options.map((op, oi) => (
                      <button
                        key={op}
                        onClick={() => setFamily((f) => ({ ...f, [fq.key]: oi }))}
                        className={`${CHIP_BASE} ${family[fq.key] === oi ? CHIP_ON : CHIP_OFF}`}
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                  {fq.key === "familyChange" && family.familyChange != null && family.familyChange !== 0 && (
                    <input
                      value={familyChangeNote}
                      onChange={(e) => setFamilyChangeNote(e.target.value)}
                      placeholder="简单写一句这个变化的情况（可留空）"
                      maxLength={200}
                      className={inputCls}
                    />
                  )}
                </>
              ) : (
                /* 纯文本题（wish） */
                <textarea
                  value={wish}
                  onChange={(e) => setWish(e.target.value)}
                  rows={2}
                  maxLength={1000}
                  placeholder="例如：先让他自己愿意坐下来写作业…"
                  className={`${inputCls} resize-none`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 二、条件三格观察 */}
      <div className="paper-card p-4 sm:p-5">
        <h3 className="font-bold text-olive">二、条件三格观察</h3>
        <p className="mt-1 text-[13px] text-olive-mute">
          根据您平时的观察选最接近的一项；确实不了解时选「不了解」，不要猜。
        </p>
        <div className="mt-3 space-y-4">
          {condObserveItems.map((it) => (
            <div key={it.key}>
              <p className="text-[14.5px] font-medium text-olive">
                {it.label}
                <span className="mono ml-1.5 text-[11px] text-olive-mute">对应孩子第 {it.ref} 题</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {it.options.map((op, oi) => (
                  <button
                    key={op}
                    onClick={() => setCondObserve((m) => ({ ...m, [it.key]: oi }))}
                    className={`${CHIP_BASE} ${condObserve[it.key] === oi ? CHIP_ON : CHIP_OFF}`}
                  >
                    {op}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 三、家长认知对照题 */}
      <div className="paper-card p-4 sm:p-5">
        <h3 className="font-bold text-olive">三、家长认知对照题</h3>
        <p className="mt-1 text-[13px] text-olive-mute">
          请根据平时真实观察作答；确实不了解时选「不了解」，不要猜。
        </p>
        <div className="mt-3 divide-y divide-border">
          {mirrorQuestions.map((mq, i) => (
            <div key={mq.key} className="py-3">
              <p className="text-[14.5px] leading-relaxed text-olive">
                <span className="mono mr-1.5 text-[12px] text-olive-mute">{mq.key}</span>
                {mq.text}
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {E3V37P_MIRROR_HINTS.map((hint, v) => (
                  <button
                    key={hint}
                    onClick={() => setMirror((arr) => arr.map((x, j) => (j === i ? v : x)))}
                    className={`rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors ${
                      mirror[i] === v ? CHIP_ON : CHIP_OFF
                    }`}
                  >
                    {hint}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={() =>
          ready &&
          submit.mutate({
            kind: "e3parent",
            answers: { family, distractions, familyChangeNote, wish, condObserve, mirror },
          } as never)
        }
        disabled={!ready || submit.isPending}
        className="w-full rounded-xl bg-olive py-3.5 text-[16px] font-semibold text-cream transition-colors hover:bg-lime disabled:opacity-40"
      >
        {submit.isPending ? "正在生成对照分析…" : ready ? "提交家长卷" : "还有题目没答完"}
      </button>
      {submit.isError && <p className="text-center text-[13px] text-terra">提交没成功，再点一次试试。</p>}
    </div>
  );
}
