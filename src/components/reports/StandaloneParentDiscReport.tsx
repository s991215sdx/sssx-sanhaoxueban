/**
 * 家长扫码直测（/pd）的独立 DISC 报告：无学生上下文时复用的完整渲染组件。
 * 与 ReportView 的 DiscParentDetail 同构，但不依赖学员档案（无孩子 DISC 时自然省略冲突点段落）。
 */
import { getDiscCombo, DISC_ANIMAL, DISC_REPORTS } from "@/data/reports";
import { PARENT_DISC_ADJUST } from "@/components/reports/DiscParentCompare";
import { discTendencyFromDims, type DiscResult } from "@contracts/assessments";
import DiscTendencyChart from "@/components/reports/DiscTendencyChart";
import { DiscBipolarAxis, DiscReboundExplain, PARENT_DISC_STYLE } from "@/components/reports/ReportView";

export default function StandaloneParentDiscReport({ label, result }: { label: string; result: DiscResult }) {
  const combo = getDiscCombo(result.dims);
  const report = DISC_REPORTS[result.primary];
  const style = PARENT_DISC_STYLE[result.primary];
  const tendency = discTendencyFromDims(result.dims, result.version);
  return (
    <div className="paper-card p-5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[#E3B53A]/70 bg-[#E3B53A]/15 px-2.5 py-0.5 text-[11.5px] font-bold text-[#8A6500]">
          家长版 · {label}
        </span>
        <span className="text-xl font-bold text-olive">
          {combo.join("")} 型{report ? ` · ${report.name}` : ""}
        </span>
        <span className="text-[12px] text-olive-mute">{combo.map((k) => DISC_ANIMAL[k]).join(" + ")}</span>
      </div>
      <p className="mt-1.5 text-[13.5px] text-olive-soft">
        <b className="text-olive">管教风格：</b>
        {label}偏 {result.primary} 型（{style.style}）。这份报告是{label}本人完成的 DISC
        行为测评结果，可作为亲子沟通的参考。
      </p>
      {/* 行为特征轴（与学生详版同一份口径） */}
      <DiscBipolarAxis tendency={tendency} />
      {/* 双极倾向度图（家长版） */}
      <div className="mt-4 -mx-5">
        <DiscTendencyChart dims={result.dims} version={result.version} title={`${label} 的行为之镜 · DISC 四因子倾向度（家长版）`} who={label} />
      </div>
      <DiscReboundExplain tendency={tendency} />
      <div className="mt-3 space-y-2 text-[13px] leading-relaxed text-olive-soft">
        <p>
          <b className="text-olive">管教建议：</b>
          {style.tip}
        </p>
        <div className="rounded-xl border border-butter/60 bg-butter/10 px-3 py-2">
          <div className="text-[12.5px] font-bold text-olive">{label} 的管教风格 · 三点调整</div>
          <ul className="mt-1 space-y-0.5">
            {PARENT_DISC_ADJUST[result.primary].map((t, i) => (
              <li key={i} className="text-[12px] leading-relaxed text-olive-soft">
                {i + 1}. {t}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
