import { ArrowRight, ClipboardCheck, Compass, Target, TrendingUp } from "lucide-react";
import { COURSE_OUTLINE, parseGrowForm } from "./growPlan";
import { IcebergPanel } from "./CoachingV2Panels";
import { V4_BUTTON } from "./CoachingV4";
import type { CoachingDetail } from "./coachingTypes";

const EMPTY = "尚未记录";
const COURSE_KEYS: Record<string, string> = { 规划课: "planning", 心法课: "mindset", 技法课: "method", 督学课: "supervision", 亲子美言课: "parent" };

/** GROW 总览完全使用当前主档与真实交付记录；未开课、无测评、无验收均保留空态。 */
export default function GrowSnapshot({ data, onEdit, onOpenCoaching }: {
  data?: CoachingDetail;
  onEdit?: () => void;
  onOpenCoaching?: (caseId: number) => void;
}) {
  const growForm = parseGrowForm(data?.coachingCase.growForm);
  const profile = data?.planning.growProfiles[0];
  const goal = profile?.studentGoal || data?.coachingCase.goal || "";
  const situation = profile?.currentSituation || data?.coachingCase.currentSituation || "";
  const evidence = profile?.evidence || "";
  const plan = data?.coachingCase.planSummary || profile?.followUpActions || "";
  const tasks = data?.tasks ?? [];
  const verified = tasks.filter((task) => task.status === "verified").length;
  const rate = tasks.length ? Math.round(verified / tasks.length * 100) : 0;
  const latest = data?.events[0];
  const nextContact = profile?.nextContactAt ? new Date(profile.nextContactAt).toLocaleString("zh-CN") : "";
  const sessionCount = (key: string) => data?.sessions.filter((session) => session.status === "completed" || session.status === "done").reduce((sum, session) => sum + session.units.filter((unit) => unit.courseKey === key).length, 0) ?? 0;
  const deliveryCount = (key: string) => key === "supervision" ? data?.supervisions.filter((row) => row.status === "done" || row.status === "verified" || row.status === "completed").length ?? 0 : sessionCount(key);
  const completedPlans = data?.plans.filter((item) => item.status === "confirmed" && item.issuedAt).length ?? 0;
  return <div className="grid items-start gap-4 md:grid-cols-2" aria-label="GROW 伴学四象限">
    <GrowCard letter="G" title="明确目标" subtitle="目的 · 升学目标 · 学科目标" tone="green" icon={<Target size={16} />}>
      {growForm ? <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-1.5">{growForm.purpose.map((item) => <span key={item} className="rounded-full bg-[#E5EFE8] px-2.5 py-1 text-[10.5px] font-semibold text-[#0C7064]">{item}</span>)}{growForm.purposeNote && <span className="text-[11px] text-olive-soft">{growForm.purposeNote}</span>}</div>
        <Fact label="升学目标" value={growForm.targetSchool} strong />
        <div className="space-y-1.5">{growForm.subjects.filter((item) => item.name && (item.baseline != null || item.target != null)).map((item, index) => <div key={index} className="grid grid-cols-[64px_minmax(0,1fr)] gap-2 border-b border-[#F0EDE0] pb-1.5 text-[12px] last:border-0"><span className="text-olive-mute">{item.name}</span><span className="font-semibold text-olive">{item.baseline ?? "?"} <b className="mx-1 text-[#0C7064]">→</b> {item.target ?? "?"}</span></div>)}</div>
      </div> : <Fact label="学生目标" value={goal} strong />}
      <Fact label="家长期待" value={profile?.parentExpectation || ""} />
      {onEdit && <button type="button" onClick={onEdit} className={`${V4_BUTTON} mt-auto w-full`}>调整目标 <ArrowRight size={12} /></button>}
    </GrowCard>

    <GrowCard letter="R" title="评估现状" subtitle="E3 冰山模型 · 红黄绿" tone="blue" icon={<TrendingUp size={16} />}>
      {data && <IcebergPanel studentUserId={data.coachingCase.studentUserId} />}
      {!data?.e3Results.length && <p className="rounded-lg border border-dashed border-border bg-cream/40 px-3 py-2.5 text-[11px] text-olive-mute">暂无 V3.7 E3 结果，不生成冰山四维评价；可先记录真人观察。</p>}
      <Fact label="现状评估" value={situation} strong />
      <Fact label="事实证据" value={evidence} />
      {data?.reportAllowed === false ? <p className="rounded-lg bg-amber-50 px-2.5 py-2 text-[10.5px] text-amber-800">报告权限未开放或已到期，不以空列表代替测评结论。</p> : <p className="mt-auto pt-1 text-[10.5px] text-olive-mute">已关联 {data?.results.length ?? 0} 份可见测评结果</p>}
    </GrowCard>

    <GrowCard letter="O" title="定制计划" subtitle={`五大课课程设计 · ${completedPlans ? `${completedPlans} 份计划已会签` : "当前无已生效会签计划"}`} tone="amber" icon={<Compass size={16} />}>
      {growForm ? <div className="overflow-x-auto"><table className="w-full min-w-[590px] border-collapse text-left"><thead><tr className="border-b border-border text-[10.5px] text-olive-mute"><th className="px-2 py-2 font-semibold">课程</th><th className="px-2 py-2 font-semibold">目标</th><th className="px-2 py-2 font-semibold">频次</th><th className="px-2 py-2 font-semibold">形式</th><th className="px-2 py-2 font-semibold">真实状态</th></tr></thead><tbody>{COURSE_OUTLINE.map((course) => {
        const selected = growForm.courses.includes(course.course);
        const coursePlan = growForm.coursePlans.find((item) => item.course === course.course);
        const count = deliveryCount(COURSE_KEYS[course.course]);
        return <tr key={course.course} className={`border-b border-[#F0EDE0] last:border-0 ${selected ? "bg-[#E5EFE8]/35" : "opacity-65"}`}><td className="px-2 py-2.5 text-[11.5px] font-bold text-olive">{course.course}</td><td className="px-2 py-2.5 text-[11px] text-olive-soft">{course.goal}</td><td className="px-2 py-2.5 text-[11px] text-olive-soft">{selected ? coursePlan?.frequency || course.frequency : "—"}</td><td className="px-2 py-2.5 text-[11px] text-olive-soft">{selected ? coursePlan?.format || course.format : "—"}</td><td className="px-2 py-2.5"><span className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[10px] font-semibold ${count ? "bg-[#E5EFE8] text-[#0C7064]" : selected ? "bg-[#FAF0CC] text-[#8A6500]" : "bg-cream text-olive-mute"}`}>{count ? `已交付 ${count} 次` : selected ? "待首次交付" : "未纳入方案"}</span></td></tr>;
      })}</tbody></table></div> : <Fact label="方案摘要" value={plan} strong />}
      {growForm?.weekly.some((item) => item.item) && <p className="text-[11px] leading-relaxed text-olive-soft"><b>衡量：</b>{growForm.weekly.filter((item) => item.item).slice(0, 3).map((item) => `${item.item}${item.metric ? `（${item.metric}）` : ""}`).join(" ｜ ")}</p>}
      {onEdit && <button type="button" onClick={onEdit} className={`${V4_BUTTON} mt-auto w-full`}>打开课程设计 <ArrowRight size={12} /></button>}
    </GrowCard>

    <GrowCard letter="W" title="督学陪跑" subtitle="执行 · 跟进 · 复测闭环" tone="green" icon={<ClipboardCheck size={16} />} aside={<div className="text-right"><div className="text-[10px] text-olive-mute">任务验收率</div><b className="text-[22px] tabular-nums text-[#0C7064]">{tasks.length ? `${rate}%` : "—"}</b></div>}>
      <div className="h-2 rounded-full bg-cream"><div className="h-full rounded-full bg-[#0C9B82] transition-[width]" style={{ width: `${rate}%` }} /></div>
      <div className="grid grid-cols-4 gap-1.5 text-center text-[10px] text-olive-mute"><Metric value={data?.supervisions.length ?? 0} label="到店督学" /><Metric value={data?.sessions.length ?? 0} label="课堂记录" /><Metric value={tasks.length} label="行动任务" /><Metric value={verified} label="任务已验收" accent /></div>
      <p className="text-[10px] text-olive-mute">{tasks.length ? `验收率 ${rate}% ＝ 已验收 ${verified} ÷ 全部行动 ${tasks.length}` : "尚无行动任务，不计算验收率"}</p>
      <div className="space-y-1.5">{tasks.slice(0, 3).map((task) => <div key={task.id} className="flex items-center gap-2 text-[11px]"><span className={`rounded-full px-2 py-0.5 ${task.status === "verified" ? "bg-[#E9F3E6] text-[#2F7A41]" : "bg-[#FAF0CC] text-[#8A6500]"}`}>{task.status === "verified" ? "已验收" : "待验收"}</span><span className="min-w-0 flex-1 truncate text-olive-soft">{task.title}</span><span className="text-[10px] text-olive-mute">{task.dueDate}</span></div>)}{!tasks.length && <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-[11px] text-olive-mute">还没有行动任务，请先在规划页建立。</p>}</div>
      <Fact label="最近跟进" value={latest?.content || EMPTY} />
      {nextContact && <Fact label="下次跟进" value={nextContact} />}
      {data && onOpenCoaching && <button type="button" onClick={() => onOpenCoaching(data.coachingCase.id)} className={`${V4_BUTTON} mt-auto w-full`}>查看陪跑迁移说明 <ArrowRight size={12} /></button>}
    </GrowCard>
  </div>;
}

function GrowCard({ letter, title, subtitle, tone, icon, aside, children }: { letter: string; title: string; subtitle: string; tone: "green" | "blue" | "amber"; icon: React.ReactNode; aside?: React.ReactNode; children: React.ReactNode }) {
  const colors = { green: "bg-[#E5EFE8] text-[#0C7064]", blue: "bg-[#EEF1FA] text-[#5265A7]", amber: "bg-[#F5EBC9] text-[#9A7622]" }[tone];
  return <section className="flex min-w-0 flex-col rounded-2xl border border-[#E7E2D0] bg-white p-5 shadow-[0_1px_2px_rgba(69,80,58,.06)]"><header className="mb-3 flex items-center gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[16px] font-bold ${colors}`}>{letter}</span><div className="min-w-0 flex-1"><h3 className="flex items-center gap-1.5 text-[15px] font-bold text-olive">{title}<span className="text-olive-mute/45">{icon}</span></h3><p className="mt-0.5 text-[10.5px] text-olive-mute">{subtitle}</p></div>{aside}</header><div className="flex flex-1 flex-col gap-2.5">{children}</div></section>;
}
function Fact({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return <div className="grid grid-cols-[64px_minmax(0,1fr)] items-start gap-2 text-[11.5px] leading-relaxed"><span className="shrink-0 text-olive-mute">{label}</span><p className={`whitespace-pre-wrap break-words ${strong ? "font-semibold text-olive" : "text-olive-soft"} ${!value || value === EMPTY ? "font-normal text-olive-mute/70" : ""}`}>{value || EMPTY}</p></div>;
}
function Metric({ value, label, accent = false }: { value: number; label: string; accent?: boolean }) {
  return <div className={`rounded-lg p-2 ${accent ? "bg-[#E5EFE8]" : "bg-cream"}`}><b className={`block text-[16px] tabular-nums ${accent ? "text-[#0C7064]" : "text-olive"}`}>{value}</b>{label}</div>;
}
