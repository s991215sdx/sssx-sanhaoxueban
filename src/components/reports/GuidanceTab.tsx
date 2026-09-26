import { Compass, Flame, GraduationCap, Heart, Route, Star, Target, TrendingUp, Users } from "lucide-react";
import { buildGuidanceReport, PATHWAY_CATS } from "@/data/reports/guidance";
import type { GuidanceRecord } from "@/data/reports/guidance";
import type { ReportAssessmentData, ReportProfileInfo } from "@/components/reports/ReportView";
import ScoreTrendChart from "@/components/reports/ScoreTrendChart";
import type { ScoreRecord } from "@/components/reports/ScoreTrendChart";
import type { AcademicsData } from "@contracts/academics";

const QUADRANT_STYLE: Record<string, { chip: string; bar: string }> = {
  优势学科: { chip: "border-lime/60 bg-lime-pale/70 text-olive", bar: "bg-lime" },
  潜能学科: { chip: "border-amber/60 bg-amber-50 text-amber-700", bar: "bg-amber" },
  稳健学科: { chip: "border-sky/60 bg-sky-50 text-sky-700", bar: "bg-sky" },
  谨慎学科: { chip: "border-rose/50 bg-rose-50 text-rose-700", bar: "bg-rose" },
  待观察: { chip: "border-stone-300 bg-stone-50 text-stone-500", bar: "bg-stone-300" },
};
const QUADRANT_ORDER = ["优势学科", "潜能学科", "稳健学科", "谨慎学科", "待观察"] as const;

/**
 * V73：升学指导综合报告 2.0——参考市面主流升学/生涯规划报告，接入真实成绩因子：
 * 学业现状（得分率+目标差距+趋势）→ 选科四象限（兴趣×学业）→ 选科组合推荐
 * → 兴趣/性格/能力 → 专业方向（带选科要求与门槛提示）→ 行业方向 → 升学路径 → 行动计划 → 给家长的话。
 */
