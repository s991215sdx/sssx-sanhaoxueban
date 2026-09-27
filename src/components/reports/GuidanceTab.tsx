import { Compass, Flame, GraduationCap, Heart, Route, School, Star, Target, TrendingUp, Users } from "lucide-react";
import { buildGuidanceReport, PATHWAY_CATS } from "@/data/reports/guidance";
import type { GuidanceRecord } from "@/data/reports/guidance";
import { COMBO_COVERAGE, CONSIDER_FACTORS, EARLY_BATCH, SUBJECT_MAJOR_MAP } from "@/data/reports/guidanceData";
import { PATHWAY_XIAOXUE, PATHWAY_CHUZHONG, PATHWAY_GAOZHONG } from "@/data/reports/shengxueData";
import type { ReportAssessmentData, ReportProfileInfo } from "@/components/reports/ReportView";
import ScoreTrendChart from "@/components/reports/ScoreTrendChart";
import type { ScoreRecord } from "@/components/reports/ScoreTrendChart";
import FullPathwayMap from "@/components/reports/FullPathwayMap";
import DisciplineTreeChart from "@/components/reports/DisciplineTreeChart";
import ScorePathMatrix from "@/components/reports/ScorePathMatrix";
import { AnchorBars, HollandRadar, MbtiBars, Multi5Radar } from "@/components/reports/AssessCharts";
import DiscTendencyChart from "@/components/reports/DiscTendencyChart";
import { stageOfGrade } from "@contracts/constants";
import { MULTI5_DIM_LABEL } from "@contracts/multi5";
import type { Multi5Key } from "@contracts/multi5";
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
 * v77：升学指导综合报告 4.0——按学段自适应（小学/初中/高中三版）：
 * 高中 = 选科规划（图表化测评 + 12 门类图 + 三视角选科建议 + 平衡卡 + 分数段路径矩阵）；
 * 初中 = 学科优势与中考路径（全路径图），高中内容折叠参考；
 * 小学 = 兴趣能力启蒙与小升初路径（全路径图），初中/高中内容折叠参考。
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

  const stage = stageOfGrade(profile?.grade ?? "") ?? "高中";
  const isHigh = stage === "高中";
  const isPrimary = stage === "小学";

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

  /* ---- 渲染块（纯 JSX 返回，内部不用 hook，可安全条件调用） ---- */

  const renderAcademics = () =>
    g.academicsBlock && (
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
    );

  /** 4.1 自我探索：文字结论 + 各测评图表（v77 图表化）。 */
  const renderSelfExplore = (title: string, sub: string) =>
    hasSelfExplore && (
      <div className="paper-card p-5">
        <h3 className="font-bold text-olive">{title}</h3>
        <p className="mt-0.5 text-[12px] text-olive-mute">{sub}</p>

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
            {data?.holland && (
              <div className="mt-2 rounded-xl border border-olive/10 bg-cream/40 p-2">
                <HollandRadar result={data.holland} />
              </div>
            )}
            {g.anchorBlock && (
              <p className="mt-2 text-[12.5px] leading-relaxed text-olive-soft">
                职业锚主导：{g.anchorBlock.map((a) => `${a.label}（${a.score} 分，${a.workStyle}）`).join("；")}——择业时「想要什么」比「能做什么」更影响长期满意度。
              </p>
            )}
            {data?.anchor && (
              <div className="mt-2 rounded-xl border border-olive/10 bg-cream/40 p-2">
                <AnchorBars result={data.anchor} />
              </div>
            )}
          </div>
        )}

        {(g.mbtiBlock || g.discBlock) && (
          <div className={`mt-3 ${g.hollandBlock ? "border-t border-olive/10 pt-3" : ""}`}>
            <p className="flex items-center gap-1.5 text-[13px] font-bold text-olive">
              <Users size={14} className="text-sky" /> 性格与学习打法
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
                {data?.mbti && (
                  <div className="mt-2 rounded-xl border border-olive/10 bg-cream/40 p-2">
                    <MbtiBars result={data.mbti} />
                  </div>
                )}
              </div>
            )}
            {g.discBlock && (
              <div className="mt-2.5">
                <p className="text-[12.5px] font-bold text-olive">DISC · {g.discBlock.name}（主导 {g.discBlock.primary}）</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-olive-soft">{g.discBlock.roleStyle}</p>
                <p className="mt-1 text-[12.5px] leading-relaxed text-olive-mute">{g.discBlock.scene}</p>
                {data?.disc && (
                  <div className="mt-2">
                    <DiscTendencyChart dims={data.disc.dims} version={data.disc.version ?? undefined} />
                  </div>
                )}
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
            {data?.multi5 && (
              <div className="mt-2 rounded-xl border border-olive/10 bg-cream/40 p-2">
                <Multi5Radar result={data.multi5} />
              </div>
            )}
          </div>
        )}
      </div>
    );

  /** 4.2 学科 ↔ 专业对照（知识表，折叠）。 */
  const renderSubjectMajorFold = () => (
    <Fold title="高中学科 ↔ 大学专业对照表" sub="点开看每科对应的专业大类">
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
  );

  /** 4.3 本科专业规划：12 门类匹配 + 门类树图 + 推荐专业 + 行业。 */
  const renderMajorPlan = () =>
    (g.disciplines.length > 0 || g.majors.length > 0) && (
      <div>
        <div className="flex items-center gap-2">
          <GraduationCap size={16} className="text-olive" />
          <h3 className="font-bold text-olive">本科专业规划</h3>
        </div>

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
            <DisciplineTreeChart matches={g.disciplines.map((d) => ({ name: d.name, matchPct: d.matchPct }))} />
          </div>
        )}

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
    );

  /** 决策平衡卡表格（高中选科 / 初小学科参考通用）。 */
  const renderScorecard = () =>
    g.scorecard && (
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
    );

  /** 首选/再选决策（仅高中生成，非高中为 null 自动隐藏）。 */
  const renderFirstSecond = () => (
    <>
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
    </>
  );

  /** 兴趣 × 学业四象限。 */
  const renderQuadrant = () =>
    g.matrix && (
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
    );

  /** 推荐组合（高中=选科组合 / 初小=发力组合）。 */
  const renderCombos = () =>
    g.combos.length > 0 && (
      <div className="mt-3 border-t border-olive/10 pt-3">
        <p className="mb-2 flex items-center gap-1.5 text-[13px] font-bold text-olive">
          <Star size={14} className="text-amber" /> {isHigh ? "推荐选科组合（由决策平衡卡得分生成）" : "推荐发力组合（由成绩与测评生成）"}
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
    );

  /** v77：选科建议三视角（借鉴模板图1）——学生 / 家长 / 学校各看一面，再回填考虑因素。 */
  const renderThreePerspective = () => {
    const top3 = g.scorecard?.rows.slice(0, 3) ?? [];
    const best = top3[0];
    const pick = g.firstDecision?.pick ?? (best?.subject === "历史" ? "历史" : "物理");
    return (
      <div className="mt-3 border-t border-olive/10 pt-3">
        <p className="text-[13px] font-bold text-olive">选科建议（三视角对照）</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-olive-mute">同一个决定，学生看兴趣与学法、家长看专业与出路、学校看开班与师资——三面都问过再定。</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <div className="rounded-xl border border-lime/40 bg-lime-pale/50 p-3">
            <p className="text-[12.5px] font-bold text-olive">学生视角 · 我想不想学</p>
            <p className="mt-1 text-[12px] leading-relaxed text-olive-soft">
              {best ? `平衡卡前三：${top3.map((r) => r.subject).join("、")}。` : ""}首选倾向{pick}：跟着兴趣与成绩优势走，学得动才是根本——{g.combos[0] ? `建议组合 ${g.combos[0].title}` : "详见上方推荐组合"}。
            </p>
          </div>
          <div className="rounded-xl border border-sky/40 bg-sky-50/60 p-3">
            <p className="text-[12.5px] font-bold text-sky-700">家长视角 · 未来路宽不宽</p>
            <p className="mt-1 text-[12px] leading-relaxed text-olive-soft">
              {pick === "物理" ? "物理侧专业覆盖率 95% 上下，理工医农几乎全开门；但要确认孩子数理吃得消。" : "历史侧可选专业约四成，人文社科法学语言类是主场；若目标未定，先用「专业覆盖」表核一遍目标专业。"}再对照家庭条件看军警/公费/中外合作等定向路径。
            </p>
          </div>
          <div className="rounded-xl border border-amber/50 bg-amber-50/60 p-3">
            <p className="text-[12.5px] font-bold text-amber-700">学校视角 · 开不开班、教得好不好</p>
            <p className="mt-1 text-[12px] leading-relaxed text-olive-soft">
              先问本校目标组合的<b>开班情况与师资</b>，人数不足可能被要求改选；再看该组合历届成绩，别只看全省平均。
            </p>
          </div>
        </div>

        {/* 考虑因素 × 本人数据回填 */}
        <div className="mt-3 rounded-xl border border-olive/12 bg-cream/60 p-3">
          <p className="text-[12.5px] font-bold text-olive">考虑因素 × 你的数据</p>
          <div className="mt-1.5 space-y-1.5">
            {[
              { factor: "学科兴趣", fact: g.scorecard ? `兴趣维度最高：${[...g.scorecard.rows].sort((a, b) => b.interest - a.interest)[0].subject}` : "待测评补充" },
              { factor: "学业成绩", fact: g.academicsBlock?.avgPct != null ? `当前平均得分率 ${g.academicsBlock.avgPct}%` : "待录入成绩" },
              { factor: "能力匹配", fact: data?.multi5 ? `最强智能：${MULTI5_TOP_LABEL(data.multi5)}` : "待测多元智能" },
              { factor: "专业覆盖", fact: pick === "物理" ? "物理侧可报专业约 95%+" : "历史侧可报专业约 40%，先核目标专业" },
              { factor: "学校师资", fact: "需向学校确认目标组合开班情况（外部信息）" },
              { factor: "升学路径", fact: g.pathway.some((p) => p.fit === "适配") ? `已识别适配路径：${g.pathway.filter((p) => p.fit === "适配").map((p) => p.name).slice(0, 2).join("、")}` : "暂无硬性选科要求的路径触发" },
            ].map((x) => (
              <p key={x.factor} className="text-[12px] leading-relaxed text-olive-soft">
                <b className="text-olive">{x.factor}：</b>{x.fact}
              </p>
            ))}
          </div>
        </div>
      </div>
    );
  };

  /** 12 组合覆盖率 + 考虑因素清单（折叠知识表）。 */
  const renderCoverageFolds = () => (
    <>
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
    </>
  );

  /** 5.1 个性化路径清单 + 提前批结构（数据触发，高考口径）。 */
  const renderPathwayList = () =>
    g.pathway.length > 0 && (
      <div>
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
    );

  /** 5.2 冲稳保（仅高中有数据时渲染）。 */
  const renderSchoolPlan = () =>
    g.schoolPlan && (
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
        <ScorePathMatrix first={g.schoolPlan.first} estScore={g.schoolPlan.estScore} />
        <p className="mt-2.5 text-[11.5px] leading-relaxed text-olive-mute">
          院校库为 2023 年广东投档线口径示例，仅用于建立「冲稳保」概念；正式填报请以当年一分一段表与招生计划为准。
        </p>
      </div>
    );

  /** 高中内容折叠参考（初中/小学版用）：全路径 + 选科/专业/路径知识。 */
  const renderHighSchoolReference = () => (
    <Fold title="高中升学参考（高考路径 · 选科 · 专业）" sub="提前了解，不超前焦虑">
      <FullPathwayMap stages={PATHWAY_GAOZHONG} />
      {renderPathwayList()}
      {renderSubjectMajorFold()}
      {renderMajorPlan()}
      <div className="mt-3">
        <ScorePathMatrix first={g.firstDecision?.pick ?? "物理"} estScore={g.schoolPlan?.estScore ?? null} />
      </div>
      {renderCoverageFolds()}
    </Fold>
  );

  /* ---- 主流程 ---- */

  return (
    <div className="space-y-4">
      {/* 头卡 */}
      <div className="paper-card accent-l border-lime p-5">
        <div className="flex items-center gap-2">
          <Compass size={17} className="text-olive" />
          <h3 className="font-bold text-olive">升学指导综合报告（{stage}版）</h3>
        </div>
        <p className="mt-2 text-[15px] font-bold leading-relaxed text-olive">{g.headline}</p>
        <p className="mt-1 text-[13px] leading-relaxed text-olive-mute">
          基于 {g.basedOn.join("、")} 交叉分析
          {g.missing.length > 0 && <>；再补充 {g.missing.join("、")} 会更准</>}
          。{isHigh ? <>回答三个问题：<b className="text-olive">选什么科 · 学什么专业 · 走什么路径</b>。</> : <>聚焦当下：<b className="text-olive">强什么 · 怎么学 · 下一步怎么走</b>。</>}
        </p>
      </div>

      {renderAcademics()}

      <GroupDivider no="四" title={isHigh ? "个性化选科规划" : isPrimary ? "兴趣与能力启蒙" : "学科优势与学习能力"} />

      {/* 4.1 测评解读（全学段，含图表） */}
      {renderSelfExplore(
        isHigh ? "4.1 自我探索（测评解读）" : isPrimary ? "4.1 兴趣与能力启蒙（测评解读）" : "4.1 学科优势画像（测评解读）",
        isHigh
          ? "所有测评结论服务于同一个问题：我是谁，我适合怎么学、往哪走。"
          : isPrimary
            ? "小学阶段的测评看倾向、不看定论：兴趣和能力方向比分数更值得记住。"
            : "测评与成绩合起来看：兴趣在哪、能力底子在哪、哪些学科正在成为优势。",
      )}

      {/* 4.2-4.4：高中为主体；初小为学科方案 + 高中内容折叠参考 */}
      {isHigh ? (
        <>
          <div className="paper-card p-5">
            <h3 className="font-bold text-olive">4.2 高中学科与专业之间关系</h3>
            {renderSubjectMajorFold()}
          </div>

          {(g.disciplines.length > 0 || g.majors.length > 0) && (
            <div className="paper-card p-5">
              {renderMajorPlan()}
            </div>
          )}

          {(g.scorecard || g.matrix || g.combos.length > 0) && (
            <div className="paper-card p-5">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-olive" />
                <h3 className="font-bold text-olive">4.4 选科规划方案</h3>
              </div>
              {renderFirstSecond()}
              {renderScorecard()}
              {renderThreePerspective()}
              {renderQuadrant()}
              {renderCombos()}
              {renderCoverageFolds()}
            </div>
          )}
        </>
      ) : (
        <>
          {(g.scorecard || g.matrix || g.combos.length > 0) && (
            <div className="paper-card p-5">
              <div className="flex items-center gap-2">
                <Target size={16} className="text-olive" />
                <h3 className="font-bold text-olive">{isPrimary ? "4.2 学科平衡参考" : "4.2 学科发力方案"}</h3>
              </div>
              {renderScorecard()}
              {renderQuadrant()}
              {renderCombos()}
            </div>
          )}
          {renderHighSchoolReference()}
        </>
      )}

      <GroupDivider no="五" title={isHigh ? "多元升学路径规划" : "升学路径规划"} />

      {/* 5.1：全升学路径图（按学段） + 高中版附加个性化路径清单 */}
      <div className="paper-card p-5">
        <div className="flex items-center gap-2">
          <Route size={16} className="text-olive" />
          <h3 className="font-bold text-olive">
            5.1 {isPrimary ? "小升初及后续升学路径" : isHigh ? "多元升学路径规划" : "中考与初升高路径"}
          </h3>
        </div>
        <p className="mt-1 text-[12px] leading-relaxed text-olive-mute">
          {isPrimary
            ? "从小学到高中，每一段升学都有哪些主流走法——先建立全景图，再一步步走。"
            : isHigh
              ? "除裸分高考外，还有多条「数据已识别适配」的通道，全部与高考并行不冲突。"
              : "初中之后的两段路（中考 → 高考）主流走法一览："}
        </p>
        <FullPathwayMap stages={isPrimary ? PATHWAY_XIAOXUE : isHigh ? PATHWAY_GAOZHONG : PATHWAY_CHUZHONG} />
        {isHigh && renderPathwayList()}
      </div>

      {/* 5.2 冲稳保（仅高中） */}
      {renderSchoolPlan()}

      {/* 小学版：初中升学参考折叠 */}
      {isPrimary && (
        <Fold title="初中升学参考（中考路径 · 学科发力）" sub="升上初中后这些内容会自动变成主角">
          <FullPathwayMap stages={PATHWAY_CHUZHONG} />
          <p className="mt-2 text-[12px] leading-relaxed text-olive-mute">
            初中的核心三件事：稳住语数英基本盘、找到 1-2 门拳头科目、初二物理起步别掉队。到时本报告的「学科发力方案」会按中考口径重新生成。
          </p>
        </Fold>
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

/** 多元智能最强维度名（考虑因素回填用）。 */
function MULTI5_TOP_LABEL(r: NonNullable<ReportAssessmentData["multi5"]>): string {
  const entries = Object.entries(r.dims) as [Multi5Key, number][];
  entries.sort((a, b) => b[1] - a[1]);
  return entries.length > 0 ? MULTI5_DIM_LABEL[entries[0][0]] : "";
}
