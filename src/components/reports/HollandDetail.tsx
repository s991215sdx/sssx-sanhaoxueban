import { RichText } from "@/components/RichText";
import { HOLLAND_ORDER, HOLLAND_LABEL, buildHollandReport } from "@contracts/holland";
import type { HollandResult } from "@contracts/holland";
import { Map, BookOpen, Briefcase, GraduationCap, Star } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

/** 霍兰德职业兴趣测评详细报告（选做）。 */
export default function HollandDetail({ result }: { result: HollandResult }) {
  const report = buildHollandReport(result);
  return (
    <div className="space-y-4">
      {/* 六型雷达图（优先图示，便于一眼判断主导兴趣） */}
      <div className="paper-card p-5">
        <h3 className="text-[14.5px] font-bold text-olive">六型兴趣雷达</h3>
        <p className="mt-1 text-[12.5px] text-olive-mute">
          外凸最明显的方向就是你的主导兴趣；相邻类型共同点较多，相对类型差异最大。
        </p>
        <div className="mt-2 h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart
              data={HOLLAND_ORDER.map((k) => ({ dim: `${k}·${HOLLAND_LABEL[k]}`, 得分: result.dims[k] }))}
              outerRadius="72%"
            >
              <PolarGrid stroke="#d9dcb8" />
              <PolarAngleAxis dataKey="dim" tick={{ fill: "#556339", fontSize: 12 }} />
              <Radar dataKey="得分" stroke="#cf6a3c" fill="#cf6a3c" fillOpacity={0.3} strokeWidth={2.5} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 总览 */}
      <div className="paper-card p-5">
        <h2 className="flex items-center gap-2 text-[16px] font-bold text-olive">
          <Map size={17} className="text-lime" />
          霍兰德职业兴趣 · RIASEC
        </h2>
        <div className="mt-3 flex items-center gap-3">
          <div className="rounded-xl bg-cream px-4 py-2.5 text-center">
            <div className="text-[11.5px] text-olive-mute">职业兴趣代码</div>
            <div className="mono mt-0.5 text-[20px] font-bold tracking-widest text-olive">{report.code}</div>
          </div>
          <div className="flex-1 text-[12.5px] leading-relaxed text-olive-soft">
            <span className="font-bold text-olive">个性关键词</span>
            <br />
            {report.keywords}
          </div>
        </div>
        <p className="mt-3 text-[13.5px] leading-relaxed text-olive-soft">
          <RichText text={result.summary} />
        </p>
      </div>

      {/* 六型得分 */}
      <div className="paper-card p-5">
        <h3 className="text-[14.5px] font-bold text-olive">六型得分（1-5）</h3>
        <div className="mt-3 space-y-2">
          {HOLLAND_ORDER.map((k) => (
            <div key={k} className="flex items-center gap-3">
              <span className="w-24 shrink-0 text-[12.5px] text-olive-soft">
                {k} · {HOLLAND_LABEL[k]}
              </span>
              <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream-deep">
                <div className="h-full rounded-full bg-lime" style={{ width: `${(result.dims[k] / 5) * 100}%` }} />
              </div>
              <span className="mono w-8 text-right text-[12.5px] text-olive">{result.dims[k].toFixed(1)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* top3 重点解读 */}
      <div className="paper-card accent-l border-butter bg-butter/20 p-5">
        <h3 className="flex items-center gap-1.5 text-[14.5px] font-bold text-olive">
          <Star size={15} className="text-lime" />
          兴趣代码「{report.code}」重点解读
        </h3>
        <div className="mt-2.5 space-y-2.5">
          {report.top3.map((t, i) => (
            <div key={t.key} className="rounded-xl bg-cream/70 p-3.5">
              <p className="text-[13px] font-bold text-olive">
                第 {i + 1} 位 · {t.key} {t.label}（{t.score.toFixed(1)} 分）
              </p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-olive-soft">{t.focus}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 六型详细分析 */}
      {report.dims.map((d) => (
        <div key={d.key} className="paper-card p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-[15px] font-bold text-olive">
              {d.key} · {d.label}
              {d.isTop && <span className="ml-1.5 text-[11px] font-normal text-lime">兴趣代码内</span>}
            </h3>
            <span className="chip">{d.score.toFixed(1)} / 5</span>
          </div>
          <p className="mt-2 text-[13.5px] leading-relaxed text-olive-soft">{d.trait}</p>
          <div className="mt-3 space-y-2.5">
            <div className="rounded-xl bg-cream p-3.5">
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-olive">
                <BookOpen size={13} className="text-lime" />
                对学习的影响与学科关联
              </p>
              <ul className="mt-1 space-y-1">
                {d.studyImpact.map((s, i) => (
                  <li key={i} className="flex gap-1.5 text-[13px] leading-relaxed text-olive-soft">
                    <span className="text-lime">·</span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl bg-cream p-3.5">
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-olive">
                <Briefcase size={13} className="text-lime" />
                匹配职业方向
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {d.careers.map((c) => (
                  <span key={c} className="chip">
                    {c}
                  </span>
                ))}
              </div>
            </div>
            <div className="rounded-xl bg-cream p-3.5">
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-olive">
                <GraduationCap size={13} className="text-lime" />
                对应大学专业举例
              </p>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {d.majors.map((m) => (
                  <span key={m} className="chip">
                    {m}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      ))}

      {/* 相邻/相隔/相对关系说明 */}
      <div className="paper-card border-butter bg-butter/20 p-5">
        <p className="text-[12.5px] leading-relaxed text-olive-soft">{report.relationNote}</p>
      </div>
    </div>
  );
}
