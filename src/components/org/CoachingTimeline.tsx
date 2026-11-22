import { useMemo, type ReactNode } from "react";
import { BookOpenCheck, CalendarDays, ClipboardCheck, Footprints } from "lucide-react";
import { parseGrowForm } from "./growPlan";
import type { CoachingDetail } from "./coachingTypes";

const COURSE_LABEL: Record<string, string> = { planning: "规划课", mindset: "心法课", method: "技法课", supervision: "督学课", parent: "亲子美言课" };
const SESSION_STATUS: Record<string, string> = { draft: "草稿", scheduled: "已排期", completed: "已完成", cancelled: "已取消" };
const SUPERVISION_STATUS: Record<string, string> = { draft: "草稿", done: "已完成", verified: "已验收", cancelled: "已取消" };
const COURSE_TARGET: Record<string, { target: number; unit: string }> = { planning: { target: 1, unit: "次" }, mindset: { target: 4, unit: "次" }, method: { target: 1, unit: "次" }, parent: { target: 1, unit: "期" }, supervision: { target: 4, unit: "次" } };

type DayEntry = { date: string; sessions: CoachingDetail["sessions"]; supervisions: CoachingDetail["supervisions"]; checkins: CoachingDetail["checkins"] };
const dayOf = (value: Date | string): string => new Date(value).toISOString().slice(0, 10);

