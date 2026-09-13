import { RichText } from "@/components/RichText";
import { ANCHOR_ORDER, ANCHOR_LABEL, buildAnchorReport } from "@contracts/careerAnchor";
import type { AnchorResult } from "@contracts/careerAnchor";
import { Anchor, BookOpen, Briefcase, Heart, Sparkles } from "lucide-react";

/** 职业锚测评详细报告（选做）。 */
export default function AnchorDetail({ result }: { result: AnchorResult }) {
  const report = buildAnchorReport(result);
  return (
    <div className="space-y-4">
      {/* 总览 */}
      <div className="paper-card p-5">
        <h2 className="flex items-center gap-2 text-[16px] font-bold text-olive">
          <Anchor size={17} className="text-lime" />
          职业锚 · 施恩八型
        </h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-olive-soft">
          <RichText text={result.summary} />
        </p>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {result.top2.map((k) => (
            <span key={k} className="chip !border-lime/50 !bg-lime-pale">
              {k} · {ANCHOR_LABEL[k]} {result.dims[k].toFixed(1)}
            </span>
          ))}
        </div>
      </div>

      {/* 八型得分 */}
      <div className="paper-card p-5">
        <h3 className="text-[14.5px] font-bold text-olive">八型得分（1-5，从高到低）</h3>
        <div className="mt-3 space-y-2">
          {[...ANCHOR_ORDER].sort((a, b) => result.dims[b] - result.dims[a]).map((k) => (
            <div key={k} className="flex items-center gap-3">
              <span className="w-28 shrink-0 text-[12.5px] text-olive-soft">{ANCHOR_LABEL[k]}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${(result.dims[k] / 5) * 100}%`,
                    background: result.top2.includes(k) ? "#c7a23a" : "#7cb83c", // Top2 标琥珀
                  }}
                />
              </div>
              <span className="mono w-8 text-right text-[12.5px] text-olive">{result.dims[k].toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 最突出两项详细解析 */}
      {report.top2.map((t) => (
        <div key={t.key} className="paper-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-olive">
              {t.code} · {t.label}
            </h3>
            <span className="chip">{t.score.toFixed(1)} / 5</span>
          </div>
          <p className="mt-2 text-[13.5px] leading-relaxed text-olive-soft">{t.feature}</p>
          <div className="mt-3 space-y-2.5">
            <div className="rounded-xl bg-cream p-3.5">
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-olive">
                <Briefcase size={13} className="text-lime" />
                更愿意从事的工作
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-olive-soft">{t.workStyle}</p>
            </div>
            <div className="rounded-xl bg-cream p-3.5">
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-olive">
                <Heart size={13} className="text-lime" />
                期望被认可的方式
              </p>
              <p className="mt-1 text-[13px] leading-relaxed text-olive-soft">{t.recognition}</p>
            </div>
            <div className="rounded-xl bg-cream p-3.5">
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-olive">
                <BookOpen size={13} className="text-lime" />
                对学习的影响与建议
              </p>
              <ul className="mt-1 space-y-1">
                {t.studyImpact.map((s, i) => (
                  <li key={i} className="flex gap-1.5 text-[13px] leading-relaxed text-olive-soft">
                    <span className="text-lime">·</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-cream p-3.5">
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-olive">
                <Sparkles size={13} className="text-lime" />
                主要职业领域
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {t.careerFields.map((f) => (
                  <span key={f} className="chip">
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* 八型简表 */}
      <div className="paper-card p-5">
        <h3 className="text-[14.5px] font-bold text-olive">八型简表</h3>
        <div className="mt-3 space-y-2">
          {[...report.table].sort((a, b) => b.score - a.score).map((row) => (
            <div
              key={row.key}
              className={`rounded-xl border p-3 ${row.isTop ? "border-lime/50 bg-lime-pale/50" : "border-border bg-cream"}`}
            >
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-olive">
                  {row.code} · {row.label}
                  {row.isTop && <span className="ml-1.5 text-[11px] font-normal text-lime">Top2</span>}
                </span>
                <span className="mono text-[12px] text-olive-mute">{row.score.toFixed(1)}</span>
              </div>
              <p className="mt-0.5 text-[12.5px] leading-relaxed text-olive-soft">{row.trait}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 理论依据 */}
      <div className="paper-card border-butter bg-butter/20 p-5">
        <p className="text-[12.5px] leading-relaxed text-olive-soft">{report.theoryNote}</p>
      </div>
    </div>
  );
}
