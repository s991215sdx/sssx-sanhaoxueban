import { RichText } from "@/components/RichText";
import { MENTAL_FACTOR_ORDER, buildMentalReport } from "@contracts/mentalHealth";
import type { MentalResult, MentalBand } from "@contracts/mentalHealth";
import { HeartHandshake, AlertTriangle, Lightbulb, ShieldAlert } from "lucide-react";

const BAND_STYLE: Record<MentalBand, string> = {
  无: "text-olive-mute",
  轻度: "text-olive",
  中度: "text-terra",
  重度: "text-terra font-bold",
};

const LEVEL_STYLE: Record<MentalResult["level"], string> = {
  良好: "border-lime/50 bg-lime-pale text-olive",
  关注: "border-butter bg-butter/25 text-olive",
  预警: "border-terra/50 bg-terra/10 text-terra",
};

/** 心理健康筛查详细报告（选做）。 */
export default function MentalDetail({ result }: { result: MentalResult }) {
  const report = buildMentalReport(result);
  return (
    <div className="space-y-4">
      {/* 免责声明（必须置于顶部） */}
      <div className="paper-card accent-l border-butter bg-butter/20 p-5">
        <h3 className="flex items-center gap-1.5 text-[14px] font-bold text-olive">
          <AlertTriangle size={15} className="text-terra" />
          免责声明
        </h3>
        <p className="mt-1.5 text-[12.5px] leading-relaxed text-olive-soft">{report.disclaimer}</p>
      </div>

      {/* 总览 */}
      <div className="paper-card p-5">
        <h2 className="flex items-center gap-2 text-[16px] font-bold text-olive">
          <HeartHandshake size={17} className="text-lime" />
          心理健康筛查 · 近一周状态
        </h2>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={`rounded-full border px-3.5 py-1 text-[13px] font-bold ${LEVEL_STYLE[report.level]}`}>
            整体状态：{report.level}
          </span>
          <span className="chip">总分 {report.total}</span>
          <span className="chip">阳性项目 {report.positiveCount} 项</span>
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-olive-soft">
          <RichText text={result.summary} />
        </p>
        {result.positiveFactors.length > 0 && (
          <p className="mt-2 text-[12.5px] text-olive-mute">
            阳性因子（均分 &gt; 2，需温柔关注）：
            {result.positiveFactors
              .map((f) => {
                const r = report.factors.find((x) => x.factor === f);
                return r ? `${r.label}（${r.band}）` : "";
              })
              .filter(Boolean)
              .join("、")}
            ；其余因子均在正常范围（绿色）。
          </p>
        )}
      </div>

      {/* 十因子得分 */}
      <div className="paper-card p-5">
        <h3 className="text-[14.5px] font-bold text-olive">十因子均分（1-5）</h3>
        <div className="mt-3 space-y-2">
          {report.factors.map((r) => (
            <div key={r.factor} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-[12.5px] text-olive-soft">{r.label}</span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
                <div
                  className={`h-full rounded-full ${r.score > 2 ? "bg-terra" : "bg-lime"}`}
                  style={{ width: `${(r.score / 5) * 100}%` }}
                />
              </div>
              <span className="mono w-9 text-right text-[12.5px] text-olive">{r.score.toFixed(2)}</span>
              <span className={`w-10 text-[11.5px] ${r.band === "无" ? "text-lime" : BAND_STYLE[r.band]}`}>
                {r.band === "无" ? "正常" : `${r.band}↑`}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 十因子详细解读 */}
      {report.factors.map((r) => (
        <div key={r.factor} className="paper-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-olive">
              {r.factor} · {r.label}
            </h3>
            <span className={`chip ${r.score > 2 ? "!border-terra/40 !text-terra" : ""}`}>
              {r.score.toFixed(2)} 分 · {r.band === "无" ? "正常" : `${r.band}·需关注`}
            </span>
          </div>
          <p className="mt-2 text-[13.5px] leading-relaxed text-olive-soft">{r.meaning}</p>
          {r.score > 2 && (
            <div className="mt-2.5 flex items-start gap-2 rounded-xl border border-terra/30 bg-terra/5 p-3">
              <ShieldAlert size={14} className="mt-0.5 shrink-0 text-terra" />
              <p className="text-[12.5px] leading-relaxed text-olive-soft">{r.riskText}</p>
            </div>
          )}
          <div className="mt-2.5 rounded-xl bg-cream p-3.5">
            <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-olive">
              <Lightbulb size={13} className="text-lime" />
              改善建议
            </p>
            <ul className="mt-1 space-y-1">
              {r.advice.map((a, i) => (
                <li key={i} className="flex gap-1.5 text-[13px] leading-relaxed text-olive-soft">
                  <span className="text-lime">·</span>
                  {a}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ))}

      {/* 底部再次提示 */}
      <div className="paper-card border-butter bg-butter/20 p-5">
        <p className="text-[12.5px] leading-relaxed text-olive-soft">
          再次提醒：本评估共 {MENTAL_FACTOR_ORDER.length * 3} 题，为筛查参考，不构成医学诊断。状态不好时，
          **先照顾好自己，再谈学习**——主动求助是勇敢，不是软弱。
        </p>
      </div>
    </div>
  );
}
