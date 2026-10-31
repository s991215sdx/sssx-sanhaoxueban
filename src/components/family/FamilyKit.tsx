/**
 * 家庭沟通锦囊（v239）· 报告的第四块之后
 *
 * 报告读到这里，家长通常已经知道「哪里不通」，但不知道「今晚回家第一句说什么」。
 * 这一块就是那一步：四个版本对应四种看的人，内容全部从本次作答推出来。
 *
 * 为什么不写成一页长文：四个版本互相打架——孩子版教他退出，家长版教他追问，
 * 放在一起读会互相抵消。所以要分人、分开看。
 */
import { useState } from "react";
import { BookOpen, X } from "lucide-react";
import type { KitPart } from "@contracts/familyKit";

export default function FamilyKit({ parts }: { parts: KitPart[] }) {
  const [open, setOpen] = useState<KitPart["key"] | null>(null);
  const current = parts.find((p) => p.key === open) ?? null;

  return (
    <>
      <section className="paper-card p-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="flex items-center gap-1.5 text-[16px] font-bold text-olive">
            <BookOpen size={16} className="shrink-0" />
            家庭沟通锦囊
          </h3>
          <span className="text-[11.5px] text-olive-mute">分人看，别四个人一起读</span>
        </div>
        <p className="mt-2 text-[13px] leading-relaxed text-olive-soft">
          报告讲的是「现在是什么样」，锦囊讲的是「下一步说什么」。四个版本分开写，是因为孩子和家长要做的动作本来就相反。
        </p>

        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {parts.map((p) => (
            <button
              key={p.key}
              onClick={() => setOpen(p.key)}
              className="rounded-xl border border-border bg-cream px-3.5 py-3 text-left transition-colors hover:border-olive/40 hover:bg-butter-pale/40"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13.5px] font-bold text-olive">{p.label}</span>
                {!p.ready && <span className="shrink-0 rounded bg-cream-deep px-1.5 py-px text-[10.5px] text-olive-mute">缺数据</span>}
              </div>
              <p className="mt-1 line-clamp-2 text-[12px] leading-relaxed text-olive-mute">{p.headline}</p>
              <p className="mt-1 text-[11.5px] text-olive-mute/80">{p.forWhom}</p>
            </button>
          ))}
        </div>
      </section>

      {current && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/45 px-3 py-6 sm:py-10"
          onClick={() => setOpen(null)}
        >
          <div
            className="w-full max-w-2xl rounded-2xl border border-border bg-cream-card p-5 shadow-xl sm:p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="mono text-[10.5px] tracking-wider text-olive-mute">家庭沟通锦囊 · {current.label}</p>
                <h3 className="mt-1 text-[17px] font-bold leading-snug text-olive">{current.headline}</h3>
                <p className="mt-1 text-[12px] text-olive-mute">{current.forWhom}</p>
              </div>
              <button onClick={() => setOpen(null)} className="shrink-0 rounded-lg p-1 text-olive-mute hover:text-olive" aria-label="关闭">
                <X size={18} />
              </button>
            </div>

            <div className="mt-3 flex flex-wrap gap-1.5">
              {parts.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setOpen(p.key)}
                  className={`rounded-full px-2.5 py-1 text-[11.5px] font-semibold transition-colors ${
                    p.key === current.key ? "bg-brand text-cream" : "border border-border bg-cream text-olive-soft hover:text-olive"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {!current.ready && current.missing && (
              <p className="mt-3 rounded-xl border border-butter bg-butter/20 px-3 py-2 text-[12.5px] leading-relaxed text-olive-soft">
                {current.missing}
              </p>
            )}

            <div className="mt-4 space-y-3">
              {current.blocks.map((b) => (
                <div key={b.h} className="rounded-xl border border-border/70 bg-cream px-3.5 py-3">
                  <h4 className="text-[13.5px] font-bold text-olive">{b.h}</h4>
                  <ul className="mt-1.5 space-y-1.5">
                    {b.lines.map((l) => (
                      <li key={l} className="text-[13px] leading-relaxed text-olive-soft">
                        {l}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>

            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-lime/50 bg-lime-pale/40 px-3.5 py-3">
                <div className="text-[12.5px] font-bold text-olive">可以直接照念</div>
                <ul className="mt-1.5 space-y-1">
                  {current.say.map((s) => (
                    <li key={s} className="text-[12.5px] leading-relaxed text-olive-soft">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-xl border border-terra/30 bg-terra/5 px-3.5 py-3">
                <div className="text-[12.5px] font-bold text-terra">这几句别说</div>
                <ul className="mt-1.5 space-y-1">
                  {current.avoid.map((s) => (
                    <li key={s} className="text-[12.5px] leading-relaxed text-olive-soft">
                      {s}
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <p className="mt-3 text-[11.5px] leading-relaxed text-olive-mute">
              锦囊只按本次作答推导，不做性格判断，也不替你做决定。四个版本里，只有「孩子本人」和「家长本人」那两份是给自己看的，
              另两份是给一家人坐下来谈的时候用的。
            </p>
          </div>
        </div>
      )}
    </>
  );
}
