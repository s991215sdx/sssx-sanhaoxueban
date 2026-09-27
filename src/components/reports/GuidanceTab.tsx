import { Compass, Flame, GraduationCap, Heart, Route, School, Star, Target, TrendingUp, Users } from "lucide-react";
import { buildGuidanceReport, PATHWAY_CATS } from "@/data/reports/guidance";
import type { GuidanceRecord } from "@/data/reports/guidance";
import { COMBO_COVERAGE, CONSIDER_FACTORS, EARLY_BATCH, SUBJECT_MAJOR_MAP } from "@/data/reports/guidanceData";
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

const VERDICT_STYLE: Record<string, string> = {
  强烈推荐: "bg-lime text-cream",
  推荐: "bg-sky text-cream",
  可选: "bg-amber text-cream",
  慎重: "bg-rose/80 text-cream",
};

function Fold({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <details className="group mt-3 overflow-hidden rounded-xl border border-olive/12 bg-cream/50">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 px-3.5 py-2.5 text-[13px] font-semibold text-olive transition-colors hover:bg-lime-pale/50">
        <span>
          {title}
          {sub && <span className="ml-2 font-normal text-olive-mute">{sub}</span>}
        </span>
        <span className="text-[11px] font-normal text-lime">展开 ▾</span>
      </summary>
      <div className="border-t border-olive/10 px-3.5 py-3">{children}</div>
    </details>
  );
}

function GroupDivider({ no, title }: { no: string; title: string }) {
  return (
    <div className="flex items-center gap-2.5 px-1 pt-2">
      <span className="rounded-lg bg-olive px-2 py-1 text-[12px] font-bold text-cream">{no}</span>
      <h2 className="text-[15px] font-bold text-olive">{title}</h2>
      <div className="h-px flex-1 bg-olive/15" />
    </div>
  );
}

