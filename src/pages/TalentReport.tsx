/**
 * 人才测评报告页（v253）。
 *
 * 顺序是刻意的：先说「这个岗合不合」，再说「凭什么这么判」，最后才给「怎么用、怎么问」。
 * 反过来先摆十维条形图，读的人会先算分、再找结论，报告就变成了一张成绩单。
 *
 * 每个分数旁边都留着「来源」（哪几道题算出来的）与「实测 / 估算」标记——
 * 缺答的维度不该和答过的维度看起来一样重。
 */
import { useEffect } from "react";
import { Link, useParams } from "react-router";
import { AlertCircle, ArrowLeft, Printer } from "lucide-react";
import { trpc } from "@/providers/trpc";
import { FIT_BAND_LABEL } from "@contracts/talent/score";

const BAND_STYLE: Record<string, string> = {
  strong: "bg-brand text-white",
  fit: "bg-brand-pale text-brand",
  watch: "bg-butter-pale text-[#8A6A12]",
  off: "bg-[#FDECEC] text-[#B23B3B]",
};

/** 用人要求对照表的达标状态。gap 是「这个岗离不开你却不行」，edge 是「够用但撑不起」。 */
const REQ_STATUS: Record<string, { label: string; cls: string }> = {
  met: { label: "达标", cls: "bg-brand-pale text-brand" },
  edge: { label: "差一点", cls: "bg-butter-pale text-[#8A6A12]" },
  gap: { label: "偏弱", cls: "bg-[#FDECEC] text-[#B23B3B]" },
};

const REQ_WEIGHT: Record<number, { label: string; cls: string }> = {
  3: { label: "核心", cls: "bg-cream-deep font-bold text-olive" },
  2: { label: "重要", cls: "bg-cream-deep/60 text-olive-soft" },
};

