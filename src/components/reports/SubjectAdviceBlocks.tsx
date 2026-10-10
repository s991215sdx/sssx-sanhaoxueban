/**
 * 学习力报告 v75：两个折叠块。
 * 1) 各学科学习建议与方法（分学段，含测评个性化加成）
 * 2) 学术/艺术/运动/生活 四项平衡规划
 * 默认折叠，按需打开（用户明确要求）。
 */
import { useMemo } from "react";
import { ChevronDown } from "lucide-react";
import type { AcademicsData } from "@contracts/academics";
import { stageOfGrade } from "@contracts/constants";
import type { Multi5Result } from "@contracts/multi5";
import { balancePlansFor, factorTip, personalTip, subjectMethodsFor, type PersonalCtx, type Stage } from "@/data/reports/subjectAdvice";

/** 学科 → 相关多元智能维度（与升学平衡卡 abilityOf 映射一致）。 */
const ABILITY_DIMS: Record<string, (d: Multi5Result["dims"]) => number> = {
  数学: (d) => Math.max(d.reasoning ?? 0, d.number ?? 0),
  物理: (d) => Math.max(d.reasoning ?? 0, d.spatial ?? 0),
  化学: (d) => Math.max(d.reasoning ?? 0, d.detail ?? 0),
  生物: (d) => d.detail ?? 0,
  历史: (d) => Math.max(d.verbal ?? 0, d.detail ?? 0),
  地理: (d) => Math.max(d.spatial ?? 0, d.detail ?? 0),
  语文: (d) => d.verbal ?? 0,
  英语: (d) => d.verbal ?? 0,
  道德与法治: (d) => d.verbal ?? 0,
};

function defaultFullScoreLocal(name: string, grade?: string | null): number {
  if (grade && /^高(一|二|三)$/.test(grade)) return 150;
  if (name === "语文" || name === "数学" || name === "英语") return 150;
  return 100;
}

function Fold({ title, sub, children, accent }: { title: string; sub?: string; children: React.ReactNode; accent?: string }) {
  return (
    <details className="group overflow-hidden rounded-xl border border-border bg-cream/50">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3.5 py-2.5 text-[13px] font-semibold text-olive transition-colors hover:bg-lime-pale/50">
        <span>
          {title}
          {sub && <span className="ml-2 font-normal text-olive-mute">{sub}</span>}
        </span>
        <ChevronDown size={15} className="shrink-0 text-olive-mute transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t border-border/70 px-3.5 py-3" style={accent ? { borderLeft: `3px solid ${accent}` } : undefined}>{children}</div>
    </details>
  );
}

export function SubjectAdviceBlocks({
  grade,
  academics,
  multi5,
  mbtiType,
  discPrimary,
  e3MainLabel,
}: {
  grade?: string | null;
  academics?: AcademicsData | null;
  multi5?: Multi5Result;
  /** 测评因子（v76 差异化扬长补短） */
  mbtiType?: string | null;
  discPrimary?: string | null;
  e3MainLabel?: string | null;
}) {
  const stage: Stage = (grade ? stageOfGrade(grade) : null) ?? "初中";
  const methods = useMemo(() => subjectMethodsFor(stage), [stage]);
  const plans = useMemo(() => balancePlansFor(stage), [stage]);

  /* 成绩上下文：得分率/趋势/差距，供个性化加成。 */
  const ctxMap = useMemo(() => {
    const m = new Map<string, PersonalCtx>();
    for (const s of academics?.subjects ?? []) {
      if (s.lastScore == null) continue;
      const full = s.fullScore ?? defaultFullScoreLocal(s.name, grade);
      m.set(s.name, { pct: (s.lastScore / full) * 100, gap: s.targetScore != null ? s.targetScore - s.lastScore : null });
    }
    return m;
  }, [academics, grade]);

  return (
    <div className="space-y-3 print:hidden">
      <Fold title="各学科学习建议与方法" sub={`按${stage}学段整理 · 结合测评结果个性化`}>
        <p className="mb-2.5 text-[11.5px] leading-relaxed text-olive-mute">
          通用方法之后紧跟一条基于本次测评数据的个性化建议；得分率与趋势来自最近一次录入的成绩。
        </p>
        <div className="space-y-2.5">
          {methods.map((m) => {
            const ctx = ctxMap.get(m.subject);
            const ability = multi5 ? (ABILITY_DIMS[m.subject]?.(multi5.dims) ?? null) : null;
            const personal = personalTip(m.subject, { ...ctx, ability });
            const factor = factorTip(m.subject, { ...ctx, ability, mbtiType, discPrimary, e3MainLabel });
            return (
              <div key={m.subject} className="rounded-lg border border-border/70 bg-cream/60 px-3 py-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-[13px] font-bold text-olive">{m.subject}</span>
                  {ctx?.pct != null && (
                    <span className={`mono text-[11px] font-semibold ${ctx.pct >= 80 ? "text-[#c43d28]" : ctx.pct < 60 ? "text-terra" : "text-[#b7791f]"}`}>
                      得分率 {Math.round(ctx.pct)}%{ctx.gap != null && ctx.gap > 0 ? ` · 距目标 ${Math.round(ctx.gap)} 分` : ""}
                    </span>
                  )}
                </div>
                {personal && <p className="mt-1.5 rounded-md bg-lime-pale/60 px-2.5 py-1.5 text-[12px] leading-relaxed text-olive"><b>个性化：</b>{personal}</p>}
                {factor && <p className="mt-1.5 rounded-md bg-sky-50 px-2.5 py-1.5 text-[12px] leading-relaxed text-sky-800"><b>测评打法：</b>{factor}</p>}
                <ul className="mt-1.5 space-y-1">
                  {m.methods.map((x, i) => (
                    <li key={i} className="flex gap-1.5 text-[12px] leading-relaxed text-olive-soft">
                      <span className="text-lime">•</span>
                      <span>{x}</span>
                    </li>
                  ))}
                </ul>
                {m.pitfalls.length > 0 && (
                  <p className="mt-1.5 text-[11.5px] leading-relaxed text-terra/90">
                    <b>常见误区：</b>{m.pitfalls.join("；")}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      </Fold>

      <Fold title="学术 · 艺术 · 运动 · 生活 四项平衡规划" sub="不只盯成绩，全面发展才是升学竞争力">
        <p className="mb-2.5 text-[11.5px] leading-relaxed text-olive-mute">
          借鉴综合素质评价体系（身心健康/艺术素养/社会实践），四项每周都要「有交代」，学术之外的三项同样是综评档案与面试素材。
        </p>
        <div className="grid gap-2.5 sm:grid-cols-2">
          {plans.map((p) => (
            <div key={p.key} className="rounded-lg border border-border/70 bg-cream/60 px-3 py-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[13px] font-bold text-olive">{p.icon} {p.label}</span>
                <span className="text-[10.5px] text-olive-mute">{p.weekly}</span>
              </div>
              <p className="mt-0.5 text-[11px] font-medium text-lime">{p.stage}</p>
              <ul className="mt-1.5 space-y-1">
                {p.tips.map((t, i) => (
                  <li key={i} className="flex gap-1.5 text-[12px] leading-relaxed text-olive-soft">
                    <span className="text-lime">•</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Fold>
    </div>
  );
}
