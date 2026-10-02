import { useMemo, useState } from "react";
import { BookOpenCheck, ChevronDown, ListChecks } from "lucide-react";
import { buildSubjectAnalysis, SUBJECT_STAGE_LABEL, type SubjectAssessmentResult } from "@contracts/subjectAssessment";

/**
 * v80 学科能力评估 · 分析报告：由测评结果纯函数推导结构化分析
 * （总体判断 → 逐科优势/短板 + 薄弱测评点 + 建议 → 优先行动清单），
 * 学生端与伴学师端共用（ReportView 的 subject 栏目内嵌渲染）。
 */
export default function SubjectAnalysisCard({ result }: { result: SubjectAssessmentResult }) {
  const analysis = useMemo(() => buildSubjectAnalysis(result), [result]);
  const [openSubjects, setOpenSubjects] = useState<string[]>([]);
  const toggle = (name: string) =>
    setOpenSubjects((list) => (list.includes(name) ? list.filter((x) => x !== name) : [...list, name]));

  return (
    <div className="paper-card p-5">
      <div className="flex items-center gap-2">
        <BookOpenCheck size={16} className="text-olive" />
        <h3 className="font-bold text-olive">学科分析报告</h3>
      </div>
      <p className="mt-2 rounded-xl bg-lime-pale/60 px-3.5 py-2.5 text-[14px] font-semibold leading-relaxed text-olive">
        {analysis.headline}
      </p>
      <ul className="mt-3 space-y-2">
        {analysis.overall.map((t, i) => (
          <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed text-olive-soft">
            <span className="mono mt-0.5 shrink-0 text-olive-mute">{i + 1}.</span>
            {t}
          </li>
        ))}
      </ul>

      {/* 优先行动清单 */}
      {analysis.priority.length > 0 && (
        <div className="mt-4 rounded-xl border border-butter bg-butter/30 p-3.5">
          <div className="flex items-center gap-1.5">
            <ListChecks size={15} className="text-olive" />
            <h4 className="text-[13.5px] font-bold text-olive">优先行动清单（从最不熟的环节开始）</h4>
          </div>
          <ol className="mt-2 space-y-2">
            {analysis.priority.map((p, i) => (
              <li key={i} className="text-[13px] leading-relaxed text-olive">
                <span className="mono mr-1.5 font-bold text-olive-mute">{i + 1}.</span>
                <b>{p.title}</b>
                <span className="text-olive-soft"> —— {p.detail}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* 逐科分析（默认折叠，点击展开） */}
      <div className="mt-4 space-y-2">
        {analysis.subjects.map((s) => {
          const open = openSubjects.includes(s.name);
          return (
            <div key={s.name} className="rounded-xl border border-border bg-cream/60">
              <button
                onClick={() => toggle(s.name)}
                className="flex w-full items-center justify-between px-3.5 py-2.5 text-left"
              >
                <span className="text-[13.5px] font-bold text-olive">
                  {s.name}
                  <span className="ml-2 text-[12px] font-semibold text-olive-mute">
                    {s.overall} 分 · {s.grade}
                  </span>
                </span>
                <ChevronDown size={15} className={`text-olive-mute transition-transform ${open ? "rotate-180" : ""}`} />
              </button>
              {open && (
                <div className="space-y-2.5 border-t border-border/60 px-3.5 py-3">
                  <p className="text-[13px] leading-relaxed text-olive">{s.verdict}</p>
                  <p className="text-[13px] leading-relaxed text-olive-soft">{s.compare}</p>
                  {s.weakPoints.length > 0 && (
                    <div className="rounded-lg bg-terra/10 px-3 py-2">
                      <p className="text-[12px] font-bold text-terra">薄弱测评点（自评 ≤2 分）</p>
                      <ul className="mt-1 space-y-0.5">
                        {s.weakPoints.map((w, i) => (
                          <li key={i} className="text-[12.5px] leading-relaxed text-olive-soft">
                            · {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {s.suggestions.length > 0 && (
                    <div>
                      <p className="text-[12px] font-bold text-olive">提升建议</p>
                      <ul className="mt-1 space-y-1">
                        {s.suggestions.map((g, i) => (
                          <li key={i} className="flex gap-2 text-[12.5px] leading-relaxed text-olive-soft">
                            <span className="mono shrink-0 text-olive-mute">{i + 1}.</span>
                            {g}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[12px] text-olive-mute">
        报告基于「听懂 → 记住 → 运用」学习环节的自评结果自动生成；{SUBJECT_STAGE_LABEL.听懂} 等完整口径见测评量表。
      </p>
    </div>
  );
}