export default function GuidanceTab({
  data,
  profile,
  academics,
  records,
  onAssess,
}: {
  data?: ReportAssessmentData;
  profile?: ReportProfileInfo;
  academics?: AcademicsData | null;
  records?: GuidanceRecord[] | null;
  onAssess?: (start: string) => void;
}) {
  const g = buildGuidanceReport({
    grade: profile?.grade,
    mbti: data?.mbti,
    disc: data?.disc,
    multi5: data?.multi5 ?? undefined,
    anchor: data?.anchor ?? undefined,
    holland: data?.holland ?? undefined,
    academics: academics ?? undefined,
    records: records ?? undefined,
  });

  if (!g) {
    return (
      <div className="paper-card mx-auto max-w-xl p-8 text-center">
        <Compass className="mx-auto h-10 w-10 text-olive-mute" />
        <p className="mt-3 font-semibold text-olive">还没有可用于升学指导的测评数据</p>
        <p className="mt-1 text-[13.5px] leading-relaxed text-olive-mute">
          完成下面的任意测评、或在「我的档案」里填一次成绩后，这里会自动生成你的升学指导报告（测评做得越全、成绩越新，报告越准）。
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {(["holland", "anchor", "mbti", "disc", "multi5"] as const).map((k) => (
            <button
              key={k}
              onClick={() => onAssess?.(k)}
              className="rounded-full border border-lime/50 bg-lime-pale/60 px-3 py-1.5 text-[12.5px] font-semibold text-olive hover:border-lime"
            >
              去测{{ holland: "霍兰德职业兴趣", anchor: "职业锚", mbti: "MBTI", disc: "DISC", multi5: "多元智能五项" }[k]} →
            </button>
          ))}
        </div>
      </div>
    );
  }

  const trendIcon = (t: "up" | "down" | "flat" | null, pct: number | null) =>
    t === "up" ? <span className="text-[11px] font-bold text-lime">↗ {pct != null ? `+${pct}%` : "上升"}</span>
    : t === "down" ? <span className="text-[11px] font-bold text-rose">↘ {pct != null ? `${pct}%` : "下滑"}</span>
    : null;

  return (
    <div className="space-y-4">
      {/* 头卡 */}
      <div className="paper-card accent-l border-lime p-5">
        <div className="flex items-center gap-2">
          <Compass size={17} className="text-olive" />
          <h3 className="font-bold text-olive">升学指导综合报告</h3>
        </div>
        <p className="mt-2 text-[15px] font-bold leading-relaxed text-olive">{g.headline}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-olive-mute">
          基于 {g.basedOn.join("、")} 交叉分析
          {g.missing.length > 0 && <>；再补充 {g.missing.join("、")} 会更准</>}
          。回答三个问题：<b className="text-olive">选什么科 · 学什么专业 · 进什么行业</b>。
        </p>
      </div>

      {/* 学业现状 */}
      {g.academicsBlock && (
        <div className="paper-card p-5">
          <div className="flex items-center gap-2">
            <TrendingUp size={16} className="text-olive" />
            <h3 className="font-bold text-olive">学业现状（{g.academicsBlock.examName}）</h3>
            {g.academicsBlock.avgPct != null && (
              <span className="ml-auto rounded-full bg-lime-pale/70 px-2.5 py-0.5 text-[11.5px] font-bold text-olive">
                平均得分率 {g.academicsBlock.avgPct}%
              </span>
            )}
          </div>
          <div className="mt-3 space-y-2.5">
            {g.academicsBlock.rows.map((r) => (
              <div key={r.name}>
                <div className="flex items-baseline justify-between text-[12.5px]">
                  <span className="font-semibold text-olive">
                    {r.name}
                    <span className="ml-1.5 font-normal text-olive-mute">{r.raw}/{r.full}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    {trendIcon(r.trend, r.trendPct)}
                    {r.targetPct != null && <span className="text-olive-mute">目标 {r.targetPct}%</span>}
                    <b className={r.pct >= 70 ? "text-lime" : r.pct >= 60 ? "text-amber" : "text-rose"}>{r.pct}%</b>
                  </span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-olive/8">
                  <div
                    className={`h-full rounded-full ${r.pct >= 70 ? "bg-lime" : r.pct >= 60 ? "bg-amber" : "bg-rose"}`}
                    style={{ width: `${Math.min(100, r.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[12.5px] leading-relaxed text-olive-mute">
            得分率 = 得分 ÷ 满分，比原始分更可比。{records && records.length >= 2 ? "下方曲线来自多次成绩记录。" : "多次录入成绩后，下方会出现变化曲线与趋势判断。"}
          </p>
          {records && records.length >= 2 && (
            <div className="mt-3 border-t border-olive/10 pt-3">
              <ScoreTrendChart records={records as ScoreRecord[]} />
            </div>
          )}
        </div>
      )}

      {/* 选科建议（核心）：四象限 + 推荐组合 */}
      {(g.matrix || g.combos.length > 0) && (
        <div className="paper-card p-5">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-olive" />
            <h3 className="font-bold text-olive">选科建议{g.matrix ? "（兴趣 × 学业四象限）" : ""}</h3>
          </div>
          {g.matrix && (
            <div className="mt-3 space-y-3">
              {QUADRANT_ORDER.map((q) => {
                const items = g.matrix!.filter((m) => m.quadrant === q);
                if (items.length === 0) return null;
                return (
                  <div key={q}>
                    <div className="flex items-center gap-1.5 text-[12.5px] font-bold text-olive">
                      <span className={`inline-block h-2.5 w-2.5 rounded-full ${QUADRANT_STYLE[q].bar}`} />
                      {q}
                      <span className="font-normal text-olive-mute">（{items.map((i) => i.name).join("、")}）</span>
                    </div>
                    <p className="mt-1 text-[12.5px] leading-relaxed text-olive-soft">{items[0].note}</p>
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-4 border-t border-olive/10 pt-3">
            <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-olive">
              <Star size={14} className="text-amber" /> 推荐组合
            </p>
            <div className="space-y-2.5">
              {g.combos.map((c) => (
                <div key={c.title} className="rounded-xl border border-olive/12 bg-cream/60 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-[13px] font-bold text-olive">{c.title}</span>
                    <span className="text-[13px] tracking-wider text-amber" aria-label={`推荐度 ${c.stars}/3`}>
                      {"★".repeat(c.stars)}{"☆".repeat(3 - c.stars)}
                    </span>
                  </div>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-olive-soft">{c.reason}</p>
                  {c.risk && <p className="mt-1 text-[12px] leading-relaxed text-rose">⚠ {c.risk}</p>}
                </div>
              ))}
            </div>
            <div className="mt-3 space-y-1">
              {g.subjectAdvice.map((s, i) => (
                <p key={i} className="text-[12.5px] leading-relaxed text-olive-mute">· {s}</p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 兴趣与驱动力 */}
      {g.hollandBlock && (
        <div className="paper-card p-5">
          <div className="flex items-center gap-2">
            <Heart size={16} className="text-olive" />
            <h3 className="font-bold text-olive">兴趣与驱动力（霍兰德 {g.hollandBlock.code}）</h3>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {g.hollandBlock.top3.map((t) => (
              <div key={t.key} className="rounded-xl border border-olive/12 bg-cream/60 px-3 py-2">
                <p className="text-[12.5px] font-bold text-olive">
                  {t.label} <span className="font-normal text-olive-mute">{t.score} 分</span>
                </p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-olive-soft">职业：{t.careers.slice(0, 3).join("、")}</p>
              </div>
            ))}
          </div>
          {g.anchorBlock && (
            <p className="mt-2.5 text-[12.5px] leading-relaxed text-olive-soft">
              职业锚主导：{g.anchorBlock.map((a) => `${a.label}（${a.score} 分，${a.workStyle}）`).join("；")}——择业时「想要什么」比「能做什么」更影响长期满意度。
            </p>
          )}
        </div>
      )}

      {/* 性格升学打法 */}
      {(g.mbtiBlock || g.discBlock) && (
        <div className="paper-card p-5">
          <div className="flex items-center gap-2">
            <Users size={16} className="text-olive" />
            <h3 className="font-bold text-olive">性格升学打法</h3>
          </div>
          {g.mbtiBlock && (
            <div className="mt-3">
              <p className="text-[12.5px] font-bold text-olive">
                {g.mbtiBlock.type} · {g.mbtiBlock.name}
              </p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-olive-soft">{g.mbtiBlock.fieldSlant}</p>
              <ul className="mt-1.5 space-y-1">
                {g.mbtiBlock.studyStyle.map((s, i) => (
                  <li key={i} className="text-[12.5px] leading-relaxed text-olive-mute">· {s}</li>
                ))}
              </ul>
            </div>
          )}
          {g.discBlock && (
            <div className="mt-3 border-t border-olive/10 pt-3">
              <p className="text-[12.5px] font-bold text-olive">DISC · {g.discBlock.name}（主导 {g.discBlock.primary}）</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-olive-soft">{g.discBlock.roleStyle}</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-olive-mute">{g.discBlock.scene}</p>
            </div>
          )}
        </div>
      )}

      {/* 能力底子 */}
      {g.multi5Block && (
        <div className="paper-card p-5">
          <div className="flex items-center gap-2">
            <Flame size={16} className="text-olive" />
            <h3 className="font-bold text-olive">能力底子（五项智能 Top {g.multi5Block.length}）</h3>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {g.multi5Block.map((d) => (
              <div key={d.label} className="rounded-xl border border-olive/12 bg-cream/60 px-3 py-2">
                <p className="text-[12.5px] font-bold text-olive">{d.label} {d.score}</p>
                <p className="mt-0.5 text-[12px] text-olive-soft">{d.feature}</p>
                <p className="text-[11.5px] text-olive-mute">{d.career.slice(0, 2).join("、")}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 专业方向（带选科要求 + 成绩门槛提示） */}
      {g.majors.length > 0 && (
        <div className="paper-card p-5">
          <div className="flex items-center gap-2">
            <GraduationCap size={16} className="text-olive" />
            <h3 className="font-bold text-olive">推荐专业方向</h3>
          </div>
          <div className="mt-3 space-y-2">
            {g.majors.map((m) => (
              <div key={m.name} className="rounded-xl border border-olive/12 bg-cream/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[13px] font-bold text-olive">{m.name}</span>
                  <span className="rounded-full bg-lime-pale/70 px-2 py-0.5 text-[11px] font-semibold text-olive-mute">{m.why}</span>
                  {m.req && <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[11px] font-semibold text-sky-700">选科要求：{m.req}</span>}
                </div>
                {m.gateNote && <p className={`mt-1 text-[12px] leading-relaxed ${m.gateNote.includes("不足") ? "text-rose" : "text-olive-mute"}`}>{m.gateNote}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 行业方向 */}
      {g.industries.length > 0 && (
        <div className="paper-card p-5">
          <h3 className="font-bold text-olive">行业方向参考</h3>
          <div className="mt-3 flex flex-wrap gap-2">
            {g.industries.map((i) => (
              <div key={i.name} className="rounded-full border border-olive/12 bg-cream/60 px-3 py-1.5 text-[12.5px]">
                <b className="text-olive">{i.name}</b>
                <span className="ml-1.5 text-olive-mute">{i.why}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 升学路径（六大类全路径） */}
      {g.pathway.length > 0 && (
        <div className="paper-card p-5">
          <div className="flex items-center gap-2">
            <Route size={16} className="text-olive" />
            <h3 className="font-bold text-olive">升学路径适配</h3>
            <span className="ml-auto text-[11px] text-olive-mute">主力 = 当前主战场 · 适配 = 数据支持 · 关注 = 值得了解 · 参考 = 看条件</span>
          </div>
          <div className="mt-3 space-y-3.5">
            {PATHWAY_CATS.map((cat) => {
              const items = g.pathway.filter((p) => p.cat === cat);
              if (items.length === 0) return null;
              return (
                <div key={cat} className="border-t border-olive/10 pt-3 first:border-0 first:pt-0">
                  <p className="text-[12px] font-bold tracking-wide text-olive-mute">{cat}</p>
                  <div className="mt-1.5 space-y-2.5">
                    {items.map((p) => (
                      <div key={p.name} className="flex items-start gap-2.5">
                        <span
                          className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            p.fit === "主力" ? "bg-lime text-cream"
                            : p.fit === "适配" ? "bg-sky text-cream"
                            : p.fit === "关注" ? "bg-amber text-cream"
                            : "bg-olive/15 text-olive"
                          }`}
                        >
                          {p.fit}
                        </span>
                        <div>
                          <p className="text-[13px] font-bold text-olive">
                            {p.name}
                            {p.cond && (
                              <span className="ml-1.5 rounded-full bg-olive/8 px-2 py-0.5 align-middle text-[10.5px] font-semibold text-olive-mute">
                                {p.cond}
                              </span>
                            )}
                          </p>
                          <p className="mt-0.5 text-[12.5px] leading-relaxed text-olive-soft">{p.note}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 行动建议（分阶段） */}
      {g.actionTips.length > 0 && (
        <div className="paper-card p-5">
          <h3 className="font-bold text-olive">行动建议</h3>
          <div className="mt-3 space-y-2.5">
            {g.actionTips.map((a, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0 rounded-full bg-lime-pale/80 px-2 py-0.5 text-[11px] font-bold text-olive">{a.phase}</span>
                <p className="text-[12.5px] leading-relaxed text-olive-soft">{a.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 给家长的话 */}
      {g.parentTips.length > 0 && (
        <div className="paper-card p-5">
          <h3 className="font-bold text-olive">给家长的话</h3>
          <ul className="mt-2.5 space-y-1.5">
            {g.parentTips.map((t, i) => (
              <li key={i} className="text-[12.5px] leading-relaxed text-olive-soft">· {t}</li>
            ))}
          </ul>
        </div>
      )}

      {/* 免责声明 */}
      <p className="px-2 text-center text-[11.5px] leading-relaxed text-olive-mute">
        本报告基于测评与成绩数据生成，仅供升学规划参考；选科与志愿请以学校正式通知、省级招考政策与个人意愿为准。
      </p>
    </div>
  );
}