/** 执行：服务时间线。到店/课堂/督学/日检验按天合并为一条时间线，带服务阶段标签，右侧五课课时累计。 */
export default function CoachingTimeline({ data, children }: { data: CoachingDetail; children?: ReactNode }) {
  const growForm = parseGrowForm(data.coachingCase.growForm);
  const serviceStart = new Date(data.coachingCase.serviceStart);
  const methodStarted = useMemo(() => data.sessions.some((session) => session.status === "completed" && session.units.some((unit) => unit.courseKey === "method")), [data.sessions]);
  const days = useMemo(() => {
    const map = new Map<string, DayEntry>();
    const entry = (date: string): DayEntry => { const hit = map.get(date); if (hit) return hit; const created: DayEntry = { date, sessions: [], supervisions: [], checkins: [] }; map.set(date, created); return created; };
    for (const session of data.sessions) entry(dayOf(session.startAt)).sessions.push(session);
    for (const record of data.supervisions) entry(dayOf(record.visitAt)).supervisions.push(record);
    for (const checkin of data.checkins) entry(checkin.checkDate).checkins.push(checkin);
    return [...map.values()].sort((a, b) => b.date.localeCompare(a.date));
  }, [data]);
  const counts = useMemo(() => {
    const map: Record<string, number> = { planning: 0, mindset: 0, method: 0, parent: 0, supervision: 0 };
    for (const session of data.sessions) { if (session.status !== "completed") continue; for (const unit of session.units) if (map[unit.courseKey] != null) map[unit.courseKey] += 1; }
    map.supervision = data.supervisions.filter((record) => record.status !== "cancelled" && record.status !== "draft").length;
    return map;
  }, [data]);

  const stageChip = (date: string): { label: string; cls: string } => {
    const months = Math.max(1, (new Date(date).getFullYear() - serviceStart.getFullYear()) * 12 + new Date(date).getMonth() - serviceStart.getMonth() + 1);
    if (methodStarted && new Date(date) >= serviceStart) return { label: `推进期 · 第 ${months} 月`, cls: "bg-[#EEF1FA] text-[#5265A7]" };
    if (months <= 2) return { label: `启动预热期 · 第 ${months} 月`, cls: "bg-[#EEF1FA] text-[#5265A7]" };
    return { label: `深化期 · 第 ${months} 月`, cls: "bg-[#EEF1FA] text-[#5265A7]" };
  };

  return <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
    <div className="min-w-0 space-y-4">
    <section className="rounded-2xl border border-[#E7E2D0] bg-white p-5 shadow-[0_1px_2px_rgba(69,80,58,.06)]" aria-label="服务时间线">
      <h3 className="flex items-center gap-1.5 text-[15px] font-bold text-olive"><Footprints size={16} className="text-[#0C7064]" />服务时间线<span className="text-[11px] font-normal text-olive-mute">每次到店一条：课堂＋督学＋日检验合并展示</span></h3>
      <div className="mt-4 space-y-5">
        {days.map((day) => { const stage = stageChip(day.date); const when = new Date(`${day.date}T00:00:00`); return <div key={day.date} className="relative border-l-2 border-[#0C7064]/20 pl-4">
          <span className="absolute -left-[5px] top-1 h-2 w-2 rounded-full bg-[#0C9B82]" />
          <div className="flex flex-wrap items-center gap-2 text-[12px]"><b className="text-olive">{when.toLocaleDateString("zh-CN", { month: "numeric", day: "numeric", weekday: "short" })}</b><span className={`rounded-full px-2 py-0.5 text-[10px] ${stage.cls}`}>{stage.label}</span></div>
          <div className="mt-2 space-y-2">
            {day.sessions.map((session) => <article key={`s${session.id}`} className="rounded-xl border border-border bg-cream/35 p-3 text-[12px]">
              <div className="flex flex-wrap items-center gap-2"><BookOpenCheck size={13} className="text-[#0C7064]" /><b className="text-olive">{new Date(session.startAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 课堂</b>
                {session.units.map((unit, index) => <span key={index} className="rounded-full bg-mint-pale px-2 py-0.5 text-[10.5px] font-semibold text-[#0C7064]">{COURSE_LABEL[unit.courseKey] ?? unit.courseKey} · {unit.title}</span>)}
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${session.status === "completed" ? "bg-mint-pale text-[#0C7064]" : session.status === "cancelled" ? "bg-gray-100 text-gray-500" : "bg-butter-pale text-olive"}`}>{SESSION_STATUS[session.status] ?? session.status}</span></div>
              {session.sharedSummary && <p className="mt-1.5 whitespace-pre-wrap text-[11.5px] leading-relaxed text-olive-soft">{session.sharedSummary}</p>}
              {session.participants.some((participant) => participant.participant.feedbackVersion > 0) && <p className="mt-1 text-[10.5px] text-[#0C7064]">当日家长反馈已推送</p>}
            </article>)}
            {day.supervisions.map((record) => <article key={`v${record.id}`} className="rounded-xl border border-border bg-cream/35 p-3 text-[12px]">
              <div className="flex flex-wrap items-center gap-2"><ClipboardCheck size={13} className="text-[#0C7064]" /><b className="text-olive">{new Date(record.visitAt).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 到店督学</b><span className="text-[10.5px] text-olive-mute">{record.mode === "direct" ? "纯督学" : "课堂＋督学"}</span>
                <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] ${record.status === "verified" || record.status === "done" ? "bg-mint-pale text-[#0C7064]" : record.status === "cancelled" ? "bg-gray-100 text-gray-500" : "bg-butter-pale text-olive"}`}>{SUPERVISION_STATUS[record.status] ?? record.status}</span></div>
              {record.exitCheck && <p className="mt-1.5 whitespace-pre-wrap text-[11.5px] leading-relaxed text-olive-soft"><b>离店验收：</b>{record.exitCheck}</p>}
            </article>)}
            {day.checkins.map((checkin) => <article key={`c${checkin.id}`} className="rounded-xl border border-border bg-cream/35 p-3 text-[12px]">
              <div className="flex flex-wrap items-center gap-2"><CalendarDays size={13} className="text-[#0C7064]" /><b className="text-olive">日检验 V{checkin.version}</b><span className="text-[10.5px] text-olive-mute">完成率 {checkin.completionRate}% · 正确率 {checkin.accuracyRate}%</span>
                {checkin.retestDate && <span className="rounded-full bg-butter-pale px-2 py-0.5 text-[10px] text-olive">复测日 {checkin.retestDate}</span>}</div>
            </article>)}
          </div>
        </div>; })}
        {!days.length && <p className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-[12px] text-olive-mute">还没有到店或课堂记录，用下方表单记第一次。</p>}
      </div>
    </section>
    {children}
    </div>

    <div className="space-y-3">
      <section className="rounded-2xl border border-[#E7E2D0] bg-white p-4 shadow-[0_1px_2px_rgba(69,80,58,.06)]" aria-label="五课课时累计">
        <h3 className="text-[13px] font-bold text-olive">五课课时累计</h3>
        <div className="mt-3 space-y-2.5 text-[11px]">
          {(["planning", "mindset", "supervision", "method", "parent"] as const).map((key) => { const count = counts[key]; const target = COURSE_TARGET[key]; const pct = Math.min(100, Math.round(count / target.target * 100)); return <div key={key}>
            <div className="flex justify-between"><span>{COURSE_LABEL[key]}</span><span className="text-olive-mute">{count} / {target.target} {target.unit}</span></div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-cream-deep/45"><div className="h-full rounded-full bg-[#0C9B82] transition-[width]" style={{ width: `${pct}%` }} /></div>
          </div>; })}
        </div>
      </section>
      {growForm && growForm.weekly.some((w) => w.item) && <section className="rounded-2xl border border-[#E7E2D0] bg-white p-4 shadow-[0_1px_2px_rgba(69,80,58,.06)]" aria-label="本周修正项">
        <h3 className="text-[13px] font-bold text-olive">本周修正项</h3>
        <div className="mt-3 space-y-2 text-[11.5px]">{growForm.weekly.filter((w) => w.item).slice(0, 6).map((w, index) => <div key={index} className="flex items-baseline gap-2"><span className="min-w-0 flex-1 text-olive-soft">· {w.item}</span>{w.metric && <span className="shrink-0 font-semibold text-[#0C7064]">{w.metric}</span>}</div>)}</div>
      </section>}
    </div>
  </div>;
}
