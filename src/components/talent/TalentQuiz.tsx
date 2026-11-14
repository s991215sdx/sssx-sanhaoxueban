/**
 * 人才测评答题器（v253）。
 *
 * 五个部分按「底盘 → 岗位加测」顺序排：大五、价值观、职场 DISC、特质情商、最后才是岗位加测。
 * 这个顺序有理由：前四段是通用底盘，答到第四段时人对题型的节奏已经稳了；
 * 加测是最贴近具体工作的一段（情境题、校对题），放在最后不容易被前面的惯性带跑。
 *
 * 一次只渲染一段，答完一段再进下一段——100 多道题铺在一屏里，人会开始点「比较符合」。
 * 草稿存 localStorage：中途接电话、切出去回消息，回来不该从头再答一遍。
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";

export type PaperPart = {
  key: string;
  name: string;
  minutes: number;
  kind: "likert5" | "likert7" | "disc" | "mixed";
  blurb?: string;
  items?: { id: string; kind?: "likert5" | "choice"; text: string; options?: string[] }[];
  groups?: { words: string[] }[];
};

export type TalentAnswerPayload = {
  bigfive: Record<string, number>;
  value: Record<string, number>;
  discwork: { most: number[]; least: number[] };
  eq: Record<string, number>;
  duty: Record<string, number>;
};

const L5 = ["非常不符合", "不太符合", "一半一半", "比较符合", "非常符合"];
const L7 = ["完全不符合", "比较不符合", "有点不符合", "说不好", "有点符合", "比较符合", "完全符合"];

function totalOf(parts: PaperPart[]) {
  return parts.reduce((n, p) => n + (p.kind === "disc" ? (p.groups?.length ?? 0) : (p.items?.length ?? 0)), 0);
}

function countAnswered(parts: PaperPart[], a: TalentAnswerPayload) {
  let n = 0;
  for (const p of parts) {
    if (p.key === "bigfive") n += Object.keys(a.bigfive).length;
    else if (p.key === "value") n += Object.keys(a.value).length;
    else if (p.key === "eq") n += Object.keys(a.eq).length;
    else if (p.key === "duty") n += Object.keys(a.duty).length;
    else if (p.key === "discwork")
      n += a.discwork.most.filter((m, i) => m != null && a.discwork.least[i] != null && m !== a.discwork.least[i]).length;
  }
  return n;
}

export default function TalentQuiz({
  parts,
  storageKey,
  onSubmit,
  submitting,
  submitLabel = "交卷，生成报告",
  note,
}: {
  parts: PaperPart[];
  storageKey: string;
  onSubmit: (answers: TalentAnswerPayload) => void;
  submitting?: boolean;
  submitLabel?: string;
  note?: string;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<TalentAnswerPayload>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) return JSON.parse(raw) as TalentAnswerPayload;
    } catch {
      /* 私密模式读不到就当没草稿 */
    }
    return { bigfive: {}, value: {}, discwork: { most: [], least: [] }, eq: {}, duty: {} };
  });
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(answers));
    } catch {
      /* 存不下就算了，不阻断答题 */
    }
  }, [answers, storageKey]);

  const total = totalOf(parts);
  const done = countAnswered(parts, answers);
  const pct = total ? Math.round((done / total) * 100) : 0;
  const part = parts[step];
  const last = step === parts.length - 1;

  const setL = (bucket: "bigfive" | "value" | "eq" | "duty", id: string, v: number) =>
    setAnswers((s) => ({ ...s, [bucket]: { ...s[bucket], [id]: v } }));

  /* DISC 一组只能有一个「最像」、一个「最不像」，两者还不能是同一个词 */
  const setDisc = (i: number, side: "most" | "least", v: number) =>
    setAnswers((s) => {
      const most = [...s.discwork.most];
      const least = [...s.discwork.least];
      if (side === "most") {
        most[i] = v;
        if (least[i] === v) least[i] = -1;
      } else {
        least[i] = v;
        if (most[i] === v) most[i] = -1;
      }
      return { ...s, discwork: { most, least } };
    });

  const partDone = useMemo(() => {
    if (!part) return 0;
    if (part.kind === "disc") {
      return answers.discwork.most.filter((m, i) => m != null && m >= 0 && answers.discwork.least[i] != null && answers.discwork.least[i] >= 0).length;
    }
    const bucket = part.key as "bigfive" | "value" | "eq" | "duty";
    return (part.items ?? []).filter((it) => answers[bucket][it.id] != null).length;
  }, [part, answers]);

  const partTotal = part ? (part.kind === "disc" ? (part.groups?.length ?? 0) : (part.items?.length ?? 0)) : 0;

  const go = (d: number) => {
    setStep((s) => Math.max(0, Math.min(parts.length - 1, s + d)));
    topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (!part) return null;

  return (
    <div ref={topRef} className="space-y-4">
      {/* 进度：答了多少题、当前第几段 */}
      <div className="paper-card p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="text-[11px] font-bold tracking-wider text-olive-mute">
              第 {step + 1} / {parts.length} 段 · {part.name}
            </div>
            <div className="mt-1 text-[13px] text-olive-soft">
              这一段 {partTotal} 题，已完成 {partDone} 题
            </div>
          </div>
          <div className="text-right">
            <div className="mono text-[22px] font-bold leading-none text-brand">{pct}%</div>
            <div className="mono mt-1 text-[10.5px] text-olive-mute">
              {done} / {total}
            </div>
          </div>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-brand-pale">
          <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {parts.map((p, i) => (
            <button
              key={p.key}
              type="button"
              onClick={() => {
                setStep(i);
                topRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                i === step
                  ? "bg-brand text-white"
                  : i < step
                    ? "bg-brand-pale text-brand"
                    : "border border-border text-olive-mute hover:bg-butter-pale"
              }`}
            >
              {p.name}
            </button>
          ))}
        </div>
      </div>

      {part.blurb && (
        <div className="rounded-xl border border-border bg-butter-pale/60 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-olive-soft">
          {part.blurb}
        </div>
      )}

      {/* 题面 */}
      {part.kind === "disc" ? (
        <div className="space-y-2.5">
          <div className="text-[12px] leading-relaxed text-olive-mute">
            每组四个词：选出一个<b className="text-olive">最像你</b>的，再选出一个<b className="text-olive">最不像你</b>的。
            请按工作中真实的你选，不是你希望成为的样子。
          </div>
          {(part.groups ?? []).map((g, i) => (
            <div key={i} className="paper-card p-3.5">
              <div className="mono mb-2 text-[10.5px] text-olive-mute">第 {i + 1} 组</div>
              <div className="grid gap-1.5 sm:grid-cols-2">
                {g.words.map((w, wi) => {
                  const isMost = answers.discwork.most[i] === wi;
                  const isLeast = answers.discwork.least[i] === wi;
                  return (
                    <div
                      key={wi}
                      className={`flex items-center justify-between gap-2 rounded-lg border px-2.5 py-2 text-[13px] ${
                        isMost ? "border-brand bg-brand-pale/70" : isLeast ? "border-border bg-butter-pale/70" : "border-border bg-white"
                      }`}
                    >
                      <span className={isMost || isLeast ? "font-semibold text-olive" : "text-olive-soft"}>{w}</span>
                      <span className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => setDisc(i, "most", wi)}
                          className={`rounded-md px-2 py-0.5 text-[11px] transition-colors ${
                            isMost ? "bg-brand text-white" : "border border-border text-olive-mute hover:bg-butter-pale"
                          }`}
                        >
                          最像
                        </button>
                        <button
                          type="button"
                          onClick={() => setDisc(i, "least", wi)}
                          className={`rounded-md px-2 py-0.5 text-[11px] transition-colors ${
                            isLeast ? "bg-brand text-white" : "border border-border text-olive-mute hover:bg-butter-pale"
                          }`}
                        >
                          最不像
                        </button>
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {(part.items ?? []).map((it, idx) => {
            const bucket = part.key as "bigfive" | "value" | "eq" | "duty";
            const scale = it.kind === "choice" ? 0 : part.kind === "likert7" ? 7 : 5;
            const val = answers[bucket][it.id];
            return (
              <div key={it.id} className="paper-card px-3.5 py-3">
                <div className="flex gap-2.5">
                  <span className="mono mt-0.5 shrink-0 text-[11px] text-olive-mute">{String(idx + 1).padStart(2, "0")}</span>
                  <p className="text-[13.5px] leading-relaxed text-olive">{it.text}</p>
                </div>
                {it.kind === "choice" ? (
                  <div className="mt-2.5 space-y-1.5 pl-7">
                    {(it.options ?? []).map((o, oi) => (
                      <button
                        key={oi}
                        type="button"
                        onClick={() => setL(bucket, it.id, oi)}
                        className={`flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left text-[13px] transition-colors ${
                          val === oi ? "border-brand bg-brand-pale/60 font-medium text-olive" : "border-border text-olive-soft hover:bg-butter-pale"
                        }`}
                      >
                        <span className={`mt-[3px] grid h-3.5 w-3.5 shrink-0 place-items-center rounded-full border ${val === oi ? "border-brand bg-brand" : "border-input"}`}>
                          {val === oi && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                        {o}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2.5 flex flex-wrap gap-1.5 pl-7">
                    {Array.from({ length: scale }, (_, k) => k + 1).map((v) => {
                      const labels = scale === 7 ? L7 : L5;
                      const on = val === v;
                      return (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setL(bucket, it.id, v)}
                          title={labels[v - 1]}
                          className={`rounded-lg border px-2 py-1 text-[11.5px] transition-colors ${
                            on ? "border-brand bg-brand font-semibold text-white" : "border-border text-olive-mute hover:bg-butter-pale"
                          }`}
                        >
                          {labels[v - 1]}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 导航 */}
      <div className="sticky bottom-0 -mx-1 flex items-center gap-2 bg-cream/90 px-1 py-3 backdrop-blur">
        <button
          type="button"
          disabled={step === 0}
          onClick={() => go(-1)}
          className="flex items-center gap-1.5 rounded-xl border border-border px-3.5 py-2.5 text-[13px] text-olive-soft transition-colors hover:bg-butter-pale disabled:opacity-40"
        >
          <ArrowLeft size={15} /> 上一段
        </button>
        <div className="flex-1 text-center text-[11.5px] text-olive-mute">
          {partDone < partTotal ? `这一段还差 ${partTotal - partDone} 题` : "这一段已完成"}
        </div>
        {last ? (
          <button
            type="button"
            disabled={!!submitting || done < Math.floor(total * 0.7)}
            onClick={() => onSubmit(answers)}
            className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Check size={15} /> {submitting ? "正在计算…" : submitLabel}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => go(1)}
            className="flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-[13px] font-semibold text-white shadow-sm transition-colors hover:bg-brand-deep"
          >
            下一段 <ArrowRight size={15} />
          </button>
        )}
      </div>
      {last && done < Math.floor(total * 0.7) && (
        <p className="pb-2 text-center text-[12px] text-terra">
          还差一些题才能生成报告（至少要答 {Math.floor(total * 0.7)} 题，现在 {done} 题）。
        </p>
      )}
      {note && <p className="pb-4 text-center text-[11.5px] leading-relaxed text-olive-mute">{note}</p>}
    </div>
  );
}