function Bar({ value, tone = "brand" }: { value: number; tone?: "brand" | "mute" }) {
  const color = tone === "mute" ? "bg-olive-mute/50" : value >= 65 ? "bg-brand" : value >= 45 ? "bg-lime" : "bg-terra";
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-pale/50">
      <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

export default function TalentReportPage() {
  const { id = "" } = useParams();
  const numeric = Number(id);
  const q = trpc.talent.report.useQuery({ id: numeric }, { enabled: Number.isFinite(numeric) && numeric > 0, retry: false });

  /* 打印这件小事在这页上很要紧：报告是要发给用人部门、贴进档案的。
     挂一个 body 类，让打印样式知道「这一页要去掉侧栏」，离开时摘掉。 */
  useEffect(() => {
    document.body.classList.add("talent-print");
    return () => document.body.classList.remove("talent-print");
  }, []);

  if (q.isLoading) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-brand border-t-transparent" />
        <p className="mono text-[12px] text-olive-mute">正在打开报告…</p>
      </div>
    );
  }

  if (q.error || !q.data) {
    return (
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="paper-card p-7 text-center">
          <AlertCircle className="mx-auto text-olive-mute" size={32} />
          <h1 className="mt-3 text-[17px] font-bold text-olive">打不开这份报告</h1>
          <p className="mt-2 text-[13px] leading-relaxed text-olive-mute">{q.error?.message ?? "没有这份报告，或者它不在你名下。"}</p>
          <Link to="/talent" className="mt-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline">
            <ArrowLeft size={14} /> 回到人才测评
          </Link>
        </div>
      </div>
    );
  }

  const r = q.data.report;
  const when = new Date(q.data.createdAt);
  const eq = r.eq;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 md:px-8 md:py-8">
      {/* 封面：一张整页，报告的第一印象 */}
      <section className="cover relative mb-8 overflow-hidden rounded-2xl border border-border bg-white">
        <div className="px-7 py-12 text-center md:px-12 md:py-16">
          <div className="mx-auto w-16 border-t-4 border-brand" />
          <div className="mt-7 text-[12px] tracking-[0.35em] text-olive-mute">人才测评报告</div>
          <h1 className="mt-4 text-[34px] font-bold tracking-tight text-olive">{r.meta.name}</h1>
          <div className="mt-3 text-[15px] text-olive-soft">
            {q.data.orgName ? `${q.data.orgName} · ` : ""}岗位评估：{r.meta.positionLabel}
          </div>
          <div className="mt-9 flex flex-col items-center gap-2.5">
            <span className={`rounded-xl px-4 py-1.5 text-[14px] font-semibold ${BAND_STYLE[r.currentBand.key] ?? "bg-cream-deep text-olive"}`}>
              {r.currentBand.label}
            </span>
            <span className="mono text-[13px] text-olive-mute">匹配度 {r.current.score} / 100</span>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[12px] text-olive-mute">
            <span>
              {when.getFullYear()} 年 {when.getMonth() + 1} 月 {when.getDate()} 日
            </span>
            <span>{q.data.source === "invite" ? "扫码作答" : "本人自测"}</span>
            <span>完成 {r.completeness.pct}%</span>
          </div>
          <div className="mx-auto mt-12 max-w-md border-t border-border pt-5 text-[11px] leading-relaxed text-olive-mute">
            本报告依据作答人的自评生成，反映施测时点的倾向，是招聘与用人决策的参考之一，
            须结合面试、工作样本与业务场景综合判断，不单独作为录用或淘汰依据。
          </div>
        </div>
      </section>

      {/* 头部 */}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="mono text-[11px] font-bold tracking-wider text-olive-mute">人才测评报告 · {r.meta.positionLabel}</div>
          <h1 className="mt-1 text-[24px] font-bold tracking-tight text-olive">{r.meta.name}</h1>
          <div className="mono mt-1 text-[11.5px] text-olive-mute">
            {when.getFullYear()} 年 {when.getMonth() + 1} 月 {when.getDate()} 日 · 完成 {r.completeness.pct}% ·{" "}
            {q.data.source === "invite" ? "扫码作答" : "本人自测"}
          </div>
        </div>
        <div className="no-print flex gap-2">
          <Link to="/talent" className="rounded-xl border border-border px-3 py-2 text-[12.5px] text-olive-soft hover:bg-butter-pale">
            返回
          </Link>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 rounded-xl border border-border px-3 py-2 text-[12.5px] text-olive-soft hover:bg-butter-pale"
          >
            <Printer size={14} /> 打印 / 存 PDF
          </button>
        </div>
      </header>

      {/* 结论 */}
      <section className="paper-card mt-5 p-5">
        <div className="flex flex-wrap items-end gap-5">
          <div>
            <div className="text-[12px] text-olive-mute">与「{r.meta.positionLabel}」的匹配度</div>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="mono text-[46px] font-bold leading-none text-brand">{r.current.score}</span>
              <span className="mono text-[13px] text-olive-mute">/ 100</span>
            </div>
          </div>
          <div className="flex-1">
            <span className={`inline-block rounded-lg px-2.5 py-1 text-[12.5px] font-semibold ${BAND_STYLE[r.currentBand.key] ?? "bg-cream-deep text-olive"}`}>
              {r.currentBand.label}
            </span>
            <p className="mt-2 text-[13px] leading-relaxed text-olive-soft">{r.currentBand.text}</p>
          </div>
        </div>

        {/* 用人建议：决策结论前置，别让 HR 从分数里自己拼「怎么办」 */}
        <div className="mt-4 rounded-xl border border-brand/25 bg-brand-pale/25 px-3.5 py-3">
          <div className="text-[12px] font-semibold text-brand">用人建议</div>
          <p className="mt-1 text-[13px] leading-relaxed text-olive-soft">{r.summary.action}</p>
          {r.summary.focus.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] text-olive-mute">重点观察：</span>
              {r.summary.focus.map((f) => (
                <span key={f} className="mono rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-brand">
                  {f}
                </span>
              ))}
            </div>
          )}
        </div>

        {r.current.gaps.length > 0 && (
          <div className="mt-4 rounded-xl border border-terra/30 bg-[#FFF4EE] px-3.5 py-3">
            <div className="text-[12px] font-semibold text-[#B2521F]">硬缺口：这个岗的核心项低于 40 分</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {r.current.gaps.map((g) => (
                <span key={g.dim} className="mono rounded-md bg-white px-2 py-0.5 text-[11.5px] text-[#B2521F]">
                  {g.label} {g.score}
                </span>
              ))}
            </div>
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-olive-soft">
              不要指望「多提醒几次」能补上。这类缺口要靠改流程、配搭档，或者换岗位——把人放在每天都撞墙的位置，最先垮的是人。
            </p>
          </div>
        )}
        {r.current.gaps.length === 0 && r.current.weak.length > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-cream-deep/50 px-3.5 py-3">
            <div className="text-[12px] font-semibold text-olive">重要项偏低：不至于干不了，但会拖后腿</div>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {r.current.weak.map((g) => (
                <span key={g.dim} className="mono rounded-md bg-white px-2 py-0.5 text-[11.5px] text-olive-soft">
                  {g.label} {g.score}
                </span>
              ))}
            </div>
          </div>
        )}
        {r.completeness.missing.length > 0 && (
          <p className="mt-3 text-[11.5px] leading-relaxed text-olive-mute">
            本次未完成：{r.completeness.missing.join("、")}。相关维度标了「估算」，结论请打折看。
          </p>
        )}
      </section>

      {/* 用人要求对照：把「岗位要什么」和「他多少」并排摆开 */}
      <section className="mt-6">
        <h2 className="text-[11px] font-bold tracking-wider text-olive-mute">这个岗位要什么，他差在哪</h2>
        <div className="mt-2 overflow-hidden rounded-xl border border-border bg-white">
          {r.requirements.map((req) => {
            const st = REQ_STATUS[req.status];
            const wt = REQ_WEIGHT[req.weight];
            return (
              <div key={req.dim} className="flex items-center gap-2.5 border-b border-border/60 px-3.5 py-2.5 last:border-0">
                <span className="w-20 shrink-0 text-[13px] font-medium text-olive">{req.label}</span>
                <span className={`w-10 shrink-0 rounded-md px-1.5 py-0.5 text-center text-[10px] ${wt.cls}`}>{wt.label}</span>
                <div className="flex-1">
                  <Bar value={req.score} />
                </div>
                <span className="mono w-7 shrink-0 text-right text-[13px] font-bold text-olive">{req.score}</span>
                <span className={`w-14 shrink-0 rounded-md px-1.5 py-0.5 text-center text-[10.5px] ${st.cls}`}>{st.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      {/* 四岗 */}
      <section className="mt-6">
        <h2 className="text-[11px] font-bold tracking-wider text-olive-mute">换个岗位会怎样</h2>
        <div className="mt-2 space-y-1.5">
          {r.fits.map((f) => {
            const on = f.job === r.current.job;
            return (
              <div key={f.job} className={`rounded-xl border px-3.5 py-2.5 ${on ? "border-brand bg-brand-pale/30" : "border-border bg-white"}`}>
                <div className="flex items-center gap-3">
                  <span className={`w-24 shrink-0 text-[13px] ${on ? "font-bold text-brand" : "text-olive-soft"}`}>{f.label}</span>
                  <div className="flex-1">
                    <Bar value={f.score} />
                  </div>
                  <span className="mono w-8 shrink-0 text-right text-[13px] font-bold text-olive">{f.score}</span>
                  <span className="mono w-14 shrink-0 whitespace-nowrap text-right text-[10.5px] text-olive-mute">{FIT_BAND_LABEL[f.band]}</span>
                </div>
                {f.strengths.length > 0 && (
                  <div className="mono mt-1 pl-[108px] text-[10.5px] text-olive-mute">吃得开：{f.strengths.map((s) => s.label).join("、")}</div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 十维 */}
      <section className="mt-6">
        <h2 className="text-[11px] font-bold tracking-wider text-olive-mute">十维明细</h2>
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
          {r.dims.map((d) => (
            <div key={d.key} className="rounded-xl border border-border bg-white px-3.5 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-medium text-olive">{d.label}</span>
                <span className="flex items-center gap-1.5">
                  {d.basis === "estimated" && (
                    <span className="rounded bg-cream-deep px-1.5 py-0.5 text-[9.5px] text-olive-mute">估算</span>
                  )}
                  <span className="mono text-[15px] font-bold text-brand">{d.score}</span>
                </span>
              </div>
              <div className="mt-1.5">
                <Bar value={d.score} />
              </div>
              <div className="mt-1.5 text-[11.5px] leading-relaxed text-olive-soft">{d.text}</div>
              <div className="mono mt-1 text-[9.5px] text-olive-mute">来源：{d.source}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 强项与风险 */}
      <section className="mt-6 grid gap-2.5 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[11px] font-bold tracking-wider text-brand">可以先用起来的长处</div>
          {r.strengths.length === 0 && <p className="mt-2 text-[12px] text-olive-mute">这次没有哪一维明显突出，先按下面的风险项补短板。</p>}
          {r.strengths.map((s) => (
            <div key={s.label} className="mt-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-olive">{s.label}</span>
                <span className="mono text-[12px] text-brand">{s.score}</span>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-olive-soft">{s.text}</p>
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="text-[11px] font-bold tracking-wider text-[#B2521F]">要盯住的地方</div>
          {r.risks.length === 0 && <p className="mt-2 text-[12px] text-olive-mute">没有低于 55 分的维度，属于比较稳的一份。</p>}
          {r.risks.map((s) => (
            <div key={s.label} className="mt-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-medium text-olive">
                  {s.label}
                  {s.isCore && <span className="ml-1.5 rounded bg-[#FFF4EE] px-1 py-0.5 text-[9.5px] text-[#B2521F]">核心项</span>}
                </span>
                <span className="mono text-[12px] text-[#B2521F]">{s.score}</span>
              </div>
              <p className="mt-1 text-[11.5px] leading-relaxed text-olive-soft">{s.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* 情商 */}
      {eq && (
        <section className="mt-6 rounded-2xl border border-border bg-white p-4">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h2 className="text-[11px] font-bold tracking-wider text-olive-mute">特质情商</h2>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="mono text-[30px] font-bold leading-none text-olive">{eq.overall}</span>
                <span className="text-[12px] text-olive-soft">{eq.level}</span>
              </div>
            </div>
            <span className="mono text-[10.5px] text-olive-mute">4 因素 · 15 维（AD AS SC MO EE EM ER EX IC RE SA SM TE HA OP）</span>
          </div>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {eq.factors.map((f) => (
              <div key={f.key} className="rounded-xl border border-border px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[12.5px] font-semibold text-olive">{f.label}</span>
                  <span className="mono text-[13px] font-bold text-brand">{f.score}</span>
                </div>
                <div className="mt-1.5">
                  <Bar value={f.score} />
                </div>
                <div className="mt-2 space-y-1">
                  {f.dims.map((d) => (
                    <div key={d.dim} className="flex items-center gap-2">
                      <span className="w-[96px] shrink-0 truncate text-[10.5px] text-olive-soft">{d.label}</span>
                      <div className="flex-1">
                        <Bar value={d.score} tone="mute" />
                      </div>
                      <span className="mono w-6 shrink-0 text-right text-[10.5px] text-olive-mute">{d.score}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 rounded-xl bg-cream-deep/50 px-3.5 py-3">
            <div className="text-[11.5px] font-semibold text-olive">最低的三维，以及具体怎么练</div>
            <div className="mt-1.5 space-y-1.5">
              {eq.low3.map((d) => (
                <div key={d.dim} className="text-[11.5px] leading-relaxed text-olive-soft">
                  <span className="font-medium text-olive">
                    {d.label}（{d.score}）
                  </span>
                  ：{d.tip}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* 建议 */}
      <section className="mt-6">
        <h2 className="text-[11px] font-bold tracking-wider text-olive-mute">发展建议</h2>
        <ol className="mt-2 space-y-1.5">
          {r.coaching.map((c, i) => (
            <li key={i} className="flex gap-2.5 rounded-xl border border-border bg-white px-3.5 py-2.5">
              <span className="mono mt-0.5 shrink-0 text-[11px] text-olive-mute">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-[12.5px] leading-relaxed text-olive-soft">{c}</span>
            </li>
          ))}
        </ol>
      </section>

      {/* 面试追问 */}
      <section className="mt-6 rounded-2xl border border-border bg-butter-pale/30 p-4">
        <h2 className="text-[11px] font-bold tracking-wider text-olive-mute">面谈时值得追问的</h2>
        <ul className="mt-2 space-y-1.5">
          {r.interview.map((s, i) => (
            <li key={i} className="text-[12.5px] leading-relaxed text-olive-soft">
              · {s}
            </li>
          ))}
        </ul>
      </section>

      {/* 口径 */}
      <section className="mt-6 rounded-xl border border-border bg-cream-deep/40 px-3.5 py-3">
        <div className="text-[11px] font-bold tracking-wider text-olive-mute">这份报告能用到什么程度</div>
        <ul className="mt-1.5 space-y-1">
          {r.caveats.map((c, i) => (
            <li key={i} className="text-[11px] leading-relaxed text-olive-soft">
              · {c}
            </li>
          ))}
        </ul>
      </section>

      {/* 附录：原始作答明细。正文讲「分数意味着什么」，附录讲「分数从哪几笔答出来」——
          复核、存档、跟候选人核对都能翻到这。 */}
      {r.appendix && r.appendix.sections.length > 0 && (
        <section className="appendix mt-8">
          <h2 className="text-[11px] font-bold tracking-wider text-olive-mute">附录 · 原始作答明细</h2>
          <p className="mt-1 text-[11px] text-olive-mute">
            共 {r.appendix.total} 题，已答 {r.appendix.answered} 题。逐题回显作答时的选择，供复核与存档。
          </p>
          {r.appendix.sections.map((sec) => {
            const done = sec.items.filter((i) => i.answer !== "未作答").length;
            return (
              <div key={sec.key} className="mt-4">
                <div className="flex items-baseline gap-2 border-b border-border pb-1.5">
                  <span className="text-[13px] font-semibold text-olive">{sec.title}</span>
                  <span className="mono text-[11px] text-olive-mute">
                    {done} / {sec.items.length}
                  </span>
                </div>
                <div className="mt-2 divide-y divide-border/50">
                  {sec.items.map((it) => (
                    <div key={it.id} className="flex gap-2.5 py-1.5">
                      <span className="mono mt-0.5 w-6 shrink-0 text-right text-[10px] text-olive-mute">{it.no}</span>
                      <div className="min-w-0 flex-1">
                        <div className="text-[12px] leading-relaxed text-olive-soft">{it.text}</div>
                        <div className={`mt-0.5 text-[12px] ${it.answer === "未作答" ? "text-olive-mute" : "font-medium text-brand"}`}>
                          作答：{it.answer}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}