/**
 * v75：升学指导综合报告 3.0——按规划报告标准目录重排：
 * 学业现状 → 四、个性化选科规划（4.1 自我探索测评解读 / 4.2 学科与专业关系 / 4.3 本科专业规划 / 4.4 选科规划方案含多测评决策平衡卡）
 * → 五、多元升学路径规划（5.1 路径含提前批介绍 / 5.2 目标院校冲稳保）→ 行动建议 → 给家长的话。
 * 能用图表的用图表；数据型知识（学科专业关系、12 组合覆盖率、提前批结构）默认折叠按需打开。
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

  const highSchool = /高中|高一|高二|高三/.test(profile?.grade ?? "");

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

  const hasSelfExplore = g.hollandBlock || g.mbtiBlock || g.discBlock || g.multi5Block;

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
          。回答三个问题：<b className="text-olive">选什么科 · 学什么专业 · 走什么路径</b>。
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

      <GroupDivider no="四" title="个性化选科规划" />

      {/* 4.1 自我探索（测评解读）：兴趣/性格/能力合并一块 */}
      {hasSelfExplore && (
        <div className="paper-card p-5">
          <h3 className="font-bold text-olive">4.1 自我探索（测评解读）</h3>
          <p className="mt-0.5 text-[12px] text-olive-mute">所有测评结论服务于同一个问题：我是谁，我适合怎么学、往哪走。</p>

          {g.hollandBlock && (
            <div className="mt-3">
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-olive">
                <Heart size={14} className="text-terra" /> 职业兴趣（霍兰德 {g.hollandBlock.code}）
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
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
                <p className="mt-2 text-[12.5px] leading-relaxed text-olive-soft">
                  职业锚主导：{g.anchorBlock.map((a) => `${a.label}（${a.score} 分，${a.workStyle}）`).join("；")}——择业时「想要什么」比「能做什么」更影响长期满意度。
                </p>
              )}
            </div>
          )}

          {(g.mbtiBlock || g.discBlock) && (
            <div className={`mt-3 ${g.hollandBlock ? "border-t border-olive/10 pt-3" : ""}`}>
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-olive">
                <Users size={14} className="text-sky" /> 性格与升学打法
              </p>
              {g.mbtiBlock && (
                <div className="mt-2">
                  <p className="text-[12.5px] font-bold text-olive">
                    MBTI {g.mbtiBlock.type} · {g.mbtiBlock.name}
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
                <div className="mt-2.5">
                  <p className="text-[12.5px] font-bold text-olive">DISC · {g.discBlock.name}（主导 {g.discBlock.primary}）</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-olive-soft">{g.discBlock.roleStyle}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-olive-mute">{g.discBlock.scene}</p>
                </div>
              )}
            </div>
          )}

          {g.multi5Block && (
            <div className={`mt-3 ${g.hollandBlock || g.mbtiBlock || g.discBlock ? "border-t border-olive/10 pt-3" : ""}`}>
              <p className="flex items-center gap-1.5 text-[13px] font-bold text-olive">
                <Flame size={14} className="text-amber" /> 能力底子（五项智能 Top {g.multi5Block.length}）
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
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
        </div>
      )}

      {/* 4.2 高中学科与专业之间关系（知识表，折叠） */}
      {highSchool && (
        <div className="paper-card p-5">
          <h3 className="font-bold text-olive">4.2 高中学科与专业之间关系</h3>
          <Fold title="六大学科 ↔ 大学专业对照表" sub="点开看每科对应的专业大类">
            <div className="space-y-2.5">
              {SUBJECT_MAJOR_MAP.map((s) => (
                <div key={s.subject} className="rounded-xl border border-olive/12 bg-cream/60 p-3">
                  <p className="text-[13px] font-bold text-olive">{s.subject}</p>
                  <p className="mt-0.5 text-[12px] leading-relaxed text-olive-mute">{s.intro}</p>
                  <p className="mt-1.5 text-[12px] leading-relaxed text-olive-soft"><b>关联专业：</b>{s.majors}</p>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-olive-mute">
              注：普通高校本科招生专业选考科目要求以各省教育考试院当年公布为准；「不提科目要求」的专业原则上物理/历史兼收。
            </p>
          </Fold>
        </div>
      )}

      {/* 4.3 本科专业规划：12 学科门类匹配表 + 推荐专业 + 行业 */}
      {(g.disciplines.length > 0 || g.majors.length > 0) && (
        <div className="paper-card p-5">
          <div className="flex items-center gap-2">
            <GraduationCap size={16} className="text-olive" />
            <h3 className="font-bold text-olive">4.3 本科专业规划</h3>
          </div>

          {/* 12 学科门类匹配度（决策平衡卡同源的匹配结果） */}
          {g.disciplines.length > 0 && (
            <div className="mt-3">
              <p className="text-[13px] font-bold text-olive">12 大学科门类匹配度（Top {g.disciplines.length}）</p>
              <div className="mt-2 space-y-2.5">
                {g.disciplines.map((d) => (
                  <div key={d.key} className="rounded-xl border border-olive/12 bg-cream/60 p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-[13px] font-bold text-olive">
                        {d.name}
                        <span className="ml-1.5 rounded-full bg-olive/8 px-2 py-0.5 align-middle text-[10.5px] font-semibold text-olive-mute">选科要求：{d.req}</span>
                      </p>
                      <b className={`text-[13px] ${d.matchPct >= 75 ? "text-lime" : d.matchPct >= 65 ? "text-sky" : "text-amber"}`}>{d.matchPct}%</b>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-olive/8">
                      <div
                        className={`h-full rounded-full ${d.matchPct >= 75 ? "bg-lime" : d.matchPct >= 65 ? "bg-sky" : "bg-amber"}`}
                        style={{ width: `${d.matchPct}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[12px] leading-relaxed text-olive-mute"><b>下设大类：</b>{d.groups.join("、")}</p>
                    <p className="mt-0.5 text-[12px] leading-relaxed text-olive-soft"><b>代表专业：</b>{d.majors.slice(0, 6).join("、")}{d.majors.length > 6 ? " 等" : ""}</p>
                    <p className="mt-1 text-[11.5px] leading-relaxed text-olive-mute">匹配依据：{d.why}。{d.note}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 推荐专业方向（带选科要求 + 成绩门槛提示） */}
          {g.majors.length > 0 && (
            <div className={`mt-3 ${g.disciplines.length > 0 ? "border-t border-olive/10 pt-3" : ""}`}>
              <p className="text-[13px] font-bold text-olive">推荐专业方向（结合选科要求）</p>
              <div className="mt-2 space-y-2">
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
            <div className={`mt-3 ${g.disciplines.length > 0 || g.majors.length > 0 ? "border-t border-olive/10 pt-3" : ""}`}>
              <p className="text-[13px] font-bold text-olive">行业方向参考</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {g.industries.map((i) => (
                  <div key={i.name} className="rounded-full border border-olive/12 bg-cream/60 px-3 py-1.5 text-[12.5px]">
                    <b className="text-olive">{i.name}</b>
                    <span className="ml-1.5 text-olive-mute">{i.why}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4.4 选科规划方案：决策平衡卡 + 四象限 + 组合 + 考虑因素 + 覆盖率 */}
      {(g.scorecard || g.matrix || g.combos.length > 0) && (
        <div className="paper-card p-5">
          <div className="flex items-center gap-2">
            <Target size={16} className="text-olive" />
            <h3 className="font-bold text-olive">4.4 选科规划方案</h3>
          </div>

          {/* 首选决策（物理/历史 2 选 1） */}
          {g.firstDecision && (
            <div className="mt-3 rounded-xl border border-olive/12 bg-cream/60 p-3">
              <p className="text-[13px] font-bold text-olive">
                首选决策：<span className="text-lime">{g.firstDecision.pick}</span>
                <span className="ml-1.5 text-[11px] font-normal text-olive-mute">（广东 3+1+2：物理 / 历史 二选一）</span>
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                <div className={`rounded-lg px-3 py-2 ${g.firstDecision.pick === "物理" ? "bg-lime-pale/70" : "bg-cream"}`}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12.5px] font-bold text-olive">物理</span>
                    <b className="mono text-[14px] text-olive">{g.firstDecision.physScore}</b>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-olive/8">
                    <div className={`h-full rounded-full ${g.firstDecision.pick === "物理" ? "bg-lime" : "bg-olive/25"}`} style={{ width: `${Math.min(100, g.firstDecision.physScore)}%` }} />
                  </div>
                </div>
                <div className={`rounded-lg px-3 py-2 ${g.firstDecision.pick === "历史" ? "bg-lime-pale/70" : "bg-cream"}`}>
                  <div className="flex items-baseline justify-between">
                    <span className="text-[12.5px] font-bold text-olive">历史</span>
                    <b className="mono text-[14px] text-olive">{g.firstDecision.histScore}</b>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-olive/8">
                    <div className={`h-full rounded-full ${g.firstDecision.pick === "历史" ? "bg-lime" : "bg-olive/25"}`} style={{ width: `${Math.min(100, g.firstDecision.histScore)}%` }} />
                  </div>
                </div>
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-olive-soft">{g.firstDecision.text}</p>
            </div>
          )}

          {/* 再选决策（4 选 2） */}
          {g.secondDecision && (
            <div className="mt-2.5 rounded-xl border border-olive/12 bg-cream/60 p-3">
              <p className="text-[13px] font-bold text-olive">
                再选决策：{g.secondDecision.picks.join(" + ")}
                <span className="ml-1.5 text-[11px] font-normal text-olive-mute">（化学 / 生物 / 道法 / 地理 四选二）</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {g.secondDecision.picks.map((p) => (
                  <span key={p} className="rounded-full bg-lime px-2.5 py-0.5 text-[11.5px] font-bold text-cream">选 {p}</span>
                ))}
                {g.secondDecision.dropped.map((p) => (
                  <span key={p} className="rounded-full bg-olive/10 px-2.5 py-0.5 text-[11.5px] font-semibold text-olive-mute">备选 {p}</span>
                ))}
              </div>
              <p className="mt-2 text-[12.5px] leading-relaxed text-olive-soft">{g.secondDecision.text}</p>
            </div>
          )}

          {/* 多测评决策平衡卡 */}
          {g.scorecard && (
            <div className="mt-3">
              <p className="text-[13px] font-bold text-olive">多测评决策平衡卡</p>
              <p className="mt-0.5 text-[11.5px] leading-relaxed text-olive-mute">
                加权总分 = 学业成绩×{g.scorecard.weights[0].pct}% + 学科兴趣×{g.scorecard.weights[1].pct}% + 能力匹配×{g.scorecard.weights[2].pct}% + 专业覆盖×{g.scorecard.weights[3].pct}%（学业/能力取自成绩与多元智能测评，兴趣取自霍兰德+测评问卷；缺数据按中位 55 分计）
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[520px] border-collapse text-[11.5px] sm:text-[12px]">
                  <thead>
                    <tr className="border-b border-olive/15 text-left text-olive-mute">
                      <th className="py-1.5 pr-2 font-semibold">学科</th>
                      <th className="py-1.5 pr-2 text-center font-semibold">学业成绩</th>
                      <th className="py-1.5 pr-2 text-center font-semibold">学科兴趣</th>
                      <th className="py-1.5 pr-2 text-center font-semibold">能力匹配</th>
                      <th className="py-1.5 pr-2 text-center font-semibold">专业覆盖</th>
                      <th className="py-1.5 pr-2 text-center font-semibold">加权总分</th>
                      <th className="py-1.5 text-center font-semibold">结论</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.scorecard.rows.map((r) => (
                      <tr key={r.subject} className="border-b border-olive/8 last:border-0">
                        <td className="py-1.5 pr-2 font-semibold text-olive">{r.subject}</td>
                        <td className="py-1.5 pr-2 text-center text-olive-soft">{r.score}</td>
                        <td className="py-1.5 pr-2 text-center text-olive-soft">{r.interest}</td>
                        <td className="py-1.5 pr-2 text-center text-olive-soft">{r.ability}</td>
                        <td className="py-1.5 pr-2 text-center text-olive-soft">{r.coverage}</td>
                        <td className="py-1.5 pr-2 text-center font-bold text-olive">{r.total}</td>
                        <td className="py-1.5 text-center">
                          <span className={`inline-block rounded-full px-2 py-0.5 text-[10.5px] font-bold ${VERDICT_STYLE[r.verdict]}`}>{r.verdict}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 兴趣 × 学业四象限 */}
          {g.matrix && (
            <div className="mt-3 border-t border-olive/10 pt-3">
              <p className="text-[13px] font-bold text-olive">兴趣 × 学业四象限</p>
              <div className="mt-2 space-y-3">
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
            </div>
          )}

          {/* 推荐组合 */}
          {g.combos.length > 0 && (
            <div className="mt-3 border-t border-olive/10 pt-3">
              <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-olive">
                <Star size={14} className="text-amber" /> 推荐组合（由决策平衡卡得分生成）
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
          )}

          {/* 12 组合专业覆盖率（知识表，折叠） */}
          <Fold title="12 种选科组合专业覆盖率对照表" sub="2021 广东口径 · 覆盖率最高相差 60 个百分点">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[440px] border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-olive/15 text-left text-olive-mute">
                    <th className="py-1.5 pr-2 font-semibold">组合</th>
                    <th className="py-1.5 pr-2 text-center font-semibold">首选</th>
                    <th className="py-1.5 pr-2 text-right font-semibold">专业类覆盖率</th>
                    <th className="py-1.5 text-right font-semibold">全部专业覆盖率</th>
                  </tr>
                </thead>
                <tbody>
                  {COMBO_COVERAGE.map((c) => (
                    <tr key={c.combo} className="border-b border-olive/8 last:border-0">
                      <td className="py-1.5 pr-2 font-semibold text-olive">{c.combo}</td>
                      <td className="py-1.5 pr-2 text-center text-olive-soft">{c.first}</td>
                      <td className="py-1.5 pr-2 text-right text-olive-soft">{c.majorClassPct}%</td>
                      <td className={`py-1.5 text-right font-semibold ${c.majorPct >= 95 ? "text-lime" : c.majorPct >= 60 ? "text-sky" : "text-amber"}`}>{c.majorPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Fold>

          {/* 选科考虑因素清单（折叠） */}
          <Fold title="选科考虑因素清单（决策前逐项自问）">
            <div className="space-y-2">
              {CONSIDER_FACTORS.map((f) => (
                <div key={f.factor} className="rounded-lg bg-cream/60 px-3 py-2">
                  <p className="text-[12.5px] font-bold text-olive">{f.factor}</p>
                  <ul className="mt-1 space-y-0.5">
                    {f.points.map((p, i) => (
                      <li key={i} className="text-[12px] leading-relaxed text-olive-soft">· {p}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Fold>
        </div>
      )}

      <GroupDivider no="五" title="多元升学路径规划" />

      {/* 5.1 多元升学路径规划：路径适配 + 提前批介绍 */}
      {g.pathway.length > 0 && (
        <div className="paper-card p-5">
          <div className="flex items-center gap-2">
            <Route size={16} className="text-olive" />
            <h3 className="font-bold text-olive">5.1 多元升学路径规划</h3>
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

          {/* 5.1.1 提前批介绍（折叠） */}
          <Fold title="5.1.1 提前批志愿结构一览" sub="志愿没填好，多考 20 分也白搭">
            <div className="space-y-2">
              {EARLY_BATCH.map((e) => (
                <div key={e.name} className="rounded-lg bg-cream/60 px-3 py-2">
                  <div className="flex flex-wrap items-center justify-between gap-1.5">
                    <p className="text-[12.5px] font-bold text-olive">{e.name}</p>
                    <span className="rounded-full bg-olive/8 px-2 py-0.5 text-[10.5px] font-semibold text-olive-mute">{e.slots}</span>
                  </div>
                  <p className="mt-1 text-[12px] leading-relaxed text-olive-soft">{e.desc}</p>
                </div>
              ))}
            </div>
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-olive-mute">
              注：以上为广东新高考志愿结构示例（军检/非军检/教师专项/卫生专项等），各省批次设置以本省考试院当年文件为准。
            </p>
          </Fold>
        </div>
      )}

      {/* 5.2 多元升学目标院校规划（冲稳保） */}
      {g.schoolPlan && (
        <div className="paper-card p-5">
          <div className="flex items-center gap-2">
            <School size={16} className="text-olive" />
            <h3 className="font-bold text-olive">5.2 多元升学目标院校规划</h3>
            <span className="ml-auto rounded-full bg-lime-pale/70 px-2.5 py-0.5 text-[11.5px] font-bold text-olive">
              预估 {g.schoolPlan.estScore} 分 · {g.schoolPlan.first}类
            </span>
          </div>
          <p className="mt-1.5 text-[12px] leading-relaxed text-olive-mute">
            预估分 = 当前平均得分率 × 750（满分换算），当前档位：{g.schoolPlan.tier}。院校库按「冲一冲 / 稳一稳 / 保一保」三档列出：
          </p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
            <div className="rounded-xl border border-rose/40 bg-rose-50/60 p-3">
              <p className="text-[12.5px] font-bold text-rose">冲一冲</p>
              <ul className="mt-1.5 space-y-1">
                {g.schoolPlan.chong.map((s, i) => (
                  <li key={i} className="text-[12px] leading-relaxed text-olive-soft">· {s}</li>
                ))}
              </ul>
              {g.schoolPlan.chongNote && <p className="mt-2 text-[11.5px] leading-relaxed text-rose/90">{g.schoolPlan.chongNote}</p>}
            </div>
            <div className="rounded-xl border border-lime/50 bg-lime-pale/50 p-3">
              <p className="text-[12.5px] font-bold text-olive">稳一稳（主战场）</p>
              <ul className="mt-1.5 space-y-1">
                {g.schoolPlan.wen.map((s, i) => (
                  <li key={i} className="text-[12px] leading-relaxed text-olive-soft">· {s}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-sky/40 bg-sky-50/60 p-3">
              <p className="text-[12.5px] font-bold text-sky-700">保一保</p>
              <ul className="mt-1.5 space-y-1">
                {g.schoolPlan.bao.map((s, i) => (
                  <li key={i} className="text-[12px] leading-relaxed text-olive-soft">· {s}</li>
                ))}
              </ul>
              {g.schoolPlan.baoNote && <p className="mt-2 text-[11.5px] leading-relaxed text-sky-700/90">{g.schoolPlan.baoNote}</p>}
            </div>
          </div>
          <p className="mt-2.5 text-[11.5px] leading-relaxed text-olive-mute">
            院校库为 2023 年广东投档线口径示例，仅用于建立「冲稳保」概念；正式填报请以当年一分一段表与招生计划为准。
          </p>
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
