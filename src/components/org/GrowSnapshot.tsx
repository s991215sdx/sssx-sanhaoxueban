import { ArrowRight, ClipboardCheck, Compass, Target, TrendingUp } from "lucide-react";
import { parseGrowForm } from "./growPlan";
import type { CoachingDetail } from "./coachingTypes";

const LEVEL: Record<string, string> = { term: "学期", month: "月", week: "周", day: "日" };
const EMPTY = "尚未记录";

/** 测评与陪跑共用的真实 GROW 摘要；没有事实时不生成评价或分数。 */
export default function GrowSnapshot({ data, onEdit, onOpenCoaching }: {
  data?: CoachingDetail;
  onEdit?: () => void;
  onOpenCoaching?: (caseId: number) => void;
}) {
  const growForm = parseGrowForm(data?.coachingCase.growForm);
  const profile = data?.planning.growProfiles[0];
  const goal = profile?.studentGoal || data?.coachingCase.goal || "";
  const parentGoal = profile?.parentExpectation || "";
  const situation = profile?.currentSituation || data?.coachingCase.currentSituation || "";
  const evidence = profile?.evidence || "";
  const plan = data?.coachingCase.planSummary || profile?.followUpActions || "";
  const tasks = data?.tasks ?? [];
  const verified = tasks.filter((task) => task.status === "verified").length;
  const rate = tasks.length ? Math.round(verified / tasks.length * 100) : 0;
  const latest = data?.events[0];
  const nextContact = profile?.nextContactAt ? new Date(profile.nextContactAt).toLocaleString("zh-CN") : "";
  return <div className="grid gap-4 md:grid-cols-2" aria-label="GROW 伴学四象限">
    <GrowCard letter="G" title="明确目标" subtitle="学生目标与家长期待分别呈现" tone="green" icon={<Target size={17} />}>
      {growForm ? <div className="space-y-2">
        {growForm.purpose.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-[10.5px] text-olive-mute">目的</span>{growForm.purpose.map((p) => <span key={p} className="rounded-full bg-mint-pale px-2 py-0.5 text-[10.5px] font-semibold text-[#0C7064]">{p}</span>)}{growForm.purposeNote && <span className="text-[10.5px] text-olive-soft">{growForm.purposeNote}</span>}</div>}
        {growForm.targetSchool && <div className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-2 text-[11.5px]"><span className="shrink-0 text-olive-mute">升学目标</span><b className="font-semibold text-olive">{growForm.targetSchool}</b></div>}
        {growForm.subjects.filter((s) => s.name && (s.baseline != null || s.target != null)).length > 0 && <div className="space-y-1">{growForm.subjects.filter((s) => s.name && (s.baseline != null || s.target != null)).slice(0, 5).map((s, index) => <div key={index} className="grid grid-cols-[48px_minmax(0,1fr)] gap-2 text-[11px]"><span className="text-olive-mute">{s.name}</span><span className="text-olive">{s.baseline ?? "?"} <b className="mx-1 text-[#0C7064]">→</b> {s.target ?? "?"}</span></div>)}</div>}
        {!growForm.purpose.length && !growForm.targetSchool && !growForm.subjects.length && <p className="text-[11px] text-olive-mute">{EMPTY}</p>}
      </div> : <Fact label="学生目标" value={goal} strong />}
      <Fact label="家长期待" value={parentGoal} />
      {profile && asSubjects(profile.targetSubjects).length > 0 && <div className="mt-3 space-y-2">{asSubjects(profile.targetSubjects).slice(0, 3).map((item, index) => <div key={index} className="grid grid-cols-[48px_minmax(0,1fr)] gap-2 text-[11px]"><span className="text-olive-mute">{item.subject}</span><span className="text-olive">{item.baseline} <b className="mx-1 text-[#0C7064]">→</b> {item.target}</span></div>)}</div>}
      <p className="mt-auto pt-3 text-[10.5px] text-olive-mute">目标须由伴学师与学生、家长分别核对</p>
    </GrowCard>
    <GrowCard letter="R" title="评估现状" subtitle="结论可追溯到具体事实与报告" tone="blue" icon={<TrendingUp size={17} />}>
      <Fact label="现状评估" value={situation} strong />
      <Fact label="事实证据" value={evidence} />
      {data?.reportAllowed === false ? <p className="mt-3 rounded-lg bg-amber-50 px-2.5 py-2 text-[10.5px] text-amber-800">报告权限未开放或已到期，不以空列表代替测评结论。</p> : <p className="mt-auto pt-3 text-[10.5px] text-olive-mute">已关联 {data?.results.length ?? 0} 份可见测评结果</p>}
    </GrowCard>
    <GrowCard letter="O" title="定制计划" subtitle="学期—月—周—日，措施经确认后执行" tone="amber" icon={<Compass size={17} />}>
      {growForm ? <div className="space-y-2">
        {growForm.courses.length > 0 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-[10.5px] text-olive-mute">策略·课程</span>{growForm.courses.map((c) => <span key={c} className="rounded-full bg-butter-pale px-2 py-0.5 text-[10.5px] font-semibold text-[#9A7622]">{c}</span>)}</div>}
        {growForm.strategyNote && <p className="text-[11px] leading-relaxed text-olive-soft">{growForm.strategyNote}</p>}
        {growForm.weekly.filter((w) => w.item).length > 0 && <div className="space-y-1"><span className="text-[10.5px] text-olive-mute">衡量·每周修正项</span>{growForm.weekly.filter((w) => w.item).slice(0, 4).map((w, index) => <div key={index} className="flex items-baseline gap-1.5 text-[11px]"><span className="min-w-0 flex-1 text-olive-soft">· {w.item}</span>{w.metric && <span className="shrink-0 font-semibold text-[#0C7064]">{w.metric}</span>}</div>)}</div>}
        {growForm.exams.filter((e) => e.name).length > 0 && <div className="space-y-1"><span className="text-[10.5px] text-olive-mute">衡量·大考成绩</span>{growForm.exams.filter((e) => e.name).slice(0, 3).map((e, index) => <div key={index} className="text-[11px] text-olive-soft">· {e.name}{e.date ? `（${e.date}）` : ""}：<b className="text-olive">{e.scores || "待记录"}</b></div>)}</div>}
        {!growForm.courses.length && !growForm.weekly.some((w) => w.item) && !growForm.exams.some((e) => e.name) && <p className="text-[11px] text-olive-mute">{EMPTY}</p>}
      </div> : <Fact label="方案摘要" value={plan} strong />}
      <div className="mt-3 space-y-1.5">{data?.plans.slice(0, 3).map((item) => <div key={item.id} className="flex items-center gap-2 rounded-lg bg-cream/60 px-2.5 py-2"><span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-butter-pale text-[10px] font-bold text-olive">{LEVEL[item.level] ?? item.level}</span><span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold text-olive">{item.title}</span><span className="text-[9.5px] text-olive-mute">{item.status === "confirmed" && item.issuedAt ? "已会签" : item.status === "awaiting_family" ? "待会签" : "草稿"}</span></div>)}{!data?.plans.length && <p className="rounded-lg border border-dashed border-border px-3 py-3 text-[11px] text-olive-mute">尚未建立四级计划</p>}</div>
      {onEdit && <button type="button" onClick={onEdit} className="mt-3 inline-flex min-h-9 items-center gap-1 rounded-lg border border-[#0C7064]/25 px-3 text-[11px] font-semibold text-[#0C7064]">调整目标与训练方案<ArrowRight size={12} /></button>}
    </GrowCard>
    <GrowCard letter="W" title="督学陪跑" subtitle="执行、跟进与复测形成闭环" tone="green" icon={<ClipboardCheck size={17} />}>
      <div className="flex items-end justify-between gap-3"><span className="text-[11.5px] text-olive-mute">行动任务验收率</span><b className="mono text-[24px] text-[#0C7064]">{tasks.length ? `${rate}%` : "—"}</b></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-cream-deep/45"><div className="h-full rounded-full bg-[#0C9B82] transition-[width]" style={{ width: `${rate}%` }} /></div>
      <div className="mt-3 grid grid-cols-3 gap-1.5 text-center text-[10px] text-olive-mute"><span className="rounded-lg bg-cream/50 p-2"><b className="block text-[15px] text-olive">{data?.supervisions.length ?? 0}</b>到店督学</span><span className="rounded-lg bg-cream/50 p-2"><b className="block text-[15px] text-olive">{data?.checkins.length ?? 0}</b>日检验</span><span className="rounded-lg bg-cream/50 p-2"><b className="block text-[15px] text-olive">{verified}/{tasks.length}</b>已验收</span></div>
      <Fact label="最近跟进" value={latest?.content || EMPTY} />
      {nextContact && <Fact label="下次跟进" value={nextContact} />}
      {data && onOpenCoaching && <button type="button" onClick={() => onOpenCoaching(data.coachingCase.id)} className="mt-3 inline-flex min-h-9 w-full items-center justify-center gap-1 rounded-lg bg-[#0C7064] px-3 text-[11px] font-semibold text-white">更新陪跑进度<ArrowRight size={12} /></button>}
    </GrowCard>
  </div>;
}

function GrowCard({ letter, title, subtitle, tone, icon, children }: { letter: string; title: string; subtitle: string; tone: "green" | "blue" | "amber"; icon: React.ReactNode; children: React.ReactNode }) {
  const colors = { green: "bg-mint-pale text-[#0C7064]", blue: "bg-[#EEF1FA] text-[#5265A7]", amber: "bg-butter-pale text-[#9A7622]" }[tone];
  return <section className="flex min-w-0 flex-col rounded-2xl border border-border bg-white p-4 shadow-sm sm:p-5"><header className="mb-4 flex items-center gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[17px] font-bold ${colors}`}>{letter}</span><div className="min-w-0 flex-1"><h3 className="flex items-center gap-1.5 text-[16px] font-bold text-olive">{title}<span className="text-olive-mute/45">{icon}</span></h3><p className="mt-0.5 text-[10.5px] text-olive-mute">{subtitle}</p></div></header><div className="flex flex-1 flex-col gap-2.5">{children}</div></section>;
}
function Fact({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-2 text-[11.5px] leading-relaxed"><span className="shrink-0 text-olive-mute">{label}</span><p className={`whitespace-pre-wrap break-words ${strong ? "font-semibold text-olive" : "text-olive-soft"} ${!value || value === EMPTY ? "font-normal text-olive-mute/70" : ""}`}>{value || EMPTY}</p></div>;
}
function asSubjects(value: unknown): { subject: string; baseline: string; target: string }[] {
  if (!Array.isArray(value)) return [];
  return value.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null).map((row) => ({ subject: String(row.subject ?? "学科"), baseline: String(row.baseline ?? "待记录"), target: String(row.target ?? "待记录") }));
}
